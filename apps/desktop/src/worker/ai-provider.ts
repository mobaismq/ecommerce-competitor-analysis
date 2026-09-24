import { readLocalAiConfig, CapabilityNotConfiguredError } from './ai-config'

export interface TextRequest {
  prompt: string
  system?: string
  maxTokens?: number
}

export interface VisionRequest extends TextRequest {
  images: string[]
}

export interface StreamEvent {
  type: 'thinking' | 'content' | 'done' | 'error'
  text?: string
  data?: Record<string, unknown>
}

export interface RealAiProvider {
  type: string
  generateText(request: TextRequest): Promise<{ text: string; model: string }>
  analyzeImage(request: VisionRequest): Promise<{ text: string; model: string }>
  streamText(request: TextRequest, emit: (event: StreamEvent) => void): Promise<{ text: string; model: string }>
}

export function createRealAiProvider(userId: string): RealAiProvider {
  const config = readLocalAiConfig(userId)
  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` }

  function messages(request: { prompt: string; system?: string }) {
    return [
      ...(request.system ? [{ role: 'system', content: request.system }] : []),
      { role: 'user', content: request.prompt },
    ]
  }

  return {
    type: config.providerType,
    generateText: async (request) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: messages(request),
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 120_000),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(`AI 请求失败: HTTP ${response.status}`)
      const text = (payload as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content
      return { text: typeof text === 'string' ? text : JSON.stringify(payload), model: config.model }
    },
    analyzeImage: async (request) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            ...(request.system ? [{ role: 'system', content: request.system }] : []),
            { role: 'user', content: [{ type: 'text', text: request.prompt }, ...request.images.map((url) => ({ type: 'image_url', image_url: { url } }))] },
          ],
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 120_000),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(`AI 请求失败: HTTP ${response.status}`)
      const text = (payload as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content
      return { text: typeof text === 'string' ? text : JSON.stringify(payload), model: config.model }
    },
    streamText: async (request, emit) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: config.model, messages: messages(request), stream: true, ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}) }),
        signal: AbortSignal.timeout((config.timeoutMs ?? 120_000) + 30_000),
      })
      if (!response.ok || !response.body) throw new Error(`AI 流式请求失败: HTTP ${response.status}`)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''
      for (;;) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              full += delta
              emit({ type: 'content', text: full })
            }
          } catch {
            /* 忽略无法解析的 SSE 行 */
          }
        }
        if (done) break
      }
      if (!full.trim()) throw new Error('AI 流式未返回可用内容')
      return { text: full, model: config.model }
    },
  }
}

export { CapabilityNotConfiguredError }
