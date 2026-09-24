import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { LocalStorageDriver } from './local-storage.driver'
import { OssStorageDriver } from './oss-storage.driver'
import { StorageDriverService } from './storage.service'

describe('Storage Drivers', () => {
  describe('StorageDriverService 环境变量路由', () => {
    const originalEnv = process.env.STORAGE_DRIVER

    afterEach(() => {
      process.env.STORAGE_DRIVER = originalEnv
    })

    it('默认使用 local 存储驱动', () => {
      delete process.env.STORAGE_DRIVER
      const service = new StorageDriverService()
      expect(service.getDriver().name).toBe('local')
    })

    it('配置 STORAGE_DRIVER=oss 时使用 oss 驱动', () => {
      process.env.STORAGE_DRIVER = 'oss'
      const service = new StorageDriverService()
      expect(service.getDriver().name).toBe('oss')
    })
  })

  describe('LocalStorageDriver 文件操作与安全边界', () => {
    let tmpDir: string
    let driver: LocalStorageDriver

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eca-storage-test-'))
      driver = new LocalStorageDriver(tmpDir)
    })

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('putObject, head, getReadUrl, delete 完整生命周期', async () => {
      const buffer = Buffer.from('hello-storage-content')
      const meta = await driver.putObject({
        storageKey: 'tenant-1/images/test.png',
        buffer,
      })

      expect(meta.storageKey).toBe('tenant-1/images/test.png')
      expect(meta.size).toBe(buffer.length)
      expect(meta.mimeType).toBe('image/png')
      expect(meta.sha256).toBeDefined()

      const headMeta = await driver.head('tenant-1/images/test.png')
      expect(headMeta).not.toBeNull()
      expect(headMeta?.size).toBe(buffer.length)

      const readUrl = await driver.getReadUrl('tenant-1/images/test.png')
      expect(readUrl).toContain('tenant-1/images/test.png')
      expect(fs.existsSync(readUrl)).toBe(true)

      const bytes = await driver.readBytes('tenant-1/images/test.png')
      expect(bytes.buffer).toEqual(buffer)
      expect(bytes.mimeType).toBe('image/png')

      const deleted = await driver.delete('tenant-1/images/test.png')
      expect(deleted).toBe(true)
      expect(await driver.head('tenant-1/images/test.png')).toBeNull()
    })

    it('越界路径应被拒绝防止目录遍历攻击', async () => {
      await expect(
        driver.putObject({
          storageKey: '../../etc/passwd',
          buffer: Buffer.from('attack'),
        }),
      ).rejects.toThrow('storageKey 越界')
    })

    it('signUploadUrl 生成合法的预签名上传凭证', async () => {
      const ticket = await driver.signUploadUrl({
        tenantId: 'tenant-1',
        bizType: 'images',
        originalName: 'photo.jpg',
        contentType: 'image/jpeg',
      })

      expect(ticket.uploadId).toBeDefined()
      expect(ticket.storageKey).toContain('tenant-1/images')
      expect(ticket.headers?.['x-upload-sign']).toBeDefined()
      expect(ticket.headers?.['x-biz-type']).toBe('images')
    })
  })

  describe('OssStorageDriver 真实驱动', () => {
    it('未配置 OSS_* 时抛出清晰配置错误（离线安全）', async () => {
      delete process.env.OSS_REGION
      delete process.env.OSS_BUCKET
      delete process.env.OSS_ACCESS_KEY_ID
      delete process.env.OSS_ACCESS_KEY_SECRET
      const driver = new OssStorageDriver()
      await expect(driver.listObjects()).rejects.toThrow('OSS 驱动未配置')
      await expect(driver.head('any-key')).rejects.toThrow('OSS 驱动未配置')
      await expect(driver.putObject({ storageKey: 'x.png', buffer: Buffer.from('x') })).rejects.toThrow('OSS 驱动未配置')
    })
  })
})
