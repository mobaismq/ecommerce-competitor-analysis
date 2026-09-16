import { Injectable } from '@nestjs/common'
import { AiCallError, type AiProvider, type ProviderConfig } from './ai.types'
import { MockAiProvider } from './providers/mock.provider'
import { ArkProvider } from './providers/ark.provider'
import { OpenRouterProvider } from './providers/openrouter.provider'
import { OpenAICompatibleProvider } from './providers/openai-compatible.provider'

type ProviderFactory = (config: ProviderConfig) => AiProvider

@Injectable()
export class ProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>()

  constructor() {
    this.register('mock', (config) => new MockAiProvider(config))
    this.register('ark', (config) => new ArkProvider(config))
    this.register('openrouter', (config) => new OpenRouterProvider(config))
    this.register('openai-compatible', (config) => new OpenAICompatibleProvider(config))
  }

  register(type: string, factory: ProviderFactory) {
    this.factories.set(type, factory)
    return this
  }

  create(type: string, config: ProviderConfig = {}): AiProvider {
    const factory = this.factories.get(type)
    if (!factory) {
      throw new AiCallError(`unknown provider type: ${type}`, 'UNKNOWN_PROVIDER', false)
    }
    return factory(config)
  }

  has(type: string) {
    return this.factories.has(type)
  }

  listTypes() {
    return [...this.factories.keys()]
  }
}
