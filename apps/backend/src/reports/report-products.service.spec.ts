import { NotFoundException } from '@nestjs/common'
import type { PrismaService } from '../prisma.service'
import type { ProviderRouter } from '../ai/provider-router.service'
import { ReportProductsService } from './report-products.service'

describe('ReportProductsService (离线 mock)', () => {
  let prisma: any
  let router: any
  let service: ReportProductsService

  beforeEach(() => {
    prisma = {
      analysisRun: { findFirst: jest.fn() },
      collectionJob: { findUnique: jest.fn(), findFirst: jest.fn() },
      productSnapshot: { findMany: jest.fn(), count: jest.fn() },
      productSkuSnapshot: { findMany: jest.fn() },
      mainImageAnalysis: { findMany: jest.fn(), create: jest.fn() },
      analysisPriceBand: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    }
    router = { execute: jest.fn() }
    service = new ReportProductsService(prisma as unknown as PrismaService, router as unknown as ProviderRouter)
    prisma.analysisRun.findFirst.mockResolvedValue({ id: 'run-1', jobId: 'job-1', tenantId: 't1' })
    prisma.analysisPriceBand.findMany.mockResolvedValue([])
  })

  describe('productsView', () => {
    it('支持筛选条件与分页，返回 total', async () => {
      prisma.collectionJob.findUnique.mockResolvedValue({ id: 'cj-1', keyword: '耳机', createdAt: new Date(), rawResultJson: null })
      prisma.productSnapshot.findMany.mockResolvedValue([
        { id: 'ps-1', externalProductId: 'EP-1', title: '耳机A', shopName: '店A', price: 99, rawJson: { productUrl: 'http://x', sold: 10 } },
      ])
      prisma.productSnapshot.count.mockResolvedValue(1)
      prisma.productSkuSnapshot.findMany.mockResolvedValue([])
      prisma.mainImageAnalysis.findMany.mockResolvedValue([])

      const res = await service.productsView('run-1', 't1', { keyword: '耳机', page: 1, pageSize: 10 })
      expect(res.total).toBe(1)
      expect(res.products[0]).toMatchObject({ productId: 'EP-1', productUrl: 'http://x', sold: 10 })
      expect(prisma.productSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ title: { contains: '耳机' } }), skip: 0, take: 10 }),
      )
    })

    it('未找到报告抛 NotFound', async () => {
      prisma.analysisRun.findFirst.mockResolvedValue(null)
      await expect(service.productsView('none', 't1', {})).rejects.toThrow(NotFoundException)
    })
  })

  describe('runMainImageAnalysis', () => {
    it('模型返回合法 JSON 时保存结构化字段', async () => {
      prisma.collectionJob.findUnique.mockResolvedValue(null)
      router.execute.mockResolvedValue({ text: '{"ocr":"text","selling_points":["a"]}', model: 'mock' })
      prisma.mainImageAnalysis.create.mockResolvedValue({ id: 'ma-1', createdAt: new Date() })

      const res = await service.runMainImageAnalysis({ tenantId: 't1', runId: 'run-1', imageUrl: 'http://img', productId: 'EP-1' })
      expect(res.structured).toBe(true)
      expect(prisma.mainImageAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ resultJson: expect.objectContaining({ ocr: 'text' }) }) }),
      )
    })

    it('模型返回纯文本时诚实回退为 summary', async () => {
      router.execute.mockResolvedValue({ text: '视觉卖点是清晰', model: 'mock' })
      prisma.mainImageAnalysis.create.mockResolvedValue({ id: 'ma-2', createdAt: new Date() })
      const res = await service.runMainImageAnalysis({ tenantId: 't1', runId: 'run-1', imageUrl: 'http://img' })
      expect(res.structured).toBe(false)
      expect(prisma.mainImageAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ resultJson: expect.objectContaining({ summary: '视觉卖点是清晰' }) }) }),
      )
    })
  })

  describe('priceBandsPreviewByKeyword', () => {
    it('按租户过滤且不跨租户读取最近采集', async () => {
      prisma.collectionJob.findFirst.mockResolvedValue({ id: 'cj-1', keyword: '耳机', createdAt: new Date() })
      prisma.productSnapshot.findMany.mockResolvedValue([
        { price: 50, externalProductId: 'EP-1', title: 'A', shopName: '店', rawJson: { productUrl: 'http://p' } },
      ])
      const res = await service.priceBandsPreviewByKeyword({ tenantId: 't1', keyword: '耳机' })
      expect(prisma.collectionJob.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1' }) }),
      )
      expect(res.priceBands.length).toBeGreaterThan(0)
      expect(res.priceBands[0]).toHaveProperty('avgPrice')
    })

    it('无已生成报告时每带分析状态回落 raw（不伪造已AI分析）', async () => {
      prisma.collectionJob.findFirst.mockResolvedValue({ id: 'cj-1', keyword: '耳机', createdAt: new Date() })
      prisma.productSnapshot.findMany.mockResolvedValue([
        { price: 50, externalProductId: 'EP-1', title: 'A', shopName: '店', rawJson: { productUrl: 'http://p' } },
      ])
      // 无已生成成功报告 → analysisPriceBand.findMany 不会被调用
      prisma.analysisRun.findFirst.mockResolvedValue(null)
      const res = await service.priceBandsPreviewByKeyword({ tenantId: 't1', keyword: '耳机' })
      const b = Array.isArray(res.priceBands) ? res.priceBands : []
      expect(b.length).toBeGreaterThan(0)
      expect(b[0]).toHaveProperty('analysisStatus', 'raw')
      expect(prisma.analysisPriceBand.findMany).not.toHaveBeenCalled()
    })

    it('已生成报告时按带名回传 AI 分析状态', async () => {
      prisma.collectionJob.findFirst.mockResolvedValue({ id: 'cj-1', keyword: '耳机', createdAt: new Date() })
      prisma.productSnapshot.findMany.mockResolvedValue([
        { price: 50, externalProductId: 'EP-1', title: 'A', shopName: '店', rawJson: { productUrl: 'http://p' } },
      ])
      prisma.analysisRun.findFirst.mockResolvedValue({ id: 'run-1', jobId: 'job-1', tenantId: 't1' })
      prisma.analysisPriceBand.findMany.mockResolvedValue([
        { bandName: '50元', analysisStatus: 'analyzed', sellingPointsJson: [{ term: '好', count: 3 }], demandsJson: [] },
      ])
      const res = await service.priceBandsPreviewByKeyword({ tenantId: 't1', keyword: '耳机' })
      const b = Array.isArray(res.priceBands) ? res.priceBands : []
      const matched = b.find((x) => String(x.bandName) === '50元')
      expect(matched?.analysisStatus).toBe('analyzed')
    })

    it('重跑某价格段：无真实模型 key 时保持 raw 不伪造', async () => {
      prisma.analysisRun.findFirst.mockResolvedValue({ id: 'run-1', jobId: 'job-1', tenantId: 't1', keyword: '耳机' })
      prisma.analysisPriceBand.findFirst.mockResolvedValue({ id: 'band-1', bandName: '0-100', priceMin: 0, priceMax: 100, analysisRunId: 'run-1' })
      prisma.collectionJob.findUnique.mockResolvedValue({ id: 'cj-1', keyword: '耳机' })
      prisma.productSnapshot.findMany.mockResolvedValue([
        { id: 'p1', title: 'A', price: 50, shopName: '店', externalProductId: 'EP-1' },
      ])
      prisma.analysisPriceBand.update.mockResolvedValue({ id: 'band-1' })
      // 模型返回空/非法 JSON
      router.execute.mockResolvedValue({ text: '没有可用分析', model: 'mock' })
      const res = await service.rerunBandAnalysis({ tenantId: 't1', keyword: '耳机', bandName: '0-100' })
      expect(res.analysisStatus).toBe('raw')
      expect(prisma.analysisPriceBand.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ analysisStatus: 'raw' }) }),
      )
    })
  })
})
