import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getWorkerPrisma } from './worker-db'
import { createProduct, deleteProduct, listProducts, updateProduct } from './product-capability'

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

    const all = await listProducts('local')
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
    const localCodes = (await listProducts('local')).map((p) => p.productCode)
    expect(localCodes).not.toContain('SPU-C')
    const otherCodes = (await listProducts('other')).map((p) => p.productCode)
    expect(otherCodes).toContain('SPU-OTHER')

    const db = getWorkerPrisma()
    expect(await db.productSku.count({ where: { productId: a.id } })).toBe(0)
  })

  it('update/delete 不存在的商品诚实抛 PRODUCT_NOT_FOUND', async () => {
    await expect(updateProduct('local', 'missing-id', { productCode: 'X', productName: 'X' })).rejects.toThrow('商品不存在')
    await expect(deleteProduct('local', 'missing-id')).rejects.toThrow('商品不存在')
  })
})
