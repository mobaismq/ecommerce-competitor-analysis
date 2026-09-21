import { Injectable } from '@nestjs/common'
import { MockVideoProvider } from './mock-video.provider'
import { notConfiguredVideoError } from './not-configured-video.provider'
import type { VideoProvider } from './video.types'

@Injectable()
export class VideoProviderRegistry {
  private readonly factories = new Map<string, () => VideoProvider>()

  constructor() {
    this.register('mock', () => new MockVideoProvider())
  }

  register(type: string, factory: () => VideoProvider) {
    this.factories.set(type, factory)
    return this
  }

  create(type: string) {
    const factory = this.factories.get(type)
    if (!factory) throw notConfiguredVideoError(type)
    return factory()
  }

  listTypes() {
    return [...this.factories.keys()]
  }
}
