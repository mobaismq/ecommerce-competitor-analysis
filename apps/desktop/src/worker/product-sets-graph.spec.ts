import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { runProductSetGraph, type GenerationSlotGraph, type GeneratedAssetGraph } from './product-sets-graph'
import { generatePrompts } from './product-sets-capability'
import { PrismaCheckpointSaver } from './checkpoint-saver'
import { getWorkerPrisma } from './worker-db'

// 独立进程 + 单一临时库：prisma 是模块级单例，首次 getWorkerPrisma 即绑定当前 ECOMMERCE_DATA_ROOT，
// 故整份 spec 共用一个临时库（各测试用不同 threadId，互不干扰），不能在 beforeEach 里换 root。
let root = ''
let clean: () => void = () => {}
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'pset-graph-'))
  process.env.ECOMMERCE_DATA_ROOT = root
  mkdirSync(join(root, '.ecommerce'), { recursive: true })
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
  const dir = root
  clean = () => { rmSync(dir, { recursive: true, force: true }) }
})
afterAll(() => clean())

function makeSlots(count: number): GenerationSlotGraph[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `slot-${i + 1}`,
    name: `${String(i + 1).padStart(2, '0')} 图${i + 1}`,
    type: ['白底图', '场景图', '卖点图'][i] ?? '卖点图',
    typeKey: 'white',
    sequence: i + 1,
    prompt: '',
    status: 'idle' as const,
  }))
}

function fakeImageDep(overrides?: { url?: (slot: GenerationSlotGraph) => string; onGenerate?: (slot: GenerationSlotGraph) => void }) {
  return async ({ slot, jobId }: { slot: GenerationSlotGraph; jobId: string }): Promise<{ url: string; asset: GeneratedAssetGraph }> => {
    overrides?.onGenerate?.(slot)
    const url = overrides?.url?.(slot) ?? `data:image/png;base64,${slot.id}`
    return {
      url,
      asset: { id: `asset-${slot.id}`, url, originalName: slot.name, category: slot.type, prompt: slot.prompt, ratio: '1:1' },
    }
  }
}

function makeDeps(opts: { planError?: boolean; onGenerate?: (slot: GenerationSlotGraph) => void; abortSlotId?: string }) {
  return {
    checkpointer: new PrismaCheckpointSaver(),
    planPrompts: async (slots: GenerationSlotGraph[]): Promise<Record<string, string>> => {
      if (opts.planError) throw new Error('plan 失败')
      return Object.fromEntries(slots.map((s) => [s.id, `prompt-${s.id}`]))
    },
    generateImage: async ({ slot, jobId }: { slot: GenerationSlotGraph; jobId: string }) => {
      opts.onGenerate?.(slot)
      if (opts.abortSlotId && slot.id === opts.abortSlotId) {
        const err = new Error('基础设施崩溃') as Error & { code?: string }
        err.code = 'ABORT'
        throw err
      }
      return fakeImageDep()({ slot, jobId })
    },
  }
}

describe('productSets.graph.run (LangGraph 编排)', () => {
  it('recovers both truncated planning stages and dispatches all five image slots with matching prompts', async () => {
    const userId = 'vision-retry-user'
    const configDir = join(root, '.ecommerce', 'users', userId, 'config')
    mkdirSync(configDir, { recursive: true })
    writeFileSync(join(configDir, 'ai-default.json'), JSON.stringify({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'mock-only',
      visionModel: 'deepseek-flash',
      textModel: 'deepseek-v4-pro',
    }))
    const slots = makeSlots(5)
    const reply = (content: string | null, finishReason = 'stop') => new Response(JSON.stringify({
      choices: [{ finish_reason: finishReason, message: { content } }],
    }))
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected AI request'))
      .mockResolvedValueOnce(reply(null, 'length'))
      .mockResolvedValueOnce(reply(JSON.stringify({ product: '褐皮鲜梨', lockedFeatures: ['可见褐色果皮'] })))
      .mockResolvedValueOnce(reply('{"prompts":[', 'length'))
      .mockResolvedValueOnce(reply(JSON.stringify({
        prompts: slots.slice().reverse().map((slot) => ({ id: slot.id, prompt: `鲜梨画面 ${slot.id}` })),
      })))
    const generateImage = vi.fn(fakeImageDep())
    try {
      const result = await runProductSetGraph({
        checkpointer: new PrismaCheckpointSaver(),
        planPrompts: async (requested) => {
          const planned = await generatePrompts({
            userId,
            image: 'data:image/png;base64,AA==',
            information: '产品名称：褐皮鲜梨',
            reportText: '猫粮 · 冻干看得见',
            promptSlots: requested,
          })
          return Object.fromEntries(planned.prompts.map((item) => [item.id, item.prompt]))
        },
        generateImage,
      }, { slots }, { threadId: 'job-planning-retry' })

      expect(result.failedCount).toBe(0)
      expect(generateImage).toHaveBeenCalledTimes(5)
      expect(result.slots.map((slot) => slot.prompt)).toEqual(slots.map((slot) => `鲜梨画面 ${slot.id}`))
      expect(mockFetch).toHaveBeenCalledTimes(4)
      const [vision, visionRetry, plan, planRetry] = mockFetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
      for (const request of [vision, visionRetry, plan, planRetry]) {
        expect(request).toMatchObject({ thinking: { type: 'disabled' }, response_format: { type: 'json_object' } })
      }
      expect(visionRetry.max_tokens).toBeGreaterThan(vision.max_tokens)
      expect(planRetry.max_tokens).toBeGreaterThan(plan.max_tokens)
      expect(plan.messages[1].content).toContain('商品主体：褐皮鲜梨')
      expect(plan.messages[1].content).toContain('如果竞品报告与原图品类不同')
    } finally {
      mockFetch.mockRestore()
    }
  })

  it('全量成功：planPrompts → 逐图生成，所有 slot done，assets 落库并持久化 checkpoint', async () => {
    const emitted: Array<{ type: string; data?: Record<string, unknown> }> = []
    const result = await runProductSetGraph(
      makeDeps({}),
      { slots: makeSlots(3) },
      { threadId: 'job-full', emit: (e) => emitted.push(e) },
    )
    expect(result.ok).toBe(true)
    expect(result.failedCount).toBe(0)
    expect(result.slots.every((s) => s.status === 'done')).toBe(true)
    expect(result.assets).toHaveLength(3)
    // 流式节点事件
    expect(emitted.filter((e) => e.type === 'node')).toHaveLength(4) // 1 planPrompts + 3 generateImage
    expect(emitted.some((e) => e.data?.node === 'planPrompts')).toBe(true)
    expect(emitted.filter((e) => e.data?.node === 'generateImage')).toHaveLength(3)
    // checkpoint 已持久化
    const db = getWorkerPrisma()
    const cpCount = await db.langGraphCheckpoint.count({ where: { threadId: 'job-full' } })
    expect(cpCount).toBeGreaterThan(0)
  })

  it('部分失败：单个图位抛错只标 failed，其余照常 done，整图不中断', async () => {
    const deps = makeDeps({})
    deps.generateImage = async ({ slot, jobId }) => {
      if (slot.id === 'slot-2') throw new Error('图生图失败')
      return fakeImageDep()({ slot, jobId })
    }
    const events: Record<string, unknown>[] = []
    const result = await runProductSetGraph(deps, { slots: makeSlots(3) }, {
      threadId: 'job-partial',
      emit: ({ data }) => { if (data) events.push(data) },
    })
    expect(result.ok).toBe(true)
    expect(result.failedCount).toBe(1)
    expect(result.slots.find((s) => s.id === 'slot-2')?.status).toBe('failed')
    expect(result.slots.filter((s) => s.status === 'done')).toHaveLength(2)
    expect(events).toContainEqual(expect.objectContaining({ node: 'generateImage', slotId: 'slot-2', status: 'failed', prompt: 'prompt-slot-2' }))
  })

  it('never dispatches image jobs with missing prompts', async () => {
    const generateImage = vi.fn(fakeImageDep())
    await expect(runProductSetGraph({
      checkpointer: new PrismaCheckpointSaver(),
      planPrompts: async () => ({ 'slot-1': '已有提示词' }),
      generateImage,
    }, { slots: makeSlots(2) }, { threadId: 'job-missing-prompt' })).rejects.toThrow('主图提示词规划未覆盖全部图位')
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('断点续跑：ABORT 中止整图后，同 jobId 再次运行从 checkpoint 恢复补跑，最终全部 done', async () => {
    // 第一次运行：slot-2 触发 ABORT 中止（模拟进程/基础设施崩溃）
    let run1: unknown
    try {
      run1 = await runProductSetGraph(makeDeps({ abortSlotId: 'slot-2' }), { slots: makeSlots(3) }, { threadId: 'job-crash' })
    } catch {
      // ABORT 从中止的运行中冒出来，属预期
    }
    // 中止后的 checkpoint 已落库
    const db = getWorkerPrisma()
    const cpCountAfterAbort = await db.langGraphCheckpoint.count({ where: { threadId: 'job-crash' } })
    expect(cpCountAfterAbort).toBeGreaterThan(0)

    // 第二次运行：故障恢复，所有图位照常生成；同 jobId 从 checkpoint 续跑完成
    const run2 = await runProductSetGraph(makeDeps({}), { slots: makeSlots(3) }, { threadId: 'job-crash' })
    expect(run2.ok).toBe(true)
    expect(run2.failedCount).toBe(0)
    expect(run2.slots.every((s) => s.status === 'done')).toBe(true)
  })
})
