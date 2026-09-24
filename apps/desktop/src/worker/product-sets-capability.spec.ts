import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeGeneratedImagePrompts, parseJsonFromText, buildImagePromptGenerationPrompt } from './image-prompt'
import { expandPrompts, mainImageDescriptions } from './product-sets-capability'
import { getWorkerPrisma } from './worker-db'

const dirs: string[] = []
beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'psets-'))
  dirs.push(root)
  process.env.ECOMMERCE_DATA_ROOT = root
  mkdirSync(join(root, '.ecommerce', 'users', 'u1', 'config'), { recursive: true })
  writeFileSync(join(root, '.ecommerce', 'users', 'u1', 'config', 'ai-self.json'), JSON.stringify({ selfEnabled: true, providerType: 'openai-compatible', apiKey: 'k', baseUrl: 'https://example.invalid/v1', model: 'test' }))
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
})
afterEach(() => {
  delete process.env.ECOMMERCE_DATA_ROOT
  vi.restoreAllMocks()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('image prompt helpers', () => {
  it('parseJsonFromText tolerates code fence and trailing comma', () => {
    const parsed = parseJsonFromText('```json\n{"prompts":[{"id":"a","prompt":"x",}]}\n```')
    expect(parsed).toMatchObject({ prompts: [{ id: 'a', prompt: 'x' }] })
  })
  it('normalizeGeneratedImagePrompts aligns by slot id and filters empty', () => {
    const prompts = normalizeGeneratedImagePrompts(
      { prompts: [{ id: 's1', prompt: '图1提示词' }, { id: 's2', prompt: '' }] },
      [{ id: 's1', name: '图1｜白底图', type: '白底图', sequence: 1 }, { id: 's2', name: '图2｜场景图', type: '场景图', sequence: 2 }],
    )
    expect(prompts).toHaveLength(1)
    expect(prompts[0].id).toBe('s1')
    expect(prompts[0].prompt).toBe('图1提示词')
  })
  it('buildImagePromptGenerationPrompt contains all slot ids and json schema', () => {
    const prompt = buildImagePromptGenerationPrompt({ promptSlots: [{ id: 's1', name: '图1', type: '白底图', sequence: 1 }] })
    expect(prompt).toContain('"id": "s1"')
    expect(prompt).toContain('白底图')
  })
})

describe('expandPrompts streaming', () => {
  it('streams content chunks then returns accumulated text', async () => {
    const originalFetch = global.fetch
    global.fetch = (async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const enc = new TextEncoder()
            controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n'))
            controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"世界"}}]}\n\n'))
            controller.enqueue(enc.encode('data: [DONE]\n\n'))
            controller.close()
          },
        }),
        { status: 200 },
      )) as unknown as typeof fetch
    const events: Array<{ type: string; text?: string }> = []
    try {
      const result = await expandPrompts({ userId: 'u1', promptSlots: [{ id: 's1', name: '图1', type: '白底图', sequence: 1 }] }, (e) => events.push(e))
      expect(events.filter((e) => e.type === 'content')).toHaveLength(2)
      expect(result.text).toBe('你好世界')
      expect(events.at(-1)?.type).toBe('done')
    } finally {
      global.fetch = originalFetch
    }
  })
})

describe('mainImageDescriptions', () => {
  it('reads local AnalysisRun reportJson', async () => {
    const db = getWorkerPrisma()
    await db.analysisRun.create({
      data: {
        id: 'r1', tenantId: 't', jobId: 'j1', analysisType: 'price', status: 'success',
        reportJson: { summary: '本款定位高性价比', sellingPoints: [{ term: '无线' }, { term: '降噪' }], painPoints: ['延迟'], userDemands: ['低延迟'], opportunities: ['学生群体'] },
      },
    })
    const res = await mainImageDescriptions('r1')
    expect(res.source).toBe('ai')
    expect(res.sellingPoints).toEqual(['无线', '降噪'])
    expect(res.promptText).toContain('核心卖点：无线、降噪')
  })
})
