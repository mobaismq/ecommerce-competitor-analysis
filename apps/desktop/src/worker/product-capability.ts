import { getWorkerPrisma } from './worker-db'
import type { Prisma } from '../generated/prisma'

/**
 * 商品主档能力：从本地 HTTP 后端(ProductService) 移植到 worker，落本地 SQLite Product/ProductSku。
 * 店铺(Store)归属服务端，本地无店铺表，故 storeName 无法解析，统一返回 null（页面以 storeId/'—' 兜底展示）。
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

function skuData(s: ProductSkuInput) {
  return {
    skuCode: s.skuCode,
    specName: s.specName,
    specImage: s.specImage,
    costPrice: s.costPrice,
    standardPrice: s.standardPrice,
  }
}

function toView(row: {
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
  skus: ({ id: string; skuCode: string; specName: string | null; specImage: string | null; costPrice: number | null; standardPrice: number | null })[]
}): ProductListView {
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

/** 全量商品列表（含 SKU），保持后端 GET /api/products/master 匿名数组契约。 */
export async function listProducts(
  tenantId: string,
  opts: { keyword?: string; status?: string } = {},
): Promise<ProductListView[]> {
  const db = getWorkerPrisma()
  const where: Record<string, unknown> = { tenantId }
  if (opts.keyword?.trim()) {
    where.OR = [
      { productName: { contains: opts.keyword.trim() } },
      { productCode: { contains: opts.keyword.trim() } },
    ]
  }
  if (opts.status) where.status = opts.status
  const rows = await db.product.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { skus: true },
  })
  return rows.map(toView)
}

export async function createProduct(
  tenantId: string,
  input: SaveProductInput,
): Promise<ProductListView> {
  if (!input.productCode || !input.productName) {
    throw Object.assign(new Error('商品编码与商品名称必填'), { code: 'PRODUCT_VALIDATION' })
  }
  const db = getWorkerPrisma()
  const product = await db.$transaction(async (tx) => {
    return tx.product.create({
      data: {
        tenantId,
        productCode: input.productCode!,
        productName: input.productName!,
        brand: input.brand ?? null,
        productImage: input.productImage ?? null,
        storeId: input.storeId ?? null,
        status: input.status ?? 'enabled',
        skus: input.skus?.length ? { create: input.skus.map(skuData) } : undefined,
      },
      include: { skus: true },
    })
  })
  return toView(product)
}

export async function updateProduct(
  tenantId: string,
  id: string,
  input: SaveProductInput,
): Promise<ProductListView> {
  const db = getWorkerPrisma()
  const existing = await db.product.findFirst({ where: { id, tenantId } })
  if (!existing) throw notFound()
  const data: Prisma.ProductUpdateInput = {}
  if (input.productCode !== undefined) data.productCode = input.productCode
  if (input.productName !== undefined) data.productName = input.productName
  if (input.brand !== undefined) data.brand = input.brand
  if (input.productImage !== undefined) data.productImage = input.productImage
  if (input.storeId !== undefined) data.storeId = input.storeId
  if (input.status !== undefined) data.status = input.status
  if (input.skus !== undefined) {
    data.skus = { deleteMany: {}, create: input.skus.map(skuData) }
  }
  const updated = await db.$transaction(async (tx) => {
    return tx.product.update({
      where: { id },
      data,
      include: { skus: true },
    })
  })
  return toView(updated)
}

export async function deleteProduct(
  tenantId: string,
  id: string,
): Promise<{ ok: boolean; id: string }> {
  const db = getWorkerPrisma()
  const existing = await db.product.findFirst({ where: { id, tenantId } })
  if (!existing) throw notFound()
  await db.$transaction([
    db.productSku.deleteMany({ where: { productId: id } }),
    db.product.delete({ where: { id } }),
  ])
  return { ok: true, id }
}

function notFound(): Error & { code?: string } {
  return Object.assign(new Error('商品不存在'), { code: 'PRODUCT_NOT_FOUND' })
}