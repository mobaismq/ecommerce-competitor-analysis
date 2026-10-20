import { resolveEffectiveConfig, CapabilityNotConfiguredError } from './ai-config'

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
  generateText(request: TextRequest): Promise<{ text: string; model: string; finishReason?: string }>
  analyzeImage(request: VisionRequest): Promise<{ text: string; model: string }>
  streamText(request: TextRequest, emit: (event: StreamEvent) => void): Promise<{ text: string; model: string }>
  streamVisionText(request: VisionRequest, emit: (event: StreamEvent) => void): Promise<{ text: string; model: string }>
}


export function anthropicImage(url: string) {
  const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(url)
  return { type: 'image', source: match ? { type: 'base64', media_type: match[1], data: match[2].replace(/\s/g, '') } : { type: 'url', url } }
}

export function createRealAiProvider(userId: string): RealAiProvider {
  const config = resolveEffectiveConfig(userId)
  if (!config) throw new CapabilityNotConfiguredError()
  const timeout = config.timeoutMs ?? 120_000

  // Anthropic 兼容协议（/messages）：x-api-key + anthropic-version，文本/视觉走 Messages API
  if (config.protocol === 'anthropic') {
    const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/messages`
    const headers = { 'content-type': 'application/json', 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' }
    const textOf = (payload: unknown) => {
      const blocks = Array.isArray((payload as { content?: unknown[] })?.content) ? (payload as { content: unknown[] }).content : []
      const text = blocks.filter((b) => (b as { type?: string })?.type === 'text').map((b) => (b as { text?: string }).text ?? '').join('')
      return text || JSON.stringify(payload)
    }
    const readSseText = (raw: string): string => {
      const data = raw.startsWith('data:') ? raw.slice(5).trim() : raw.trim()
      if (!data || data === '[DONE]') return ''
      try {
        const p = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string } }
        if (p.type === 'content_block_delta' && p.delta?.type === 'text_delta' && p.delta.text) return p.delta.text
        return ''
      } catch {
        return ''
      }
    }
    const stream = async (request: TextRequest, content: unknown, model: string, emit: (event: StreamEvent) => void) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 1024,
          stream: true,
          ...(request.system ? { system: request.system } : {}),
          messages: [{ role: 'user', content }],
        }),
        signal: AbortSignal.timeout(timeout + 30_000),
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
          if (!line.trim().startsWith('data:')) continue
          const delta = readSseText(line)
          if (delta) {
            full += delta
            emit({ type: 'content', text: delta })
          }
        }
        if (done) break
      }
      if (!full.trim()) throw new Error('AI 流式未返回可用内容')
      return { text: full, model }
    }
    const visionModel = config.visionModel || config.textModel
    return {
      type: 'anthropic',
      generateText: async (request) => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.textModel,
            max_tokens: request.maxTokens ?? 1024,
            ...(request.system ? { system: request.system } : {}),
            messages: [{ role: 'user', content: request.prompt }],
          }),
          signal: AbortSignal.timeout(timeout),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(`AI 请求失败: HTTP ${response.status}`)
        return {
          text: textOf(payload),
          model: config.textModel,
          finishReason: String((payload as { stop_reason?: string })?.stop_reason ?? ''),
        }
      },
      analyzeImage: async (request) => {
        const content: unknown[] = [{ type: 'text', text: request.prompt }]
        for (const url of request.images) content.push(anthropicImage(url))
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: visionModel,
            max_tokens: request.maxTokens ?? 1024,
            ...(request.system ? { system: request.system } : {}),
            messages: [{ role: 'user', content }],
          }),
          signal: AbortSignal.timeout(timeout),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(`AI 请求失败: HTTP ${response.status}`)
        return { text: textOf(payload), model: visionModel }
      },
      streamText: (request, emit) => stream(request, request.prompt, config.textModel, emit),
      streamVisionText: (request, emit) => stream(
        request,
        [{ type: 'text', text: request.prompt }, ...request.images.map(anthropicImage)],
        visionModel,
        emit,
      ),
    }
  }

  // OpenAI 兼容协议（/chat/completions）：Bearer 鉴权
  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` }

  function messages(request: { prompt: string; system?: string }) {
    return [
      ...(request.system ? [{ role: 'system', content: request.system }] : []),
      { role: 'user', content: request.prompt },
    ]
  }

  const model = config.textModel
  const visionModel = config.visionModel || config.textModel
  const stream = async (request: TextRequest, completionMessages: unknown[], streamModel: string, emit: (event: StreamEvent) => void) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: streamModel, messages: completionMessages, stream: true, ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}) }),
      signal: AbortSignal.timeout(timeout + 30_000),
    })
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } }
      const errMessage = payload?.error?.message
      throw new Error(errMessage ? `AI 流式请求失败: ${errMessage}` : `AI 流式请求失败: HTTP ${response.status}`)
    }
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
            emit({ type: 'content', text: delta })
          }
        } catch {
          /* 忽略无法解析的 SSE 行 */
        }
      }
      if (done) break
    }
    if (!full.trim()) throw new Error('AI 流式未返回可用内容')
    return { text: full, model: streamModel }
  }
  return {
    type: config.kind,
    generateText: async (request) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: messages(request),
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
        }),
        signal: AbortSignal.timeout(timeout),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const errMessage = (payload as { error?: { message?: string } })?.error?.message
        throw new Error(errMessage ? `AI 请求失败: ${errMessage}` : `AI 请求失败: HTTP ${response.status}`)
      }
      const choice = (payload as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> }).choices?.[0]
      const text = choice?.message?.content
      return { text: typeof text === 'string' ? text : JSON.stringify(payload), model, finishReason: choice?.finish_reason }
    },
    analyzeImage: async (request) => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: visionModel,
          messages: [
            ...(request.system ? [{ role: 'system', content: request.system }] : []),
            { role: 'user', content: [{ type: 'text', text: request.prompt }, ...request.images.map((url) => ({ type: 'image_url', image_url: { url } }))] },
          ],
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
        }),
        signal: AbortSignal.timeout(timeout),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const errMessage = (payload as { error?: { message?: string } })?.error?.message
        throw new Error(errMessage ? `AI 视觉请求失败: ${errMessage}` : `AI 视觉请求失败: HTTP ${response.status}`)
      }
      const text = (payload as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content
      return { text: typeof text === 'string' ? text : JSON.stringify(payload), model: visionModel }
    },
    streamText: (request, emit) => stream(request, messages(request), model, emit),
    streamVisionText: (request, emit) => stream(
      request,
      [
        ...(request.system ? [{ role: 'system', content: request.system }] : []),
        { role: 'user', content: [{ type: 'text', text: request.prompt }, ...request.images.map((url) => ({ type: 'image_url', image_url: { url } }))] },
      ],
      visionModel,
      emit,
    ),
  }
}

export { CapabilityNotConfiguredError }
