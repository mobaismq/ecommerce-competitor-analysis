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
}

function contentJsonFromInput(dto: PublishListingInput): Record<string, unknown> {
  return {
    storeId: dto.storeId,
    categoryId: dto.categoryId,
    categoryPath: dto.categoryPath,
    price: dto.price !== undefined && dto.price !== '' ? Number(dto.price) : undefined,
    skus: dto.skus ?? [],
    mainImages: dto.mainImages ?? [],
    video: dto.video,
    whiteImage: dto.whiteImage,
    detailImages: dto.detailImages ?? [],
    productAttrs: dto.productAttrs ?? {},
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

export async function rawListingMedia(storageKey: string): Promise<{ dataUrl: string; mimeType: string; size: number } | null> {
  if (!storageKey || !storageKey.startsWith(LISTINGS_MEDIA_PREFIX)) return null
  const bytes = readBytesByKey(storageKey, workerDataRoots())
  if (!bytes) return null
  const mimeType = extname(storageKey) === '.mp4' ? 'video/mp4' : 'image/png'
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

/** 保存草稿：写入本地 ListingDraft。 */
export async function saveListingDraft(input: { tenantId: string; platformCode: string } & PublishListingInput) {
  const db = getWorkerPrisma()
  const contentJson = contentJsonFromInput(input)
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
  return { ok: true, draftId: draft.id, platform: resolveAdapterCode(input.platformCode, listAdapterCodes()), title: draft.title, status: draft.status }
}

/** 发布：无真实凭证诚实报错，绝不建假单。 */
export async function publishListing(input: { tenantId: string; platformCode: string } & PublishListingInput) {
  assertRequiredFields(input.platformCode, input as unknown as Record<string, unknown>)
  const registry = new PlatformRegistry()
  const adapter = registry.create(resolveAdapterCode(input.platformCode, registry.listCodes()))
  const jobId = `manual-listing-${randomUUID().slice(0, 8)}`
  const contentJson = contentJsonFromInput(input)
  const db = getWorkerPrisma()
  const draft = await db.listingDraft.create({
    data: {
      tenantId: input.tenantId,
      jobId,
      title: input.title,
      platformId: input.platformCode,
      contentJson: contentJson as unknown as Record<string, never>,
      status: 'submitting',
    },
  })
  try {
    const result = adapter.submitListing
      ? await adapter.submitListing({ jobId, draftId: draft.id, title: input.title, contentJson: draft.contentJson })
      : { status: 'success' as const, rawPayload: { kind: 'manual' } }
    const finalStatus = result.status === 'success' ? 'submitted' : 'failed'
    await db.listingDraft.update({ where: { id: draft.id }, data: { status: finalStatus } })
    return { draftId: draft.id, jobId, status: finalStatus, platform: input.platformCode, title: input.title, rawPayload: result.rawPayload }
  } catch (error) {
    await db.listingDraft.update({ where: { id: draft.id }, data: { status: 'failed' } })
    throw error
  }
}

function rawRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export interface ListProductsInput {
  tenantId?: string
  platform?: string
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface PlatformProductView {
  id: string
  title: string
  platform: string
  outerId?: string
  price: number
  stock: number
  status: string
  updatedAt: string
}

/**
 * 平台商品列表：查询本地 ListingDraft（上架草稿/已发布）与 ProductSnapshot（竞品快照）。
 * 筛选参数语义对齐后端 platform.service.listProducts：platform→platformId、status、keyword→title 包含。
 */
export async function listProducts(input: ListProductsInput = {}): Promise<{ items: PlatformProductView[]; total: number; page: number; pageSize: number }> {
  const db = getWorkerPrisma()
  const tenantId = input.tenantId || 'local'
  const page = Math.max(1, Number(input.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize ?? 20)))
  const skip = (page - 1) * pageSize

  const draftWhere = {
    tenantId,
    ...(input.platform ? { platformId: input.platform } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.keyword?.trim() ? { title: { contains: input.keyword.trim() } } : {}),
  }
  const drafts = await db.listingDraft.findMany({ where: draftWhere, orderBy: { updatedAt: 'desc' }, take: pageSize, skip })

  const snapshotWhere = {
    tenantId,
    ...(input.keyword?.trim() ? { title: { contains: input.keyword.trim() } } : {}),
  }
  const snapshots = await db.productSnapshot.findMany({ where: snapshotWhere, orderBy: { createdAt: 'desc' }, take: pageSize })

  const draftItems: PlatformProductView[] = drafts.map((d) => {
    const content = rawRecord(d.contentJson) ?? {}
    const priceValue = content.price
    const skus = Array.isArray(content.skus) ? (content.skus as Array<Record<string, unknown>>) : []
    const stock = skus.reduce((acc, s) => acc + Number(s.stock ?? s.quantity ?? 0), 0)
    return {
      id: d.id,
      title: d.title ?? '未命名商品',
      platform: d.platformId ?? 'taobao',
      outerId: d.jobId,
      price: priceValue !== undefined && priceValue !== null && priceValue !== '' ? Number(priceValue) : 0,
      stock,
      status: d.status,
      updatedAt: d.updatedAt.toISOString(),
    }
  })

  const snapshotItems: PlatformProductView[] = snapshots.map((s) => ({
    id: s.id,
    title: s.title ?? '商品快照',
    platform: 'taobao',
    outerId: s.externalProductId,
    price: s.price ? Number(s.price) : 0,
    stock: 0,
    status: 'online',
    updatedAt: s.updatedAt.toISOString(),
  }))

  const items = [...draftItems, ...snapshotItems].slice(0, pageSize)
  return { items, total: items.length, page, pageSize }
}