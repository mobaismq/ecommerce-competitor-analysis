export type PlatformMethod = 'categories' | 'shops'

export interface PlatformCategory {
  externalId: string
  parentExternalId?: string
  name: string
  isParent?: boolean
  rawPayload?: unknown
}

export interface PlatformShop {
  externalId: string
  name: string
  nick?: string
  approveStatus?: string
  rawPayload?: unknown
}

export interface PlatformListingInput {
  jobId?: string
  draftId?: string
  title?: string
  contentJson?: unknown
}

export interface PlatformListingResult {
  status: 'success' | 'failure'
  rawPayload?: unknown
  error?: string
}

export interface PlatformStatus {
  configured: boolean
  mock?: boolean
  detail?: string
}

export interface PlatformAdapter {
  readonly code: string
  supports(method: PlatformMethod): boolean
  fetchCategories(parentExternalId?: string): Promise<PlatformCategory[]>
  fetchShops(): Promise<PlatformShop[]>
  submitListing?(input: PlatformListingInput): Promise<PlatformListingResult>
  /** 连接/授权配置状态（对齐旧版 /api/taobao/status） */
  getStatus(): PlatformStatus
}

export class PlatformAdapterError extends Error {
  constructor(
    message: string,
    readonly code = 'PLATFORM_ADAPTER_ERROR',
  ) {
    super(message)
    this.name = 'PlatformAdapterError'
  }
}
