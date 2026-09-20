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

  it('有真实返回时登记 GeneratedAsset 并返回图片', async () => {
    const router = { execute: jest.fn().mockResolvedValue({ images: ['https://cdn/1.png', 'data:image/png;base64,QUJD'], model: 'm', durationMs: 1 }) }
    const prisma = { generatedAsset: { create: jest.fn().mockResolvedValue({ id: 'asset-1' }) } }
    const service = makeService(router, prisma)

    const res = await service.generateImage({ prompt: 'p', tenantId: 't' })
    expect(prisma.generatedAsset.create).toHaveBeenCalled()
    expect(res.images).toEqual([
      { url: 'https://cdn/1.png', dataUrl: 'https://cdn/1.png' },
      { url: 'data:image/png;base64,QUJD', dataUrl: 'data:image/png;base64,QUJD' },
    ])
    expect(res.assetId).toBe('asset-1')
  })
})
