import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { extname, join } from 'node:path'
import { getWorkerPrisma, putBytes, readBytesByKey, removeBytes, workerDataRoots } from './worker-db'

// ---- 平台适配器类型与注册（移植自 apps/backend/src/platform/platform.types.ts） ----

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
  getStatus(): PlatformStatus
}

export class PlatformAdapterError extends Error {
  constructor(message: string, readonly code = 'PLATFORM_ADAPTER_ERROR') {
    super(message)
    this.name = 'PlatformAdapterError'
  }
}

// ---- 淘宝适配器（移植自 taobao.adapter.ts，纯逻辑无 NestJS 依赖） ----

function topTimestamp(date = new Date()) {
  const shifted = new Date(date.getTime() + (8 * 60 + date.getTimezoneOffset()) * 60000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())} ${pad(shifted.getHours())}:${pad(shifted.getMinutes())}:${pad(shifted.getSeconds())}`
}

function signTopParams(params: Record<string, string>, secret: string) {
  const joined = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('')
  return createHash('md5').update(secret + joined + secret, 'utf8').digest('hex').toUpperCase()
}

/** 是否配置了可用的真实 TOP 凭证（非空且非占位符）。 */
export function isRealTopConfig(appKey: string, appSecret: string, session: string): boolean {
  const isPlaceholder = (v: string) => !v || /(your|changeme|replace|xxx)/i.test(v)
  return !isPlaceholder(appKey) && !isPlaceholder(appSecret) && !isPlaceholder(session)
}

/** 把上架入参映射为 taobao.item.add 的业务参数（纯函数，可单测）。 */
export function buildItemAddParams(input: PlatformListingInput): Record<string, string> {
  const content = (input.contentJson ?? {}) as Record<string, unknown>
  const params: Record<string, string> = {}
  if (input.title) params.title = String(input.title)
  const price = content.price
  if (price !== undefined && price !== null && price !== '') params.price = String(price)
  const cid = content.categoryId
  if (cid !== undefined && cid !== null && cid !== '') params.cid = String(cid)
  const skus = Array.isArray(content.skus) ? (content.skus as Array<Record<string, unknown>>) : []
  const explicitNum = Number(content.num ?? 0)
  const stockSum = skus.reduce((acc: number, s) => acc + Number(s.stock ?? 0), 0)
  const num = explicitNum > 0 ? explicitNum : stockSum
  if (num > 0) params.num = String(num)
  if (content.video) params.main_video = String(content.video)
  if (content.whiteImage) params.white_background_image = String(content.whiteImage)
  const detailImages = Array.isArray(content.detailImages) ? (content.detailImages as string[]).filter(Boolean) : []
  const descParts = [content.detailContent || content.description || '']
  for (const url of detailImages) descParts.push(`<img src="${url}">`)
  const desc = descParts.filter((part) => String(part).trim()).join('\n') || input.title || ''
  if (desc) params.desc = String(desc)
  const attrs = content.productAttrs && typeof content.productAttrs === 'object' ? (content.productAttrs as Record<string, string>) : {}
  const attrEntries = Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (attrEntries.length) params.input_str = attrEntries.map(([k, v]) => `${k}:${v}`).join(';')
  const skuStr = skus
    .map((s) => [s.specName || s.properties || '', s.price ?? '', s.stock ?? s.quantity ?? 0, s.skuCode || s.outerId || ''].join(';'))
    .filter(Boolean)
    .join(',')
  if (skuStr) params.sku = skuStr
  return params
}

function mockCategories(): PlatformCategory[] {
  return [
    { externalId: '50008163', parentExternalId: '0', name: 'Mock 女装', isParent: true, rawPayload: { kind: 'mock', cid: 50008163 } },
    { externalId: '162102', parentExternalId: '50008163', name: 'Mock 连衣裙', isParent: false, rawPayload: { kind: 'mock', cid: 162102 } },
    { externalId: '50008907', parentExternalId: '0', name: 'Mock 男装', isParent: true, rawPayload: { kind: 'mock', cid: 50008907 } },
  ]
}

function mockShops(): PlatformShop[] {
  return [{ externalId: 'mock-shop-1', name: 'Mock 测试店铺', nick: 'mock_shop', approveStatus: 'ok', rawPayload: { kind: 'mock', sid: 'mock-shop-1' } }]
}

class TaobaoAdapter implements PlatformAdapter {
  readonly code = 'taobao'
  private readonly gateway: string
  private readonly appKey: string
  private readonly appSecret: string
  private readonly session: string
  private readonly mock: boolean

  constructor() {
    this.gateway = process.env.TAOBAO_GATEWAY || 'https://eco.taobao.com/router/rest'
    this.appKey = (process.env.TAOBAO_APP_KEY || '').trim()
    this.appSecret = (process.env.TAOBAO_APP_SECRET || '').trim()
    this.session = (process.env.TAOBAO_SESSION || '').trim()
    this.mock = process.env.PLATFORM_MOCK === 'true' || process.env.NODE_ENV !== 'production'
  }

  getStatus() {
    return { configured: Boolean(this.appKey && this.appSecret), hasSession: Boolean(this.session), mock: this.mock }
  }

  supports(method: PlatformMethod) {
    return method === 'categories' || method === 'shops'
  }

  async fetchCategories(parentExternalId = '0'): Promise<PlatformCategory[]> {
    if (this.mock) {
      return parentExternalId === '0' ? mockCategories() : mockCategories().filter((item) => item.parentExternalId === parentExternalId)
    }
    const payload = await this.topRequest('taobao.itemcats.get', {
      fields: 'cid,parent_cid,name,is_parent',
      parent_cid: String(parentExternalId),
    })
    const cats = payload?.itemcats_get_response?.item_cats?.item_cat || []
    return (Array.isArray(cats) ? cats : []).map((cat: Record<string, unknown>) => ({
      externalId: String(cat.cid),
      parentExternalId: String(cat.parent_cid ?? '0'),
      name: String(cat.name ?? ''),
      isParent: cat.is_parent === true || cat.is_parent === 'true',
      rawPayload: cat,
    }))
  }

  async fetchShops(): Promise<PlatformShop[]> {
    if (this.mock) return mockShops()
    const payload = await this.topRequest('taobao.shops.get', { fields: 'sid,title,nick,approve_status' })
    const shops = payload?.shops_get_response?.shops?.shop || []
    return (Array.isArray(shops) ? shops : []).map((shop: Record<string, unknown>) => ({
      externalId: String(shop.sid),
      name: String(shop.title ?? ''),
      nick: shop.nick ? String(shop.nick) : undefined,
      approveStatus: shop.approve_status ? String(shop.approve_status) : undefined,
      rawPayload: shop,
    }))
  }

  async submitListing(input: PlatformListingInput): Promise<PlatformListingResult> {
    // 诚实回落：无真实 TOP 凭证时明确报错，绝不返回假上架成功。
    if (!isRealTopConfig(this.appKey, this.appSecret, this.session)) {
      throw new PlatformAdapterError('未配置淘宝开放平台真实凭证，无法实际上架（当前为演示，不产生真实订单）', 'TAOBAO_NOT_CONFIGURED')
    }
    const payload = await this.topRequest('taobao.item.add', buildItemAddParams(input))
    return { status: 'success', rawPayload: payload?.item_add_response ?? payload }
  }

  private async topRequest(method: string, bizParams: Record<string, string> = {}): Promise<Record<string, any>> {
    if (!this.appKey || !this.appSecret) {
      throw new PlatformAdapterError('未配置淘宝开放平台 AppKey/AppSecret', 'TAOBAO_NOT_CONFIGURED')
    }
    const params: Record<string, string> = {
      app_key: this.appKey,
      method,
      timestamp: topTimestamp(),
      v: '2.0',
      sign_method: 'md5',
      format: 'json',
      ...bizParams,
    }
    if (this.session) params.session = this.session
    params.sign = signTopParams(params, this.appSecret)

    const response = await fetch(this.gateway, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString(),
    })
    const payload = (await response.json().catch(() => null)) as Record<string, any> | null
    if (!payload) throw new PlatformAdapterError(`淘宝网关 ${method} 返回了无法解析的响应`, 'TAOBAO_BAD_RESPONSE')
    if (payload.error_response) {
      const err = payload.error_response
      const detail = err.sub_code ? `（${err.sub_code}: ${err.sub_msg}）` : ''
      throw new PlatformAdapterError(`淘宝 API ${method} 调用失败: [${err.code}] ${err.msg}${detail}`, 'TAOBAO_API_ERROR')
    }
    return payload
  }
}

class MockPlatformAdapter implements PlatformAdapter {
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
    throw new PlatformAdapterError(`平台「${this.code}」真实上架能力未接入，无法发布，请接入对应平台适配器`, 'PLATFORM_NOT_CONFIGURED')
  }
}

// ---- 适配器注册/解析（移植自 platform-registry.ts / adapter-resolve.ts） ----

class PlatformRegistry {
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

function resolveAdapterCode(code: string, registered: string[]): string {
  const c = code.toLowerCase()
  if (registered.includes(c)) return c
  if (c === 'tmall') return 'taobao'
  return 'mock'
}

// ---- 必填字段校验（移植自 platform-required-fields.ts） ----

const PLATFORM_REQUIRED_FIELDS: Record<string, string[]> = {
  taobao: ['title', 'categoryPath', 'storeId'],
  tmall: ['title', 'categoryPath', 'storeId'],
  jd: ['title', 'brand'],
  pdd: ['title'],
  douyin: ['title'],
}

const PLATFORM_DISPLAY: Record<string, string> = {
  taobao: '淘宝',
  tmall: '天猫',
  jd: '京东',
  pdd: '拼多多',
  douyin: '抖音',
  xhs: '小红书',
}

/** 返回指定平台缺失的必填字段列表；平台未登记时返回空数组。 */
export function requiredMissingFields(platform: string, dto: Record<string, unknown>): string[] {
  const normalized = platform.toLowerCase()
  const required = PLATFORM_REQUIRED_FIELDS[normalized]
  if (!required) return []
  return required.filter((field) => {
    const value = dto[field]
    return value === undefined || value === null || value === ''
  })
}

export function assertRequiredFields(platform: string, dto: Record<string, unknown>): void {
  const missing = requiredMissingFields(platform, dto)
  if (missing.length === 0) return
  const display = PLATFORM_DISPLAY[platform.toLowerCase()] ?? platform
  throw new PlatformAdapterError(`平台${display}必填字段缺失：${missing.join('、')}`, 'INVALID_PLATFORM_FIELDS')
}

const LISTINGS_MEDIA_PREFIX = 'listings/'

export interface PublishListingInput {
  tenantId: string
  platformCode: string
  title: string
  storeId?: string
  categoryId?: string
  /** 完整类目 id 链（Cascader 路径），供草稿回填精确定位。 */
  categoryIds?: string[]
  price?: number | string
  skus?: Array<Record<string, unknown>>
  contentJson?: Record<string, unknown>
  subTitle?: string
  categoryPath?: string
  brand?: string
  origin?: string
  freightTemplate?: string
  mainImages?: string[]
  video?: string
  whiteImage?: string
  detailImages?: string[]
  productAttrs?: Record<string, string>
  detailContent?: string
  originPlace?: string
  warranty?: string
  shippingTime?: string
  serviceGuarantees?: string
  /** 拼多多专有字段（迁移自旧版 ManualListing 的拼多多分支）。 */
  longImage?: string
  packageImages?: string[]
  presaleType?: string
  isSecondHand?: string
  groupCount?: number | string
  bundleDiscount?: string
  referencePrice?: number | string
  sizeTemplate?: string
}

/**
 * 表单入参 → 落库 contentJson。
 * 表单采集的字段必须全部落库，否则「编辑草稿」回填会丢字段（副标题/品牌/物流承诺等）。
 */
function contentJsonFromInput(dto: PublishListingInput): Record<string, unknown> {
  return {
    platform: dto.platformCode,
    storeId: dto.storeId,
    categoryId: dto.categoryId,
    categoryIds: dto.categoryIds,
    categoryPath: dto.categoryPath,
    price: dto.price !== undefined && dto.price !== '' ? Number(dto.price) : undefined,
    skus: dto.skus ?? [],
    mainImages: dto.mainImages ?? [],
    video: dto.video,
    whiteImage: dto.whiteImage,
    detailImages: dto.detailImages ?? [],
    productAttrs: dto.productAttrs ?? {},
    subTitle: dto.subTitle,
    brand: dto.brand,
    origin: dto.origin,
    freightTemplate: dto.freightTemplate,
    detailContent: dto.detailContent,
    originPlace: dto.originPlace,
    warranty: dto.warranty,
    shippingTime: dto.shippingTime,
    serviceGuarantees: dto.serviceGuarantees,
    longImage: dto.longImage,
    packageImages: dto.packageImages ?? [],
    presaleType: dto.presaleType,
    isSecondHand: dto.isSecondHand,
    groupCount: dto.groupCount !== undefined && dto.groupCount !== '' ? Number(dto.groupCount) : undefined,
    bundleDiscount: dto.bundleDiscount,
    referencePrice: dto.referencePrice !== undefined && dto.referencePrice !== '' ? Number(dto.referencePrice) : undefined,
    sizeTemplate: dto.sizeTemplate,
    ...(dto.contentJson ?? {}),
  }
}

export function listAdapterCodes() {
  return new PlatformRegistry().listCodes()
}

export async function getCategories(code: string, parentExternalId = '0') {
  const registry = new PlatformRegistry()
  const adapter = registry.create(resolveAdapterCode(code, registry.listCodes()))
  if (!adapter.supports('categories')) throw new PlatformAdapterError(`平台 ${code} 不支持类目查询`, 'PLATFORM_NOT_CONFIGURED')
  return adapter.fetchCategories(parentExternalId ?? '0')
}

export function getStatus(code: string) {
  const registry = new PlatformRegistry()
  const adapter = registry.create(resolveAdapterCode(code, registry.listCodes()))
  return { ok: true, code, ...adapter.getStatus() }
}

/** 富媒体去内嵌化：字节落盘到 listings/<tenantId>/media/，返回 storageKey 引用（contentJson 只存引用）。 */
export async function uploadListingMedia(input: {
  buffer: Uint8Array
  tenantId?: string
  kind?: string
  contentType?: string
  originalName?: string
}): Promise<{ storageKey: string; size: number; mimeType: string; kind: string }> {
  const root = workerDataRoots().userRoot
  const tenantId = input.tenantId || 'local'
  const kind = input.kind || 'main'
  const contentType = input.contentType || 'application/octet-stream'
  const ext = extname(input.originalName ?? '') || (contentType.includes('video') ? '.mp4' : contentType.includes('image/png') ? '.png' : '.jpg')
  const storageKey = `${LISTINGS_MEDIA_PREFIX}${tenantId}/media/${randomUUID()}${ext}`
  putBytes(storageKey, input.buffer, { userRoot: root })
  return { storageKey, size: input.buffer.byteLength, mimeType: contentType, kind }
}

/** 扩展名 → MIME：按真实后缀返回，避免把 jpg/svg/webm 一律当 png 导致预览破图。 */
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
}

export async function rawListingMedia(storageKey: string): Promise<{ dataUrl: string; mimeType: string; size: number } | null> {
  if (!storageKey || !storageKey.startsWith(LISTINGS_MEDIA_PREFIX)) return null
  const bytes = readBytesByKey(storageKey, workerDataRoots())
  if (!bytes) return null
  const mimeType = MIME_BY_EXT[extname(storageKey).toLowerCase()] ?? 'application/octet-stream'
  return { dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`, mimeType, size: bytes.length }
}

export async function removeListingMedia(keys: string[]): Promise<{ removed: number }> {
  if (!keys.length) return { removed: 0 }
  const root = workerDataRoots().userRoot
  let removed = 0
  for (const key of keys) {
    if (!key || !key.startsWith(LISTINGS_MEDIA_PREFIX)) continue
    const full = join(root, key)
    if (existsSync(full)) {
      removeBytes(full)
      removed += 1
    }
  }
  return { removed }
}

/**
 * 保存草稿：写入本地 ListingDraft。
 * 传 draftId 时更新既有草稿（「编辑商品详情」回存），否则新建。
 */
export async function saveListingDraft(input: { tenantId: string; platformCode: string; draftId?: string } & PublishListingInput) {
  const db = getWorkerPrisma()
  const contentJson = contentJsonFromInput(input)

  if (input.draftId) {
    const existing = await db.listingDraft.findFirst({ where: { id: input.draftId, tenantId: input.tenantId } })
    if (!existing) throw new PlatformAdapterError('草稿不存在', 'DRAFT_NOT_FOUND')
    const updated = await db.listingDraft.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        platformId: input.platformCode,
        contentJson: contentJson as unknown as Record<string, never>,
        status: 'draft',
      },
    })
    return {
      ok: true,
      draftId: updated.id,
      platform: resolveAdapterCode(input.platformCode, listAdapterCodes()),
      title: updated.title,
      status: updated.status,
      updated: true,
    }
  }

  const draft = await db.listingDraft.create({
    data: {
      tenantId: input.tenantId,
      jobId: `manual-draft-${randomUUID().slice(0, 8)}`,
      title: input.title,
      platformId: input.platformCode,
      contentJson: contentJson as unknown as Record<string, never>,
      status: 'draft',
    },
  })
  return { ok: true, draftId: draft.id, platform: resolveAdapterCode(input.platformCode, listAdapterCodes()), title: draft.title, status: draft.status, updated: false }
}

/**
 * 发布：无真实凭证诚实报错，绝不建假单。
 * 传 draftId 时在同一草稿上发布（避免「编辑后再发布」产生重复草稿）；
 * 失败时更新状态并把本次落盘的 listings/ 富媒体清掉，避免孤儿文件（对齐后端行为）。
 */
export async function publishListing(input: { tenantId: string; platformCode: string; draftId?: string } & PublishListingInput) {
  assertRequiredFields(input.platformCode, input as unknown as Record<string, unknown>)
  const registry = new PlatformRegistry()
  const adapter = registry.create(resolveAdapterCode(input.platformCode, registry.listCodes()))
  const contentJson = contentJsonFromInput(input)
  const db = getWorkerPrisma()

  let draftId = input.draftId
  if (draftId) {
    const existing = await db.listingDraft.findFirst({ where: { id: draftId, tenantId: input.tenantId } })
    if (!existing) throw new PlatformAdapterError('草稿不存在', 'DRAFT_NOT_FOUND')
    await db.listingDraft.update({
      where: { id: existing.id },
      data: { title: input.title, platformId: input.platformCode, contentJson: contentJson as unknown as Record<string, never>, status: 'submitting' },
    })
  } else {
    const created = await db.listingDraft.create({
      data: {
        tenantId: input.tenantId,
        jobId: `manual-listing-${randomUUID().slice(0, 8)}`,
        title: input.title,
        platformId: input.platformCode,
        contentJson: contentJson as unknown as Record<string, never>,
        status: 'submitting',
      },
    })
    draftId = created.id
  }

  const draft = await db.listingDraft.findFirstOrThrow({ where: { id: draftId } })
  const jobId = draft.jobId

  try {
    const result = adapter.submitListing
      ? await adapter.submitListing({ jobId, draftId: draft.id, title: input.title, contentJson: draft.contentJson })
      : { status: 'success' as const, rawPayload: { kind: 'manual' } }
    const finalStatus = result.status === 'success' ? 'submitted' : 'failed'
    await db.listingDraft.update({ where: { id: draft.id }, data: { status: finalStatus } })
    return { draftId: draft.id, jobId, status: finalStatus, platform: input.platformCode, title: input.title, rawPayload: result.rawPayload }
  } catch (error) {
    await db.listingDraft.update({ where: { id: draft.id }, data: { status: 'failed' } })
    // 发布失败：清理该草稿已落盘的富媒体对象，避免孤儿文件
    const content = rawRecord(draft.contentJson) ?? {}
    const mediaKeys = [
      String(content.video || ''),
      String(content.whiteImage || ''),
      ...(Array.isArray(content.mainImages) ? (content.mainImages as unknown[]) : []),
      ...(Array.isArray(content.detailImages) ? (content.detailImages as unknown[]) : []),
    ]
      .map((key) => String(key))
      .filter(Boolean)
    await removeListingMedia(mediaKeys).catch(() => ({ removed: 0 }))
    throw error
  }
}

function rawRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export interface ListProductsInput {
  tenantId?: string
  /** 平台编码（taobao/tmall/jd/pdd/douyin/xhs）；不传=全部平台。 */
  platform?: string
  storeId?: string
  /** 商品标题包含。 */
  keyword?: string
  /** 商品编码，支持英文逗号分隔多值（任一命中即可），对齐旧版商品编码查询。 */
  productCode?: string
  /** 商品ID，支持英文逗号分隔多值（任一命中即可），对齐旧版商品ID查询。 */
  externalId?: string
  /** 发布状态：可传码（draft/submitted/...）或展示文案（草稿/已发布/...）。 */
  status?: string
  updateTimeFrom?: string
  updateTimeTo?: string
  page?: number
  pageSize?: number
}

export interface PlatformSkuView {
  skuName: string
  skuCode: string
  skuId: string
  price: number
  stock: number
  skuImage: string | null
}

export interface PlatformProductView {
  id: string
  source: 'draft' | 'snapshot'
  /** 平台商品ID：草稿用 jobId，采集快照用 externalProductId。 */
  productId: string
  productName: string
  productCode: string
  category: string
  platform: string
  storeId: string | null
  storeName: string | null
  price: number
  minPrice: number
  maxPrice: number
  /** 发布状态展示文案（由 PUBLISH_STATUS_LABEL 派生，渲染层不再自己映射）。 */
  publishStatus: string
  publishStatusCode: string
  listingStatus: string
  /** 主图引用：本地上传返回 storageKey（listings/...），采集快照可能为 http URL。 */
  productImage: string | null
  updateTime: string
  createTime: string
  skus: PlatformSkuView[]
}

/** 发布状态码 → 展示文案的唯一映射（能力层权威定义）。 */
export const PUBLISH_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  submitting: '审核中',
  submitted: '已发布',
  failed: '发布失败',
}

function splitTerms(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
}

/** 发布状态归一化：接受状态码或旧版展示文案，非法值返回 undefined（视为不过滤）。 */
function normalizePublishStatus(value?: string): string | undefined {
  const raw = (value ?? '').trim()
  if (!raw) return undefined
  if (PUBLISH_STATUS_LABEL[raw]) return raw
  const matched = Object.entries(PUBLISH_STATUS_LABEL).find(([, label]) => label === raw)
  return matched?.[0]
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

/** 草稿 contentJson → 列表视图（字段口径对齐旧版 ProductManagement 表格）。 */
function draftToView(draft: {
  id: string
  jobId: string
  title: string | null
  platformId: string | null
  status: string
  contentJson: unknown
  createdAt: Date
  updatedAt: Date
}): PlatformProductView {
  const content = rawRecord(draft.contentJson) ?? {}
  const rawSkus = Array.isArray(content.skus) ? (content.skus as Array<Record<string, unknown>>) : []
  const skus: PlatformSkuView[] = rawSkus.map((sku, index) => ({
    skuName: String(sku.specName ?? sku.skuName ?? ''),
    skuCode: String(sku.skuCode ?? ''),
    skuId: String(sku.id ?? sku.skuId ?? sku.skuCode ?? `${draft.id}-sku-${index}`),
    price: Number(sku.price ?? 0),
    stock: Number(sku.stock ?? sku.quantity ?? 0),
    skuImage: stringOrNull(sku.specImage) ?? stringOrNull(sku.skuImage),
  }))
  const prices = skus.map((sku) => sku.price).filter((price) => Number.isFinite(price) && price > 0)
  const contentPrice = content.price !== undefined && content.price !== null && content.price !== '' ? Number(content.price) : undefined
  const price = contentPrice ?? prices[0] ?? 0
  const mainImages = Array.isArray(content.mainImages) ? content.mainImages.filter((v): v is string => typeof v === 'string' && Boolean(v)) : []
  const categoryPath = content.categoryPath

  return {
    id: draft.id,
    source: 'draft',
    productId: draft.jobId,
    productName: draft.title ?? '未命名商品',
    productCode: stringOrNull(content.productCode) ?? draft.jobId,
    category: Array.isArray(categoryPath) ? categoryPath.map(String).join('/') : String(categoryPath ?? ''),
    platform: draft.platformId ?? 'taobao',
    storeId: stringOrNull(content.storeId),
    storeName: stringOrNull(content.storeName),
    price,
    minPrice: prices.length ? Math.min(...prices) : price,
    maxPrice: prices.length ? Math.max(...prices) : price,
    publishStatus: PUBLISH_STATUS_LABEL[draft.status] ?? draft.status,
    publishStatusCode: draft.status,
    listingStatus: '上架',
    productImage: mainImages[0] ?? null,
    updateTime: toIso(draft.updatedAt),
    createTime: toIso(draft.createdAt),
    skus,
  }
}

/** 采集快照 → 列表视图（店透视采集自淘宝，故平台固定 taobao，不改写成未知平台）。 */
function snapshotToView(snapshot: {
  id: string
  externalProductId: string
  title: string | null
  price: number | null
  shopId: string | null
  shopName: string | null
  rawJson: unknown
  createdAt: Date
  updatedAt: Date
}): PlatformProductView {
  const raw = rawRecord(snapshot.rawJson) ?? {}
  const image = stringOrNull(raw.mainImage) ?? stringOrNull(raw.imageUrl) ?? stringOrNull(raw.picUrl)
  const price = snapshot.price ? Number(snapshot.price) : 0
  return {
    id: snapshot.id,
    source: 'snapshot',
    productId: snapshot.externalProductId,
    productName: snapshot.title ?? '商品快照',
    productCode: snapshot.externalProductId,
    category: '',
    platform: 'taobao',
    storeId: snapshot.shopId,
    storeName: snapshot.shopName,
    price,
    minPrice: price,
    maxPrice: price,
    publishStatus: '已发布',
    publishStatusCode: 'submitted',
    listingStatus: '上架',
    productImage: image,
    updateTime: toIso(snapshot.updatedAt),
    createTime: toIso(snapshot.createdAt),
    skus: [],
  }
}

/**
 * 平台商品列表：合并本地 ListingDraft（上架草稿/已发布）与 ProductSnapshot（采集快照）。
 * 迁移自后端 platform.service.listProducts，并补上旧版页面用到的字段与筛选（店铺/商品编码/商品ID/更新时间）。
 * 说明：两来源需合并后统一排序分页，故过滤与分页在内存完成（本地数据量级有限）。
 */
export async function listProducts(
  input: ListProductsInput = {},
): Promise<{ items: PlatformProductView[]; total: number; page: number; pageSize: number }> {
  const db = getWorkerPrisma()
  const tenantId = input.tenantId || 'local'
  const page = Math.max(1, Math.trunc(Number(input.page ?? 1)))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(input.pageSize ?? 20))))

  const platform = (input.platform ?? '').trim().toLowerCase()
  const statusCode = normalizePublishStatus(input.status)
  const keyword = (input.keyword ?? '').trim()
  const storeId = (input.storeId ?? '').trim()
  const codes = splitTerms(input.productCode).map((v) => v.toLowerCase())
  const ids = splitTerms(input.externalId).map((v) => v.toLowerCase())
  // 纯日期补齐时分秒后再解析（否则 new Date('YYYY-MM-DD') 按 UTC 解析，本地 00:00-08:00 会漏数据）
  const from = input.updateTimeFrom
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(input.updateTimeFrom)) ? `${input.updateTimeFrom}T00:00:00.000` : input.updateTimeFrom)
    : null
  const to = input.updateTimeTo
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(input.updateTimeTo)) ? `${input.updateTimeTo}T23:59:59.999` : input.updateTimeTo)
    : null

  const [drafts, snapshots] = await Promise.all([
    db.listingDraft.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' }, take: 500 }),
    db.productSnapshot.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 500 }),
  ])

  const merged = [...drafts.map(draftToView), ...snapshots.map(snapshotToView)]

  const filtered = merged.filter((item) => {
    if (platform && platform !== 'all' && item.platform.toLowerCase() !== platform) return false
    if (storeId && item.storeId !== storeId) return false
    if (statusCode && item.publishStatusCode !== statusCode) return false
    if (keyword && !item.productName.toLowerCase().includes(keyword.toLowerCase())) return false
    if (codes.length && !codes.some((code) => item.productCode.toLowerCase().includes(code))) return false
    if (ids.length && !ids.some((id) => item.productId.toLowerCase().includes(id))) return false
    const updated = item.updateTime ? new Date(item.updateTime).getTime() : 0
    if (from && !Number.isNaN(from.getTime()) && updated < from.getTime()) return false
    if (to && !Number.isNaN(to.getTime()) && updated > to.getTime()) return false
    return true
  })

  filtered.sort((a, b) => (a.updateTime < b.updateTime ? 1 : a.updateTime > b.updateTime ? -1 : 0))

  const start = (page - 1) * pageSize
  return { items: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
}

/** 读取单个草稿（供「编辑商品详情」回填）。 */
export async function getListingDraft(id: string, tenantId = 'local') {
  if (!id) throw new PlatformAdapterError('缺少草稿 ID', 'DRAFT_INVALID')
  const db = getWorkerPrisma()
  const draft = await db.listingDraft.findFirst({ where: { id, tenantId } })
  if (!draft) throw new PlatformAdapterError('草稿不存在', 'DRAFT_NOT_FOUND')
  return {
    id: draft.id,
    title: draft.title,
    platformCode: draft.platformId ?? 'taobao',
    status: draft.status,
    contentJson: rawRecord(draft.contentJson) ?? {},
    createdAt: toIso(draft.createdAt),
    updatedAt: toIso(draft.updatedAt),
  }
}