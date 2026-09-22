import { ProductService } from './product.service'

describe('ProductService.list（筛选 + 分页）', () => {
  function makePrisma() {
    const findMany = jest.fn()
    const count = jest.fn()
    const storeFindMany = jest.fn()
    const prisma: {
      product: { findMany: jest.Mock; count: jest.Mock }
      store: { findMany: jest.Mock }
      $transaction: jest.Mock
    } = {
      product: { findMany, count },
      store: { findMany: storeFindMany },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    }
    return { prisma, findMany, count, storeFindMany }
  }

  it('无分页参数时返回全量数组，并应用 status/storeId/时间/关键词筛选', async () => {
    const { prisma, findMany } = makePrisma()
    findMany.mockResolvedValue([{ id: 'p1' }])
    const service = new ProductService(prisma as any)

    await service.list('tenant-1', {
      keyword: '激光',
      status: 'enabled',
      storeId: 'store-9',
      createTimeFrom: '2026-01-01',
      createTimeTo: '2026-06-30',
    })

    expect(findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        status: 'enabled',
        storeId: 'store-9',
        OR: [{ productName: { contains: '激光' } }, { productCode: { contains: '激光' } }],
        createdAt: { gte: new Date('2026-01-01'), lte: new Date('2026-06-30') },
      },
      orderBy: { createdAt: 'desc' },
      include: { skus: true },
    })
  })

  it('传 page/pageSize 时返回 { rows, total } 分页结构，并带 skip/take', async () => {
    const { prisma, findMany, count } = makePrisma()
    findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    count.mockResolvedValue(42)
    const service = new ProductService(prisma as any)

    const result = await service.list('tenant-1', { page: 2, pageSize: 10 })

    expect(prisma.$transaction).toHaveBeenCalled()
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    )
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-1' } }))
    expect(result).toEqual({ rows: [{ id: 'p1', storeName: null }, { id: 'p2', storeName: null }], total: 42, page: 2, pageSize: 10 })
  })

  it('带 storeId 的商品附加店铺名（storeName）', async () => {
    const { prisma, findMany, storeFindMany } = makePrisma()
    findMany.mockResolvedValue([{ id: 'p1', storeId: 's1' }, { id: 'p2', storeId: 'missing' }, { id: 'p3', storeId: null }])
    storeFindMany.mockResolvedValue([{ id: 's1', name: '旗舰店' }])
    const service = new ProductService(prisma as any)

    const result = await service.list('tenant-1', {})

    expect(storeFindMany).toHaveBeenCalledWith({ where: { id: { in: ['s1', 'missing'] } }, select: { id: true, name: true } })
    expect(result).toEqual([
      { id: 'p1', storeId: 's1', storeName: '旗舰店' },
      { id: 'p2', storeId: 'missing', storeName: null },
      { id: 'p3', storeId: null, storeName: null },
    ])
  })
})
