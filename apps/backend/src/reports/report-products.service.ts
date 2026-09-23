import { Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { AiCapability } from '../ai/ai.types'
import { ProviderRouter } from '../ai/provider-router.service'
import { PrismaService } from '../prisma.service'
import { computePriceBands as buildPriceBands } from './report-price-bands'
import { extractJson } from './report-json.util'

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
    // 1.22/1.23：优先复用该关键词已生成成功报告持久化的每带 AI 分析状态，
    // 无报告或某带宽未产出时才回退为 'raw'（基础数据），不伪造"已AI分析"。
    const existingRun = await this.prisma.analysisRun.findFirst({
      where: {
        tenantId: input.tenantId,
        status: 'success',
        ...(input.keyword?.trim() ? { keyword: { contains: input.keyword.trim() } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    })
    const bandStatusByRun = new Map<string, { analysisStatus: string; sellingPointsJson?: unknown; demandsJson?: unknown }>()
    if (existingRun) {
      const persistedBands = await this.prisma.analysisPriceBand.findMany({
        where: { analysisRunId: existingRun.id },
        select: { bandName: true, analysisStatus: true, sellingPointsJson: true, demandsJson: true },
      })
      for (const band of persistedBands) {
        bandStatusByRun.set(band.bandName, {
          analysisStatus: band.analysisStatus || 'raw',
          sellingPointsJson: band.sellingPointsJson ?? undefined,
          demandsJson: band.demandsJson ?? undefined,
        })
      }
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
      const persisted = bandStatusByRun.get(band.bandName)
      return {
        ...band,
        // 每带 AI 分析状态（旧版 analysis_status → analyzed/partial/raw）
        analysisStatus: persisted?.analysisStatus ?? 'raw',
        extractedSellingPoints: persisted ? (persisted.sellingPointsJson ?? []) : [],
        extractedDemands: persisted ? (persisted.demandsJson ?? []) : [],
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

  /**
   * 1.22/1.23：按价格段重跑 AI 分析。基于该段真实商品样本（标题/图片/评价）调用模型，
   * 无真实模型 key 时保持 'raw'（诚实空态），不伪造"已AI分析"。
   */
  async rerunBandAnalysis(input: { tenantId: string; keyword?: string; bandName: string; userId?: string }) {
    const bandName = String(input.bandName || '').trim()
    if (!bandName) throw new NotFoundException('缺少价格段')
    const run = await this.prisma.analysisRun.findFirst({
      where: {
        tenantId: input.tenantId,
        status: 'success',
        ...(input.keyword?.trim() ? { keyword: { contains: input.keyword.trim() } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    })
    if (!run) throw new NotFoundException('未找到该关键词的已生成报告')
    const bandRow = await this.prisma.analysisPriceBand.findFirst({ where: { analysisRunId: run.id, bandName } })
    if (!bandRow) throw new NotFoundException('价格段不存在于报告中')

    const collectionJob = await this.prisma.collectionJob.findUnique({ where: { jobId: run.jobId } })
    const min = Number(bandRow.priceMin ?? -Infinity)
    const max = Number(bandRow.priceMax ?? Infinity)
    const products = collectionJob
      ? await this.prisma.productSnapshot.findMany({
          where: { collectionJobId: collectionJob.id },
          take: 8,
          orderBy: { createdAt: 'desc' },
        })
      : []
    const inBand = products.filter((p) => {
      const price = Number(p.price)
      return price >= min && price <= max
    })
    if (!inBand.length) {
      return { ok: true, bandName, analysisStatus: 'raw', message: '该价格段暂无商品样本，保持基础数据' }
    }

    const sample = inBand.map((p) => ({ title: p.title ?? '', price: p.price?.toString(), shop: p.shopName }))
    const attemptKey = `band-rerun:${run.id}:${bandName}:${randomUUID()}`
    const result = await this.router.execute(
      'text',
      {
        system: '你是电商竞品价格段分析师。请仅输出合法 JSON：{"sellingPoints":[{"term":"卖点","count":次数}],"demands":[{"term":"需求/问大家点","count":次数}],"imagePrompts":{"style":"风格","scene":"场景","composition":"构图"}}。基于给定商品真实信息提炼，数据不足的字段省略，不要编造数字。',
        prompt: `价格段 ${bandName} 的商品样本：${JSON.stringify(sample)}`,
        maxTokens: 1500,
      },
      { tenantId: input.tenantId, jobId: run.jobId, attemptKey, userId: input.userId },
    )
    const parsed = extractJson(result.text)
    const sellingPoints = Array.isArray(parsed?.sellingPoints) ? parsed.sellingPoints : []
    const demands = Array.isArray(parsed?.demands) ? parsed.demands : []
    const imagePrompts = parsed?.imagePrompts && typeof parsed.imagePrompts === 'object' ? parsed.imagePrompts : null
    const analyzed = sellingPoints.length > 0 || demands.length > 0
    const status = analyzed ? 'analyzed' : 'raw'
    await this.prisma.analysisPriceBand.update({
      where: { id: bandRow.id },
      data: {
        analysisStatus: status,
        sellingPointsJson: (sellingPoints.length ? sellingPoints : []) as Prisma.InputJsonValue,
        demandsJson: (demands.length ? demands : []) as Prisma.InputJsonValue,
        imagePromptsJson: (imagePrompts ?? {}) as Prisma.InputJsonValue,
      },
    })
    return {
      ok: true,
      bandName,
      analysisStatus: status,
      extractedSellingPoints: sellingPoints,
      extractedDemands: demands,
      imagePrompts,
      model: result.model,
    }
  }
}
