import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  computePriceBands,
  dataAgentChat,
  dataAgentDatasets,
  exportReport,
  generateReport,
  getMainImageAnalysis,
  getReport,
  listReports,
  priceBandsPreview,
  rerunBandAnalysis,
  reportProducts,
  runMainImageAnalysis,
  type ReportAiProvider,
} from './report-capability'
import { getWorkerPrisma, workerDataRoots } from './worker-db'
import { creativeFixture } from './test-fixtures/creative'
import { REPORT_SECTION_TITLES } from '../shared/report-skill'

const root = mkdtempSync(join(tmpdir(), 'report-cap-'))
beforeAll(() => {
  process.env.ECOMMERCE_DATA_ROOT = root
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
})
afterAll(() => {
  delete process.env.ECOMMERCE_DATA_ROOT
  rmSync(root, { recursive: true, force: true })
})

const skillResult = JSON.stringify({ summary: '高性价比需求明确', markdown: REPORT_SECTION_TITLES.map((title) => `## ${title}\n实际数据分析`).join('\n\n'), sellingPoints: ['性价比'], painPoints: ['偏贵'], userDemands: ['希望续航更久'], opportunities: ['学生群体'], evidence: [{ claim: '标题提及商品', sourceIds: ['title'], quote: '商品标题' }], reviewAnalysis: [{ reviewId: 'review-0', sentiment: 'positive', quote: '质量不错', point: '质量' }], imageObservations: [{ imageId: 'main_image-0', observation: '主体清晰', ocr: ['无线耳机'] }] })
const provider: ReportAiProvider = {
  generateText: async (request) => ({ text: request.system?.includes('[stage:creative-report]') ? JSON.stringify(creativeFixture()) : request.system?.includes('[stage:skill-report]') ? skillResult : JSON.stringify({ summary: '高性价比需求明确', sellingPoints: [{ term: '性价比', count: 3 }], painPoints: ['偏贵'], userDemands: ['希望续航更久'], opportunities: ['学生群体'] }), model: 'mock-text' }),
  analyzeImage: async (request) => ({ text: request.system?.includes('[stage:skill-report]') ? skillResult : JSON.stringify({ summary: '主体清晰', ocr: ['无线耳机'] }), model: 'mock-vision' }),
}

async function seedCollection() {
  const db = getWorkerPrisma()
  const suffix = randomUUID().slice(0, 8)
  const collectionId = `cj-${suffix}`
  const jobId = `job-${suffix}`
  await db.collectionJob.create({ data: { id: collectionId, tenantId: 'local', jobId, type: 'collection', status: 'success', keyword: '耳机' } })
  await db.productSnapshot.create({
    data: {
      id: `p-${suffix}`,
      tenantId: 'local',
      collectionJobId: collectionId,
      externalProductId: `ext-${suffix}`,
      title: '无线降噪耳机',
      price: 199,
      shopName: '测试店铺',
      snapshotTime: new Date(),
      dataSnapshotDate: '2026-09-24',
      rawJson: { imageUrl: 'https://example.invalid/main.png', productUrl: 'https://example.invalid/product', sold: 120, salesAmount: 23880 },
    },
  })
  await db.productSkuSnapshot.create({ data: { id: `sku-${suffix}`, productSnapshotId: `p-${suffix}`, skuId: 'sku-1', name: '黑色', price: 199 } })
  await db.productQaSnapshot.create({ data: { id: `qa-${suffix}`, productSnapshotId: `p-${suffix}`, question: '希望续航更久吗？' } })
  await db.productReviewSnapshot.create({ data: { id: `rev-${suffix}`, productSnapshotId: `p-${suffix}`, content: '性价比很高，质量不错' } })
}

describe('report capabilities', () => {
  it('computes adaptive price bands', () => {
    expect(computePriceBands([10, 20, 30, 40])).toEqual([
      { bandName: '10-20元', priceMin: 10, priceMax: 20, productCount: 2 },
      { bandName: '30-40元', priceMin: 30, priceMax: 40, productCount: 2 },
    ])
    expect(computePriceBands([])).toEqual([])
  })

  it('lists collected data before report generation, filters dates/status, and resolves the selected batch', async () => {
    const db = getWorkerPrisma()
    const keyword = '数据库联通测试'
    const makeCollection = async (id: string, tenantId: string, prices: number[], updatedAt: string) => {
      await db.collectionJob.create({ data: { id, jobId: `job-${id}`, tenantId, keyword, type: 'collection', status: 'success', updatedAt: new Date(updatedAt) } })
      for (const [index, price] of prices.entries()) {
        await db.productSnapshot.create({ data: { id: `${id}-p${index}`, collectionJobId: id, tenantId,
          externalProductId: `${id}-ext${index}`, price, title: `${id}商品`, snapshotTime: new Date(), dataSnapshotDate: '2026-01-01' } })
      }
    }
    await makeCollection('catalog-old', 'local', [99], '2026-01-01T04:00:00Z')
    await makeCollection('catalog-new', 'local', [199, 299], '2026-01-03T04:00:00Z')
    await makeCollection('catalog-empty', 'local', [], '2026-01-04T04:00:00Z')
    await makeCollection('catalog-other-tenant', 'other', [999], '2026-01-05T04:00:00Z')
    const query = { tenantId: 'local', keyword, includeCollections: true }
    const list = await listReports({ ...query, pageSize: 1 })
    expect(list.total).toBe(2)
    expect(list.rows[0]).toMatchObject({ id: 'raw-job-catalog-new', source: 'collection', status: 'not_generated', competitorCount: 2, priceMin: 199, priceMax: 299 })
    expect((await listReports({ ...query, pageSize: 1, page: 2 })).rows[0].id).toBe('raw-job-catalog-old')
    expect((await listReports({ ...query, startTime: '2026-01-03T00:00:00Z', endTime: '2026-01-03T23:59:59Z' })).total).toBe(1)
    expect((await listReports({ ...query, status: 'completed' })).total).toBe(0)
    const rawProducts = await reportProducts({ tenantId: 'local', runId: 'raw-job-catalog-old' })
    expect(rawProducts.products).toHaveLength(1)
    expect(rawProducts.products[0].price).toBe(99)
    await expect(reportProducts({ tenantId: 'other', runId: 'raw-job-catalog-old' })).rejects.toThrow('采集数据不存在')

    // Exact collection ID wins over a newer batch with the same keyword.
    const generated = await generateReport({ userId: 'u1', tenantId: 'local', keyword, collectionJobId: 'catalog-old' }, provider)
    expect(generated.competitorCount).toBe(1)
    expect((await listReports({ ...query, status: 'completed' })).total).toBe(1)
    expect((await listReports({ ...query, status: 'not_generated' })).rows[0].id).toBe('raw-job-catalog-new')
    expect((await listReports(query)).total).toBe(2)
    // Other callers keep the report-only history contract.
    expect((await listReports({ tenantId: 'local', keyword })).total).toBe(1)
    const reused = await generateReport({ userId: 'u1', tenantId: 'local', keyword, collectionJobId: 'catalog-old' }, {
      generateText: async () => { throw new Error('Must not call AI for an existing report') }, analyzeImage: provider.analyzeImage,
    })
    expect(reused.reused).toBe(true)

  })

  it('missing key fails honestly without network', async () => {
    await seedCollection()
    // 确保“完全无默认供应商”的确定性：临时清空默认供应商 env，避免主机/环境带 Key 而触发真实网络调用
    const saved: Record<string, string | undefined> = {}
    for (const k of ['OPENROUTER_API_KEY', 'OPENROUTER_BASE_URL', 'OPENROUTER_TEXT_MODEL', 'OPENROUTER_IMAGE_MODEL']) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
    try {
      const error = await generateReport({ userId: 'no-key-user', tenantId: 'local', keyword: '耳机' }).catch((error: Error & { code?: string }) => error)
      expect(error).toBeInstanceOf(Error)
      expect((error as { code?: string }).code).toBe('AI_NOT_CONFIGURED')
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  })

  it('generates report, persists metadata, exports to user tree, and serves product view', async () => {
    await seedCollection()
    const generated = await generateReport({ userId: 'u1', tenantId: 'local', keyword: '耳机' }, provider)
    expect(generated.status).toBe('success')
    expect(generated.reportNo).toMatch(/^R\d{8}/)

    const db = getWorkerPrisma()
    const run = await db.analysisRun.findUnique({ where: { id: generated.reportId } })
    expect(run?.competitorCount).toBe(1)
    const bands = await db.analysisPriceBand.findMany({ where: { analysisRunId: generated.reportId } })
    expect(bands).toHaveLength(1)
    const bandProducts = await db.analysisBandProduct.findMany({ where: { priceBandId: bands[0].id } })
    expect(bandProducts[0]?.title).toBe('无线降噪耳机')
    const insights = await db.analysisInsight.findMany({ where: { analysisRunId: generated.reportId } })
    expect(insights.length).toBeGreaterThan(1)

    const detail = await getReport({ tenantId: 'local', runId: generated.reportId })
    expect(detail.reportJson).toMatchObject({ reportVersion: 'ecommerce-report-20261020-v1', productReports: [{ summary: '高性价比需求明确' }], sellingPoints: [{ term: '性价比', count: 1 }] })
    expect(detail.priceBands[0]).toMatchObject({ bandName: '199元', productCount: 1 })

    const exported = await exportReport({ userId: 'u1', tenantId: 'local', runId: generated.reportId, format: 'markdown' })
    const absolute = join(workerDataRoots().userRoot, exported.storageKey)
    expect(existsSync(absolute)).toBe(true)
    expect(exported.size).toBeGreaterThan(0)
    for (const title of REPORT_SECTION_TITLES) expect(exported.content).toContain(title)
    expect(exported.content).toContain('主图内容脚本')
    expect(exported.content).toContain('详情页内容脚本')
    const asset = await db.generatedAsset.findUnique({ where: { storageKey: exported.storageKey } })
    expect(asset?.analysisRunId).toBe(generated.reportId)

    const products = await reportProducts({ tenantId: 'local', runId: generated.reportId, page: 1, pageSize: 20 })
    expect(products.products).toHaveLength(1)
    expect(products.products[0]).toMatchObject({ price: 199, sold: 120 })

    const list = await listReports({ tenantId: 'local', keyword: '耳', page: 1, pageSize: 10 })
    expect(list.total).toBe(1)
    const reused = await generateReport({ userId: 'u1', tenantId: 'local', keyword: '耳机' }, provider)
    expect(reused.reused).toBe(true)
    const originalHash = run!.reportHash
    await expect(generateReport({ userId: 'u1', tenantId: 'local', keyword: '耳机', jobId: run!.jobId, regenerate: true }, {
      generateText: async () => { throw new Error('offline failure') }, analyzeImage: async () => { throw new Error('offline failure') },
    })).rejects.toThrow('offline failure')
    expect((await db.analysisRun.findUnique({ where: { id: run!.id } }))!.reportHash).toBe(originalHash)
    const updated = await generateReport({ userId: 'u1', tenantId: 'local', keyword: '耳机', jobId: run!.jobId, regenerate: true }, provider)
    expect(updated.reused).toBe(false)
    expect(updated.reportId).toBe(run!.id)
    expect(updated.reportNo).not.toBe(run!.reportNo)
    expect(await db.analysisPriceBand.count({ where: { analysisRunId: run!.id } })).toBe(1)
  })

  it('serves price preview, reruns a band, runs vision analysis, and data agent chat offline', async () => {
    await seedCollection()
    const preview = await priceBandsPreview({ tenantId: 'local', keyword: '耳机', costPrice: 80, shippingCost: 10, platformFeeRate: 0.05, targetMargin: 0.2 })
    expect(preview.priceBands).toHaveLength(1)
    expect(preview.profitSimulation?.[0]).toMatchObject({ targetPrice: 199, totalCost: 90 })

    const generated = await generateReport({ userId: 'u1', tenantId: 'local', keyword: '耳机' }, provider)
    const rerun = await rerunBandAnalysis({ userId: 'u1', tenantId: 'local', keyword: '耳机', bandName: '199元' }, provider)
    expect(rerun.analysisStatus).toBe('analyzed')
    expect(rerun.extractedSellingPoints).toEqual([{ term: '性价比', count: 3 }])

    const products = await reportProducts({ tenantId: 'local', runId: generated.reportId, page: 1, pageSize: 20 })
    const productId = products.products[0]?.productId
    if (!productId) throw new Error('测试数据缺少商品编号')
    const analysis = await runMainImageAnalysis({ userId: 'u1', tenantId: 'local', runId: generated.reportId, productId, imageUrl: 'https://example.invalid/main.png' }, provider)
    expect(analysis.structured).toBe(true)
    const fetched = await getMainImageAnalysis({ tenantId: 'local', runId: generated.reportId, productId })
    expect(fetched.analysis?.resultJson).toMatchObject({ summary: '主体清晰' })

    const datasets = await dataAgentDatasets({ tenantId: 'local', keyword: '耳' })
    const generatedDataset = datasets.datasets.find((item) => item.id === generated.reportId)
    expect(generatedDataset).toMatchObject({ status: 'generated', keyword: '耳机', competitorCount: 1, priceRange: '199' })
    expect(generatedDataset?.collectTime).toBeTruthy()
    expect(generatedDataset?.description).toContain('已生成整体报告')

    // 旧版「原始数据」语义：无报告的已完成采集任务也进数据集，raw- 前缀问答仅用商品上下文
    const bareSuffix = randomUUID().slice(0, 8)
    await getWorkerPrisma().collectionJob.create({ data: { id: `cj-raw-${bareSuffix}`, tenantId: 'local', jobId: `job-raw-${bareSuffix}`, type: 'collection', status: 'success', keyword: '耳机' } })
    await getWorkerPrisma().productSnapshot.create({
      data: {
        id: `p-raw-${bareSuffix}`,
        tenantId: 'local',
        collectionJobId: `cj-raw-${bareSuffix}`,
        externalProductId: `ext-raw-${bareSuffix}`,
        title: '普通蓝牙耳机',
        price: 99,
        snapshotTime: new Date(),
        dataSnapshotDate: '2026-09-24',
      },
    })
    const refreshed = await dataAgentDatasets({ tenantId: 'local', keyword: '耳' })
    const rawDataset = refreshed.datasets.find((item) => item.id === `raw-job-raw-${bareSuffix}`)
    expect(rawDataset).toMatchObject({ status: 'not_generated', keyword: '耳机', competitorCount: 1, priceRange: '99' })
    expect(rawDataset?.description).toContain('原始采集数据')

    const chat = await dataAgentChat({ userId: 'u1', tenantId: 'local', datasetId: generated.reportId, question: '哪个价格带值得做？', keyword: '耳机', history: [{ role: 'user', content: '你好' }, { role: 'assistant', content: '你好，请先选择数据集后提问。' }] }, provider)
    expect(chat.answer).toContain('高性价比需求明确')
    expect(chat.sources[0]).toMatchObject({ type: 'report', id: generated.reportId })
    const rawChat = await dataAgentChat({ userId: 'u1', tenantId: 'local', datasetId: `raw-job-raw-${bareSuffix}`, question: '这些商品卖多少钱？' }, provider)
    expect(rawChat.answer).toContain('高性价比需求明确')
    expect(rawChat.sources[0]?.type).toBe('product')
    expect(await dataAgentChat({ userId: 'u1', tenantId: 'local', question: '没有选择数据集' }).catch((error: Error) => error.message)).toBe('请先选择要问答的数据')
  })
})
