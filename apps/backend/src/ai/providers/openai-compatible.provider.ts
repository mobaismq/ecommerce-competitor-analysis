import { AiCallError, type AiCapability, type AiImageRequest, type AiProvider, type AiResult, type AiTextRequest, type AiVisionRequest, type ProviderConfig } from '../ai.types'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

export class OpenAICompatibleProvider implements AiProvider {
  readonly type: string = 'openai-compatible'

  constructor(protected readonly config: ProviderConfig = {}) {}

  supports(capability: AiCapability) {
    return capability === 'text' || capability === 'vision' || capability === 'image'
  }

  protected endpoint(path: string) {
    const base = (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    return `${base}/${path.replace(/^\/+/, '')}`
  }

  protected authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`
    return headers
  }

  protected async requestJson(endpoint: string, body: Record<string, unknown>): Promise<{ payload: Record<string, any>; durationMs: number }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120_000)
    const started = Date.now()
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const payload = (await response.json().catch(() => ({}))) as Record<string, any>
      if (!response.ok) {
        throw new AiCallError(
          `provider http ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`,
          'PROVIDER_HTTP_ERROR',
          response.status >= 500,
        )
      }
      return { payload, durationMs: Date.now() - started }
    } catch (error) {
      if (error instanceof AiCallError) throw error
      throw new AiCallError(error instanceof Error ? error.message : String(error), 'PROVIDER_NETWORK_ERROR', true)
    } finally {
      clearTimeout(timeout)
    }
  }

  async generateText(request: AiTextRequest): Promise<AiResult> {
    const { payload, durationMs } = await this.requestJson(this.endpoint('chat/completions'), {
      model: this.config.model ?? 'gpt-4o-mini',
      messages: [
        ...(request.system ? [{ role: 'system', content: request.system }] : []),
        { role: 'user', content: request.prompt },
      ],
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    })
    const text = payload.choices?.[0]?.message?.content
    return {
      status: 'success',
      text: typeof text === 'string' ? text : JSON.stringify(payload),
      model: this.config.model ?? 'gpt-4o-mini',
      rawPayload: payload,
      tokenIn: payload.usage?.prompt_tokens,
      tokenOut: payload.usage?.completion_tokens,
      durationMs,
    }
  }

  async analyzeImage(request: AiVisionRequest): Promise<AiResult> {
    const { payload, durationMs } = await this.requestJson(this.endpoint('chat/completions'), {
      model: this.config.model ?? 'gpt-4o-mini',
      messages: [
        ...(request.system ? [{ role: 'system', content: request.system }] : []),
        {
          role: 'user',
          content: [
            { type: 'text', text: request.prompt },
            ...request.images.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        },
      ],
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    })
    const text = payload.choices?.[0]?.message?.content
    return {
      status: 'success',
      text: typeof text === 'string' ? text : JSON.stringify(payload),
      model: this.config.model ?? 'gpt-4o-mini',
      rawPayload: payload,
      tokenIn: payload.usage?.prompt_tokens,
      tokenOut: payload.usage?.completion_tokens,
      durationMs,
    }
  }

  async generateImage(request: AiImageRequest): Promise<AiResult> {
    const { payload, durationMs } = await this.requestJson(this.endpoint('images/generations'), {
      model: this.config.model ?? 'gpt-image-1',
      prompt: request.prompt,
      n: request.count ?? 1,
      size: request.size ?? '1024x1024',
    })
    const images = (payload.data ?? []).map((item: { url?: string; b64_json?: string }) => item.url ?? item.b64_json ?? '')
    return {
      status: 'success',
      images,
      model: this.config.model ?? 'gpt-image-1',
      rawPayload: payload,
      tokenIn: 0,
      tokenOut: 0,
      durationMs,
    }
  }
}
