import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getWorkerPrisma } from '../worker/worker-db'
import { importCollectedProducts } from './collection-importer'

// 测试专用 mock 采集数据：仅用于本单元测试验证"采集结果→报告快照表"桥，绝不触发真实爬虫。
const MOCK_PRODUCTS = [
  {
    externalProductId: 'p1',
    title: '智能运动手表 防水 心率监测',
    price: 399,
    shopName: '测试店铺A',
    sold: 1200,
    imageUrl: 'https://img.example.com/p1.jpg',
    productUrl: 'https://item.example.com/p1',
    skus: [
      { skuId: 'p1-s1', name: '曜石黑 43mm', price: 399 },
      { skuId: 'p1-s2', name: '幻夜银 46mm', price: 429 },
    ],
    qas: [{ question: '支持游泳吗？', answer: '支持 5ATM 防水' }],
    reviews: [
      { content: '性价比高，满意', rating: 4 },
      { content: '表带偏硬', rating: 3 },
    ],
  },
  {
    externalProductId: 'p2',
    title: '儿童电话手表 4G 定位',
    price: 459,
    shopName: '测试店铺B',
    sold: 890,
    imageUrl: 'https://img.example.com/p2.jpg',
    productUrl: 'https://item.example.com/p2',
    skus: [{ skuId: 'p2-s1', name: '蓝色', price: 459 }],
    qas: [],
    reviews: [{ content: '定位准，视频清晰', rating: 5 }],
  },
]

const dirs: string[] = []
beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'collection-importer-'))
  dirs.push(root)
  process.env.ECOMMERCE_DATA_ROOT = root
  mkdirSync(join(root, '.ecommerce'), { recursive: true })
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
})
afterEach(() => {
  delete process.env.ECOMMERCE_DATA_ROOT
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('importCollectedProducts', () => {
  it('将采集结果写入 collectionJob + 四张快照表，且按 jobId 幂等、快照按最新覆盖', async () => {
    const db = getWorkerPrisma()
    const res = await importCollectedProducts(db, {
      tenantId: 'local',
      keyword: '智能手表',
      jobId: 'collect-123',
      dataSnapshotDate: '2026-09-25',
      products: MOCK_PRODUCTS,
    })

    expect(res.counts.productCount).toBe(2)
    expect(res.counts.skuCount).toBe(3)
    expect(res.counts.qaCount).toBe(1)
    expect(res.counts.reviewCount).toBe(3)

    const collection = await db.collectionJob.findFirst({
      where: { tenantId: 'local', keyword: { contains: '智能手表' } },
      orderBy: { createdAt: 'desc' },
    })
    expect(collection).not.toBeNull()
    expect(collection!.status).toBe('success')

    const snapshots = await db.productSnapshot.findMany({ where: { collectionJobId: collection!.id }, orderBy: { price: 'asc' } })
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0].externalProductId).toBe('p1')
    expect(snapshots[0].shopName).toBe('测试店铺A')
    // report-capability 从 rawJson 读取 sold / imageUrl / productUrl
    const raw = snapshots[0].rawJson as Record<string, unknown>
    expect(raw.sold).toBe(1200)
    expect(raw.imageUrl).toContain('p1.jpg')
    expect(raw.productUrl).toContain('item.example.com/p1')

    const skus = await db.productSkuSnapshot.findMany({ where: { productSnapshotId: snapshots[0].id } })
    expect(skus).toHaveLength(2)
    const qas = await db.productQaSnapshot.findMany({ where: { productSnapshotId: snapshots[0].id } })
    expect(qas).toHaveLength(1)
    const reviews = await db.productReviewSnapshot.findMany({ where: { productSnapshotId: snapshots[0].id } })
    expect(reviews).toHaveLength(2)

    // 幂等：相同 jobId 重复导入不产生重复 collectionJob；新增竞品并入同一采集任务快照
    await importCollectedProducts(db, {
      tenantId: 'local',
      keyword: '智能手表',
      jobId: 'collect-123',
      dataSnapshotDate: '2026-09-25',
      products: [{ externalProductId: 'p3', title: '新增竞品', price: 599, shopName: '测试店铺C', sold: 50 }],
    })
    const jobs = await db.collectionJob.findMany({ where: { jobId: 'collect-123' } })
    expect(jobs).toHaveLength(1)
    const after = await db.productSnapshot.findMany({ where: { collectionJobId: jobs[0].id } })
    // p1/p2 保留，新增 p3
    expect(after).toHaveLength(3)
    const p3 = after.find((s) => s.externalProductId === 'p3')
    expect(p3?.title).toBe('新增竞品')
  })
})
