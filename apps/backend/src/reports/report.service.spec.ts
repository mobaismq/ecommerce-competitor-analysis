import { ReportService } from './report.service'

function makePrismaMock(overrides: Partial<Record<string, unknown>> = {}) {
  const tx = {
    analysisRun: {
      upsert: jest.fn().mockImplementation(async ({ update, create }) => ({
        id: 'run-1',
        reportNo: create?.reportNo ?? update?.reportNo,
        reportHash: create?.reportHash,
        competitorCount: create?.competitorCount,
        status: 'success',
      })),
    },
    analysisPriceBand: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    analysisBandProduct: { createMany: jest.fn() },
    analysisInsight: { deleteMany: jest.fn(), createMany: jest.fn() },
  }
  const prisma = {
    job: { findUnique: jest.fn().mockResolvedValue(overrides.job ?? { id: 'job-1', tenantId: 't', type: 'analysis' }), update: jest.fn().mockResolvedValue({}) },
    analysisRun: { findUnique: jest.fn().mockResolvedValue(overrides.existingReport ?? null) },
    collectionJob: { findUnique: jest.fn().mockResolvedValue(overrides.collectionJob ?? { id: 'col-1', keyword: '水平仪' }) },
    productSnapshot: { findMany: jest.fn().mockResolvedValue(overrides.products ?? []) },
    productSkuSnapshot: { findMany: jest.fn().mockResolvedValue(overrides.skus ?? []) },
    productQaSnapshot: { findMany: jest.fn().mockResolvedValue(overrides.qas ?? []) },
    productReviewSnapshot: { findMany: jest.fn().mockResolvedValue(overrides.reviews ?? []) },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
    ...((overrides.prisma as Record<string, unknown>) ?? {}),
  }
  return { prisma, tx }
}

const baseProducts = [
  { id: 'p1', title: 'A款激光', price: 100, shopName: '店铺A' },
  { id: 'p2', title: 'B款激光', price: 120, shopName: '店铺B' },
  { id: 'p3', title: 'C款激光', price: 160, shopName: '店铺C' },
  { id: 'p4', title: 'D款激光', price: 200, shopName: '店铺D' },
]
const baseSkus = [
  { productSnapshotId: 'p1', name: '红色', price: 100 },
  { productSnapshotId: 'p1', name: '绿色', price: 118 },
]
const baseQas = [
  { productSnapshotId: 'p1', question: '多久发货', answer: '48h' },
  { productSnapshotId: 'p2', question: '是否防水', answer: '是' },
]
const baseReviews = [
  { productSnapshotId: 'p1', content: '质量很好耐用性价比高满意' },
  { productSnapshotId: 'p3', content: '很差容易坏' },
]

const AI_JSON = {
  summary: '整体结论X',
  sellingPoints: [{ term: '耐用', count: 3 }, { term: '清晰', count: 2 }],
  painPoints: ['质量差', '售后慢'],
  userDemands: ['加大容量'],
  opportunities: ['夜光款'],
}

describe('ReportService.runReport（富报告结构回迁）', () => {
  it('AI 返回 JSON 时，reportJson 采用 AI 结构化卖点/痛点/需求/机会，并含代表商品与均价', async () => {
    const { prisma, tx } = makePrismaMock({
      products: baseProducts,
      skus: baseSkus,
      qas: baseQas,
      reviews: baseReviews,
    })
    const router = {
      execute: jest.fn().mockResolvedValue({ text: JSON.stringify(AI_JSON), model: 'mock-model' }),
    }
    const service = new ReportService(prisma as any, router as any)

    await service.runReport({ jobId: 'job-1', tenantId: 't' })

    const upsertCall = tx.analysisRun.upsert.mock.calls[0][0] // get create data
    const reportJson = upsertCall.create.reportJson

    // AI 结构化字段采用
    expect(reportJson.summary).toBe('整体结论X')
    expect(reportJson.sellingPoints).toEqual([{ term: '耐用', count: 3 }, { term: '清晰', count: 2 }])
    expect(reportJson.painPoints).toEqual(['质量差', '售后慢'])
    expect(reportJson.userDemands).toEqual(['加大容量'])
    expect(reportJson.opportunities).toEqual(['夜光款'])

    // 富价格带：携带均价 + 代表商品，且带 SKU 的商品优先出现
    const priceBands = reportJson.priceBands as Array<{ avgPrice: number | null; representativeProducts: Array<{ title: string; skuCount: number }> }>
    expect(priceBands.length).toBeGreaterThan(0)
    const allReps = priceBands.flatMap((b) => b.representativeProducts)
    expect(allReps.some((r) => r.title === 'A款激光' && r.skuCount === 2)).toBe(true)

    // competitorCount = 商品数量
    expect(upsertCall.create.competitorCount).toBe(4)
    // 基础洞察：summary insight
    expect(reportJson.insights[0]).toMatchObject({ type: 'summary', title: 'AI 总结' })
  })

  it('AI 返回非 JSON 时，summary 回退 AI 文本、卖点回退评价关键词频度兜底，价格带仍富化', async () => {
    const { prisma, tx } = makePrismaMock({
      products: baseProducts,
      skus: baseSkus,
      reviews: baseReviews,
    })
    const router = { execute: jest.fn().mockResolvedValue({ text: '这是一段纯文本结论' , model: 'mock' }) }
    const service = new ReportService(prisma as any, router as any)

    await service.runReport({ jobId: 'job-1', tenantId: 't' })

    const reportJson = tx.analysisRun.upsert.mock.calls[0][0].create.reportJson
    expect(reportJson.summary).toBe('这是一段纯文本结论')
    // 兜底从真实评价文本聚合出正向词
    const terms = (reportJson.sellingPoints as Array<{ term: string }>).map((s) => s.term)
    expect(terms).toContain('耐用')
    expect(reportJson.priceBands.length).toBeGreaterThan(0)
  })

  it('已有成功报告时直接复用，不再重新生成', async () => {
    const { prisma } = makePrismaMock({
      existingReport: { id: 'run-1', jobId: 'job-1', status: 'success', reportNo: 'R1', reportHash: 'h' },
    })
    const router = { execute: jest.fn() }
    const service = new ReportService(prisma as any, router as any)

    const res = await service.runReport({ jobId: 'job-1', tenantId: 't' })
    expect(res.reused).toBe(true)
    expect(res.status).toBe('success')
    expect(router.execute).not.toHaveBeenCalled()
  })

  it('价格带从采集 rawJson.sold 聚合月销量（soldTotal）', async () => {
    const { prisma, tx } = makePrismaMock({
      products: [
        { id: 'p1', title: 'A款', price: 100, shopName: '店A', rawJson: { sold: 30 } },
        { id: 'p2', title: 'B款', price: 200, shopName: '店B', rawJson: { sold: 20 } },
        { id: 'p3', title: 'C款', price: 300, shopName: '店C', rawJson: null },
      ],
      skus: [],
      qas: [],
      reviews: [],
    })
    const router = { execute: jest.fn().mockResolvedValue({ text: JSON.stringify({ summary: 's' }), model: 'mock' }) }
    const service = new ReportService(prisma as any, router as any)

    await service.runReport({ jobId: 'job-1', tenantId: 't' })

    const reportJson = tx.analysisRun.upsert.mock.calls[0][0].create.reportJson
    const priceBands = reportJson.priceBands as Array<{ soldTotal: number }>
    // 有 sold 数据的产品（A=30、B=20）逐带累计，总计 50；无 sold 的 C 款不计数
    expect(priceBands.reduce((sum, b) => sum + b.soldTotal, 0)).toBe(50)
    expect(priceBands.some((b) => b.soldTotal === 30)).toBe(true)
    expect(priceBands.some((b) => b.soldTotal === 20)).toBe(true)
  })
})