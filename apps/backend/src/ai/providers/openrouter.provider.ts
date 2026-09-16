import type { ProviderConfig } from '../ai.types'
import { OpenAICompatibleProvider } from './openai-compatible.provider'

export class OpenRouterProvider extends OpenAICompatibleProvider {
  override readonly type = 'openrouter'

  constructor(config: ProviderConfig = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
      apiKey: config.apiKey ?? process.env.OPENROUTER_API_KEY,
      model: config.model ?? process.env.OPENROUTER_VISION_MODEL ?? 'deepseek/deepseek-v4-flash-vision-exp',
    })
  }
}
