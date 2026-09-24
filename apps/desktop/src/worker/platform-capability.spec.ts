import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getWorkerPrisma, workerDataRoots } from './worker-db'
import { publishListing, rawListingMedia, saveListingDraft, uploadListingMedia } from './platform-capability'

const dirs: string[] = []
beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'platform-cap-'))
  dirs.push(root)
  process.env.ECOMMERCE_DATA_ROOT = root
  mkdirSync(join(root, '.ecommerce'), { recursive: true })
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
})
afterEach(() => {
  delete process.env.ECOMMERCE_DATA_ROOT
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
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
})
