import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeGeneratedImagePrompts, parseJsonFromText, buildImagePromptGenerationPrompt } from './image-prompt'
import { expandPrompts, generateDetailWorkflow, generatePrompts, mainImageDescriptions } from './product-sets-capability'
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
      const result = await expandPrompts({ userId: 'u1', image: 'data:image/png;base64,AA==', promptSlots: [{ id: 's1', name: '图1', type: '白底图', sequence: 1 }] }, (e) => events.push(e))
      expect(events.filter((e) => e.type === 'content')).toHaveLength(2)
      expect(events.filter((e) => e.type === 'content').map((e) => e.text)).toEqual(['你好', '世界'])
      expect(result.text).toBe('你好世界')
      expect(events.at(-1)?.type).toBe('done')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('streams the product image with optional user content and returns only the five product fields', async () => {
    const originalFetch = global.fetch
    let sentBody = ''
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      sentBody = String(init?.body ?? '')
      return new Response(
        new ReadableStream({
          start(controller) {
            const enc = new TextEncoder()
            controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"1.产品名称：测试裙\\n2.核心卖点：A"}}]}\n\n'))
            controller.enqueue(enc.encode('data: [DONE]\n\n'))
            controller.close()
          },
        }),
        { status: 200 },
      )
    }) as unknown as typeof fetch
    try {
      await expandPrompts({ userId: 'u1', image: 'data:image/png;base64,AA==', information: '', settings: { platform: '淘宝', country: '中国', language: '中文', ratio: '1:1' } }, () => undefined)
      expect(sentBody).toContain('"image_url"')
      expect(sentBody).toContain('data:image/png;base64,AA==')
      expect(sentBody).toContain('1.产品名称')
      expect(sentBody).toContain('2.核心卖点')
      expect(sentBody).toContain('3.适用人群')
      expect(sentBody).toContain('4.期望场景')
      expect(sentBody).toContain('5.具体参数')
      expect(sentBody).toContain('用户未填写内容')
      expect(sentBody).toContain('商品原图为准')
      expect(sentBody).not.toContain('"prompts"')
      expect(sentBody).not.toContain('完整图生图提示词')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('requires a product image before starting AI help', async () => {
    await expect(expandPrompts({ userId: 'u1', information: '灰色毛衣' }, () => undefined)).rejects.toThrow('请先上传商品原图')
  })
})

describe('product visual grounding', () => {
  it('uses original-image visual facts as the highest-priority prompt constraint', async () => {
    const originalFetch = global.fetch
    const requestBodies: string[] = []
    let requestCount = 0
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      requestBodies.push(String(init?.body ?? ''))
      requestCount += 1
      if (requestCount === 1) {
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ product: '深棕色褶皱无袖上衣', lockedFeatures: ['颜色：深棕色', '袖型：无袖', '纹理：纵向褶皱'] }) } }],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ prompts: [{ id: 's1', prompt: '深棕色褶皱无袖上衣白底图' }] }) } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    try {
      const result = await generatePrompts({
        userId: 'u1',
        image: 'data:image/png;base64,AA==',
        information: '经典圆领休闲风上衣',
        promptSlots: [{ id: 's1', name: '图1｜白底图', type: '白底图', sequence: 1 }],
      })
      expect(result.prompts).toEqual([expect.objectContaining({ id: 's1', prompt: '深棕色褶皱无袖上衣白底图' })])
      expect(requestBodies[0]).toContain('image_url')
      expect(requestBodies[1]).toContain('商品原图视觉事实（最高优先级）')
      expect(requestBodies[1]).toContain('深棕色')
      expect(requestBodies[1]).toContain('无袖')
      expect(requestBodies[1]).toContain('纵向褶皱')
      expect(requestBodies[1]).toContain('与《信息整理补全》或《主图设计规划》冲突时')
    } finally {
      global.fetch = originalFetch
    }
  })
})

describe('detail planning workflow', () => {
  it('returns a separate read-only design plan and generates prompts from it', async () => {
    const originalFetch = global.fetch
    const requestBodies: string[] = []
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      requestBodies.push(String(init?.body ?? ''))
      const content = requestBodies.length === 1
        ? JSON.stringify({ product: '蓝色无线耳机', lockedFeatures: ['颜色：蓝色'] })
        : requestBodies.length === 2
          ? '详情页总规划：蓝色耳机，深蓝视觉系统。\n首屏主视觉：突出降噪体验。'
          : JSON.stringify({ prompts: [{ id: 'detail-1-首屏主视觉', name: '01 首屏主视觉', type: '首屏主视觉', prompt: '蓝色耳机首屏主视觉提示词' }] })
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
    try {
      const result = await generateDetailWorkflow({
        userId: 'u1',
        image: 'data:image/png;base64,AA==',
        baseText: '蓝色无线耳机',
        promptSlots: ['首屏主视觉'],
      })
      expect(result.designPlan).toContain('详情页总规划')
      expect(result.data).toEqual([expect.objectContaining({ type: '首屏主视觉', prompt: '蓝色耳机首屏主视觉提示词' })])
      expect(requestBodies).toHaveLength(3)
      expect(requestBodies[0]).toContain('image_url')
      expect(requestBodies[1]).toContain('商品原图视觉事实')
      expect(requestBodies[2]).toContain('深蓝视觉系统')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('retries an empty planning response with more output tokens before generating prompts', async () => {
    const originalFetch = global.fetch
    const requests: Array<{ max_tokens?: number }> = []
    global.fetch = (async (_url: unknown, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body ?? '{}')) as { max_tokens?: number })
      const content = requests.length === 1
        ? JSON.stringify({ product: '蓝色无线耳机', lockedFeatures: ['颜色：蓝色'] })
        : requests.length === 2
          ? ''
          : requests.length === 3
            ? '详情页总规划：蓝色耳机，深蓝视觉系统。'
            : JSON.stringify({ prompts: [{ id: 'detail-1-首屏主视觉', name: '01 首屏主视觉', type: '首屏主视觉', prompt: '蓝色耳机首屏提示词' }] })
      return new Response(JSON.stringify({ choices: [{ finish_reason: requests.length === 2 ? 'length' : 'stop', message: { content } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
    try {
      const result = await generateDetailWorkflow({
        userId: 'u1',
        image: 'data:image/png;base64,AA==',
        promptSlots: ['首屏主视觉'],
      })
      expect(result.designPlan).toContain('详情页总规划')
      expect(result.data).toHaveLength(1)
      expect(requests).toHaveLength(4)
      expect(requests[1].max_tokens).toBe(6000)
      expect(requests[2].max_tokens).toBe(8000)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('reports output exhaustion only after both planning attempts return empty', async () => {
    const originalFetch = global.fetch
    let requests = 0
    global.fetch = (async () => {
      requests += 1
      const content = requests === 1
        ? JSON.stringify({ product: '蓝色无线耳机', lockedFeatures: ['颜色：蓝色'] })
        : ''
      return new Response(JSON.stringify({ choices: [{ finish_reason: requests === 1 ? 'stop' : 'length', message: { content } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
    try {
      await expect(generateDetailWorkflow({
        userId: 'u1',
        image: 'data:image/png;base64,AA==',
        promptSlots: ['首屏主视觉'],
      })).rejects.toThrow('模型输出长度已耗尽')
      expect(requests).toBe(3)
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
