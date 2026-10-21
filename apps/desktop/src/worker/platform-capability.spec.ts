import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getWorkerPrisma, workerDataRoots } from './worker-db'
import {
  getListingDraft,
  listProducts,
  publishListing,
  rawListingMedia,
  saveListingDraft,
  uploadListingMedia,
} from './platform-capability'

// getWorkerPrisma() 是本文件内模块单例（缓存首个数据根），故用 beforeAll 建一个共享临时库，
// 各用例用不同 title/storeId 区分数据，避免互相干扰。
const root = mkdtempSync(join(tmpdir(), 'platform-cap-'))
beforeAll(() => {
  process.env.ECOMMERCE_DATA_ROOT = root
  mkdirSync(join(root, '.ecommerce'), { recursive: true })
  execFileSync('node', ['scripts/apply-local-migration.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, ECOMMERCE_DATA_ROOT: root },
    stdio: 'pipe',
  })
})
afterAll(() => {
  delete process.env.ECOMMERCE_DATA_ROOT
  rmSync(root, { recursive: true, force: true })
})

const payload = {
  tenantId: 'local',
  platformCode: 'taobao',
  title: '测试商品',
  storeId: 'mock-shop-1',
  categoryId: '162102',
  categoryPath: 'Mock 女装/Mock 连衣裙',
  price: 199,
  skus: [{ specName: '黑色', price: 199, stock: 10 }],
  productAttrs: { 品牌: '测试' },
}

describe('platform capabilities', () => {
  it('草稿保存写入本地 ListingDraft，发布无真实凭证诚实报错', async () => {
    const draft = await saveListingDraft(payload)
    expect(draft.ok).toBe(true)
    expect(draft.draftId).toBeTruthy()
    expect(draft.status).toBe('draft')

    const db = getWorkerPrisma()
    const row = await db.listingDraft.findUnique({ where: { id: draft.draftId } })
    expect(row?.tenantId).toBe('local')
    expect(row?.title).toBe('测试商品')

    // 发布：无真实 TAOBAO 凭证 → 诚实报错，草稿落为 failed，不建假单
    await expect(publishListing(payload)).rejects.toThrow('未配置淘宝开放平台真实凭证')
    const failed = await db.listingDraft.findFirst({ where: { jobId: { startsWith: 'manual-listing' } }, orderBy: { createdAt: 'desc' } })
    expect(failed?.status).toBe('failed')
  })

  it('富媒体字节落盘 listings/ 并可 raw 读回真实字节', async () => {
    const bytes = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])
    const uploaded = await uploadListingMedia({ buffer: bytes, tenantId: 'local', kind: 'main', contentType: 'image/png', originalName: 'cover.png' })
    expect(uploaded.storageKey.startsWith('listings/local/media/')).toBe(true)
    expect(uploaded.size).toBe(bytes.length)
    expect(workerDataRoots().userRoot.length).toBeGreaterThan(0)

    const raw = await rawListingMedia(uploaded.storageKey)
    expect(raw).not.toBeNull()
    expect(raw!.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(Buffer.from(raw!.dataUrl.split(',')[1], 'base64')).toEqual(bytes)
  })

  it('草稿可读回并按 draftId 原地更新（不产生重复草稿）', async () => {
    const created = await saveListingDraft({ ...payload, title: '待编辑草稿' })
    const loaded = await getListingDraft(created.draftId, 'local')
    expect(loaded.title).toBe('待编辑草稿')
    expect(loaded.platformCode).toBe('taobao')
    expect(loaded.contentJson.storeId).toBe('mock-shop-1')

    const updated = await saveListingDraft({ ...payload, draftId: created.draftId, title: '已编辑草稿' })
    expect(updated.updated).toBe(true)
    expect(updated.draftId).toBe(created.draftId)

    const again = await getListingDraft(created.draftId, 'local')
    expect(again.title).toBe('已编辑草稿')

    const db = getWorkerPrisma()
    const count = await db.listingDraft.count({ where: { title: { in: ['待编辑草稿', '已编辑草稿'] } } })
    expect(count).toBe(1)
  })

  it('草稿不存在时诚实抛错（读取/更新/发布同口径）', async () => {
    await expect(getListingDraft('missing-draft', 'local')).rejects.toThrow('草稿不存在')
    await expect(saveListingDraft({ ...payload, draftId: 'missing-draft' })).rejects.toThrow('草稿不存在')
    await expect(publishListing({ ...payload, draftId: 'missing-draft' })).rejects.toThrow('草稿不存在')
  })

  it('发布带 draftId 时复用同一条草稿，不产生重复记录', async () => {
    const created = await saveListingDraft({ ...payload, title: '复用草稿发布' })
    const db = getWorkerPrisma()
    const before = await db.listingDraft.count()

    await expect(publishListing({ ...payload, draftId: created.draftId, title: '复用草稿发布' })).rejects.toThrow('未配置淘宝开放平台真实凭证')

    const after = await db.listingDraft.count()
    expect(after).toBe(before)
    const row = await db.listingDraft.findUnique({ where: { id: created.draftId } })
    expect(row?.status).toBe('failed')
  })
})

describe('platform listProducts（迁移自后端 platform.service.listProducts）', () => {
  let draftA = ''
  let draftB = ''
  let jobIdA = ''
  let jobIdB = ''

  beforeAll(async () => {
    const a = await saveListingDraft({
      tenantId: 'local',
      platformCode: 'taobao',
      title: '降噪蓝牙耳机',
      storeId: 'store-a',
      categoryId: '1001',
      categoryPath: '数码/耳机',
      price: 199,
      skus: [
        { specName: '黑色', skuCode: 'A-BLK', price: 199, stock: 10 },
        { specName: '白色', skuCode: 'A-WHT', price: 249, stock: 5 },
      ],
      contentJson: { productCode: 'SPL-001', storeName: 'A 旗舰店' },
    })
    draftA = a.draftId

    const b = await saveListingDraft({
      tenantId: 'local',
      platformCode: 'jd',
      title: '便携榨汁机',
      storeId: 'store-b',
      categoryId: '2001',
      categoryPath: '家电/榨汁机',
      price: 89,
      contentJson: { productCode: 'SPL-002' },
    })
    draftB = b.draftId

    const db = getWorkerPrisma()
    jobIdA = (await db.listingDraft.findUniqueOrThrow({ where: { id: draftA } })).jobId
    jobIdB = (await db.listingDraft.findUniqueOrThrow({ where: { id: draftB } })).jobId
  })

  it('返回旧版表格所需字段（编码/ID/类目/店铺/价格区间/SKU/状态文案）', async () => {
    const result = await listProducts({ tenantId: 'local', productCode: 'SPL-001' })
    expect(result.total).toBe(1)
    const item = result.items[0]
    expect(item.productCode).toBe('SPL-001')
    expect(item.productId).toBe(jobIdA)
    expect(item.category).toBe('数码/耳机')
    expect(item.storeId).toBe('store-a')
    expect(item.storeName).toBe('A 旗舰店')
    expect(item.minPrice).toBe(199)
    expect(item.maxPrice).toBe(249)
    expect(item.publishStatus).toBe('草稿')
    expect(item.publishStatusCode).toBe('draft')
    expect(item.listingStatus).toBe('上架')
    expect(item.skus.map((sku) => sku.skuCode)).toEqual(['A-BLK', 'A-WHT'])
    expect(item.skus[0].skuName).toBe('黑色')
  })

  it('平台 / 店铺 / 关键词筛选', async () => {
    const byPlatform = await listProducts({ tenantId: 'local', platform: 'jd' })
    expect(byPlatform.items.map((item) => item.productCode)).toEqual(['SPL-002'])
    const byStore = await listProducts({ tenantId: 'local', storeId: 'store-a' })
    expect(byStore.items.map((item) => item.productCode)).toEqual(['SPL-001'])
    const byKeyword = await listProducts({ tenantId: 'local', keyword: '榨汁' })
    expect(byKeyword.items.map((item) => item.productCode)).toEqual(['SPL-002'])
  })

  it('商品编码 / 商品ID 支持逗号多值 OR 匹配', async () => {
    const byCodes = await listProducts({ tenantId: 'local', productCode: 'SPL-001, SPL-002' })
    expect(byCodes.items.map((item) => item.productCode).sort()).toEqual(['SPL-001', 'SPL-002'])
    const byIds = await listProducts({ tenantId: 'local', externalId: `${jobIdA}, ${jobIdB}` })
    expect(byIds.items.map((item) => item.productCode).sort()).toEqual(['SPL-001', 'SPL-002'])
  })

  it('发布状态支持展示文案与状态码两种入参', async () => {
    const byLabel = await listProducts({ tenantId: 'local', status: '草稿' })
    expect(byLabel.total).toBeGreaterThanOrEqual(2)
    const byCode = await listProducts({ tenantId: 'local', status: 'draft' })
    expect(byCode.total).toBe(byLabel.total)
    const submitted = await listProducts({ tenantId: 'local', status: '已发布' })
    expect(submitted.items.every((item) => item.publishStatusCode === 'submitted')).toBe(true)
    // 有 failed 草稿（前面发布失败的用例），文案应为「发布失败」
    const failed = await listProducts({ tenantId: 'local', status: '发布失败' })
    expect(failed.items.every((item) => item.publishStatus === '发布失败')).toBe(true)
  })

  it('更新时间区间筛选：To 补当日末尾，越界返回空', async () => {
    const today = localToday()
    const sameDay = await listProducts({ tenantId: 'local', updateTimeFrom: today, updateTimeTo: today })
    expect(sameDay.total).toBeGreaterThanOrEqual(2)
    const outOfRange = await listProducts({ tenantId: 'local', updateTimeFrom: '2000-01-01', updateTimeTo: '2000-01-02' })
    expect(outOfRange.total).toBe(0)
  })

  it('分页返回正确的 total（不是只统计当页）', async () => {
    const page1 = await listProducts({ tenantId: 'local', page: 1, pageSize: 1 })
    expect(page1.items).toHaveLength(1)
    expect(page1.total).toBeGreaterThanOrEqual(2)
    expect(page1.page).toBe(1)
    expect(page1.pageSize).toBe(1)
    const page2 = await listProducts({ tenantId: 'local', page: 2, pageSize: 1 })
    expect(page2.items).toHaveLength(1)
    expect(page2.items[0].id).not.toBe(page1.items[0].id)
  })
})

/** 本地日期（YYYY-MM-DD）：能力层按本地时区解析，用 UTC 日切会在 00:00-08:00 误判 */
function localToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
