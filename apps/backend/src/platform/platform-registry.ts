import { Injectable } from '@nestjs/common'
import { PlatformAdapterError, type PlatformAdapter } from './platform.types'
import { TaobaoAdapter } from './providers/taobao.adapter'
import { MockPlatformAdapter } from './providers/mock.adapter'

@Injectable()
export class PlatformRegistry {
  private readonly factories = new Map<string, () => PlatformAdapter>()

  constructor() {
    this.register('taobao', () => new TaobaoAdapter())
    this.register('mock', () => new MockPlatformAdapter())
  }

  register(code: string, factory: () => PlatformAdapter) {
    this.factories.set(code, factory)
    return this
  }

  create(code: string): PlatformAdapter {
    const factory = this.factories.get(code)
    if (!factory) throw new PlatformAdapterError(`unknown platform adapter: ${code}`, 'UNKNOWN_PLATFORM')
    return factory()
  }

  listCodes() {
    return [...this.factories.keys()]
  }
}
