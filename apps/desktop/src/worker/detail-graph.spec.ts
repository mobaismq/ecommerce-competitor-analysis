import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runDetailGraph, type DetailModuleGraph, type GeneratedAssetGraph } from './detail-graph'
import { PrismaCheckpointSaver } from './checkpoint-saver'
import { getWorkerPrisma } from './worker-db'

// 独立进程 + 单一临时库：prisma 是模块级单例，整份 spec 共用一个临时库（各测试用不同 threadId，互不干扰）。
let root = ''
let clean: () => void = () => {}
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'detail-graph-'))
  process.env.ECOMMERCE_DATA_ROOT = root
  mkdirSync(join(root, '.ecommerce'), { recursive: true })
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
  const dir = root
  clean = () => { rmSync(dir, { recursive: true, force: true }) }
})
afterAll(() => clean())

function makeModules(count: number): DetailModuleGraph[] {
  return Array.from({ length: count }, (_, i) => ({
    instanceId: `mod-${i + 1}`,
    title: ['首屏主视觉', '核心卖点图', '使用场景图'][i] ?? `模块${i + 1}`,
    key: 'hero_banner',
    prompt: `prompt-${i + 1}`,
    status: 'idle' as const,
    sequence: i + 1,
  }))
}

function fakeImageDep() {
  return async ({ module, jobId }: { module: DetailModuleGraph; jobId: string }): Promise<{ url: string; asset: GeneratedAssetGraph }> => {
    const url = `data:image/png;base64,${module.instanceId}`
    return { url, asset: { id: `asset-${module.instanceId}`, url, originalName: module.title, category: module.title, prompt: module.prompt, ratio: '1:1' } }
  }
}

function makeDeps(opts: { abortModuleId?: string; failModuleId?: string } = {}) {
  return {
    checkpointer: new PrismaCheckpointSaver(),
    generateImage: async ({ module, jobId }: { module: DetailModuleGraph; jobId: string }) => {
      if (opts.abortModuleId && module.instanceId === opts.abortModuleId) {
        const err = new Error('基础设施崩溃') as Error & { code?: string }
        err.code = 'ABORT'
        throw err
      }
      if (opts.failModuleId && module.instanceId === opts.failModuleId) throw new Error('图生图失败')
      return fakeImageDep()({ module, jobId })
    },
  }
}

describe('productSets.detailGraph.run (LangGraph 编排)', () => {
  it('批量生成全量成功：dispatch 扇出逐模块生成，所有模块 done，assets 落库并持久化 checkpoint', async () => {
    const emitted: Array<{ type: string; data?: Record<string, unknown> }> = []
    const result = await runDetailGraph(makeDeps(), { modules: makeModules(3) }, { threadId: 'djob-full', emit: (e) => emitted.push(e) })
    expect(result.ok).toBe(true)
    expect(result.failedCount).toBe(0)
    expect(result.modules.every((m) => m.status === 'done')).toBe(true)
    expect(result.assets).toHaveLength(3)
    expect(emitted.filter((e) => e.data?.node === 'generateImage')).toHaveLength(3)
    const db = getWorkerPrisma()
    const cpCount = await db.langGraphCheckpoint.count({ where: { threadId: 'djob-full' } })
    expect(cpCount).toBeGreaterThan(0)
  })

  it('部分失败：单个模块抛错只标 failed，其余照常 done，整图不中断', async () => {
    const result = await runDetailGraph(makeDeps({ failModuleId: 'mod-2' }), { modules: makeModules(3) }, { threadId: 'djob-partial' })
    expect(result.ok).toBe(true)
    expect(result.failedCount).toBe(1)
    expect(result.modules.find((m) => m.instanceId === 'mod-2')?.status).toBe('failed')
    expect(result.modules.filter((m) => m.status === 'done')).toHaveLength(2)
  })

  it('断点续跑：ABORT 中止整图后，同 jobId 再次运行从 checkpoint 恢复补跑，最终全部 done', async () => {
    try {
      await runDetailGraph(makeDeps({ abortModuleId: 'mod-2' }), { modules: makeModules(3) }, { threadId: 'djob-crash' })
    } catch {
      // ABORT 从中止的运行中冒出来，属预期
    }
    const db = getWorkerPrisma()
    expect(await db.langGraphCheckpoint.count({ where: { threadId: 'djob-crash' } })).toBeGreaterThan(0)
    const run2 = await runDetailGraph(makeDeps(), { modules: makeModules(3) }, { threadId: 'djob-crash' })
    expect(run2.ok).toBe(true)
    expect(run2.failedCount).toBe(0)
    expect(run2.modules.every((m) => m.status === 'done')).toBe(true)
  })
})
