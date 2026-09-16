import type { ProviderConfig } from '../ai.types'
import { OpenAICompatibleProvider } from './openai-compatible.provider'

export class ArkProvider extends OpenAICompatibleProvider {
  override readonly type = 'ark'

  constructor(config: ProviderConfig = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: config.apiKey ?? process.env.ARK_API_KEY ?? process.env.OPENAI_API_KEY,
      model: config.model ?? process.env.ARK_ANALYSIS_MODEL ?? 'doubao-seed-2-1-pro-260628',
      timeoutMs: config.timeoutMs ?? Number(process.env.ARK_ANALYSIS_TIMEOUT_MS ?? 120000),
    })
  }
}
