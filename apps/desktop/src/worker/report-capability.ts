import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '../generated/prisma'
import { createRealAiProvider, type RealAiProvider } from './ai-provider'
import { createSkillReports, prepareProductEvidence, type ReportProgress } from './report-skill-pipeline'
import { createCreativePlan } from './creative-report'
import { creativePlanMarkdown, type CreativePlan } from '../shared/creative-report'
import { getWorkerPrisma, putBytes, readBytesByKey, workerDataRoots } from './worker-db'

export type ReportAiProvider = Pick<RealAiProvider, 'generateText' | 'analyzeImage'>

export interface PriceBand {
  bandName: string
  priceMin: number
  priceMax: number
  productCount: number
}

export interface GenerateReportInput {
  userId: string
  tenantId: string
  keyword: string
  limit?: number
  collectionJobId?: string
  jobId?: string
  regenerate?: boolean
}

interface RichSku {
  name: string | null
  price: number | null
  imageUrl?: string | null
}

interface LoadedProduct {
  id: string
  externalProductId: string
  title: string | null
  price: number | null
  shopName: string | null
  imageUrl: string | null
  productUrl: string | null
  sold: number | null
  salesAmount: number | null
  rawJson: Record<string, unknown> | null
  skus: RichSku[]
  reviews: string[]
  reviewItems: Array<{ content: string; rating: number | null }>
  qas: string[]
}

interface RichPriceBand extends PriceBand {
  avgPrice: number | null
  soldTotal: number
  representativeProducts: Array<{
    productSnapshotId: string
    externalProductId: string
    title: string | null
    shopName: string | null
    price: number | null
    imageUrl: string | null
    productUrl: string | null
    sold: number | null
    salesAmount: number | null
    skuCount: number
    skus: RichSku[]
  }>
}

export const REPORT_EXPORT_FORMATS = ['json', 'markdown', 'html'] as const
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number]

function roundCents(value: number) {
  return Math.round(value * 100) / 100
}

/** 自适应等频分箱（迁移后端 report-price-bands.ts 的唯一权威算法）。 */
export function computePriceBands(prices: readonly number[]): PriceBand[] {
  const priced = prices.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!priced.length) return []
  const min = priced[0]
  const max = priced[priced.length - 1]
  if (min === max) return [{ bandName: `${min}元`, priceMin: min, priceMax: max, productCount: priced.length }]
  const bandCount = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(priced.length))))
  const groups: number[][] = []
  for (let index = 0; index < bandCount; index += 1) {
    const start = Math.floor((index * priced.length) / bandCount)
    const end = Math.floor(((index + 1) * priced.length) / bandCount)
    const items = priced.slice(start, end)
    if (items.length) groups.push(items)
  }
  const merged = new Map<string, { min: number; max: number; count: number }>()
  for (const items of groups) {
    const lo = roundCents(Math.min(...items))
    const hi = roundCents(Math.max(...items))
    const key = lo === hi ? `${lo}元` : `${lo}-${hi}元`
    const current = merged.get(key) ?? { min: lo, max: hi, count: 0 }
    current.min = Math.min(current.min, lo)
    current.max = Math.max(current.max, hi)
    current.count += items.length
    merged.set(key, current)
  }
  return Array.from(merged.entries()).map(([bandName, band]) => ({
    bandName,
    priceMin: band.min,
    priceMax: band.max,
    productCount: band.count,
  }))
}

export function extractJson(text?: string): Record<string, any> | null {
  if (!text) return null
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

function rawRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function rawNumber(rawJson: Record<string, unknown> | null, key: string): number | null {
  const value = rawJson?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function rawString(rawJson: Record<string, unknown> | null, key: string): string | null {
  const value = rawJson?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function buildReportNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `R${date}${randomUUID().slice(0, 8).toUpperCase()}`
}

async function loadProducts(collectionJobId: string) {
  const db = getWorkerPrisma()
  const rows = await db.productSnapshot.findMany({ where: { collectionJobId }, orderBy: { price: 'asc' } })
  if (!rows.length) return [] as LoadedProduct[]
  const ids = rows.map((row) => row.id)
  const [skus, qas, reviews] = await Promise.all([
    db.productSkuSnapshot.findMany({ where: { productSnapshotId: { in: ids } } }),
    db.productQaSnapshot.findMany({ where: { productSnapshotId: { in: ids } } }),
    db.productReviewSnapshot.findMany({ where: { productSnapshotId: { in: ids } } }),
  ])
  const skuByProduct = new Map<string, RichSku[]>()
  for (const sku of skus) {
    const list = skuByProduct.get(sku.productSnapshotId) ?? []
    list.push({ name: sku.name, price: sku.price, imageUrl: sku.imageUrl })
    skuByProduct.set(sku.productSnapshotId, list)
  }
  const qaByProduct = new Map<string, string[]>()
  for (const qa of qas) {
    if (!qa.question) continue
    const list = qaByProduct.get(qa.productSnapshotId) ?? []
    list.push(`问题：${qa.question}${qa.answer ? `；回答：${qa.answer}` : ''}`)
    qaByProduct.set(qa.productSnapshotId, list)
  }
  const reviewByProduct = new Map<string, string[]>()
  for (const review of reviews) {
    if (!review.content) continue
    const list = reviewByProduct.get(review.productSnapshotId) ?? []
    list.push(review.content)
    reviewByProduct.set(review.productSnapshotId, list)
  }
  return rows.map((row) => {
    const rawJson = rawRecord(row.rawJson)
    return {
      id: row.id,
      externalProductId: row.externalProductId,
      title: row.title,
      price: row.price,
      shopName: row.shopName,
      imageUrl: rawString(rawJson, 'imageUrl'),
      productUrl: rawString(rawJson, 'productUrl'),
      sold: rawNumber(rawJson, 'sold'),
      salesAmount: rawNumber(rawJson, 'salesAmount'),
      rawJson,
      skus: skuByProduct.get(row.id) ?? [],
      reviews: reviewByProduct.get(row.id) ?? [],
      reviewItems: reviews.filter((review) => review.productSnapshotId === row.id && review.content).map((review) => ({ content: review.content!, rating: review.rating })),
      qas: qaByProduct.get(row.id) ?? [],
    }
  })
}

function buildRichPriceBands(products: LoadedProduct[], baseBands: PriceBand[]): RichPriceBand[] {
  return baseBands.map((band) => {
    const inBand = products.filter((product) => product.price != null && product.price >= band.priceMin && product.price <= band.priceMax)
    const prices = inBand.map((product) => product.price as number)
    const representativeProducts = [...inBand]
      .sort((a, b) => b.skus.length - a.skus.length || (a.price ?? 0) - (b.price ?? 0))
      .slice(0, 3)
      .map((product) => ({
        productSnapshotId: product.id,
        externalProductId: product.externalProductId,
        title: product.title,
        shopName: product.shopName,
        price: product.price,
        imageUrl: product.imageUrl,
        productUrl: product.productUrl,
        sold: product.sold,
        salesAmount: product.salesAmount,
        skuCount: product.skus.length,
        skus: product.skus,
      }))
    return {
      ...band,
      avgPrice: prices.length ? roundCents(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null,
      soldTotal: inBand.reduce((sum, product) => sum + (product.sold ?? 0), 0),
      representativeProducts,
    }
  })
}

function buildInsights(opts: { summary: string; sellingPoints: Array<{ term: string; count: number }>; painPoints: string[]; userDemands: string[]; opportunities: string[] }) {
  const rows: Array<{ type: string; title: string; content: string }> = [
    { type: 'summary', title: 'AI 总结', content: opts.summary.slice(0, 500) || '未生成总结' },
  ]
  if (opts.sellingPoints.length) rows.push({ type: 'selling_point', title: '核心卖点', content: opts.sellingPoints.map((item) => `${item.term}(${item.count})`).join('、') })
  if (opts.painPoints.length) rows.push({ type: 'pain_point', title: '差评痛点', content: opts.painPoints.slice(0, 8).join('、') })
  if (opts.userDemands.length) rows.push({ type: 'user_demand', title: '用户需求', content: opts.userDemands.slice(0, 8).join('、') })
  if (opts.opportunities.length) rows.push({ type: 'opportunity', title: '机会点', content: opts.opportunities.slice(0, 8).join('、') })
  return rows
}

// A batch may be submitted again while another window still shows its old state.
const generatingJobs = new Set<string>()
export async function generateReport(input: GenerateReportInput, provider?: ReportAiProvider, progress?: (event: ReportProgress) => void) {
  const keyword = String(input.keyword ?? '').trim()
  if (!keyword) throw new Error('keyword 不能为空')
  const db = getWorkerPrisma()
  const collection = await db.collectionJob.findFirst({
    where: { tenantId: input.tenantId, status: 'success', ...(input.collectionJobId ? { id: input.collectionJobId } : input.jobId ? { jobId: input.jobId } : { keyword: { contains: keyword } }) },
    orderBy: { createdAt: 'desc' },
  })
  if (!collection) throw new Error('未找到本机采集数据，请先完成采集')
  const existing = await db.analysisRun.findUnique({ where: { jobId: collection.jobId } })
  if (existing && ['success', 'completed'].includes(existing.status) && !input.regenerate && rawRecord(existing.reportJson)?.creativePlan) {
    return { ok: true, reused: true, jobId: existing.jobId, reportId: existing.id,
      reportNo: existing.reportNo ?? undefined, reportHash: existing.reportHash ?? undefined,
      competitorCount: existing.competitorCount ?? undefined, status: existing.status }
  }
  if (generatingJobs.has(collection.jobId)) throw new Error('该批次正在生成报告，请等待完成')
  generatingJobs.add(collection.jobId)
  try {
    const allProducts = await loadProducts(collection.id)
    if (!allProducts.length) throw new Error('本机采集数据为空，无法生成报告')
    if (input.limit != null && (!Number.isInteger(input.limit) || input.limit < 1)) throw new Error('商品数量必须是正整数')
    const products = input.limit ? allProducts.slice(0, input.limit) : allProducts
    const baseBands = computePriceBands(products.map((product) => product.price).filter((price): price is number => price != null))
    const richPriceBands = buildRichPriceBands(products, baseBands)
    const selected = provider ?? createRealAiProvider(input.userId)
    const generated = await createSkillReports(products, selected, progress)
    const productReports = generated.reports
    progress?.({ done: products.length, total: products.length, stage: '正在整理主图与详情页内容脚本' })
    const creativePlan = await createCreativePlan(collection.keyword ?? keyword, products, productReports, selected)
    const summary = productReports.map((report) => `${report.title}：${report.summary}`).join('\n\n')
    const unique = (field: 'painPoints' | 'userDemands' | 'opportunities') => [...new Set(productReports.flatMap((report) => report[field]))]
    const counts = new Map<string, number>()
    for (const report of productReports) for (const term of new Set(report.sellingPoints)) counts.set(term, (counts.get(term) ?? 0) + 1)
    const sellingPoints = [...counts].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count)
    const painPoints = unique('painPoints'), userDemands = unique('userDemands'), opportunities = unique('opportunities')
    const insights = buildInsights({ summary, sellingPoints, painPoints, userDemands, opportunities })
    const markdown = [`# ${collection.keyword ?? keyword} 竞品单品分析报告`,
      `本批共 ${allProducts.length} 件商品，本次分析 ${products.length} 件。卖点计数为覆盖商品数。`,
      ...productReports.map((report) => [
        `# ${report.title}（${report.productId}）`, report.markdown,
        '### 本次实际使用的数据',
        `评价 ${report.sampleCounts.reviewsUsed}/${report.sampleCounts.reviewsTotal} 条；问答 ${report.sampleCounts.qaUsed}/${report.sampleCounts.qaTotal} 条；图片 ${report.sampleCounts.imagesUsed}/${report.sampleCounts.imagesAvailable} 张。`,
        ...report.limitations.map((item) => `- ${item}`),
        '### 证据索引', ...report.evidence.map((item) => `- ${item.claim}【${item.confidence}】（${item.sourceIds.join('、')}）：${item.quote}`),
      ].join('\n\n')),
    ].join('\n\n')
    const reportJson = { summary, priceBands: richPriceBands, sellingPoints, sellingPointCountUnit: 'products', painPoints, userDemands, opportunities, insights,
      reportVersion: generated.version, templateHash: generated.templateHash, productReports, creativePlan, markdown, collectionProductCount: allProducts.length }
    const reportHash = createHash('sha256').update(JSON.stringify(reportJson)).digest('hex')
    const reportNo = buildReportNo()
    // Keep an existing report readable until every new product report has passed validation.
    const run = await db.$transaction(async (tx) => {
      const data = { tenantId: input.tenantId, jobId: collection.jobId, analysisType: 'market', status: 'success',
        keyword: collection.keyword ?? keyword, reportNo, reportHash, competitorCount: products.length,
        costModelJson: { models: [...new Set(productReports.flatMap((report) => [report.model, ...(report.visionModel ? [report.visionModel] : [])]))] }, reportJson: reportJson as unknown as Prisma.InputJsonValue }
      const saved = await tx.analysisRun.upsert({ where: { jobId: collection.jobId }, create: data, update: data })
      const oldBands = await tx.analysisPriceBand.findMany({ where: { analysisRunId: saved.id }, select: { id: true } })
      await tx.analysisBandProduct.deleteMany({ where: { priceBandId: { in: oldBands.map((band) => band.id) } } })
      await tx.analysisPriceBand.deleteMany({ where: { analysisRunId: saved.id } })
      await tx.analysisInsight.deleteMany({ where: { analysisRunId: saved.id } })
      for (const [index, band] of baseBands.entries()) {
        const savedBand = await tx.analysisPriceBand.create({ data: { analysisRunId: saved.id, ...band } })
        const representatives = richPriceBands[index]?.representativeProducts ?? []
        if (representatives.length) await tx.analysisBandProduct.createMany({ data: representatives.map((product) => ({
          priceBandId: savedBand.id, productSnapshotId: product.productSnapshotId, externalProductId: product.externalProductId,
          title: product.title, price: product.price, imageUrl: product.imageUrl,
        })) })
      }
      await tx.analysisInsight.createMany({ data: insights.map((insight) => ({ analysisRunId: saved.id, type: insight.type, title: insight.title.slice(0, 191), content: insight.content.slice(0, 191) })) })
      return saved
    }, { timeout: 30_000 })
    return { ok: true, reused: false, jobId: run.jobId, reportId: run.id, reportNo, reportHash, competitorCount: products.length, status: 'success', model: productReports[0]?.model }
  } finally { generatingJobs.delete(collection.jobId) }
}

export async function listReportJobs(input: { tenantId: string; status?: string; page?: number; pageSize?: number }) {
  const db = getWorkerPrisma()
  const pageSize = input.pageSize && input.pageSize > 0 ? Math.min(input.pageSize, 100) : 1
  const page = input.page && input.page > 0 ? input.page : 1
  const rows = await db.job.findMany({
    where: {
      tenantId: input.tenantId,
      type: 'analysis',
      ...(input.status?.trim() ? { status: input.status.trim() } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, status: true, type: true, stage: true, errorMessage: true, createdAt: true, paramsJson: true },
  })
  return {
    rows: rows.map((row) => ({
      ...row,
      keyword: rawRecord(row.paramsJson)?.keyword,
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

export interface ReportListInput {
  tenantId: string
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
  includeCollections?: boolean
  startTime?: string
  endTime?: string
}

export async function listReports(input: ReportListInput) {
  const db = getWorkerPrisma()
  const normalizedStatus = input.status?.trim()
  const status = ['success', 'completed'].includes(normalizedStatus ?? '') ? { in: ['success', 'completed'] }
    : ['failure', 'failed'].includes(normalizedStatus ?? '') ? { in: ['failure', 'failed'] } : normalizedStatus
  const date = (value?: string) => {
    if (!value) return undefined
    const parsed = new Date(value)
    if (!Number.isFinite(parsed.getTime())) throw new Error('更新时间格式无效')
    return parsed
  }
  const start = date(input.startTime)
  const end = date(input.endTime)
  if (start && end && start > end) throw new Error('开始时间不能晚于结束时间')
  const updatedAt = start || end ? { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } : undefined
  const where = {
    tenantId: input.tenantId,
    ...(status ? { status } : {}),
    ...(input.keyword?.trim() ? { keyword: { contains: input.keyword.trim() } } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  }
  const pageSize = input.pageSize && input.pageSize > 0 ? Math.min(input.pageSize, 100) : 100
  const page = input.page && input.page > 0 ? input.page : 1
  if (input.includeCollections) {
    const [runs, collections, reportedJobs] = await Promise.all([
      db.analysisRun.findMany({ where, orderBy: { updatedAt: 'desc' } }),
      db.collectionJob.findMany({ where: { tenantId: input.tenantId, status: 'success',
        ...(input.keyword?.trim() ? { keyword: { contains: input.keyword.trim() } } : {}),
        ...(updatedAt ? { updatedAt } : {}) } }),
      db.analysisRun.findMany({ where: { tenantId: input.tenantId }, select: { jobId: true } }),
    ])
    const reported = new Set(reportedJobs.map((run) => run.jobId))
    const pending = collections.filter((collection) => !reported.has(collection.jobId))
    const aggregates = pending.length ? await db.productSnapshot.groupBy({ by: ['collectionJobId'],
      where: { tenantId: input.tenantId, collectionJobId: { in: pending.map((collection) => collection.id) } },
      _count: { _all: true }, _min: { price: true }, _max: { price: true } }) : []
    const byCollection = new Map(aggregates.map((row) => [row.collectionJobId, row]))
    const rawRows = !normalizedStatus || normalizedStatus === 'not_generated' ? pending.flatMap((collection) => {
      const stats = byCollection.get(collection.id)
      if (!stats?._count._all) return []
      return [{ id: `raw-${collection.jobId}`, jobId: collection.jobId, collectionJobId: collection.id,
        keyword: collection.keyword, reportNo: null, status: 'not_generated', competitorCount: stats._count._all,
        priceMin: stats._min.price, priceMax: stats._max.price, createdAt: collection.createdAt, updatedAt: collection.updatedAt,
        reportJson: null, source: 'collection' as const }]
    }) : []
    const rows = [...runs.map((run) => ({ ...run, collectionJobId: null, source: 'report' as const })), ...rawRows]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id))
    return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize }
  }
  const [rows, total] = await Promise.all([
    db.analysisRun.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.analysisRun.count({ where }),
  ])
  return { rows, total, page, pageSize }
}

export async function latestReport(input: { tenantId: string; keyword?: string }) {
  const db = getWorkerPrisma()
  return db.analysisRun.findFirst({
    where: {
      tenantId: input.tenantId,
      status: { in: ['success', 'completed'] },
      ...(input.keyword?.trim() ? { keyword: { contains: input.keyword.trim() } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  })
}

async function resolveRun(runId: string | undefined, tenantId: string) {
  if (!runId) throw new Error('报告编号不能为空')
  const db = getWorkerPrisma()
  const run = await db.analysisRun.findFirst({ where: { OR: [{ id: runId }, { jobId: runId }, { reportNo: runId }], tenantId } })
  if (!run) throw new Error('报告不存在')
  return run
}

export async function getReport(input: { tenantId: string; runId: string }) {
  const db = getWorkerPrisma()
  const run = await resolveRun(input.runId, input.tenantId)
  const priceBands = await db.analysisPriceBand.findMany({ where: { analysisRunId: run.id }, orderBy: { priceMin: 'asc' } })
  const bandIds = priceBands.map((band) => band.id)
  const [insights, bandProducts] = await Promise.all([
    db.analysisInsight.findMany({ where: { analysisRunId: run.id }, orderBy: { createdAt: 'asc' } }),
    bandIds.length ? db.analysisBandProduct.findMany({ where: { priceBandId: { in: bandIds } } }) : Promise.resolve([]),
  ])
  return {
    ...run,
    priceBands: priceBands.map((band) => ({ ...band, representativeProducts: bandProducts.filter((product) => product.priceBandId === band.id) })),
    insights,
  }
}

function renderReport(run: { reportNo: string | null; reportJson: unknown }, format: ReportExportFormat) {
  const report = rawRecord(run.reportJson) ?? {}
  const priceBands = Array.isArray(report.priceBands) ? report.priceBands : []
  const insights = Array.isArray(report.insights) ? report.insights : []
  const summary = typeof report.summary === 'string' ? report.summary : ''
  if (format === 'json') return JSON.stringify(report, null, 2)
  const bandLines = priceBands.map((band) => {
    const record = rawRecord(band) ?? {}
    return `- ${String(record.bandName ?? '')}：${String(record.productCount ?? 0)} 个商品`
  }).join('\n')
  const insightLines = insights.map((insight) => {
    const record = rawRecord(insight) ?? {}
    return `- ${String(record.title ?? record.type ?? '')}：${String(record.content ?? '')}`
  }).join('\n')
  const creative = rawRecord(report.creativePlan)
  const fullMarkdown = [creative ? creativePlanMarkdown(creative as unknown as CreativePlan) : '', typeof report.markdown === 'string' ? report.markdown : ''].filter(Boolean).join('\n\n---\n\n')
  if (format === 'markdown' && fullMarkdown) return fullMarkdown
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
  if (format === 'html' && fullMarkdown) return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>竞品分析报告 ${escape(run.reportNo ?? '')}</title><style>body{max-width:1100px;margin:40px auto;padding:24px;font:16px/1.8 system-ui}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><pre>${escape(fullMarkdown)}</pre></body></html>`
  if (format === 'markdown') {
    return [`# 竞品分析报告 ${run.reportNo ?? ''}`, '', '## 总结', summary, '', '## 价格带', bandLines || '- 无', '', '## 洞察', insightLines || '- 无', ''].join('\n')
  }
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>竞品分析报告 ${run.reportNo ?? ''}</title></head><body><h1>竞品分析报告 ${run.reportNo ?? ''}</h1><h2>总结</h2><p>${escape(summary)}</p><h2>价格带</h2><pre>${escape(bandLines)}</pre><h2>洞察</h2><pre>${escape(insightLines)}</pre></body></html>`
}

export async function exportReport(input: { userId: string; tenantId: string; runId: string; format: ReportExportFormat }) {
  if (!REPORT_EXPORT_FORMATS.includes(input.format)) throw new Error(`不支持的导出格式: ${String(input.format)}`)
  const db = getWorkerPrisma()
  const run = await resolveRun(input.runId, input.tenantId)
  const extension = input.format === 'markdown' ? 'md' : input.format
  const storageKey = `users/${input.userId}/reports/${run.reportNo ?? run.id}-${run.reportHash?.slice(0, 10) ?? 'legacy'}/report.${extension}`
  const existing = await db.generatedAsset.findUnique({ where: { storageKey } })
  if (existing) {
    const bytes = readBytesByKey(storageKey, workerDataRoots())
    if (bytes) return { ok: true, storageKey, mimeType: existing.mimeType, size: existing.size, reused: true, content: bytes.toString('utf8') }
  }
  const content = renderReport(run, input.format)
  const bytes = Buffer.from(content, 'utf8')
  putBytes(storageKey, bytes, { userRoot: workerDataRoots().userRoot })
  const asset = await db.generatedAsset.create({
    data: {
      tenantId: input.tenantId,
      analysisRunId: run.id,
      runId: run.id,
      storageKey,
      mimeType: input.format === 'json' ? 'application/json' : input.format === 'markdown' ? 'text/markdown' : 'text/html',
      size: bytes.length,
      originalName: `${run.reportNo ?? run.id}.${extension}`,
    },
  })
  return { ok: true, storageKey, mimeType: asset.mimeType, size: asset.size, reused: false, content }
}

export async function reportProducts(input: { tenantId: string; runId: string; keyword?: string; productId?: string; shopName?: string; skuKeyword?: string; page?: number; pageSize?: number }) {
  const db = getWorkerPrisma()
  const rawJobId = input.runId.startsWith('raw-') ? input.runId.slice(4) : null
  const run = rawJobId ? null : await resolveRun(input.runId, input.tenantId)
  const collection = await db.collectionJob.findFirst({ where: { jobId: rawJobId ?? run!.jobId, tenantId: input.tenantId } })
  if (rawJobId && !collection) throw new Error('采集数据不存在')
  if (!collection) return { ok: true, source: 'run', collection: null, products: [], total: 0 }
  const where = {
    collectionJobId: collection.id,
    ...(input.keyword?.trim() ? { title: { contains: input.keyword.trim() } } : {}),
    ...(input.productId?.trim() ? { externalProductId: { contains: input.productId.trim() } } : {}),
    ...(input.shopName?.trim() ? { shopName: { contains: input.shopName.trim() } } : {}),
  }
  const page = input.page && input.page > 0 ? input.page : 1
  const pageSize = input.pageSize && input.pageSize > 0 ? Math.min(input.pageSize, 100) : 20
  const [rows, total, prices] = await Promise.all([
    db.productSnapshot.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.productSnapshot.count({ where }),
    db.productSnapshot.aggregate({ where: { collectionJobId: collection.id }, _min: { price: true }, _max: { price: true } }),
  ])
  const ids = rows.map((row) => row.id)
  const [skus, analyses] = await Promise.all([
    ids.length ? db.productSkuSnapshot.findMany({ where: { productSnapshotId: { in: ids } } }) : Promise.resolve([]),
    run ? db.mainImageAnalysis.findMany({ where: { analysisRunId: run.id, productId: { in: rows.map((row) => row.externalProductId) } } }) : Promise.resolve([]),
  ])
  const analysisByProduct = new Map(analyses.filter((item) => item.productId).map((item) => [item.productId as string, item]))
  const products = rows.map((row) => {
    const raw = rawRecord(row.rawJson) ?? {}
    const analysis = analysisByProduct.get(row.externalProductId)
    return {
      id: row.id,
      productId: row.externalProductId,
      title: row.title,
      shopName: row.shopName,
      price: row.price,
      imageUrl: rawString(raw, 'imageUrl'),
      productUrl: rawString(raw, 'productUrl'),
      sold: rawNumber(raw, 'sold'),
      salesAmount: rawNumber(raw, 'salesAmount'),
      skus: skus.filter((sku) => sku.productSnapshotId === row.id).map((sku) => ({ skuId: sku.skuId, name: sku.name, price: sku.price, imageUrl: sku.imageUrl })),
      mainImageAnalysisId: analysis?.id ?? null,
      mainImageAnalyzedAt: analysis?.createdAt ?? null,
    }
  })
  return { ok: true, source: 'collection', collection: { id: collection.id, keyword: collection.keyword, productCount: total,
    priceRange: agentPriceRangeText(prices._min.price, prices._max.price), collectTime: collection.updatedAt.toISOString() }, products, total, page, pageSize }
}

/** Read preview bytes only for products belonging to this tenant's selected report. */
export async function reportReferenceImages(input: { tenantId: string; runId: string }) {
  const db = getWorkerPrisma(), run = await resolveRun(input.runId, input.tenantId)
  const collection = await db.collectionJob.findFirst({ where: { tenantId: input.tenantId, jobId: run.jobId } })
  if (!collection) return { images: [] }
  const products = await loadProducts(collection.id)
  return { images: products.slice(0, 6).flatMap((product) => prepareProductEvidence(product).images.filter((image) => image.kind === 'main_image').slice(0, 2)
    .map((image) => ({ productId: product.externalProductId, title: product.title, id: `${product.externalProductId}:${image.id}`, dataUrl: image.image }))) }
}

export async function runMainImageAnalysis(input: { userId: string; tenantId: string; runId: string; productId?: string; imageUrl?: string }, provider?: ReportAiProvider) {
  const db = getWorkerPrisma()
  const run = await resolveRun(input.runId, input.tenantId)
  if (!input.imageUrl?.trim()) throw new Error('imageUrl 不能为空')
  const selected = provider ?? createRealAiProvider(input.userId)
  const ai = await selected.analyzeImage({
    prompt: '分析该商品主图：输出 JSON，字段含 ocr、selling_points、qa_user_needs、audience_and_scene、listing_suggestions、image_overall_plan；若无法结构化则输出纯文本摘要',
    system: '你是电商主图视觉分析师，优先返回结构化 JSON。',
    images: [input.imageUrl],
    maxTokens: 2000,
  })
  const structured = extractJson(ai.text)
  const saved = await db.mainImageAnalysis.create({
    data: { analysisRunId: run.id, productId: input.productId, imageUrl: input.imageUrl, visionModel: ai.model, resultJson: structured ?? { summary: ai.text } },
  })
  return { id: saved.id, analyzedAt: saved.createdAt, structured: Boolean(structured) }
}

export async function getMainImageAnalysis(input: { tenantId: string; runId: string; productId: string }) {
  const db = getWorkerPrisma()
  const run = await resolveRun(input.runId, input.tenantId)
  const analysis = await db.mainImageAnalysis.findFirst({ where: { analysisRunId: run.id, productId: input.productId }, orderBy: { createdAt: 'desc' } })
  return { ok: true, productId: input.productId, analysis: analysis ?? null }
}

export async function priceBandsPreview(input: { tenantId: string; keyword?: string; runId?: string | undefined; costPrice?: number; shippingCost?: number; packagingCost?: number; laborCost?: number; platformFeeRate?: number; adFeeRate?: number; targetMargin?: number }) {
  const db = getWorkerPrisma()
  const collection = input.runId
    ? await (async () => {
      const run = await resolveRun(input.runId, input.tenantId)
      return db.collectionJob.findUnique({ where: { jobId: run.jobId } })
    })()
    : await db.collectionJob.findFirst({
      where: { tenantId: input.tenantId, ...(input.keyword?.trim() ? { keyword: { contains: input.keyword.trim() } } : {}) },
      orderBy: { createdAt: 'desc' },
    })
  if (!collection) return { ok: true, priceBands: [], profitSimulation: null, collection: null }
  const rows = await db.productSnapshot.findMany({ where: { collectionJobId: collection.id }, orderBy: { price: 'asc' } })
  const priceBands = computePriceBands(rows.map((row) => row.price).filter((price): price is number => price != null))
  const feeRate = (input.platformFeeRate ?? 0) + (input.adFeeRate ?? 0)
  const totalCost = (input.costPrice ?? 0) + (input.shippingCost ?? 0) + (input.packagingCost ?? 0) + (input.laborCost ?? 0)
  const profitSimulation = priceBands.map((band) => {
    const targetPrice = band.priceMax
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
    const inBand = rows.filter((row) => row.price != null && row.price >= band.priceMin && row.price <= band.priceMax)
    const raws = inBand.map((row) => rawRecord(row.rawJson))
    return {
      ...band,
      analysisStatus: 'raw',
      extractedSellingPoints: [],
      extractedDemands: [],
      avgPrice: inBand.length ? roundCents(inBand.reduce((sum, row) => sum + (row.price ?? 0), 0) / inBand.length) : 0,
      competitorLinks: raws.map((raw) => rawString(raw, 'productUrl')).filter(Boolean),
      displayImages: raws.map((raw) => rawString(raw, 'imageUrl')).filter(Boolean),
      competitorTitles: inBand.map((row) => row.title).filter(Boolean),
      soldTotal: inBand.reduce((sum, row) => sum + (rawNumber(rawRecord(row.rawJson), 'sold') ?? 0), 0),
      salesAmountTotal: inBand.reduce((sum, row) => sum + (rawNumber(rawRecord(row.rawJson), 'salesAmount') ?? 0), 0),
    }
  })
  return { ok: true, priceBands: bands, profitSimulation, collection: { id: collection.id, keyword: collection.keyword, productCount: rows.length } }
}

export async function rerunBandAnalysis(input: { userId: string; tenantId: string; keyword?: string; bandName: string }, provider?: ReportAiProvider) {
  const bandName = String(input.bandName ?? '').trim()
  if (!bandName) throw new Error('缺少价格段')
  const db = getWorkerPrisma()
  const run = await db.analysisRun.findFirst({
    where: { tenantId: input.tenantId, status: 'success', ...(input.keyword?.trim() ? { keyword: { contains: input.keyword.trim() } } : {}) },
    orderBy: { updatedAt: 'desc' },
  })
  if (!run) throw new Error('未找到该关键词的已生成报告')
  const bandRow = await db.analysisPriceBand.findFirst({ where: { analysisRunId: run.id, bandName } })
  if (!bandRow) throw new Error('价格段不存在于报告中')
  const collection = await db.collectionJob.findUnique({ where: { jobId: run.jobId } })
  const products = collection ? await db.productSnapshot.findMany({ where: { collectionJobId: collection.id }, take: 8, orderBy: { createdAt: 'desc' } }) : []
  const inBand = products.filter((product) => product.price != null && product.price >= (bandRow.priceMin ?? -Infinity) && product.price <= (bandRow.priceMax ?? Infinity))
  if (!inBand.length) return { ok: true, bandName, analysisStatus: 'raw', extractedSellingPoints: [], extractedDemands: [], imagePrompts: null, message: '该价格段暂无商品样本，保持基础数据' }
  const selected = provider ?? createRealAiProvider(input.userId)
  const ai = await selected.generateText({
    system: '你是电商竞品价格段分析师。请仅输出合法 JSON：{"sellingPoints":[{"term":"卖点","count":次数}],"demands":[{"term":"需求/问大家点","count":次数}],"imagePrompts":{"style":"风格","scene":"场景","composition":"构图"}}。数据不足的字段省略，不要编造数字。',
    prompt: `价格段 ${bandName} 的商品样本：${JSON.stringify(inBand.map((product) => ({ title: product.title ?? '', price: product.price, shop: product.shopName })))}`,
    maxTokens: 1500,
  })
  const parsed = extractJson(ai.text)
  const sellingPoints = Array.isArray(parsed?.sellingPoints) ? parsed.sellingPoints : []
  const demands = Array.isArray(parsed?.demands) ? parsed.demands : []
  const imagePrompts = rawRecord(parsed?.imagePrompts)
  const status = sellingPoints.length || demands.length ? 'analyzed' : 'raw'
  await db.analysisPriceBand.update({ where: { id: bandRow.id }, data: { analysisStatus: status, sellingPointsJson: sellingPoints as Prisma.InputJsonValue, demandsJson: demands as Prisma.InputJsonValue, imagePromptsJson: (imagePrompts ?? {}) as Prisma.InputJsonValue } })
  return { ok: true, bandName, analysisStatus: status, extractedSellingPoints: sellingPoints, extractedDemands: demands, imagePrompts, model: ai.model }
}

/** 旧版 backend money()：金额保留两位小数，无 ¥ 前缀。 */
function agentMoney(value: unknown) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null
  return numeric == null ? null : Math.round(numeric * 100) / 100
}

/** 旧版 backend compactDateTime()：去分隔符取前 14 位（YYYYMMDDHHMMSS）。 */
function agentCompactDateTime(value?: string | null) {
  return String(value ?? '').replace(/[-:T ]/g, '').slice(0, 14)
}

function agentPriceRangeText(min?: number | null, max?: number | null) {
  const low = agentMoney(min)
  const high = agentMoney(max)
  if (low == null && high == null) return '-'
  if (low != null && high != null && low !== high) return `${low}-${high}`
  return String(low ?? high)
}

/** 本机时间（分钟精度），页面 formatDate 直接可读，避免 ISO/UTC 时区偏移。 */
function agentLocalDateTime(value: Date) {
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function agentText(value: unknown, limit = 220) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function agentMetrics(items: unknown, limit = 8) {
  return (Array.isArray(items) ? items : [])
    .slice(0, limit)
    .map((item) => {
      const record = rawRecord(item)
      return {
        term: agentText(record ? record.term ?? record.keyword ?? record.title : item, 40),
        count: record && typeof record.count === 'number' && Number.isFinite(record.count) ? record.count : null,
        evidence: agentText(record ? record.evidence ?? record.reason : '', 120),
      }
    })
    .filter((item) => item.term)
}

function agentTextList(items: unknown, limit = 8) {
  return (Array.isArray(items) ? items : []).slice(0, limit).map((item) => agentText(item, 120)).filter(Boolean)
}

function agentProducts(items: unknown, limit = 20) {
  return (Array.isArray(items) ? items : []).slice(0, limit).map((item) => {
    const record = rawRecord(item) ?? {}
    return {
      id: record.id ?? record.externalProductId ?? record.productSnapshotId ?? record.product_id,
      title: agentText(record.title ?? record.product_title, 120),
      shop: agentText(record.shopName ?? record.shop_name, 60),
      price: record.price ?? record.priceRange ?? record.price_range ?? null,
      sold: record.sold ?? record.sold_count ?? null,
      salesAmount: record.salesAmount ?? record.sales_amount ?? null,
      skuCount: record.skuCount ?? (Array.isArray(record.skus) ? record.skus.length : null),
    }
  })
}

/** 旧版 compactAgentReport 在桌面端 reportJson（summary/priceBands/sellingPoints/painPoints/userDemands/opportunities）上的等价映射。 */
function agentReportContext(run: { keyword: string | null; reportNo: string | null; competitorCount: number | null; createdAt: Date; reportJson: unknown }) {
  const report = rawRecord(run.reportJson) ?? {}
  const bandRecords = (Array.isArray(report.priceBands) ? report.priceBands : []).map((item) => rawRecord(item) ?? {})
  const bandMins = bandRecords.map((band) => band.priceMin).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const bandMaxs = bandRecords.map((band) => band.priceMax).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return {
    keyword: run.keyword ?? '',
    title: run.reportNo ?? '',
    generatedAt: agentLocalDateTime(run.createdAt),
    competitorCount: run.competitorCount ?? 0,
    priceRange: agentPriceRangeText(bandMins.length ? Math.min(...bandMins) : null, bandMaxs.length ? Math.max(...bandMaxs) : null),
    coreConclusions: {
      summary: agentText(report.summary, 500),
    },
    sellingPoints: agentMetrics(report.sellingPoints, 8),
    painPoints: agentTextList(report.painPoints, 8),
    userDemands: agentTextList(report.userDemands, 8),
    opportunities: agentTextList(report.opportunities, 8),
    creativePlan: report.creativePlan ? { direction: rawRecord(report.creativePlan)?.direction, mainImages: rawRecord(report.creativePlan)?.mainImages, detailImages: rawRecord(report.creativePlan)?.detailImages, missingMaterials: rawRecord(report.creativePlan)?.missingMaterials } : undefined,
    priceBands: bandRecords.slice(0, 12).map((band) => ({
      name: band.bandName,
      competitorCount: band.productCount,
      priceRange: agentPriceRangeText(typeof band.priceMin === 'number' ? band.priceMin : null, typeof band.priceMax === 'number' ? band.priceMax : null),
      avgPrice: agentMoney(band.avgPrice),
      soldTotal: typeof band.soldTotal === 'number' ? band.soldTotal : 0,
      products: agentProducts(band.representativeProducts, 8),
    })),
  }
}

export async function dataAgentDatasets(input: { tenantId: string; keyword?: string }) {
  const db = getWorkerPrisma()
  const keyword = input.keyword?.trim() ?? ''
  const [runs, collections, snapshots, runJobIds] = await Promise.all([
    db.analysisRun.findMany({
      where: { tenantId: input.tenantId, ...(keyword ? { keyword: { contains: keyword } } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    db.collectionJob.findMany({ where: { tenantId: input.tenantId, ...(keyword ? { keyword: { contains: keyword } } : {}) } }),
    db.productSnapshot.findMany({ where: { tenantId: input.tenantId }, orderBy: { createdAt: 'desc' }, take: 1000 }),
    db.analysisRun.findMany({ where: { tenantId: input.tenantId }, select: { jobId: true } }),
  ])
  const statsByCollectionId = new Map<string, { min?: number; max?: number; count: number }>()
  for (const row of snapshots) {
    const current = statsByCollectionId.get(row.collectionJobId) ?? { min: undefined, max: undefined, count: 0 }
    if (row.price != null) {
      if (current.min == null || row.price < current.min) current.min = row.price
      if (current.max == null || row.price > current.max) current.max = row.price
    }
    current.count += 1
    statsByCollectionId.set(row.collectionJobId, current)
  }
  const collectionByJobId = new Map(collections.map((collection) => [collection.jobId, collection]))
  const stats = (collectionId?: string) => {
    const price = collectionId ? statsByCollectionId.get(collectionId) : undefined
    return { min: price?.min, max: price?.max, count: price?.count ?? 0 }
  }

  const generated = runs.map((run) => {
    const price = stats(collectionByJobId.get(run.jobId)?.id)
    const priceRange = agentPriceRangeText(price.min, price.max)
    const collectTime = agentLocalDateTime(run.createdAt)
    return {
      id: run.id,
      source: 'analysis_run',
      keyword: run.keyword ?? '',
      title: `${run.keyword || '报告'}${agentCompactDateTime(collectTime)}`,
      priceRange,
      competitorCount: run.competitorCount ?? price.count,
      collectTime,
      status: 'generated',
      description: `已生成整体报告，${run.competitorCount ?? price.count} 个商品，价格 ${priceRange}`,
    }
  })

  // 旧版「原始数据」数据集：没有成功报告的已完成采集任务，问答时仅以商品上下文回答
  const reportedJobIds = new Set(runJobIds.map((item) => item.jobId))
  const raw = collections
    .filter((collection) => collection.status === 'success' && !reportedJobIds.has(collection.jobId))
    .map((collection) => {
      const price = stats(collection.id)
      const priceRange = agentPriceRangeText(price.min, price.max)
      const collectTime = agentLocalDateTime(collection.updatedAt)
      return {
        id: `raw-${collection.jobId}`,
        source: 'product_snapshot',
        keyword: collection.keyword ?? '',
        title: `${collection.keyword || '数据集'}${collectTime ? ` ${agentCompactDateTime(collectTime)}` : ''}`,
        priceRange,
        competitorCount: price.count,
        collectTime,
        status: 'not_generated',
        description: `原始采集数据，${price.count} 个商品，价格 ${priceRange}`,
      }
    })
    .filter((item) => item.competitorCount > 0)

  return {
    datasets: [...generated, ...raw]
      .sort((a, b) => b.collectTime.localeCompare(a.collectTime))
      .slice(0, 120),
  }
}

export async function dataAgentChat(
  input: { userId: string; tenantId: string; question: string; datasetId?: string; jobId?: string; keyword?: string; history?: Array<{ role?: string; content?: string }> },
  provider?: ReportAiProvider,
) {
  const datasetId = String(input.datasetId ?? input.jobId ?? '').trim()
  const keyword = String(input.keyword ?? '').trim()
  const question = String(input.question ?? '').trim()
  if (!datasetId && !keyword) throw new Error('请先选择要问答的数据')
  if (!question) throw new Error('请输入要问的问题')

  const db = getWorkerPrisma()
  const rawRequested = datasetId.startsWith('raw-')
  const report = !rawRequested && datasetId
    ? await db.analysisRun.findFirst({ where: { OR: [{ id: datasetId }, { jobId: datasetId }], tenantId: input.tenantId } })
    : !rawRequested && keyword
      ? await db.analysisRun.findFirst({ where: { tenantId: input.tenantId, keyword }, orderBy: { updatedAt: 'desc' } })
      : null
  const collection = report
    ? await db.collectionJob.findUnique({ where: { jobId: report.jobId } })
    : rawRequested && datasetId
      ? await db.collectionJob.findUnique({ where: { jobId: datasetId.slice(4) } })
      : keyword
        ? await db.collectionJob.findFirst({ where: { tenantId: input.tenantId, keyword }, orderBy: { updatedAt: 'desc' } })
        : null
  const products = collection ? await loadProducts(collection.id) : []
  const prices = products.map((product) => product.price).filter((price): price is number => price != null)

  const context = {
    selectedDataset: {
      id: datasetId,
      keyword: keyword || report?.keyword || collection?.keyword || '',
      source: report ? 'analysis_run' : 'product_snapshot',
      title: collection?.keyword || report?.reportNo || keyword,
      productCount: products.length,
      priceRange: agentPriceRangeText(prices.length ? Math.min(...prices) : null, prices.length ? Math.max(...prices) : null),
    },
    report: report ? agentReportContext(report) : null,
    products: agentProducts(products, 40),
  }

  const recentHistory = (Array.isArray(input.history) ? input.history : [])
    .slice(-8)
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: agentText(item?.content, 500),
    }))
    .filter((item) => item.content)

  const selected = provider ?? createRealAiProvider(input.userId)
  const ai = await selected.generateText({
    system: [
      '你是这个电商竞品分析系统里的数据问答智能体。用户会选择一个数据集后提问，你只能基于输入上下文回答。',
      '回答要求：',
      '1）直接回答问题，中文，结构清晰；',
      '2）涉及结论时引用上下文中的销量、价格、商品数、价格区间、问大家/评价样本或报告结论作为依据；',
      '3）如果数据不足，明确说数据不足，并说明还需要哪类数据；',
      '4）不要编造未提供的销量、价格、品牌、评价或外部事实；',
      '5）如果用户要求策略建议，要给可执行动作。',
    ].join('\n'),
    prompt: [
      '最近对话：',
      JSON.stringify(recentHistory, null, 2),
      '',
      '当前选中的数据上下文：',
      JSON.stringify(context, null, 2),
      '',
      '用户问题：',
      question,
    ].join('\n'),
    maxTokens: 3000,
  })
  return {
    answer: ai.text ?? '',
    sources: [
      ...(report ? [{ type: 'report', id: report.id, title: report.reportNo ?? '分析报告' }] : []),
      ...products.slice(0, 10).map((product) => ({ type: 'product', id: product.id, title: product.title ?? product.externalProductId })),
    ],
    model: ai.model,
  }
}
