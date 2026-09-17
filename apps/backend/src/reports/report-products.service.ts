import { Injectable, NotFoundException } from '@nestjs/common'
import { AiCapability } from '../ai/ai.types'
import { ProviderRouter } from '../ai/provider-router.service'
import { PrismaService } from '../prisma.service'
import { computePriceBands as buildPriceBands } from './report-price-bands'

export interface RunMainImageAnalysisInput {
  tenantId: string
  runId: string
  productId?: string
  productUrl?: string
  title?: string
  imageUrl?: string
  price?: number
  soldCount?: number
  skus?: unknown[]
}

/**
 * 报告竞品商品视图 / 主图分析 / 价格带预览。
 * 关联：AnalysisRun(jobId) → CollectionJob(jobId) → ProductSnapshot → ProductSkuSnapshot / MainImageAnalysis。
 */
@Injectable()
export class ReportProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouter,
  ) {}

  private async resolveRun(runId: string, tenantId: string) {
    const run = await this.prisma.analysisRun.findFirst({
      where: { OR: [{ id: runId }, { jobId: runId }, { reportNo: runId }], tenantId },
    })
    if (!run) throw new NotFoundException('报告不存在')
    return run
  }

  async productsView(runId: string, tenantId: string, keyword?: string) {
    const run = await this.resolveRun(runId, tenantId)
    const collectionJob = await this.prisma.collectionJob.findUnique({ where: { jobId: run.jobId } })
    if (!collectionJob) {
      return { ok: true, source: 'run', collection: null, products: [] }
    }

    const where = { collectionJobId: collectionJob.id, ...(keyword ? { title: { contains: keyword } } : {}) }
    const rows = await this.prisma.productSnapshot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const productIds = rows.map((r) => r.id)
    const [skuRows, analysisRows] = await Promise.all([
      this.prisma.productSkuSnapshot.findMany({ where: { productSnapshotId: { in: productIds } } }),
      this.prisma.mainImageAnalysis.findMany({
        where: { analysisRunId: run.id, productId: { in: rows.map((r) => r.externalProductId) } },
      }),
    ])

    const skusByProduct = new Map<string, typeof skuRows>()
    for (const sku of skuRows) {
      const list = skusByProduct.get(sku.productSnapshotId) ?? []
      list.push(sku)
      skusByProduct.set(sku.productSnapshotId, list)
    }
    const analysisByProduct = new Map<string, (typeof analysisRows)[number]>()
    for (const a of analysisRows) if (a.productId) analysisByProduct.set(a.productId, a)

    const products = rows.map((r) => {
      const analysis = analysisByProduct.get(r.externalProductId)
      return {
        id: r.id,
        productId: r.externalProductId,
        title: r.title,
        shopName: r.shopName,
        price: Number(r.price),
        imageUrl: (r.rawJson as { imageUrl?: string } | null)?.imageUrl ?? null,
        skus: (skusByProduct.get(r.id) ?? []).map((s) => ({
          skuId: s.skuId,
          name: s.name,
          price: Number(s.price),
          imageUrl: s.imageUrl,
        })),
        mainImageAnalysisId: analysis?.id ?? null,
        mainImageAnalyzedAt: analysis?.createdAt ?? null,
      }
    })

    return {
      ok: true,
      source: 'collection',
      collection: {
        id: collectionJob.id,
        keyword: collectionJob.keyword,
        priceRange: (collectionJob.rawResultJson as { priceRange?: string } | null)?.priceRange ?? null,
        productCount: products.length,
        collectTime: collectionJob.createdAt,
      },
      products,
    }
  }

  async runMainImageAnalysis(input: RunMainImageAnalysisInput) {
    const run = await this.resolveRun(input.runId, input.tenantId)
    let text: string | undefined
    let model = 'mock'
    if (input.imageUrl) {
      // 离线/无真实 Key 时由 ProviderRouter 解析到 Mock；不循环触发真实视觉模型
      const result = await this.router.execute(
        'vision',
        { prompt: '分析该商品主图：概括视觉卖点、画面元素与文案', system: '你是电商主图视觉分析师。', images: [input.imageUrl], maxTokens: 2000 },
        { tenantId: input.tenantId, jobId: run.jobId, attemptKey: `report:${run.id}:vision:${input.productId ?? 'p'}` },
      )
      text = result.text
      model = result.model
    }
    const saved = await this.prisma.mainImageAnalysis.create({
      data: {
        analysisRunId: run.id,
        productId: input.productId,
        imageUrl: input.imageUrl,
        visionModel: model,
        resultJson: { summary: text ?? '未提供主图，未执行视觉分析' },
      },
    })
    return { id: saved.id, analyzedAt: saved.createdAt }
  }

  async priceBandsPreview(input: {
    tenantId: string
    runId: string
    costPrice?: number
    shippingCost?: number
    packagingCost?: number
    laborCost?: number
    platformFeeRate?: number
    adFeeRate?: number
    targetMargin?: number
  }) {
    const run = await this.resolveRun(input.runId, input.tenantId)
    const collectionJob = await this.prisma.collectionJob.findUnique({ where: { jobId: run.jobId } })
    if (!collectionJob) {
      return { ok: true, priceBands: [], profitSimulation: null }
    }
    const rows = await this.prisma.productSnapshot.findMany({
      where: { collectionJobId: collectionJob.id },
      select: { price: true },
      orderBy: { price: 'asc' },
    })
    const priceBands = buildPriceBands(rows.map((r) => Number(r.price)))
    const feeRate = (input.platformFeeRate ?? 0) + (input.adFeeRate ?? 0)
    const profitSimulation = priceBands.map((band) => {
      const targetPrice = Number(band.priceMax ?? 0)
      const totalCost = (input.costPrice ?? 0) + (input.shippingCost ?? 0) + (input.packagingCost ?? 0) + (input.laborCost ?? 0)
      const fee = targetPrice * feeRate
      const grossProfit = targetPrice - totalCost - fee
      return {
        priceBand: band.bandName,
        targetPrice,
        totalCost,
        grossProfit,
        grossMargin: targetPrice > 0 ? grossProfit / targetPrice : 0,
        targetMarginPrice: (input.targetMargin ?? 0) > 0 ? totalCost / (1 - (input.targetMargin ?? 0) - feeRate) : 0,
      }
    })
    return { ok: true, priceBands, profitSimulation }
  }

  /** 市场报告用的关键词价格带预览：取最近一次含该关键词的采集 */
  async priceBandsPreviewByKeyword(input: {
    tenantId: string
    keyword?: string
    costPrice?: number
    shippingCost?: number
    packagingCost?: number
    laborCost?: number
    platformFeeRate?: number
    adFeeRate?: number
    targetMargin?: number
  }) {
    const collectionJob = await this.prisma.collectionJob.findFirst({
      where: input.keyword ? { keyword: { contains: input.keyword.trim() } } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    if (!collectionJob) {
      return { ok: true, priceBands: [], profitSimulation: null, collection: null }
    }
    const rows = await this.prisma.productSnapshot.findMany({
      where: { collectionJobId: collectionJob.id },
      select: { price: true },
      orderBy: { price: 'asc' },
    })
    const priceBands = buildPriceBands(rows.map((r) => Number(r.price)))
    const feeRate = (input.platformFeeRate ?? 0) + (input.adFeeRate ?? 0)
    const profitSimulation = priceBands.map((band) => {
      const targetPrice = Number(band.priceMax ?? 0)
      const totalCost = (input.costPrice ?? 0) + (input.shippingCost ?? 0) + (input.packagingCost ?? 0) + (input.laborCost ?? 0)
      const fee = targetPrice * feeRate
      const grossProfit = targetPrice - totalCost - fee
      return {
        priceBand: band.bandName,
        targetPrice,
        totalCost,
        grossProfit,
        grossMargin: targetPrice > 0 ? grossProfit / targetPrice : 0,
        targetMarginPrice: (input.targetMargin ?? 0) > 0 ? totalCost / (1 - (input.targetMargin ?? 0) - feeRate) : 0,
      }
    })
    return { ok: true, priceBands, profitSimulation, collection: { id: collectionJob.id, keyword: collectionJob.keyword, productCount: rows.length } }
  }
}
