import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'
import { LegacyAssetMigrationService } from '../src/storage/legacy-asset-migration.service'
import { StorageDriverService } from '../src/storage/storage.service'

async function main() {
  loadBackendEnv()
  const storageDir = mkdtempSync(join(tmpdir(), 'eca-legacy7-storage-'))
  const legacyDir = mkdtempSync(join(tmpdir(), 'eca-legacy7-source-'))
  process.env.STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_DIR = storageDir
  process.env.LEGACY_ASSET_DIRS = legacyDir
  process.env.LEGACY_ASSET_EXTENSIONS = '.png,.mp4,.svg'
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')

  writeFileSync(join(legacyDir, 'old1.png'), 'png-data')
  writeFileSync(join(legacyDir, 'video.mp4'), 'video-data')
  writeFileSync(join(legacyDir, 'logo.svg'), 'svg-data')
  const ignores = join(legacyDir, 'ignore.txt')
  writeFileSync(ignores, 'should-ignore')

  const service = new LegacyAssetMigrationService(prisma, new StorageDriverService())
  const first = await service.migrate(tenant.id, { cleanupSources: 'never' })
  const originalsKept = ['old1.png', 'video.mp4', 'logo.svg', 'ignore.txt'].every((name) => existsSync(join(legacyDir, name)))
  const assets = await prisma.generatedAsset.findMany({ where: { runId: 'legacy-migration', tenantId: tenant.id } })
  const storedFilesExist = assets.every((asset) => existsSync(join(storageDir, asset.storageKey)))
  const second = await service.migrate(tenant.id, { cleanupSources: 'after' })
  const originalsGone = ['old1.png', 'video.mp4', 'logo.svg'].every((name) => !existsSync(join(legacyDir, name)))
  const ignoreKept = existsSync(ignores)

  const output = {
    first: { scanned: first.scanned, migrated: first.migrated, skipped: first.skipped, cleaned: first.cleaned },
    originalsKept,
    storedFilesExist,
    assets: { count: assets.length, kinds: assets.map((asset) => asset.mimeType) },
    second: { scanned: second.scanned, migrated: second.migrated, skipped: second.skipped, cleaned: second.cleaned },
    originalsGone,
    ignoreKept,
  }
  console.log(JSON.stringify(output))

  await prisma.generatedAsset.deleteMany({ where: { runId: 'legacy-migration', tenantId: tenant.id } })
  await prisma.$disconnect()
  rmSync(storageDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  rmSync(legacyDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok =
    first.scanned === 3 &&
    first.migrated === 3 &&
    first.cleaned === 0 &&
    originalsKept &&
    storedFilesExist &&
    assets.length === 3 &&
    assets.some((asset) => asset.mimeType === 'image/png') &&
    assets.some((asset) => asset.mimeType === 'video/mp4') &&
    assets.some((asset) => asset.mimeType === 'image/svg+xml') &&
    second.scanned === 3 &&
    second.migrated === 0 &&
    second.skipped === 3 &&
    second.cleaned === 3 &&
    originalsGone &&
    ignoreKept
  process.exit(ok ? 0 : 1)
}

void main()
