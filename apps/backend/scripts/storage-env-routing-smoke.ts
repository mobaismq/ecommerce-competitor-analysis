import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AssetService } from '../src/assets/assets.service'
import { loadBackendEnv } from '../src/env'
import { LocalStorageDriver } from '../src/storage/local-storage.driver'
import { OssStorageDriver } from '../src/storage/oss-storage.driver'
import { StorageCleanupService } from '../src/storage/storage-cleanup.service'
import { StorageDriverService } from '../src/storage/storage.service'
import { PrismaService } from '../src/prisma.service'

async function main() {
  loadBackendEnv()
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')

  const localDir = mkdtempSync(join(tmpdir(), 'eca-env-local-'))
  const ossDir = mkdtempSync(join(tmpdir(), 'eca-env-oss-'))
  process.env.STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_DIR = localDir
  const driverService = new StorageDriverService()
  const localDriver = driverService.getDriver()
  const isLocal = localDriver instanceof LocalStorageDriver
  await localDriver.putObject({ storageKey: 'env/assets/local.png', buffer: Buffer.from('local-bytes'), contentType: 'image/png' })
  const localFileExists = existsSync(join(localDir, 'env/assets/local.png'))

  const asset = await prisma.generatedAsset.create({
    data: {
      tenantId: tenant.id,
      runId: 'env-run',
      storageKey: 'env/assets/local.png',
      mimeType: 'image/png',
      size: 11,
      originalName: 'local.png',
      sourceUrl: 'https://example.com/local.png',
    },
  })
  const assetService = new AssetService(prisma, driverService)
  const assetMeta = await assetService.find(asset.id, tenant.id)
  const cleanup = new StorageCleanupService(prisma, driverService)
  const cleanupLocal = await cleanup.cleanupOrphans()

  process.env.STORAGE_DRIVER = 'oss'
  process.env.STORAGE_LOCAL_DIR = ossDir
  const ossDriver = driverService.getDriver()
  const isOss = ossDriver instanceof OssStorageDriver
  let ossPutRejected = false
  let ossAssetRejected = false
  try {
    await ossDriver.putObject({ storageKey: 'env/assets/oss.png', buffer: Buffer.from('x') })
  } catch (error) {
    ossPutRejected = error instanceof Error && error.message.includes('待接入')
  }
  try {
    await assetService.raw(asset.id, tenant.id)
  } catch (error) {
    ossAssetRejected = error instanceof Error && error.message.includes('待接入')
  }
  const ossDirWritten = readdirSync(ossDir).length > 0

  const output = {
    local: { isLocal, fileExists: localFileExists, cleanupScanned: cleanupLocal.scanned },
    asset: { runId: assetMeta.runId, storageKey: assetMeta.storageKey, mimeType: assetMeta.mimeType, sourceUrl: assetMeta.sourceUrl },
    oss: { isOss, putRejected: ossPutRejected, assetRejected: ossAssetRejected, dirWritten: ossDirWritten },
  }
  console.log(JSON.stringify(output))

  await prisma.generatedAsset.deleteMany({ where: { id: asset.id } })
  await prisma.$disconnect()
  rmSync(localDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  rmSync(ossDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok =
    isLocal &&
    localFileExists &&
    cleanupLocal.scanned === 1 &&
    assetMeta.runId === 'env-run' &&
    assetMeta.storageKey === 'env/assets/local.png' &&
    assetMeta.mimeType === 'image/png' &&
    assetMeta.sourceUrl === 'https://example.com/local.png' &&
    isOss &&
    ossPutRejected &&
    ossAssetRejected &&
    !ossDirWritten
  process.exit(ok ? 0 : 1)
}

void main()
