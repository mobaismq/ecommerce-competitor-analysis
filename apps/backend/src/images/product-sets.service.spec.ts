import { ProductSetsService, normalizeReferenceImages } from './product-sets.service'
import { StorageDriverService } from '../storage/storage.service'
import type { StorageDriver, StorageObjectMeta } from '../storage/storage.types'

function meta(storageKey: string): StorageObjectMeta {
  return { storageKey, size: 3, mimeType: 'image/png', lastModified: new Date() }
}

function makeStorage(): StorageDriverService {
  const driver: StorageDriver = {
    name: 'fake',
    async listObjects() {
      return []
    },
    async putObject(input) {
      return meta(input.storageKey)
    },
    async head(key) {
      return meta(key)
    },
    async delete() {
      return true
    },
    async getReadUrl(key) {
      return `/fake/${key}`
    },
    async readBytes(key) {
      return { buffer: Buffer.from('abc'), mimeType: 'image/png' }
    },
    async signUploadUrl() {
      throw new Error('not used')
    },
    async confirmUpload(input) {
      return meta(input.storageKey)
    },
  }
  return { getDriver: () => driver } as unknown as StorageDriverService
}

// 图生图/保存 http URL 时走 resolveMediaBytes 的下载分支：用 mock fetch 避免真实网络（离线/防资费红线）
const realFetch = global.fetch
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'image/png' }),
    arrayBuffer: async () => new ArrayBuffer(4),
  } as unknown as Response)
})
afterEach(() => {
  global.fetch = realFetch
})

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

describe('ProductSetsService.generateImage（诚实空态 + 真落盘 + 参考图透传）', () => {
  function makeService(router: any, prisma?: any) {
    return new ProductSetsService(prisma ?? { generatedAsset: { create: jest.fn().mockResolvedValue({ id: 'a' }) } }, router, makeStorage())
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

  it('有真实返回时逐张真落盘并登记 GeneratedAsset（storageKey/size/sourceUrl），返回 id+rawUrl 引用', async () => {
    const router = {
      execute: jest.fn().mockResolvedValue({ images: ['https://cdn/1.png', 'data:image/png;base64,QUJD'], model: 'm', durationMs: 1 }),
    }
    const prisma = {
      generatedAsset: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 'asset-1', mimeType: 'image/png' })
          .mockResolvedValueOnce({ id: 'asset-2', mimeType: 'image/png' }),
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
        storageKey: expect.stringContaining('product-sets/job-1/image-'),
        size: 3,
        sourceUrl: 'https://cdn/1.png',
        originalName: '01 白底图-1',
        category: '白底图',
        prompt: 'p',
        ratio: '3:4',
      }),
    })
    expect(res.images).toEqual([
      { id: 'asset-1', url: 'https://cdn/1.png', dataUrl: 'https://cdn/1.png', mimeType: 'image/png', rawUrl: '/api/assets/asset-1/raw' },
      { id: 'asset-2', url: 'data:image/png;base64,QUJD', dataUrl: 'data:image/png;base64,QUJD', mimeType: 'image/png', rawUrl: '/api/assets/asset-2/raw' },
    ])
    expect(res.assetIds).toEqual(['asset-1', 'asset-2'])
    expect(res.jobId).toBe('job-1')
  })
})

describe('ProductSetsService.saveGenerated/removeGeneratedBatch/listGenerated（5.9 旧版契约）', () => {
  it('saveGenerated 逐张真落盘批量登记生成主图，映射 productName/productId/platform/sizeRatio', async () => {
    const prisma = { generatedAsset: { create: jest.fn().mockResolvedValue({ id: 'a1' }) } }
    const service = new ProductSetsService(prisma as never, {} as never, makeStorage())
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
          storageKey: expect.stringContaining('generated-main/t/'),
          size: 3,
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
    const service = new ProductSetsService(prisma as never, {} as never, makeStorage())
    await expect(service.saveGenerated('t', { images: [{ url: ' ' }] })).resolves.toEqual({ ok: true, saved: 0 })
    expect(prisma.generatedAsset.create).not.toHaveBeenCalled()
  })

  it('removeGeneratedBatch 按 ids 批量删除并限租户', async () => {
    const prisma = { generatedAsset: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) } }
    const service = new ProductSetsService(prisma as never, {} as never, makeStorage())
    await expect(service.removeGeneratedBatch('t', ['a', 'b'])).resolves.toEqual({ ok: true, deleted: 2 })
    expect(prisma.generatedAsset.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] }, tenantId: 't' } })
  })

  it('listGenerated 按 productName 模糊筛选 originalName 或 productName', async () => {
    const prisma = { generatedAsset: { findMany: jest.fn().mockResolvedValue([]) } }
    const service = new ProductSetsService(prisma as never, {} as never, makeStorage())
    await service.listGenerated('t', undefined, '手表')
    expect(prisma.generatedAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ originalName: { contains: '手表' } }, { productName: { contains: '手表' } }],
        }),
      }),
    )
  })
})

describe('ProductSetsService.generateImage 真源字段（1.13：关联商品/创建人）', () => {
  it('透传 productName/productId/createdBy 并落库', async () => {
    const router = { execute: jest.fn().mockResolvedValue({ images: ['https://cdn/1.png'], model: 'm' }) }
    const prisma = { generatedAsset: { create: jest.fn().mockResolvedValue({ id: 'a' }) } }
    const service = new ProductSetsService(prisma as never, router as never, makeStorage())
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
    const service = new ProductSetsService(prisma as never, {} as never, makeStorage())
    await service.saveGenerated('t', { images: [{ name: 'A', url: 'https://x/a.png' }], createdBy: 'admin' })
    expect(prisma.generatedAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdBy: 'admin' }),
      }),
    )
  })
})