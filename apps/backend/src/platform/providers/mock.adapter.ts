import type { PlatformAdapter, PlatformCategory, PlatformListingInput, PlatformListingResult, PlatformMethod, PlatformShop } from '../platform.types'

export class MockPlatformAdapter implements PlatformAdapter {
  readonly code = 'mock'

  supports(_method: PlatformMethod) {
    return true
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

  async submitListing(input: PlatformListingInput): Promise<PlatformListingResult> {
    return { status: 'success', rawPayload: { kind: 'mock-listing', jobId: input.jobId } }
  }
}
