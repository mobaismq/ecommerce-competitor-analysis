import { AiCallError, type AiCapability, type AiImageRequest, type AiProvider, type AiResult, type AiTextRequest, type AiVisionRequest } from '../ai.types'

export class FailingProvider implements AiProvider {
  readonly type = 'failing'

  supports(_capability: AiCapability) {
    return true
  }

  private fail(): Promise<AiResult> {
    throw new AiCallError('simulated provider failure', 'SIMULATED_FAILURE', false)
  }

  async generateText(_request: AiTextRequest): Promise<AiResult> {
    return this.fail()
  }

  async analyzeImage(_request: AiVisionRequest): Promise<AiResult> {
    return this.fail()
  }

  async generateImage(_request: AiImageRequest): Promise<AiResult> {
    return this.fail()
  }
}
