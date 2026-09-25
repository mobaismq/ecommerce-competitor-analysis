import { Annotation, Command, END, Send, START, StateGraph, type BaseCheckpointSaver } from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'

/**
 * 商品主图套图生成的 LangGraph 编排。
 *
 * 工作流：planPrompts（LLM 策划各图位提示词）→ 用 Send 动态扇出逐图 generateOne（图生图 + 落 GeneratedAsset）。
 * - 逐图节点内 try/catch：单个图位失败只标 failed，不中断其余（部分失败）。
 * - 节点幂等（done 的 slot 直接跳过），配合 checkpoint 实现崩溃后同 jobId 续跑不重复落盘。
 * - 用 graph.stream(..., { streamMode: 'updates' }) 产出节点级进度，由调用方转发为 IPC 流事件。
 *
 * 状态刻意保持最小（slots/assets/slotId）：参考图、设置、报告文本等走 deps 闭包注入，避免大对象进 checkpoint。
 */

export interface GenerationSlotGraph {
  id: string
  name: string
  type: string
  typeKey: string
  sequence: number
  prompt: string
  status: 'idle' | 'generating' | 'done' | 'failed'
  imageUrl?: string
  error?: string
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

interface ProductSetGraphState {
  slots: GenerationSlotGraph[]
  assets: GeneratedAssetGraph[]
  /** Send 分支载荷：当前要生成的那个 slot（LangGraph 分支不继承父状态，故直接透传）。 */
  slot?: GenerationSlotGraph
}

/** 按 id 合并 slots（planPrompts 全量替换 / generateOne 单元素合并均走同一 reducer）。 */
function mergeSlots(left: GenerationSlotGraph[], right: GenerationSlotGraph[]): GenerationSlotGraph[] {
  const map = new Map(left.map((s) => [s.id, s]))
  for (const slot of right) map.set(slot.id, { ...map.get(slot.id), ...slot })
  return [...map.values()]
}

const ProductSetState = Annotation.Root({
  slots: Annotation<GenerationSlotGraph[]>({
    reducer: mergeSlots,
    default: () => [],
  }),
  assets: Annotation<GeneratedAssetGraph[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  slot: Annotation<GenerationSlotGraph | undefined>(),
})

export interface ProductSetGraphDeps {
  /** 返回 slotId -> 提示词映射。闭包捕获 userId/settings/baseText/reportText/information。 */
  planPrompts: (slots: GenerationSlotGraph[]) => Promise<Record<string, string>>
  /** 生成单图并落库，返回展示 url + 落库资产元数据。闭包捕获 userId/tenantId/参考图/productName/ratio。 */
  generateImage: (input: { slot: GenerationSlotGraph; jobId: string }) => Promise<{ url: string; asset: GeneratedAssetGraph }>
  checkpointer: BaseCheckpointSaver
}

export function buildProductSetGraph(deps: ProductSetGraphDeps) {
  const planPromptsNode = async (state: ProductSetGraphState) => {
    const prompts = await deps.planPrompts(state.slots)
    const plannedSlots = state.slots.map((s) => ({ ...s, prompt: prompts[s.id] ?? s.prompt }))
    return new Command({
      update: { slots: plannedSlots },
      goto: plannedSlots.map((s) => new Send('generateOne', { slot: s })),
    })
  }

  const generateOneNode = async (state: ProductSetGraphState, config: RunnableConfig) => {
    const slot = state.slot
    // 幂等：已生成的 slot 直接跳过，保证 checkpoint 恢复不重复落盘
    if (!slot || slot.status === 'done') return { slots: [], assets: [] }
    const jobId = String(config.configurable?.thread_id ?? '')
    try {
      const { url, asset } = await deps.generateImage({ slot, jobId })
      return {
        slots: [{ ...slot, status: 'done' as const, imageUrl: url, error: undefined }],
        assets: [asset],
      }
    } catch (err) {
      // 致命基础设施错误（code==='ABORT'）向上抛，中止整图以便 checkpoint 断点续跑；其余当作单图失败。
      if ((err as { code?: string })?.code === 'ABORT') throw err
      return {
        slots: [{ ...slot, status: 'failed' as const, error: err instanceof Error ? err.message : String(err) }],
      }
    }
  }

  return new StateGraph(ProductSetState)
    .addNode('planPrompts', planPromptsNode, { ends: ['generateOne'] })
    .addNode('generateOne', generateOneNode)
    .addEdge(START, 'planPrompts')
    .addEdge('generateOne', END)
    .compile({ checkpointer: deps.checkpointer })
}

export interface ProductSetGraphRunOptions {
  threadId: string
  emit?: (event: { type: string; text?: string; data?: Record<string, unknown> }) => void
}

export interface ProductSetGraphResult {
  ok: boolean
  jobId: string
  slots: GenerationSlotGraph[]
  assets: GeneratedAssetGraph[]
  failedCount: number
}

export async function runProductSetGraph(
  deps: ProductSetGraphDeps,
  input: { slots: GenerationSlotGraph[] },
  run: ProductSetGraphRunOptions,
): Promise<ProductSetGraphResult> {
  const graph = buildProductSetGraph(deps)
  const config = { configurable: { thread_id: run.threadId } }
  const jobId = run.threadId

  // graph.stream 是异步的，返回 Promise<IterableReadableStream>；config 与 streamMode 都在 options 里。
  const stream = await graph.stream({ slots: input.slots }, { configurable: { thread_id: run.threadId }, streamMode: 'updates' })
  for await (const step of stream) {
    if (!run.emit) continue
    for (const [node, update] of Object.entries(step)) {
      if (node === 'planPrompts') {
        run.emit({ type: 'node', data: { jobId, node: 'planPrompts', status: 'done' } })
      } else if (node === 'generateOne') {
        for (const u of Array.isArray(update) ? update : [update]) {
          const slot = (u as { slots?: GenerationSlotGraph[] })?.slots?.[0]
          if (slot) {
            run.emit({
              type: 'node',
              data: { jobId, node: 'generateImage', slotId: slot.id, status: slot.status, imageUrl: slot.imageUrl, error: slot.error },
            })
          }
        }
      }
    }
  }

  const snapshot = await graph.getState(config)
  const values = (snapshot?.values ?? {}) as ProductSetGraphState
  const slots = values.slots ?? []
  const assets = values.assets ?? []
  const failedCount = slots.filter((s) => s.status === 'failed').length
  run.emit?.({ type: 'done', text: '', data: { jobId, failedCount, slotCount: slots.length } })
  return { ok: true, jobId, slots, assets, failedCount }
}
