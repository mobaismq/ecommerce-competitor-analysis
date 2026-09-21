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
    }
    router = { execute: jest.fn() }
    service = new ReportProductsService(prisma as unknown as PrismaService, router as unknown as ProviderRouter)
    prisma.analysisRun.findFirst.mockResolvedValue({ id: 'run-1', jobId: 'job-1', tenantId: 't1' })
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
  })
})
