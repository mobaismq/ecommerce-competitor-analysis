import { getWorkerPrisma } from './worker-db'
import type { Prisma } from '../generated/prisma'

/**
 * 商品主档能力（唯一权威实现）。
 *
 * 迁移来源：旧本地 HTTP 后端 `apps/backend/src/products/product.service.ts` + `apps/legacy` 商品主档页面。
 * 现状：桌面端直接落本地 SQLite `Product` / `ProductSku`，不再经过服务端。
 *
 * 已知边界（诚实口径，不做假数据）：
 * - 店铺（Store）归属服务端，本地无店铺表，故 `storeName` 恒为 null，页面以 storeId / '—' 兜底展示。
 * - 筛选、分页、校验的权威判定都放在本文件；渲染层只传条件、不私造过滤逻辑。
 */

export interface ProductSkuInput {
  skuCode: string
  specName?: string
  specImage?: string
  costPrice?: number
  standardPrice?: number
}

export interface SaveProductInput {
  /** 创建时必填；update 允许局部更新（如仅改 status）。 */
  productCode?: string
  productName?: string
  brand?: string | null
  productImage?: string | null
  storeId?: string | null
  status?: string
  skus?: ProductSkuInput[]
}

export interface ListProductsOptions {
  /** 命中 productName 或 productCode 的 OR 检索（保留给只需一个搜索框的调用方）。 */
  keyword?: string
  /** 以下四个字段之间是 AND 关系，逐字段 contains（对齐旧版商品主档的查询条件语义）。 */
  productCode?: string
  productName?: string
  brand?: string
  /** 本地无店铺表（storeName 不可解析），此处按 storeId 包含匹配，供文本输入使用。 */
  storeId?: string
  status?: string
  /** 以下日期均为 YYYY-MM-DD（页面 RangePicker 口径）；To 类自动补到当日 23:59:59.999。 */
  createTimeFrom?: string
  createTimeTo?: string
  updateTimeFrom?: string
  updateTimeTo?: string
  /** 同时传 page + pageSize 时返回分页对象；否则返回全量数组（保持既有调用方契约）。 */
  page?: number
  pageSize?: number
}

export interface ProductListView {
  id: string
  tenantId: string
  productCode: string
  productName: string
  brand: string | null
  productImage: string | null
  storeId: string | null
  storeName: string | null
  status: string
  skus: (ProductSkuInput & { id: string })[]
  createdAt: Date
  updatedAt: Date
}

export interface ProductListPageView {
  rows: ProductListView[]
  total: number
  page: number
  pageSize: number
}

/** 商品状态唯一取值（能力层权威定义，渲染层不得私造）。 */
export const PRODUCT_STATUS = ['enabled', 'disabled'] as const
export type ProductStatus = (typeof PRODUCT_STATUS)[number]

type ProductRow = {
  id: string
  tenantId: string
  productCode: string
  productName: string
  brand: string | null
  productImage: string | null
  storeId: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  skus: {
    id: string
    skuCode: string
    specName: string | null
    specImage: string | null
    costPrice: number | null
    standardPrice: number | null
  }[]
}

function validationError(message: string): Error & { code?: string } {
  return Object.assign(new Error(message), { code: 'PRODUCT_VALIDATION' })
}

function notFound(): Error & { code?: string } {
  return Object.assign(new Error('商品不存在'), { code: 'PRODUCT_NOT_FOUND' })
}

function requiredText(value: string | undefined | null, field: string): string {
  const text = (value ?? '').trim()
  if (!text) throw validationError(`${field}必填`)
  return text
}

function optionalText(value: string | undefined | null): string | undefined {
  const text = (value ?? '').trim()
  return text ? text : undefined
}

/** 解析日期筛选：非法日期直接诚实报错，不做静默忽略。 */
function parseDateBound(value: string, field: string, endOfDay: boolean): Date {
  const raw = value.trim()
  // 纯日期（YYYY-MM-DD）补齐时分秒：From 补 00:00:00.000、To 补 23:59:59.999。
  // 必须补齐后再解析，否则 new Date('YYYY-MM-DD') 会按 UTC 解析 → 本地 00:00-08:00 查「今天」会漏数据。
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}` : raw
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) throw validationError(`${field}格式不正确：${raw}`)
  return date
}

/** 归一化状态：只接受 enabled / disabled。 */
function normalizeStatus(value: string | undefined): ProductStatus | undefined {
  const text = optionalText(value)
  if (!text) return undefined
  if (!(PRODUCT_STATUS as readonly string[]).includes(text)) {
    throw validationError(`状态取值非法：${text}（仅支持 enabled / disabled）`)
  }
  return text as ProductStatus
}

/**
 * SKU 归一化：
 * - 整行留空 → 丢弃（表单默认会给一条空行，不应写入空 SKU）
 * - 只填了其它字段却没填编码 → 诚实报错，避免静默丢用户输入
 */
function normalizeSkus(skus: ProductSkuInput[] | undefined): ProductSkuInput[] {
  if (!skus?.length) return []
  const rows: ProductSkuInput[] = []
  skus.forEach((sku, index) => {
    const skuCode = optionalText(sku.skuCode)
    const specName = optionalText(sku.specName)
    const specImage = optionalText(sku.specImage)
    const costPrice = sku.costPrice
    const standardPrice = sku.standardPrice
    const hasOther =
      Boolean(specName) || Boolean(specImage) || typeof costPrice === 'number' || typeof standardPrice === 'number'
    if (!skuCode) {
      if (hasOther && (specName || specImage || costPrice || standardPrice)) {
        throw validationError(`第 ${index + 1} 行规格缺少 SKU 编码`)
      }
      return
    }
    rows.push({ skuCode, specName, specImage, costPrice, standardPrice })
  })
  return rows
}

function skuData(s: ProductSkuInput) {
  return {
    skuCode: s.skuCode,
    specName: s.specName,
    specImage: s.specImage,
    costPrice: s.costPrice,
    standardPrice: s.standardPrice,
  }
}

function toView(row: ProductRow): ProductListView {
  return {
    id: row.id,
    tenantId: row.tenantId,
    productCode: row.productCode,
    productName: row.productName,
    brand: row.brand,
    productImage: row.productImage,
    storeId: row.storeId,
    storeName: null,
    status: row.status,
    skus: row.skus.map((s) => ({
      id: s.id,
      skuCode: s.skuCode,
      specName: s.specName ?? undefined,
      specImage: s.specImage ?? undefined,
      costPrice: s.costPrice ?? undefined,
      standardPrice: s.standardPrice ?? undefined,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function buildWhere(tenantId: string, opts: ListProductsOptions): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { tenantId }
  const keyword = optionalText(opts.keyword)
  if (keyword) {
    where.OR = [{ productName: { contains: keyword } }, { productCode: { contains: keyword } }]
  }
  const productCode = optionalText(opts.productCode)
  if (productCode) where.productCode = { contains: productCode }
  const productName = optionalText(opts.productName)
  if (productName) where.productName = { contains: productName }
  const brand = optionalText(opts.brand)
  if (brand) where.brand = { contains: brand }
  const status = normalizeStatus(opts.status)
  if (status) where.status = status
  const storeId = optionalText(opts.storeId)
  if (storeId) where.storeId = { contains: storeId }

  if (opts.createTimeFrom || opts.createTimeTo) {
    const createdAt: Prisma.DateTimeFilter = {}
    if (opts.createTimeFrom) createdAt.gte = parseDateBound(opts.createTimeFrom, '创建时间起', false)
    if (opts.createTimeTo) createdAt.lte = parseDateBound(opts.createTimeTo, '创建时间止', true)
    where.createdAt = createdAt
  }
  if (opts.updateTimeFrom || opts.updateTimeTo) {
    const updatedAt: Prisma.DateTimeFilter = {}
    if (opts.updateTimeFrom) updatedAt.gte = parseDateBound(opts.updateTimeFrom, '更新时间起', false)
    if (opts.updateTimeTo) updatedAt.lte = parseDateBound(opts.updateTimeTo, '更新时间止', true)
    where.updatedAt = updatedAt
  }
  return where
}

/** 商品列表：无分页参数返回全量数组，有则返回 `{ rows, total, page, pageSize }`。 */
export async function listProducts(
  tenantId: string,
  opts: ListProductsOptions = {},
): Promise<ProductListView[] | ProductListPageView> {
  const db = getWorkerPrisma()
  const where = buildWhere(tenantId, opts)
  const orderBy = { createdAt: 'desc' } as const
  const include = { skus: true } as const

  if (opts.page != null && opts.pageSize != null) {
    const page = Math.trunc(opts.page)
    const pageSize = Math.trunc(opts.pageSize)
    if (page < 1 || pageSize < 1) throw validationError('分页参数必须为正整数')
    const [rows, total] = await db.$transaction([
      db.product.findMany({ where, orderBy, include, skip: (page - 1) * pageSize, take: pageSize }),
      db.product.count({ where }),
    ])
    return { rows: rows.map(toView), total, page, pageSize }
  }

  const rows = await db.product.findMany({ where, orderBy, include })
  return rows.map(toView)
}

/** 创建商品（含 SKU 整体写入，事务内完成）。 */
export async function createProduct(tenantId: string, input: SaveProductInput): Promise<ProductListView> {
  const productCode = requiredText(input.productCode, '商品编码')
  const productName = requiredText(input.productName, '商品名称')
  const status = normalizeStatus(input.status) ?? 'enabled'
  const skus = normalizeSkus(input.skus)
  const db = getWorkerPrisma()
  try {
    const product = await db.$transaction(async (tx) =>
      tx.product.create({
        data: {
          tenantId,
          productCode,
          productName,
          brand: optionalText(input.brand) ?? null,
          productImage: optionalText(input.productImage) ?? null,
          storeId: optionalText(input.storeId) ?? null,
          status,
          skus: skus.length ? { create: skus.map(skuData) } : undefined,
        },
        include: { skus: true },
      }),
    )
    return toView(product)
  } catch (error) {
    throw translateWriteError(error, productCode)
  }
}

/** 更新商品：SKU 传了就整体替换（与原后端语义一致），不传则保持。 */
export async function updateProduct(tenantId: string, id: string, input: SaveProductInput): Promise<ProductListView> {
  const db = getWorkerPrisma()
  const existing = await db.product.findFirst({ where: { id, tenantId } })
  if (!existing) throw notFound()

  const data: Prisma.ProductUpdateInput = {}
  if (input.productCode !== undefined) data.productCode = requiredText(input.productCode, '商品编码')
  if (input.productName !== undefined) data.productName = requiredText(input.productName, '商品名称')
  if (input.brand !== undefined) data.brand = optionalText(input.brand) ?? null
  if (input.productImage !== undefined) data.productImage = optionalText(input.productImage) ?? null
  if (input.storeId !== undefined) data.storeId = optionalText(input.storeId) ?? null
  if (input.status !== undefined) data.status = normalizeStatus(input.status) ?? 'enabled'
  if (input.skus !== undefined) {
    data.skus = { deleteMany: {}, create: normalizeSkus(input.skus).map(skuData) }
  }

  try {
    const updated = await db.$transaction(async (tx) => tx.product.update({ where: { id }, data, include: { skus: true } }))
    return toView(updated)
  } catch (error) {
    throw translateWriteError(error, input.productCode ?? existing.productCode)
  }
}

/** 删除商品及其 SKU（同一事务）。 */
export async function deleteProduct(tenantId: string, id: string): Promise<{ ok: boolean; id: string }> {
  const db = getWorkerPrisma()
  const existing = await db.product.findFirst({ where: { id, tenantId } })
  if (!existing) throw notFound()
  await db.$transaction([db.productSku.deleteMany({ where: { productId: id } }), db.product.delete({ where: { id } })])
  return { ok: true, id }
}

/** 把 Prisma 唯一键冲突翻译成可展示的业务错误，避免把 P2002 原文抛给界面。 */
function translateWriteError(error: unknown, productCode: string): Error {
  const code = (error as { code?: string } | null)?.code
  if (code === 'P2002') {
    return Object.assign(new Error(`商品编码已存在：${productCode}`), { code: 'PRODUCT_DUPLICATE' })
  }
  return error instanceof Error ? error : new Error(String(error))
}
