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

const root = mkdtempSync(join(tmpdir(), 'report-cap-'))
beforeAll(() => {
  process.env.ECOMMERCE_DATA_ROOT = root
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
})
afterAll(() => {
  delete process.env.ECOMMERCE_DATA_ROOT
  rmSync(root, { recursive: true, force: true })
})

const provider: ReportAiProvider = {
  generateText: async () => ({ text: JSON.stringify({ summary: '高性价比需求明确', sellingPoints: [{ term: '性价比', count: 3 }], painPoints: ['偏贵'], userDemands: ['希望续航更久'], opportunities: ['学生群体'] }), model: 'mock-text' }),
  analyzeImage: async () => ({ text: JSON.stringify({ summary: '主体清晰', ocr: ['无线耳机'] }), model: 'mock-vision' }),
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

  it('missing key fails honestly without network', async () => {
    await seedCollection()
    const error = await generateReport({ userId: 'no-key-user', tenantId: 'local', keyword: '耳机' }).catch((error: Error & { code?: string }) => error)
    expect(error).toBeInstanceOf(Error)
    expect((error as { code?: string }).code).toBe('AI_NOT_CONFIGURED')
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
    expect(detail.reportJson).toMatchObject({ summary: '高性价比需求明确' })
    expect(detail.priceBands[0]).toMatchObject({ bandName: '199元', productCount: 1 })

    const exported = await exportReport({ userId: 'u1', tenantId: 'local', runId: generated.reportId, format: 'markdown' })
    const absolute = join(workerDataRoots().userRoot, exported.storageKey)
    expect(existsSync(absolute)).toBe(true)
    expect(exported.size).toBeGreaterThan(0)
    expect(exported.content).toContain('# 竞品分析报告')
    const asset = await db.generatedAsset.findUnique({ where: { storageKey: exported.storageKey } })
    expect(asset?.analysisRunId).toBe(generated.reportId)

    const products = await reportProducts({ tenantId: 'local', runId: generated.reportId, page: 1, pageSize: 20 })
    expect(products.products).toHaveLength(1)
    expect(products.products[0]).toMatchObject({ price: 199, sold: 120 })

    const list = await listReports({ tenantId: 'local', keyword: '耳', page: 1, pageSize: 10 })
    expect(list.total).toBe(1)
    const reused = await generateReport({ userId: 'u1', tenantId: 'local', keyword: '耳机' }, provider)
    expect(reused.reused).toBe(true)
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
    expect(datasets.datasets[0]).toMatchObject({ id: generated.reportId, competitorCount: 1, priceRange: '¥199-199' })
    const chat = await dataAgentChat({ userId: 'u1', tenantId: 'local', datasetId: generated.reportId, question: '哪个价格带值得做？' }, provider)
    expect(chat.answer).toContain('高性价比需求明确')
    expect(chat.sources[0]).toMatchObject({ type: 'report', id: generated.reportId })
  })
})
