import { OpenAICompatibleProvider } from './openai-compatible.provider'
import { AiCallError } from '../ai.types'

describe('OpenAICompatibleProvider (原生 fetch 替换 ky)', () => {
  let provider: OpenAICompatibleProvider
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    provider = new OpenAICompatibleProvider({ apiKey: 'test-key', model: 'gpt-4o-mini', timeoutMs: 1000 })
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.useRealTimers()
  })

  it('generateText: 成功请求返回文本与用量', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '分析结论' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
    } as any)

    const result = await provider.generateText({ prompt: '请分析' })
    expect(result.status).toBe('success')
    expect(result.text).toBe('分析结论')
    expect(result.tokenIn).toBe(10)
    expect(result.tokenOut).toBe(5)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({ method: 'POST', body: expect.any(String) }),
    )
  })

  it('HTTP 5xx 抛 PROVIDER_HTTP_ERROR 且 retriable=true', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: 'server down' } }),
    } as any)

    await expect(provider.generateText({ prompt: 'x' })).rejects.toMatchObject({
      code: 'PROVIDER_HTTP_ERROR',
      retryable: true,
    })
  })

  it('HTTP 429 抛 PROVIDER_HTTP_ERROR 且 retriable=false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { message: 'rate limited' } }),
    } as any)

    await expect(provider.generateText({ prompt: 'x' })).rejects.toMatchObject({
      code: 'PROVIDER_HTTP_ERROR',
      retryable: false,
    })
  })

  it('abort（连接）抛 PROVIDER_TIMEOUT 且 retryable=true', async () => {
    global.fetch = jest.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'))

    await expect(provider.generateText({ prompt: 'x' })).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT',
      retryable: true,
    })
  })

  it('body 读取阶段超时抛 PROVIDER_TIMEOUT', async () => {
    global.fetch = jest.fn().mockImplementation(async (_url: string, options: any) => {
      const signal = options.signal as AbortSignal
      const json = () =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted', 'AbortError')))
        })
      return { ok: true, status: 200, json } as any
    })

    // timeoutMs=1000，body 读取悬停时真实 timer 到点 abort → json() reject → 判为超时
    const err = await provider.generateText({ prompt: 'x' }).then(
      () => 'resolved',
      (e) => e,
    )

    expect(err).toMatchObject({ code: 'PROVIDER_TIMEOUT', retryable: true })
  })

  it('body 读取解析失败(非 abort)时回落空 payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('invalid json')),
    } as any)

    const result = await provider.generateText({ prompt: 'x' })
    expect(result.text).toBe('{}')
  })

  it('网络错误抛 PROVIDER_NETWORK_ERROR', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'))

    await expect(provider.generateText({ prompt: 'x' })).rejects.toBeInstanceOf(AiCallError)
  })
})

describe('OpenAICompatibleProvider.generateImage（图生图参考图回迁）', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('openrouter /images 端点：带参考图时组装 input_references + aspect_ratio + quality', async () => {
    let captured: { url: string; body: Record<string, unknown> } | undefined
    global.fetch = (async (url: unknown, init: unknown) => {
      captured = { url: String(url), body: JSON.parse((init as RequestInit).body as string) }
      return { ok: true, status: 200, json: async () => ({ data: [{ url: 'https://cdn/1.png' }] }) }
    }) as unknown as typeof fetch

    const provider = new OpenAICompatibleProvider({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'key',
      model: 'openai/gpt-image-2',
      imageEndpoint: 'images',
    })
    const result = await provider.generateImage({
      prompt: '主图',
      // 去重/上限 4 张由 service 层 normalizeReferenceImages 保证，provider 1:1 映射
      referenceImageUrls: ['https://ref/1.png', 'https://ref/2.png'],
      aspectRatio: '1:1',
    })

    expect(captured?.url).toBe('https://openrouter.ai/api/v1/images')
    expect(captured?.body).toMatchObject({
      model: 'openai/gpt-image-2',
      prompt: '主图',
      n: 1,
      quality: 'low',
      aspect_ratio: '1:1',
    })
    expect(captured?.body.input_references).toEqual([
      { type: 'image_url', image_url: { url: 'https://ref/1.png' } },
      { type: 'image_url', image_url: { url: 'https://ref/2.png' } },
    ])
    expect(result.images).toEqual(['https://cdn/1.png'])
  })

  it('openrouter /images 端点：无参考图时不带 input_references，仍发 quality', async () => {
    let captured: { url: string; body: Record<string, unknown> } | undefined
    global.fetch = (async (url: unknown, init: unknown) => {
      captured = { url: String(url), body: JSON.parse((init as RequestInit).body as string) }
      return { ok: true, status: 200, json: async () => ({ data: [{ url: 'https://cdn/a.png' }] }) }
    }) as unknown as typeof fetch

    const provider = new OpenAICompatibleProvider({ baseUrl: 'https://openrouter.ai/api/v1', imageEndpoint: 'images' })
    const result = await provider.generateImage({ prompt: 'p' })
    expect(captured?.url).toBe('https://openrouter.ai/api/v1/images')
    expect(captured?.body.input_references).toBeUndefined()
    expect(captured?.body.quality).toBe('low')
    expect(result.images).toEqual(['https://cdn/a.png'])
  })

  it('普通 images/generations 端点：无参考图时保持原文本生图（size 参数，不带 input_references/aspect_ratio）', async () => {
    let captured: { url: string; body: Record<string, unknown> } | undefined
    global.fetch = (async (url: unknown, init: unknown) => {
      captured = { url: String(url), body: JSON.parse((init as RequestInit).body as string) }
      return { ok: true, status: 200, json: async () => ({ data: [{ url: 'https://cdn/a.png' }] }) }
    }) as unknown as typeof fetch

    const provider = new OpenAICompatibleProvider({ baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'gpt-image-1' })
    const result = await provider.generateImage({ prompt: 'p', size: '512x512' })
    expect(captured?.url).toBe('https://api.openai.com/v1/images/generations')
    expect(captured?.body).toMatchObject({ size: '512x512' })
    expect(captured?.body.input_references).toBeUndefined()
    expect(captured?.body.aspect_ratio).toBeUndefined()
    expect(result.images).toEqual(['https://cdn/a.png'])
  })

  it('b64_json 转 data: URL（media_type 缺省为 image/png）', async () => {
    global.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ data: [{ b64_json: 'QUJD', media_type: 'image/png' }] }) })) as unknown as typeof fetch
    const provider = new OpenAICompatibleProvider({ baseUrl: 'https://x/v1' })
    const result = await provider.generateImage({ prompt: 'p' })
    expect(result.images?.[0]).toBe('data:image/png;base64,QUJD')
  })
})