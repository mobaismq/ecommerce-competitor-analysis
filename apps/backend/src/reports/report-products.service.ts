import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AiCapability } from '../ai/ai.types'
import { ProviderRouter } from '../ai/provider-router.service'
import { PrismaService } from '../prisma.service'
import { computePriceBands as buildPriceBands } from './report-price-bands'

export interface RunMainImageAnalysisInput {
  tenantId: string
  runId: string
  userId?: string
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

  async productsView(
    runId: string,
    tenantId: string,
    options: { keyword?: string; productId?: string; shopName?: string; skuKeyword?: string; page?: number; pageSize?: number } = {},
  ) {
    const run = await this.resolveRun(runId, tenantId)
    const collectionJob = await this.prisma.collectionJob.findUnique({ where: { jobId: run.jobId } })
    if (!collectionJob) {
      return { ok: true, source: 'run', collection: null, products: [], total: 0 }
    }

    const where: Prisma.ProductSnapshotWhereInput = {
      collectionJobId: collectionJob.id,
      ...(options.keyword?.trim() ? { title: { contains: options.keyword.trim() } } : {}),
      ...(options.productId?.trim() ? { externalProductId: { contains: options.productId.trim() } } : {}),
      ...(options.shopName?.trim() ? { shopName: { contains: options.shopName.trim() } } : {}),
    }
    const page = options.page && options.page > 0 ? options.page : undefined
    const pageSize = options.pageSize && options.pageSize > 0 ? Math.min(options.pageSize, 100) : undefined
    let rows = await this.prisma.productSnapshot.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 })
    let total: number | null = null
    if (page !== undefined && pageSize !== undefined) {
      ;[rows, total] = await Promise.all([
        this.prisma.productSnapshot.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        this.prisma.productSnapshot.count({ where }),
      ])
    }

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
      const raw = (r.rawJson as { imageUrl?: string; productUrl?: string; sold?: number; salesAmount?: number; priceRange?: string; imageCount?: number } | null) ?? {}
      return {
        id: r.id,
        productId: r.externalProductId,
        title: r.title,
        shopName: r.shopName,
        price: Number(r.price),
        imageUrl: raw.imageUrl ?? null,
        productUrl: raw.productUrl ?? null,
        sold: raw.sold ?? null,
        salesAmount: raw.salesAmount ?? null,
        imageCount: raw.imageCount ?? null,
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

    const skuKeyword = options.skuKeyword?.trim()
    const filtered = skuKeyword
      ? products.filter((p) => p.skus.some((s) => s.name?.toLowerCase().includes(skuKeyword.toLowerCase()) || s.skuId?.toLowerCase().includes(skuKeyword.toLowerCase())))
      : products

    return {
      ok: true,
      source: 'collection',
      collection: {
        id: collectionJob.id,
        keyword: collectionJob.keyword,
        priceRange: (collectionJob.rawResultJson as { priceRange?: string } | null)?.priceRange ?? null,
        productCount: total ?? products.length,
        collectTime: collectionJob.createdAt,
      },
      products: filtered,
      total: total ?? (page ? filtered.length : undefined),
      page,
      pageSize,
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
        {
          prompt: '分析该商品主图：输出 JSON，字段含 ocr、selling_points、qa_user_needs、audience_and_scene、listing_suggestions、image_overall_plan；若无法结构化则输出纯文本摘要',
          system: '你是电商主图视觉分析师，优先返回结构化 JSON。',
          images: [input.imageUrl],
          maxTokens: 2000,
        },
        { tenantId: input.tenantId, jobId: run.jobId, attemptKey: `report:${run.id}:vision:${input.productId ?? 'p'}`, userId: input.userId },
      )
      text = result.text
      model = result.model
    }
    const structured = text ? this.parseVisionJson(text) : null
    const saved = await this.prisma.mainImageAnalysis.create({
      data: {
        analysisRunId: run.id,
        productId: input.productId,
        imageUrl: input.imageUrl,
        visionModel: model,
        resultJson: (structured ?? { summary: text ?? '未提供主图，未执行视觉分析' }) as Prisma.InputJsonValue,
      },
    })
    return { id: saved.id, analyzedAt: saved.createdAt, structured: Boolean(structured) }
  }

  /** 视觉分析结果：若模型返回合法 JSON 则保留结构化字段，否则回退为纯文本 summary（诚实呈现，不伪造）。 */
  private parseVisionJson(text: string): Record<string, unknown> | null {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      const parsed = JSON.parse(text.slice(start, end + 1))
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
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
      where: {
        tenantId: input.tenantId,
        ...(input.keyword?.trim() ? { keyword: { contains: input.keyword.trim() } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!collectionJob) {
      return { ok: true, priceBands: [], profitSimulation: null, collection: null }
    }
    const rows = await this.prisma.productSnapshot.findMany({
      where: { collectionJobId: collectionJob.id },
      select: { price: true, externalProductId: true, title: true, shopName: true, rawJson: true },
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
    const bands = priceBands.map((band) => {
      const inBand = rows.filter((r) => {
        const price = Number(r.price)
        return price >= (band.priceMin ?? -Infinity) && price <= (band.priceMax ?? Infinity)
      })
      return {
        ...band,
        avgPrice: inBand.length ? Math.round((inBand.reduce((sum, r) => sum + Number(r.price), 0) / inBand.length) * 100) / 100 : 0,
        competitorLinks: inBand.slice(0, 3).map((r) => (r.rawJson as { productUrl?: string } | null)?.productUrl ?? null).filter(Boolean),
        displayImages: inBand.slice(0, 3).map((r) => (r.rawJson as { imageUrl?: string } | null)?.imageUrl ?? null).filter(Boolean),
        competitorTitles: inBand.slice(0, 3).map((r) => r.title ?? null).filter(Boolean),
        soldTotal: inBand.reduce((sum, r) => sum + Number((r.rawJson as { sold?: number } | null)?.sold ?? 0), 0),
        salesAmountTotal: inBand.reduce((sum, r) => sum + Number((r.rawJson as { salesAmount?: number } | null)?.salesAmount ?? 0), 0),
      }
    })
    return { ok: true, priceBands: bands, profitSimulation, collection: { id: collectionJob.id, keyword: collectionJob.keyword, productCount: rows.length } }
  }

  async getMainImageAnalysis(runId: string, productId: string, tenantId: string) {
    const run = await this.resolveRun(runId, tenantId)
    const analysis = await this.prisma.mainImageAnalysis.findFirst({
      where: { analysisRunId: run.id, productId },
      orderBy: { createdAt: 'desc' },
    })
    return {
      ok: true,
      productId,
      analysis: analysis ?? null,
    }
  }
}
