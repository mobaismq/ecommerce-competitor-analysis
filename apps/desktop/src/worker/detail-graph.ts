import { Annotation, Command, END, Send, START, StateGraph, type BaseCheckpointSaver } from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'

/**
 * 商品详情图批量生成的 LangGraph 编排。
 *
 * 详情图页是两阶段：先在 form 步经 generateDetailWorkflow（单次 LLM 调用）策划各模块提示词，
 * 用户可在 strategy 步审改提示词（人工介入点），再点「生成详情图」批量生成。因此：
 * - 规划阶段保持页内单次调用（含人工审改，暂不迁 interrupt()，留作后续 HITL 增强）。
 * - 本图只承接「批量生成」：dispatch 按模块 Send 扇出 → 每个 generateOne 图生图+落 GeneratedAsset。
 * 与 product-sets-graph 一致：逐模块 try/catch 部分失败不中断、ABORT 中止供 checkpoint 续跑、幂等跳过 done。
 */

export interface DetailModuleGraph {
  instanceId: string
  title: string
  key: string
  prompt: string
  status: 'idle' | 'generating' | 'done' | 'failed'
  imageUrl?: string
  error?: string
  sequence: number
}

export interface GeneratedAssetGraph {
  id: string
  url: string
  originalName: string
  category: string
  prompt: string
  ratio: string
  productName?: string
}

interface DetailGraphState {
  modules: DetailModuleGraph[]
  assets: GeneratedAssetGraph[]
  /** Send 分支载荷：当前要生成的那个模块（LangGraph 分支不继承父状态，故直接透传）。 */
  module?: DetailModuleGraph
}

/** 按 instanceId 合并 modules。 */
function mergeModules(left: DetailModuleGraph[], right: DetailModuleGraph[]): DetailModuleGraph[] {
  const map = new Map(left.map((m) => [m.instanceId, m]))
  for (const mod of right) map.set(mod.instanceId, { ...map.get(mod.instanceId), ...mod })
  return [...map.values()]
}

const DetailState = Annotation.Root({
  modules: Annotation<DetailModuleGraph[]>({
    reducer: mergeModules,
    default: () => [],
  }),
  assets: Annotation<GeneratedAssetGraph[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  module: Annotation<DetailModuleGraph | undefined>(),
})

export interface DetailGraphDeps {
  /** 生成单图并落库，返回展示 url + 落库资产元数据。闭包捕获 userId/tenantId/参考图/ratio。 */
  generateImage: (input: { module: DetailModuleGraph; jobId: string }) => Promise<{ url: string; asset: GeneratedAssetGraph }>
  checkpointer: BaseCheckpointSaver
}

export function buildDetailGraph(deps: DetailGraphDeps) {
  const dispatchNode = async (state: DetailGraphState) =>
    new Command({ goto: state.modules.map((m) => new Send('generateOne', { module: m })) })

  const generateOneNode = async (state: DetailGraphState, config: RunnableConfig) => {
    const module = state.module
    // 幂等：已生成的模块直接跳过，保证 checkpoint 恢复不重复落盘
    if (!module || module.status === 'done') return { modules: [], assets: [] }
    const jobId = String(config.configurable?.thread_id ?? '')
    try {
      const { url, asset } = await deps.generateImage({ module, jobId })
      return {
        modules: [{ ...module, status: 'done' as const, imageUrl: url, error: undefined }],
        assets: [asset],
      }
    } catch (err) {
      // 致命基础设施错误（code==='ABORT'）向上抛，中止整图以便 checkpoint 断点续跑；其余当作单模块失败。
      if ((err as { code?: string })?.code === 'ABORT') throw err
      return {
        modules: [{ ...module, status: 'failed' as const, error: err instanceof Error ? err.message : String(err) }],
      }
    }
  }

  return new StateGraph(DetailState)
    .addNode('dispatch', dispatchNode, { ends: ['generateOne'] })
    .addNode('generateOne', generateOneNode)
    .addEdge(START, 'dispatch')
    .addEdge('generateOne', END)
    .compile({ checkpointer: deps.checkpointer })
}

export interface DetailGraphRunOptions {
  threadId: string
  emit?: (event: { type: string; text?: string; data?: Record<string, unknown> }) => void
}

export interface DetailGraphResult {
  ok: boolean
  jobId: string
  modules: DetailModuleGraph[]
  assets: GeneratedAssetGraph[]
  failedCount: number
}

export async function runDetailGraph(
  deps: DetailGraphDeps,
  input: { modules: DetailModuleGraph[] },
  run: DetailGraphRunOptions,
): Promise<DetailGraphResult> {
  const graph = buildDetailGraph(deps)
  const jobId = run.threadId

  // graph.stream 是异步的，返回 Promise<IterableReadableStream>；config 与 streamMode 都在 options 里。
  const stream = await graph.stream(
    { modules: input.modules },
    { configurable: { thread_id: run.threadId }, streamMode: 'updates' },
  )
  for await (const step of stream) {
    if (!run.emit) continue
    for (const [node, update] of Object.entries(step)) {
      if (node !== 'generateOne') continue
      for (const u of Array.isArray(update) ? update : [update]) {
        const mod = (u as { modules?: DetailModuleGraph[] })?.modules?.[0]
        if (mod) {
          run.emit({
            type: 'node',
            data: { jobId, node: 'generateImage', instanceId: mod.instanceId, status: mod.status, imageUrl: mod.imageUrl, error: mod.error },
          })
        }
      }
    }
  }

  const snapshot = await graph.getState({ configurable: { thread_id: run.threadId } })
  const values = (snapshot?.values ?? {}) as DetailGraphState
  const modules = values.modules ?? []
  const assets = values.assets ?? []
  const failedCount = modules.filter((m) => m.status === 'failed').length
  run.emit?.({ type: 'done', text: '', data: { jobId, failedCount, moduleCount: modules.length } })
  return { ok: true, jobId, modules, assets, failedCount }
}
