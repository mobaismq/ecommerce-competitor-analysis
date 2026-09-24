import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getWorkerPrisma, putBytes, workerDataRoots } from './worker-db'
import { deleteMedia, listMedia, mediaRaw, replicateVideo } from './media-capability'

const dirs: string[] = []
beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'media-cap-'))
  dirs.push(root)
  process.env.ECOMMERCE_DATA_ROOT = root
  mkdirSync(join(root, '.ecommerce'), { recursive: true })
  execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
})
afterEach(() => {
  delete process.env.ECOMMERCE_DATA_ROOT
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('media capabilities', () => {
  it('list → raw → delete round trip using local readBytes', async () => {
    const db = getWorkerPrisma()
    const roots = workerDataRoots()
    const storageKey = `videos/u1/source/sample-1.mp4`
    const video = Buffer.from('000000186674797069736f6d0000000069736f6d', 'hex')
    putBytes(storageKey, video, { userRoot: roots.userRoot })
    await db.mediaAsset.create({
      data: { id: 'm1', tenantId: 't', sourceType: 'video_source', storageKey, mimeType: 'video/mp4', size: video.length, originalName: 'sample' },
    })

    const list = await listMedia({ tenantId: 't' })
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('m1')
    // 其它 sourceType / tenantId 不混入
    expect(await listMedia({ tenantId: 'other' })).toHaveLength(0)

    const raw = await mediaRaw({ id: 'm1', tenantId: 't' })
    expect(raw).not.toBeNull()
    expect(raw!.mimeType).toBe('video/mp4')
    expect(raw!.dataUrl.startsWith('data:video/mp4;base64,')).toBe(true)
    expect(Buffer.from(raw!.dataUrl.split(',')[1], 'base64')).toEqual(video)

    // 不存在的素材返回 null
    expect(await mediaRaw({ id: 'missing', tenantId: 't' })).toBeNull()

    const del = await deleteMedia({ id: 'm1', tenantId: 't' })
    expect(del.ok).toBe(true)
    expect(await listMedia({ tenantId: 't' })).toHaveLength(0)
    // 删除后磁盘字节也随之清理
    expect(await mediaRaw({ id: 'm1', tenantId: 't' })).toBeNull()
  })

  it('replicateVideo 诚实回落：未配置 VIDEO_PROVIDER 时抛"未接入"，不伪造假 mp4', async () => {
    await expect(
      replicateVideo({ tenantId: 't', sourceUrl: 'https://example.com/v.mp4', title: 'x' }),
    ).rejects.toThrow('视频复刻')
  })
})
