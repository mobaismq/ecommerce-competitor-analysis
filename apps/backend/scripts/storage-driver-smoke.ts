import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBackendEnv } from '../src/env'
import { LocalStorageDriver } from '../src/storage/local-storage.driver'
import { StorageDriverService } from '../src/storage/storage.service'

async function main() {
  loadBackendEnv()
  const dir = mkdtempSync(join(tmpdir(), 'eca-storage-'))
  process.env.STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_DIR = dir
  process.env.STORAGE_PREFIX = 'test'
  const service = new StorageDriverService()
  const driver = service.getDriver()

  const meta = await driver.putObject({ storageKey: 'test/dev/asset/png/1.png', buffer: Buffer.from('png-bytes'), contentType: 'image/png' })
  const fileExists = existsSync(join(dir, 'test/dev/asset/png/1.png'))
  const head = await driver.head('test/dev/asset/png/1.png')
  const readUrl = await driver.getReadUrl('test/dev/asset/png/1.png')
  const missing = await driver.head('test/not-exists.png')

  const ticket = await driver.signUploadUrl({ tenantId: 't1', bizType: 'collection', runId: 'r1', originalName: 'photo.jpg' })
  await driver.putObject({ storageKey: ticket.storageKey, buffer: Buffer.from('uploaded') })
  const confirmed = await driver.confirmUpload({ uploadId: ticket.uploadId, storageKey: ticket.storageKey, expectedSize: 8 })
  const deleted = await driver.delete('test/dev/asset/png/1.png')
  const afterDelete = await driver.head('test/dev/asset/png/1.png')

  let traversalRejected = false
  try {
    await driver.head('../../outside.png')
  } catch {
    traversalRejected = true
  }

  let ossNotReady = false
  process.env.STORAGE_DRIVER = 'oss'
  const ossDriver = service.getDriver()
  try {
    await ossDriver.putObject({ storageKey: 'x.png', buffer: Buffer.from('x') })
  } catch (error) {
    ossNotReady = error instanceof Error && error.message.includes('待接入')
  }

  const output = {
    driverName: driver.name,
    put: { size: meta.size, mime: meta.mimeType, sha256: meta.sha256 != null, fileExists },
    head: { size: head?.size, mime: head?.mimeType, missing: missing === null },
    readUrl: typeof readUrl === 'string' && readUrl.length > 0,
    signUpload: { uploadId: ticket.uploadId != null, method: ticket.method, keyPrefix: ticket.storageKey.startsWith('test/t1/collection/r1/') },
    confirm: { size: confirmed.size, mime: confirmed.mimeType },
    delete: { deleted, afterDelete: afterDelete === null },
    traversalRejected,
    ossNotReady,
  }
  console.log(JSON.stringify(output))

  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  const ok =
    output.driverName === 'local' &&
    meta.size === 9 &&
    meta.mimeType === 'image/png' &&
    meta.sha256 != null &&
    output.put.fileExists &&
    head?.size === 9 &&
    head.mimeType === 'image/png' &&
    output.head.missing &&
    output.readUrl &&
    output.signUpload.uploadId &&
    ticket.method === 'PUT' &&
    output.signUpload.keyPrefix &&
    confirmed.size === 8 &&
    output.delete.deleted &&
    output.delete.afterDelete &&
    output.traversalRejected &&
    output.ossNotReady
  process.exit(ok ? 0 : 1)
}

void main()
