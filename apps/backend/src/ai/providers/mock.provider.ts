import type { AiCapability, AiImageRequest, AiProvider, AiResult, AiTextRequest, AiVisionRequest, ProviderConfig } from '../ai.types'

function countTokens(text: string) {
  return Math.ceil(text.length / 4)
}

export class MockAiProvider implements AiProvider {
  readonly type = 'mock'
  private readonly model: string

  constructor(config: ProviderConfig = {}) {
    this.model = config.model ?? process.env.AI_MOCK_MODEL ?? 'mock-model'
  }

  supports(_capability: AiCapability) {
    return true
  }

  async generateText(request: AiTextRequest): Promise<AiResult> {
    const text = `mock answer: ${request.prompt}`
    const tokenIn = countTokens(`${request.system ?? ''}${request.prompt}`)
    return {
      status: 'success',
      text,
      model: this.model,
      rawPayload: { kind: 'mock-text', prompt: request.prompt },
      tokenIn,
      tokenOut: countTokens(text),
      durationMs: 5,
    }
  }

  async analyzeImage(request: AiVisionRequest): Promise<AiResult> {
    const text = `mock vision: ${request.prompt} (${request.images.length} images)`
    return {
      status: 'success',
      text,
      model: this.model,
      rawPayload: { kind: 'mock-vision', imageCount: request.images.length },
      tokenIn: countTokens(request.prompt),
      tokenOut: countTokens(text),
      durationMs: 6,
    }
  }

  async generateImage(request: AiImageRequest): Promise<AiResult> {
    // 图像生成不能伪造 mock:// URL：无真实图像服务时返回空结果，由上层呈现诚实空态。
    return {
      status: 'success',
      images: [],
      model: this.model,
      rawPayload: { kind: 'mock-image', fake: true, prompt: request.prompt, size: request.size, referenceImageUrls: request.referenceImageUrls },
      tokenIn: countTokens(request.prompt),
      tokenOut: 0,
      durationMs: 7,
    }
  }
}
