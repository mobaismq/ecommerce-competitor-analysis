import { BadRequestException } from '@nestjs/common'
import { PlatformAdapterController } from './platform.controller'
import { PlatformAdapterService } from './platform.service'
import { StorageDriverService } from '../storage/storage.service'
import type { StorageDriver, StorageObjectMeta } from '../storage/storage.types'

function meta(storageKey: string): StorageObjectMeta {
  return { storageKey, size: 5, mimeType: 'image/png', lastModified: new Date() }
}

describe('PlatformAdapterController.uploadListingMedia（富媒体去内嵌化端点契约）', () => {
  const writes = new Map<string, Buffer>()

  const fakeDriver: StorageDriver = {
    name: 'fake',
    async listObjects() {
      return Array.from(writes.keys())
    },
    async putObject(input) {
      writes.set(input.storageKey, input.buffer)
      return meta(input.storageKey)
    },
    async head(key) {
      return writes.has(key) ? meta(key) : null
    },
    async delete(key) {
      return writes.delete(key)
    },
    async getReadUrl(key) {
      if (!writes.has(key)) throw new Error('not found')
      return `/fake/${key}`
    },
    async readBytes(key) {
      if (!writes.has(key)) throw new Error('not found')
      return { buffer: writes.get(key)!, mimeType: 'image/png' }
    },
    async signUploadUrl() {
      throw new Error('not used')
    },
    async confirmUpload(input) {
      return meta(input.storageKey)
    },
  }

  const storageService = { getDriver: () => fakeDriver } as unknown as StorageDriverService
  const service = {} as unknown as PlatformAdapterService
  const ctrl = new PlatformAdapterController(service, storageService)

  beforeEach(() => writes.clear())

  it('把字节落盘为 listings/<tenantId>/media/… 并返回引用，contentJson 不依赖调用方传 base64', async () => {
    const result = await ctrl.uploadListingMedia(
      { user: { tenantId: 't1' }, body: Buffer.from([1, 2, 3]) },
      { 'x-media-kind': 'detail', 'x-content-type': 'image/png', 'x-original-name': 'a.png' },
    )
    expect(result.storageKey).toMatch(/^listings\/t1\/media\/.+\.png$/)
    expect(result.readUrl).toBe(`/api/platform-adapters/media/raw?key=${encodeURIComponent(result.storageKey)}`)
    expect(result.mimeType).toBe('image/png')
    expect(writes.has(result.storageKey)).toBe(true)
    expect(writes.get(result.storageKey)!.length).toBe(3)
  })

  it('拒绝非二进制/非法类型（正反双向断言）', async () => {
    await expect(
      ctrl.uploadListingMedia(
        { user: { tenantId: 't1' }, body: { not: 'buffer' } },
        { 'x-media-kind': 'video', 'x-content-type': 'video/mp4' },
      ),
    ).rejects.toThrow(BadRequestException)
    await expect(
      ctrl.uploadListingMedia(
        { user: { tenantId: 't1' }, body: Buffer.from([1]) },
        { 'x-media-kind': 'hack', 'x-content-type': 'image/png' },
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it('cleanupListingMedia 只删除 listings/ 前缀，外部 key 不受影响（防误删）', async () => {
    writes.set('listings/t1/x.png', Buffer.from('a'))
    writes.set('assets/t1/keep.png', Buffer.from('b'))
    const serviceWithCleanup = {
      listPlatforms() {
        return []
      },
      async cleanupListingMedia(keys: string[]) {
        let removed = 0
        for (const k of keys) {
          if (!k.startsWith('listings/')) continue
          if (await fakeDriver.delete(k)) removed += 1
        }
        return { removed }
      },
    } as unknown as PlatformAdapterService
    const ctrl2 = new PlatformAdapterController(serviceWithCleanup, storageService)
    const r = await ctrl2.removeListingMedia({ keys: ['listings/t1/x.png', 'assets/t1/keep.png'] })
    expect(r.removed).toBe(1)
    expect(writes.has('listings/t1/x.png')).toBe(false)
    expect(writes.has('assets/t1/keep.png')).toBe(true)
  })
})