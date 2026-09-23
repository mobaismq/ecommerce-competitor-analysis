import { ProductSetsService, normalizeReferenceImages } from './product-sets.service'

describe('normalizeReferenceImages（图生图参考图归一化，对齐旧版规则）', () => {
  it('images 数组优先：去重、trim、过滤空、上限 4 张', () => {
    expect(normalizeReferenceImages(undefined, [' a ', 'a', ' b', 'c', 'd', 'e', ''])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('无 images 数组时用单张 image', () => {
    expect(normalizeReferenceImages('https://x/a.png', undefined)).toEqual(['https://x/a.png'])
  })

  it('两者皆空返回空数组', () => {
    expect(normalizeReferenceImages('', [])).toEqual([])
    expect(normalizeReferenceImages(undefined, undefined)).toEqual([])
  })
})

describe('ProductSetsService.generateImage（诚实空态 + 参考图透传）', () => {
  function makeService(router: any, prisma?: any) {
    return new ProductSetsService(prisma ?? { generatedAsset: { create: jest.fn().mockResolvedValue({ id: 'a' }) } }, router)
  }

  it('无真实返回时不写占位图，返回诚实空态', async () => {
    const router = { execute: jest.fn().mockResolvedValue({ images: [], model: 'mock-model', durationMs: 1 }) }
    const prisma = { generatedAsset: { create: jest.fn() } }
    const service = makeService(router, prisma)

    const res = await service.generateImage({ prompt: 'p', tenantId: 't' })
    expect(res.images).toEqual([])
    expect(res.assetId).toBeNull()
    expect(prisma.generatedAsset.create).not.toHaveBeenCalled()
  })

  it('参考图归一化后传给 router：referenceImageUrls 去重≤4、ratio→aspectRatio', async () => {
    const router = { execute: jest.fn().mockResolvedValue({ images: ['https://cdn/1.png'], model: 'm', durationMs: 1 }) }
    const service = makeService(router)

    await service.generateImage({ prompt: 'p', tenantId: 't', image: 'x', images: ['x', 'y', 'z', 'w', 'v'], ratio: '3:4' })

    expect(router.execute).toHaveBeenCalledWith(
      'image',
      expect.objectContaining({
        prompt: 'p',
        referenceImageUrls: ['x', 'y', 'z', 'w'],
        aspectRatio: '3:4',
      }),
      expect.anything(),
    )
  })

  it('有真实返回时逐张登记 GeneratedAsset 并返回图片与批次', async () => {
    const router = { execute: jest.fn().mockResolvedValue({ images: ['https://cdn/1.png', 'data:image/png;base64,QUJD'], model: 'm', durationMs: 1 }) }
    const prisma = {
      generatedAsset: {
        create: jest.fn()
          .mockResolvedValueOnce({ id: 'asset-1' })
          .mockResolvedValueOnce({ id: 'asset-2' }),
      },
    }
    const service = makeService(router, prisma)

    const res = await service.generateImage({
      prompt: 'p',
      tenantId: 't',
      jobId: 'job-1',
      name: '01 白底图',
      slotType: '白底图',
      ratio: '3:4',
    })
    expect(prisma.generatedAsset.create).toHaveBeenCalledTimes(2)
    expect(prisma.generatedAsset.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        tenantId: 't',
        jobId: 'job-1',
        sourceUrl: 'https://cdn/1.png',
        originalName: '01 白底图-1',
        category: '白底图',
        prompt: 'p',
        ratio: '3:4',
      }),
    })
    expect(res.images).toEqual([
      { url: 'https://cdn/1.png', dataUrl: 'https://cdn/1.png' },
      { url: 'data:image/png;base64,QUJD', dataUrl: 'data:image/png;base64,QUJD' },
    ])
    expect(res.assetIds).toEqual(['asset-1', 'asset-2'])
    expect(res.jobId).toBe('job-1')
  })
})

describe('ProductSetsService.saveGenerated/removeGeneratedBatch/listGenerated（5.9 旧版契约）', () => {
  it('saveGenerated 批量落库生成主图，映射 productName/productId/platform/sizeRatio', async () => {
    const prisma = { generatedAsset: { create: jest.fn().mockResolvedValue({ id: 'a1' }) } }
    const service = new ProductSetsService(prisma as never, {} as never)
    const res = await service.saveGenerated('t', {
      images: [
        { name: '主图A', url: 'data:image/png;base64,QUJD' },
        { name: '主图B', url: 'https://cdn/b.png' },
      ],
      productName: '手表',
      productId: 'prod-1',
      sizeRatio: '1:1',
      platform: 'taobao',
      runId: 'run-1',
    })
    expect(res).toEqual({ ok: true, saved: 2, assetIds: ['a1', 'a1'] })
    expect(prisma.generatedAsset.create).toHaveBeenCalledTimes(2)
    expect(prisma.generatedAsset.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't',
          sourceUrl: 'data:image/png;base64,QUJD',
          originalName: '主图A',
          productName: '手表',
          productId: 'prod-1',
          platform: 'taobao',
          ratio: '1:1',
          runId: 'run-1',
        }),
      }),
    )
  })

  it('saveGenerated 无有效图片时返回 saved:0 不写库', async () => {
    const prisma = { generatedAsset: { create: jest.fn() } }
    const service = new ProductSetsService(prisma as never, {} as never)
    await expect(service.saveGenerated('t', { images: [{ url: ' ' }] })).resolves.toEqual({ ok: true, saved: 0 })
    expect(prisma.generatedAsset.create).not.toHaveBeenCalled()
  })

  it('removeGeneratedBatch 按 ids 批量删除并限租户', async () => {
    const prisma = { generatedAsset: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) } }
    const service = new ProductSetsService(prisma as never, {} as never)
    await expect(service.removeGeneratedBatch('t', ['a', 'b'])).resolves.toEqual({ ok: true, deleted: 2 })
    expect(prisma.generatedAsset.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] }, tenantId: 't' } })
  })

  it('listGenerated 按 productName 模糊筛选 originalName 或 productName', async () => {
    const prisma = { generatedAsset: { findMany: jest.fn().mockResolvedValue([]) } }
    const service = new ProductSetsService(prisma as never, {} as never)
    await service.listGenerated('t', undefined, '手表')
    expect(prisma.generatedAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { originalName: { contains: '手表' } },
            { productName: { contains: '手表' } },
          ],
        }),
      }),
    )
  })
})

describe('ProductSetsService.generateImage 真源字段（1.13：关联商品/创建人）', () => {
  it('透传 productName/productId/createdBy 并落库', async () => {
    const router = { execute: jest.fn().mockResolvedValue({ images: ['https://cdn/1.png'], model: 'm' }) }
    const prisma = { generatedAsset: { create: jest.fn().mockResolvedValue({ id: 'a' }) } }
    const service = new ProductSetsService(prisma as never, router as never)
    await service.generateImage({ prompt: 'p', tenantId: 't', productName: '手表', productId: 'p1', createdBy: 'admin' })
    expect(prisma.generatedAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productName: '手表', productId: 'p1', createdBy: 'admin' }),
      }),
    )
  })
})

describe('ProductSetsService.saveGenerated createdBy（1.13 创建人真源）', () => {
  it('createdBy 透传落库', async () => {
    const prisma = { generatedAsset: { create: jest.fn().mockResolvedValue({ id: 'a' }) } }
    const service = new ProductSetsService(prisma as never, {} as never)
    await service.saveGenerated('t', { images: [{ name: 'A', url: 'https://x/a.png' }], createdBy: 'admin' })
    expect(prisma.generatedAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdBy: 'admin' }),
      }),
    )
  })
})
