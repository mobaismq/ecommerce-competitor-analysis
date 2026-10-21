import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getWorkerPrisma } from './worker-db'
import { createProduct, deleteProduct, listProducts, updateProduct, type ProductListView } from './product-capability'

// getWorkerPrisma() 是本文件内模块单例（缓存首个数据根），故用 beforeAll 建一个共享临时库，
// 各用例用不同 productCode 避免 (tenantId, productCode) 唯一约束冲突。
const root = mkdtempSync(join(tmpdir(), 'product-cap-'))
beforeAll(() => {
  process.env.ECOMMERCE_DATA_ROOT = root
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
})
afterAll(() => {
  delete process.env.ECOMMERCE_DATA_ROOT
  rmSync(root, { recursive: true, force: true })
})

/** 不传 page/pageSize 的调用方约定拿到全量数组；这里收窄联合类型，便于断言。 */
async function listAll(tenantId: string, opts: Parameters<typeof listProducts>[1] = {}): Promise<ProductListView[]> {
  const result = await listProducts(tenantId, opts)
  if (!Array.isArray(result)) throw new Error('expected array result')
  return result
}

function makeInput(code: string) {
  return {
    productCode: code,
    productName: '无线蓝牙耳机',
    brand: 'Mock 品牌',
    skus: [
      { skuCode: `${code}-SKU1`, specName: '黑色', costPrice: 80, standardPrice: 129 },
      { skuCode: `${code}-SKU2`, specName: '白色', costPrice: 80, standardPrice: 129 },
    ],
  }
}

describe('product capabilities', () => {
  it('创建商品（含 SKU）后可按 tenant 列出，storeName 本地不可解析为 null', async () => {
    const created = await createProduct('local', makeInput('SPU-A'))
    expect(created.id).toBeTruthy()
    expect(created.brand).toBe('Mock 品牌')
    expect(created.status).toBe('enabled')
    expect(created.skus.length).toBe(2)
    expect(created.storeName).toBeNull()

    const all = await listAll('local')
    expect(all.some((p) => p.productCode === 'SPU-A')).toBe(true)
    const a = all.find((p) => p.productCode === 'SPU-A')!
    expect(a.skus.map((s) => s.skuCode)).toEqual(['SPU-A-SKU1', 'SPU-A-SKU2'])
  })

  it('update 替换 SKU 与字段，list 反映变更', async () => {
    const created = await createProduct('local', makeInput('SPU-B'))
    const updated = await updateProduct('local', created.id, {
      productCode: 'SPU-B',
      productName: '升级版耳机',
      status: 'disabled',
      skus: [{ skuCode: 'SPU-B-SKU3', specName: '灰色', costPrice: 90, standardPrice: 149 }],
    })
    expect(updated.productName).toBe('升级版耳机')
    expect(updated.status).toBe('disabled')
    expect(updated.skus).toHaveLength(1)
    expect(updated.skus[0].skuCode).toBe('SPU-B-SKU3')

    const db = getWorkerPrisma()
    const row = await db.product.findUnique({ where: { id: created.id }, include: { skus: true } })
    expect(row?.skus).toHaveLength(1)
  })

  it('delete 删除商品及关联 SKU，跨 tenant 隔离', async () => {
    const a = await createProduct('local', makeInput('SPU-C'))
    await createProduct('other', { productCode: 'SPU-OTHER', productName: '他人商品' })
    const result = await deleteProduct('local', a.id)
    expect(result.ok).toBe(true)

    // 本 tenant 该商品已删，他人 tenant 不受影响
    const localCodes = (await listAll('local')).map((p) => p.productCode)
    expect(localCodes).not.toContain('SPU-C')
    const otherCodes = (await listAll('other')).map((p) => p.productCode)
    expect(otherCodes).toContain('SPU-OTHER')

    const db = getWorkerPrisma()
    expect(await db.productSku.count({ where: { productId: a.id } })).toBe(0)
  })

  it('update/delete 不存在的商品诚实抛 PRODUCT_NOT_FOUND', async () => {
    await expect(updateProduct('local', 'missing-id', { productCode: 'X', productName: 'X' })).rejects.toThrow('商品不存在')
    await expect(deleteProduct('local', 'missing-id')).rejects.toThrow('商品不存在')
  })
})

/** 以下用例覆盖从后端 ProductService.list 迁移过来的筛选/分页/校验语义。 */
describe('product list 筛选 / 分页 / 校验（迁移自后端 ProductService）', () => {
  const tenant = 'filter'
  let updatedId = ''

  beforeAll(async () => {
    const a = await createProduct(tenant, {
      productCode: 'F-001',
      productName: '降噪蓝牙耳机',
      brand: '品牌A',
      storeId: 'store-1',
      skus: [{ skuCode: 'F-001-S1', specName: '黑色', costPrice: 80, standardPrice: 129 }],
    })
    updatedId = a.id
    await createProduct(tenant, {
      productCode: 'F-002',
      productName: '便携蓝牙音箱',
      brand: '品牌B',
      storeId: 'store-2',
      status: 'disabled',
    })
    await createProduct(tenant, { productCode: 'F-003', productName: 'LED 台灯', brand: '品牌C' })
    // 触发一次更新，用于「更新时间」区间筛选
    await updateProduct(tenant, a.id, { status: 'disabled' })
  })

  it('不传 page/pageSize 时返回全量数组（保持既有调用方契约）', async () => {
    const rows = await listAll(tenant)
    expect(rows.map((r) => r.productCode).sort()).toEqual(['F-001', 'F-002', 'F-003'])
  })

  it('传 page/pageSize 时返回 { rows, total, page, pageSize }', async () => {
    const page = await listProducts(tenant, { page: 2, pageSize: 2 })
    expect(Array.isArray(page)).toBe(false)
    const result = page as { rows: unknown[]; total: number; page: number; pageSize: number }
    expect(result.total).toBe(3)
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(2)
    expect(result.rows).toHaveLength(1)
  })

  it('keyword 同时匹配商品名称与商品编码', async () => {
    const byName = await listAll(tenant, { keyword: '音箱' })
    expect(byName.map((r) => r.productCode)).toEqual(['F-002'])
    const byCode = await listAll(tenant, { keyword: 'F-003' })
    expect(byCode.map((r) => r.productCode)).toEqual(['F-003'])
  })

  it('productCode / productName / brand / storeId 逐字段 AND 筛选', async () => {
    const byCode = await listAll(tenant, { productCode: 'F-00' })
    expect(byCode).toHaveLength(3)
    const byNameAndBrand = await listAll(tenant, { productName: '蓝牙', brand: '品牌B' })
    expect(byNameAndBrand.map((r) => r.productCode)).toEqual(['F-002'])
    const byBrandMiss = await listAll(tenant, { productName: '蓝牙', brand: '品牌C' })
    expect(byBrandMiss).toHaveLength(0)
    const byStore = await listAll(tenant, { storeId: 'store-2' })
    expect(byStore.map((r) => r.productCode)).toEqual(['F-002'])
  })

  it('status 精确筛选', async () => {
    const enabled = await listAll(tenant, { status: 'enabled' })
    expect(enabled.map((r) => r.productCode)).toEqual(['F-003'])
  })

  it('创建时间/更新时间区间筛选：To 补当日末尾，越界区间返回空', async () => {
    const today = localToday()
    const sameDay = await listAll(tenant, { createTimeFrom: today, createTimeTo: today })
    expect(sameDay).toHaveLength(3)
    const updatedToday = await listAll(tenant, { updateTimeFrom: today, updateTimeTo: today })
    expect(updatedToday.length).toBeGreaterThanOrEqual(3)
    const outOfRange = await listAll(tenant, { createTimeFrom: '2000-01-01', createTimeTo: '2000-01-02' })
    expect(outOfRange).toHaveLength(0)
  })

  it('重复商品编码诚实抛 PRODUCT_DUPLICATE，不泄漏 Prisma P2002', async () => {
    await expect(createProduct(tenant, { productCode: 'F-001', productName: '重复编码' })).rejects.toThrow('商品编码已存在')
    await expect(createProduct(tenant, { productCode: 'F-009', productName: '重复编码2' })).resolves.toBeTruthy()
    await expect(updateProduct(tenant, updatedId, { productCode: 'F-009' })).rejects.toThrow('商品编码已存在')
  })

  it('缺必填字段 / 非法状态 / 非法分页诚实抛 PRODUCT_VALIDATION', async () => {
    await expect(createProduct(tenant, { productName: '缺编码' })).rejects.toThrow('商品编码必填')
    await expect(createProduct(tenant, { productCode: 'F-010' })).rejects.toThrow('商品名称必填')
    await expect(createProduct(tenant, { productCode: 'F-011', productName: 'x', status: 'unknown' })).rejects.toThrow('状态取值非法')
    await expect(listProducts(tenant, { page: 0, pageSize: 10 })).rejects.toThrow('分页参数必须为正整数')
    await expect(listProducts(tenant, { createTimeFrom: 'not-a-date' })).rejects.toThrow('格式不正确')
  })

  it('SKU 归一化：整行留空丢弃，有内容但缺编码诚实报错', async () => {
    const created = await createProduct(tenant, {
      productCode: 'F-020',
      productName: 'SKU 归一化',
      skus: [{ skuCode: '  ' }, { skuCode: 'F-020-S1', specName: '红色', costPrice: 10, standardPrice: 20 }],
    })
    expect(created.skus.map((s) => s.skuCode)).toEqual(['F-020-S1'])

    await expect(
      createProduct(tenant, {
        productCode: 'F-021',
        productName: '缺编码',
        skus: [{ skuCode: '', specName: '蓝色', costPrice: 5 }],
      }),
    ).rejects.toThrow('第 1 行规格缺少 SKU 编码')
  })
})

/** 本地日期（YYYY-MM-DD）：能力层按本地时区解析，用 UTC 日切会在 00:00-08:00 误判 */
function localToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
