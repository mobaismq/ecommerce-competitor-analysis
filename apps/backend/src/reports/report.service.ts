import { createHash, randomBytes } from 'node:crypto'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { buildAttemptKey } from '../ai/ai.types'
import { ProviderRouter } from '../ai/provider-router.service'
import { PrismaService } from '../prisma.service'
import { computePriceBands as buildPriceBands, type PriceBand } from './report-price-bands'
import { extractJson } from './report-json.util'

export interface RunReportInput {
  jobId: string
  tenantId: string
  attempt?: number
  /** 发起用户 id，用于命中个人自配 AI 供应商 */
  userId?: string
}

export interface RunReportResult {
  reused: boolean
  reportNo?: string
  reportHash?: string
  competitorCount?: number
  status: string
}

interface RichSku {
  name: string | null
  price: number | null
}

interface LoadedProduct {
  id: string
  externalProductId: string | null
  title: string | null
  price: number | null
  shopName: string | null
  imageUrl: string | null
  rawJson: Prisma.JsonValue | null
  skus: RichSku[]
  reviews: string[]
  qas: string[]
}

interface RepresentativeProduct {
  productSnapshotId: string | null
  externalProductId: string | null
  title: string | null
  shopName: string | null
  price: number | null
  imageUrl: string | null
  productUrl: string | null
  sold: number | null
  salesAmount: number | null
  skuCount: number
  skus: RichSku[]
}

interface RichPriceBand extends PriceBand {
  avgPrice: number | null
  /** 该价格带竞品销量合计（来自采集 rawJson.sold，无数据为 0） */
  soldTotal: number
  representativeProducts: RepresentativeProduct[]
}

interface InsightRow {
  type: string
  title: string
  content: string
}

const POSITIVE_TERMS = ['性价比', '质量', '耐用', '好用', '满意', '实惠', '清晰', '精准', '便携', '防水', '美观', '方便']
const NEGATIVE_TERMS = ['差', '不行', '失望', '容易坏', '坏了', '退货', '难用', '偏贵', '太小', '漏', '慢', '脏']
const NEED_TERMS = ['希望', '需要', '建议', '能不能', '多久', '怎么', '是否', '支持']

function buildReportNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `R${date}${randomBytes(4).toString('hex').toUpperCase()}`
}

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouter,
  ) {}

  async runReport(input: RunReportInput): Promise<RunReportResult> {
    const job = await this.prisma.job.findUnique({ where: { id: input.jobId } })
    if (!job || job.tenantId !== input.tenantId) throw new NotFoundException('任务不存在')

    const existing = await this.prisma.analysisRun.findUnique({ where: { jobId: job.id } })
    if (existing?.status === 'success') {
      return {
        reused: true,
        reportNo: existing.reportNo ?? undefined,
        reportHash: existing.reportHash ?? undefined,
        competitorCount: existing.competitorCount ?? undefined,
        status: existing.status,
      }
    }

    // 装载该采集任务的全部商品快照（含 SKU / 问大家 / 评价），作为富报告的确定性数据来源
    const collectionJob = await this.prisma.collectionJob.findUnique({ where: { jobId: job.id } })
    const products = collectionJob ? await this.loadProducts(collectionJob.id) : []
    const competitorCount = products.length
    const baseBands = buildPriceBands(products.map((p) => p.price).filter((n): n is number => n != null && Number.isFinite(n)))
    const richPriceBands = this.buildRichPriceBands(products, baseBands)

    const reviewTexts = products.flatMap((p) => p.reviews)
    const qaTexts = products.flatMap((p) => p.qas)

    const attemptKey = buildAttemptKey({
      jobId: job.id,
      capability: 'text',
      attempt: input.attempt ?? job.attempt,
      suffix: 'report',
    })
    const aiResult = await this.router.execute(
      'text',
      {
        prompt: this.buildAiPrompt({
          keyword: collectionJob?.keyword ?? job.type,
          competitorCount,
          priceBands: richPriceBands,
          reviewTexts,
          qaTexts,
        }),
        system: '你是电商竞品分析报告助手。请仅输出一个合法 JSON 对象，不要输出任何多余文字、Markdown 或代码块。',
        maxTokens: Number(process.env.ARK_OVERALL_REPORT_MAX_OUTPUT_TOKENS ?? 10000),
      },
      { tenantId: input.tenantId, jobId: job.id, attemptKey, userId: input.userId ?? job.userId ?? undefined },
    )

    const parsed = extractJson(aiResult.text)
    const sellingPoints = Array.isArray(parsed?.sellingPoints) && parsed.sellingPoints.length
      ? parsed.sellingPoints
      : this.termCounts(reviewTexts, POSITIVE_TERMS)
    const painPoints = Array.isArray(parsed?.painPoints) && parsed.painPoints.length
      ? parsed.painPoints.map((x: unknown) => String(x))
      : this.termCounts(reviewTexts, NEGATIVE_TERMS).map((t) => t.term)
    const userDemands = Array.isArray(parsed?.userDemands) && parsed.userDemands.length
      ? parsed.userDemands.map((x: unknown) => String(x))
      : this.termCounts(qaTexts, NEED_TERMS).map((t) => t.term)
    const opportunities = Array.isArray(parsed?.opportunities) && parsed.opportunities.length
      ? parsed.opportunities.map((x: unknown) => String(x))
      : []
    const summary = typeof parsed?.summary === 'string' && parsed.summary.trim() ? parsed.summary : (aiResult.text ?? '')

    const insights = this.buildInsights({ summary, sellingPoints, painPoints, userDemands, opportunities })
    // 旧版富区块（竞品Top/关键词矩阵/建议动作/差异化方向）只在模型真实返回时透传，缺省不造
    const passthrough = (key: string) => (parsed && typeof parsed === 'object' && parsed[key] != null ? parsed[key] : undefined)
    const reportJson = {
      summary,
      priceBands: richPriceBands,
      sellingPoints,
      painPoints,
      userDemands,
      opportunities,
      insights,
      ...(passthrough('competitors') ? { competitors: passthrough('competitors') } : {}),
      ...(passthrough('keywordMatrix') ? { keywordMatrix: passthrough('keywordMatrix') } : {}),
      ...(passthrough('recommendationActions') ? { recommendationActions: passthrough('recommendationActions') } : {}),
      ...(passthrough('differentiation') ? { differentiation: passthrough('differentiation') } : {}),
    }
    const reportHash = createHash('sha256').update(JSON.stringify(reportJson)).digest('hex')
    const reportNo = buildReportNo()

    const run = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.analysisRun.upsert({
        where: { jobId: job.id },
        update: {
          status: 'success',
          keyword: collectionJob?.keyword ?? null,
          reportNo,
          reportHash,
          competitorCount,
          costModelJson: { attemptKey, model: aiResult.model, tokenIn: aiResult.tokenIn, tokenOut: aiResult.tokenOut } as Prisma.InputJsonValue,
          reportJson: reportJson as unknown as Prisma.InputJsonValue,
        },
        create: {
          tenantId: input.tenantId,
          jobId: job.id,
          analysisType: job.type === 'analysis' ? 'market' : 'report',
          status: 'success',
          keyword: collectionJob?.keyword ?? null,
          reportNo,
          reportHash,
          competitorCount,
          costModelJson: { attemptKey, model: aiResult.model, tokenIn: aiResult.tokenIn, tokenOut: aiResult.tokenOut } as Prisma.InputJsonValue,
          reportJson: reportJson as unknown as Prisma.InputJsonValue,
        },
      })

      await tx.analysisPriceBand.deleteMany({ where: { analysisRunId: saved.id } })
      if (baseBands.length > 0) {
        await tx.analysisPriceBand.createMany({
          data: baseBands.map((band) => ({
            analysisRunId: saved.id,
            bandName: band.bandName,
            priceMin: band.priceMin,
            priceMax: band.priceMax,
            productCount: band.productCount,
          })),
        })
      }
      // 持久化每带代表商品到 AnalysisBandProduct（按 bandName 关联新写入的 AnalysisPriceBand 行）
      const savedBands = await tx.analysisPriceBand.findMany({ where: { analysisRunId: saved.id } })
      if (savedBands.length > 0) {
        const richByBand = new Map(richPriceBands.map((rb) => [rb.bandName, rb]))
        const bandProducts = savedBands.flatMap((band) => {
          const rich = richByBand.get(band.bandName)
          if (!rich || !rich.representativeProducts.length) return []
          return rich.representativeProducts.map((p) => ({
            priceBandId: band.id,
            productSnapshotId: p.productSnapshotId,
            externalProductId: p.externalProductId,
            title: p.title,
            price: p.price,
            imageUrl: p.imageUrl,
          }))
        })
        if (bandProducts.length) await tx.analysisBandProduct.createMany({ data: bandProducts })
      }
      await tx.analysisInsight.deleteMany({ where: { analysisRunId: saved.id } })
      if (insights.length > 0) {
        await tx.analysisInsight.createMany({
          data: insights.map((insight) => ({
            analysisRunId: saved.id,
            type: insight.type,
            title: insight.title.slice(0, 191),
            content: insight.content ? insight.content.slice(0, 191) : null,
          })),
        })
      }
      return saved
    })

    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'success',
        stage: 'success',
        checkpointStage: 'reporting',
        finishedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    })

    return {
      reused: false,
      reportNo: run.reportNo ?? undefined,
      reportHash: run.reportHash ?? undefined,
      competitorCount: run.competitorCount ?? undefined,
      status: run.status,
    }
  }

  /** 装载商品快照及其 SKU / 问大家 / 评价（schema 无 relation 字段，故分表查询后归并） */
  private async loadProducts(collectionJobId: string): Promise<LoadedProduct[]> {
    const rows = await this.prisma.productSnapshot.findMany({
      where: { collectionJobId },
      orderBy: { price: 'asc' },
    })
    const ids = rows.map((r) => r.id)
    if (!ids.length) return []

    const [skus, qas, reviews] = await Promise.all([
      this.prisma.productSkuSnapshot.findMany({ where: { productSnapshotId: { in: ids } } }),
      this.prisma.productQaSnapshot.findMany({ where: { productSnapshotId: { in: ids } } }),
      this.prisma.productReviewSnapshot.findMany({ where: { productSnapshotId: { in: ids } } }),
    ])

    const skuByP = new Map<string, RichSku[]>()
    for (const s of skus) {
      const arr = skuByP.get(s.productSnapshotId) ?? []
      arr.push({ name: s.name, price: Number(s.price) })
      skuByP.set(s.productSnapshotId, arr)
    }
    const qaByP = new Map<string, string[]>()
    for (const q of qas) {
      if (!q.question) continue
      const arr = qaByP.get(q.productSnapshotId) ?? []
      arr.push(q.question)
      qaByP.set(q.productSnapshotId, arr)
    }
    const revByP = new Map<string, string[]>()
    for (const r of reviews) {
      if (!r.content) continue
      const arr = revByP.get(r.productSnapshotId) ?? []
      arr.push(r.content)
      revByP.set(r.productSnapshotId, arr)
    }

    return rows.map((r) => ({
      id: r.id,
      externalProductId: r.externalProductId,
      title: r.title,
      price: Number(r.price),
      shopName: r.shopName,
      imageUrl: typeof r.rawJson === 'object' && r.rawJson && 'imageUrl' in r.rawJson ? String((r.rawJson as Prisma.JsonObject).imageUrl ?? '') || null : null,
      rawJson: r.rawJson,
      skus: skuByP.get(r.id) ?? [],
      reviews: revByP.get(r.id) ?? [],
      qas: qaByP.get(r.id) ?? [],
    }))
  }

  /** 为每个价格带补均价与代表商品（有 SKU 优先、价格居中的代表款） */
  private buildRichPriceBands(products: LoadedProduct[], baseBands: PriceBand[]): RichPriceBand[] {
    return baseBands.map((band) => {
      const inBand = products.filter((p) => p.price != null && p.price >= band.priceMin && p.price <= band.priceMax)
      const prices = inBand.map((p) => p.price as number)
      const avgPrice = prices.length ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : null
      const soldTotal = inBand.reduce((sum, p) => sum + (this.readSold(p.rawJson) ?? 0), 0)
      const representativeProducts = [...inBand]
        .sort((a, b) => b.skus.length - a.skus.length || (a.price ?? 0) - (b.price ?? 0))
        .slice(0, 3)
        .map((p) => ({
          productSnapshotId: p.id,
          externalProductId: p.externalProductId,
          title: p.title,
          shopName: p.shopName,
          price: p.price,
          imageUrl: p.imageUrl,
          productUrl: this.readRawString(p.rawJson, 'productUrl'),
          sold: this.readSold(p.rawJson),
          salesAmount: this.readRawNumber(p.rawJson, 'salesAmount'),
          skuCount: p.skus.length,
          skus: p.skus,
        }))
      return { ...band, avgPrice, soldTotal, representativeProducts }
    })
  }

  /** 安全读取采集 rawJson.sold（采集 DTO 可选回传月销）。 */
  private readSold(rawJson: Prisma.JsonValue | null): number | null {
    if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) return null
    const record = rawJson as Record<string, unknown>
    const value = record.sold
    return typeof value === 'number' ? value : null
  }

  private readRawNumber(rawJson: Prisma.JsonValue | null, key: string): number | null {
    if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) return null
    const value = (rawJson as Record<string, unknown>)[key]
    return typeof value === 'number' ? value : null
  }

  private readRawString(rawJson: Prisma.JsonValue | null, key: string): string | null {
    if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) return null
    const value = (rawJson as Record<string, unknown>)[key]
    return typeof value === 'string' && value.trim() ? value : null
  }

  /** 简单关键词频度聚合（AI 不可用时的诚实兜底，基于真实评价/问大家文本） */
  private termCounts(texts: string[], terms: string[]): Array<{ term: string; count: number }> {
    const result: Array<{ term: string; count: number }> = []
    for (const term of terms) {
      let count = 0
      for (const text of texts) if (text.includes(term)) count += 1
      if (count > 0) result.push({ term, count })
    }
    return result.sort((a, b) => b.count - a.count).slice(0, 8)
  }

  private buildAiPrompt(opts: {
    keyword: string
    competitorCount: number
    priceBands: RichPriceBand[]
    reviewTexts: string[]
    qaTexts: string[]
  }): string {
    const bandLines = opts.priceBands.map((b) => {
      const reps = b.representativeProducts
        .map((p) => `${p.title ?? '无标题'}(${p.shopName ?? '未知店铺'} ¥${p.price ?? '-'})`)
        .join(' | ')
      return `- ${b.bandName}元：${b.productCount}款，均价¥${b.avgPrice ?? '-'}${reps ? `；代表：${reps}` : ''}`
    }).join('\n')
    const reviewSample = opts.reviewTexts.slice(0, 60).join('\n').slice(0, 2000)
    const qaSample = opts.qaTexts.slice(0, 60).join('\n').slice(0, 1200)
    return [
      `基于已采集竞品数据生成竞品分析报告。`,
      `关键词：${opts.keyword}`,
      `竞品样本数：${opts.competitorCount}`,
      `价格带概况：\n${bandLines}`,
      reviewSample ? `评价样本（前若干条，用于判断卖点/痛点）：\n${reviewSample}` : '（无评价样本）',
      qaSample ? `问大家样本（前若干条，用于判断用户需求）：\n${qaSample}` : '（无问大家样本）',
      ``,
      `请输出 JSON：{"summary":"整体结论","sellingPoints":[{"term":"卖点词","count":次数}],"painPoints":["痛点"],"userDemands":["用户需求"],"opportunities":["机会点"],"competitors":[{"rank":1,"title":"竞品名","price":0,"sold":0,"salesAmount":0,"sellingPoint":"核心卖点"}],"keywordMatrix":{"coreKeywords":[{"term":"词","count":0}],"blueOceanKeywords":[{"term":"词","count":0}]},"recommendationActions":{"actionPlan":{"titleStructure":"","pricingAnchor":"","searchTerms":"","bulletOrder":""},"positiveSellingPoints":[{"term":"好评点","count":0}],"negativePainPoints":[{"term":"差评点","count":0}]},"differentiation":{"opportunityScore":0,"salesValidation":0,"demandStrength":0,"competitorGap":0,"directions":["差异化方向"]}}。数据不足的字段省略，不要编造数字。`,
    ].join('\n')
  }

  private buildInsights(opts: {
    summary: string
    sellingPoints: Array<{ term: string; count: number }>
    painPoints: string[]
    userDemands: string[]
    opportunities: string[]
  }): InsightRow[] {
    const rows: InsightRow[] = [{ type: 'summary', title: 'AI 总结', content: opts.summary.slice(0, 500) || '未生成总结' }]
    if (opts.sellingPoints.length) {
      rows.push({ type: 'selling_point', title: '核心卖点', content: opts.sellingPoints.map((s) => `${s.term}(${s.count})`).join('、') })
    }
    if (opts.painPoints.length) rows.push({ type: 'pain_point', title: '差评痛点', content: opts.painPoints.slice(0, 8).join('、') })
    if (opts.userDemands.length) rows.push({ type: 'user_demand', title: '用户需求', content: opts.userDemands.slice(0, 8).join('、') })
    if (opts.opportunities.length) rows.push({ type: 'opportunity', title: '机会点', content: opts.opportunities.slice(0, 8).join('、') })
    return rows
  }
}
