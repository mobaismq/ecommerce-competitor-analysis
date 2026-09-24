import { PlatformAdapterError, type PlatformAdapter, type PlatformCategory, type PlatformListingInput, type PlatformListingResult, type PlatformMethod, type PlatformShop } from '../platform.types'

export class MockPlatformAdapter implements PlatformAdapter {
  readonly code = 'mock'

  supports(_method: PlatformMethod) {
    return true
  }

  getStatus() {
    return { configured: true, mock: true }
  }

  async fetchCategories(parentExternalId = '0'): Promise<PlatformCategory[]> {
    const rows: PlatformCategory[] = [
      { externalId: 'mock-1', parentExternalId: '0', name: 'Mock 类目一', isParent: true, rawPayload: { kind: 'mock' } },
      { externalId: 'mock-1-1', parentExternalId: 'mock-1', name: 'Mock 子类目', isParent: false, rawPayload: { kind: 'mock' } },
    ]
    return parentExternalId === '0' ? rows : rows.filter((item) => item.parentExternalId === parentExternalId)
  }

  async fetchShops(): Promise<PlatformShop[]> {
    return [{ externalId: 'mock-shop', name: 'Mock 店铺', nick: 'mock_platform', approveStatus: 'ok', rawPayload: { kind: 'mock' } }]
  }

  async submitListing(_input: PlatformListingInput): Promise<PlatformListingResult> {
    // 诚实回落：未注册/未接入真实上架能力的平台，明确报错，绝不返回假上架成功（不骗人）。
    throw new PlatformAdapterError(`平台「${this.code}」真实上架能力未接入，无法发布，请接入对应平台适配器`, 'PLATFORM_NOT_CONFIGURED')
  }
}
