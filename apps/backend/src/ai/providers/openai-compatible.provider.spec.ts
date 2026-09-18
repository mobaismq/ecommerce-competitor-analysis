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