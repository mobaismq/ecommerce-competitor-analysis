export type AiCapability = 'text' | 'vision' | 'image'

export interface AiTextRequest {
  prompt: string
  system?: string
  maxTokens?: number
  temperature?: number
}

export interface AiVisionRequest extends AiTextRequest {
  images: string[]
}

export interface AiImageRequest {
  prompt: string
  size?: string
  count?: number
  referenceImageUrls?: string[]
  aspectRatio?: string
}

export interface AiResult {
  status: 'success' | 'failure'
  text?: string
  images?: string[]
  model: string
  rawPayload?: unknown
  tokenIn?: number
  tokenOut?: number
  durationMs: number
  error?: string
}

export interface ProviderConfig {
  baseUrl?: string
  apiKey?: string
  model?: string
  timeoutMs?: number
  /** 图片端点覆盖：如 openrouter 传 'images'（对齐旧版 /images），缺省走 images/generations */
  imageEndpoint?: string
}

export interface AiProvider {
  readonly type: string
  supports(capability: AiCapability): boolean
  generateText(request: AiTextRequest): Promise<AiResult>
  analyzeImage(request: AiVisionRequest): Promise<AiResult>
  generateImage(request: AiImageRequest): Promise<AiResult>
}

export class AiCallError extends Error {
  constructor(
    message: string,
    readonly code = 'AI_CALL_FAILED',
    readonly retryable = true,
  ) {
    super(message)
    this.name = 'AiCallError'
  }
}

export function buildAttemptKey(parts: { jobId?: string; capability: AiCapability; attempt?: number; suffix?: string }) {
  const base = [parts.jobId ?? 'manual', parts.capability, String(parts.attempt ?? 0)]
  if (parts.suffix) base.push(parts.suffix)
  return base.join(':')
}
