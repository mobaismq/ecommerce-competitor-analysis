import { randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '../generated/prisma'

/**
 * 采集结果导入器（桌面端「采集 → 分析/报告」的数据源桥）。
 * 背景：worker 的 report.generate 读取 collectionJob + productSnapshot/SKU/QA/Review 快照表，
 * 但桌面端此前没有任何代码写入这些表（旧版由后端 MySQL 导入器完成），导致报告永远报"未找到本机采集数据"。
 * 本模块把结构化采集结果（形状对齐后端 CollectionResultDto / 旧 load_to_mysql.py）落库为报告管线的数据源。
 *
 * 不伪造成功：仅把真实传入的采集结果落库；结果由真实店透视 RPA 或明确标注的离线样本提供。
 */
export interface CollectedSku {
  skuId: string
  name?: string
  price?: number
  imageUrl?: string
}

export interface CollectedQa {
  question?: string
  answer?: string
}

export interface CollectedReview {
  content?: string
  rating?: number
}

export interface CollectedProduct {
  externalProductId: string
  title?: string
  price?: number
  shopId?: string
  shopName?: string
  sold?: number
  salesAmount?: number
  imageUrl?: string
  productUrl?: string
  skus?: CollectedSku[]
  qas?: CollectedQa[]
  reviews?: CollectedReview[]
}

export interface ImportCollectedInput {
  tenantId?: string
  keyword?: string
  type?: string
  /** 采集业务号（复用采集任务号，保证 report 可按 jobId 关联）；缺省时自动生成。 */
  jobId?: string
  dataSnapshotDate: string
  products: CollectedProduct[]
}

export interface ImportCollectedResult {
  collectionJobId: string
  counts: {
    productCount: number
    skuCount: number
    qaCount: number
    reviewCount: number
  }
}

function rawJsonFor(product: CollectedProduct): Prisma.InputJsonValue | (typeof Prisma.JsonNull) {
  const raw: Record<string, unknown> = {}
  if (product.sold != null) raw.sold = product.sold
  if (product.salesAmount != null) raw.salesAmount = product.salesAmount
  if (product.imageUrl) raw.imageUrl = product.imageUrl
  if (product.productUrl) raw.productUrl = product.productUrl
  return Object.keys(raw).length ? (raw as Prisma.InputJsonValue) : Prisma.JsonNull
}

/**
 * 将采集结果写入 collectionJob 与四张快照表（upsert 幂等，SKU/QA/Review 采用替换式同步最新快照）。
 * 主进程写同一本地 SQLite，worker 用自己的连接即可读到，供 report.generate 使用。
 */
export async function importCollectedProducts(
  db: PrismaClient,
  input: ImportCollectedInput,
): Promise<ImportCollectedResult> {
  const tenantId = input.tenantId || 'local'
  const keyword = input.keyword?.trim() || null
  const jobId = input.jobId || `collect-${randomUUID().slice(0, 12)}`
  const dataSnapshotDate = input.dataSnapshotDate

  const collection = await db.collectionJob.upsert({
    where: { jobId },
    update: { status: 'success', keyword },
    create: {
      id: randomUUID(),
      tenantId,
      jobId,
      type: input.type || 'collection',
      status: 'success',
      keyword,
    },
  })

  let skuCount = 0
  let qaCount = 0
  let reviewCount = 0

  for (const product of input.products) {
    if (!product.externalProductId) continue
    const rawJson = rawJsonFor(product)
    const snapshot = await db.productSnapshot.upsert({
      where: {
        collectionJobId_externalProductId: {
          collectionJobId: collection.id,
          externalProductId: product.externalProductId,
        },
      },
      update: {
        title: product.title ?? null,
        price: product.price ?? null,
        shopId: product.shopId ?? null,
        shopName: product.shopName ?? null,
        snapshotTime: new Date(),
        dataSnapshotDate,
        rawJson,
      },
      create: {
        id: randomUUID(),
        tenantId,
        collectionJobId: collection.id,
        externalProductId: product.externalProductId,
        title: product.title ?? null,
        price: product.price ?? null,
        shopId: product.shopId ?? null,
        shopName: product.shopName ?? null,
        snapshotTime: new Date(),
        dataSnapshotDate,
        rawJson,
      },
    })

    await db.productSkuSnapshot.deleteMany({ where: { productSnapshotId: snapshot.id } })
    if (product.skus?.length) {
      await db.productSkuSnapshot.createMany({
        data: product.skus.map((sku) => ({
          id: randomUUID(),
          productSnapshotId: snapshot.id,
          skuId: sku.skuId,
          name: sku.name ?? null,
          price: sku.price ?? null,
          imageUrl: sku.imageUrl ?? null,
        })),
      })
      skuCount += product.skus.length
    }

    await db.productQaSnapshot.deleteMany({ where: { productSnapshotId: snapshot.id } })
    if (product.qas?.length) {
      await db.productQaSnapshot.createMany({
        data: product.qas.map((qa) => ({
          id: randomUUID(),
          productSnapshotId: snapshot.id,
          question: qa.question ?? null,
          answer: qa.answer ?? null,
        })),
      })
      qaCount += product.qas.length
    }

    await db.productReviewSnapshot.deleteMany({ where: { productSnapshotId: snapshot.id } })
    if (product.reviews?.length) {
      await db.productReviewSnapshot.createMany({
        data: product.reviews.map((review) => ({
          id: randomUUID(),
          productSnapshotId: snapshot.id,
          content: review.content ?? null,
          rating: review.rating ?? null,
        })),
      })
      reviewCount += product.reviews.length
    }
  }

  return {
    collectionJobId: collection.id,
    counts: { productCount: input.products.length, skuCount, qaCount, reviewCount },
  }
}