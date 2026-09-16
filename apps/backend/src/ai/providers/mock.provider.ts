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
    const count = request.count ?? 1
    const images = Array.from({ length: count }, (_, index) => `mock://generated/${index}.png`)
    return {
      status: 'success',
      images,
      model: this.model,
      rawPayload: { kind: 'mock-image', prompt: request.prompt, size: request.size },
      tokenIn: countTokens(request.prompt),
      tokenOut: 0,
      durationMs: 7,
    }
  }
}
