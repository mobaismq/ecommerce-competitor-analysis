import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRealAiProvider } from './ai-provider'
vi.mock('./ai-config', async (importOriginal) => ({
  ...await importOriginal<typeof import('./ai-config')>(),
  resolveEffectiveConfig: () => ({ kind: 'openai-compatible', protocol: 'openai', baseUrl: 'https://api.deepseek.com', apiKey: 'test-only', textModel: 'deepseek-v4-pro', visionModel: 'deepseek-flash' }),
}))
afterEach(() => vi.unstubAllGlobals())
describe('AI completion response contract', () => {
  it('requests JSON and disables DeepSeek thinking only for structured generation', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] })))
    vi.stubGlobal('fetch', fetch)
    const result = await createRealAiProvider('u1').generateText({ prompt: '返回JSON', jsonOutput: true, maxTokens: 10000 })
    expect(result.text).toBe('{"ok":true}')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ model: 'deepseek-v4-pro', response_format: { type: 'json_object' }, thinking: { type: 'disabled' }, max_tokens: 10000 })
  })
  it('rejects empty envelopes instead of returning their JSON as report text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    await expect(createRealAiProvider('u1').generateText({ prompt: 'report' })).rejects.toThrow('未返回可用正文')
  })
  it('rejects truncated and reasoning-only completions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"markdown":"short"}' }, finish_reason: 'length' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: null, reasoning_content: 'private reasoning' }, finish_reason: 'stop' }] }))))
    const provider = createRealAiProvider('u1')
    await expect(provider.generateText({ prompt: 'report' })).rejects.toThrow('长度上限')
    await expect(provider.generateText({ prompt: 'report' })).rejects.toThrow('未返回可用正文')
  })
})
