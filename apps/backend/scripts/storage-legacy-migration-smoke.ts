import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'
import { LegacyAssetMigrationService } from '../src/storage/legacy-asset-migration.service'
import { StorageDriverService } from '../src/storage/storage.service'

async function main() {
  loadBackendEnv()
  const storageDir = mkdtempSync(join(tmpdir(), 'eca-legacy-storage-'))
  const legacyDir = mkdtempSync(join(tmpdir(), 'eca-legacy-source-'))
  process.env.STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_DIR = storageDir
  process.env.LEGACY_ASSET_DIRS = legacyDir
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')

  mkdirSync(join(legacyDir, 'nested'), { recursive: true })
  writeFileSync(join(legacyDir, 'old1.png'), 'old-png')
  writeFileSync(join(legacyDir, 'nested', 'old2.jpg'), 'old-jpg')

  const service = new LegacyAssetMigrationService(prisma, new StorageDriverService())
  const first = await service.migrate(tenant.id)
  const assets = await prisma.generatedAsset.findMany({ where: { runId: 'legacy-migration', tenantId: tenant.id } })
  const originalsKept = existsSync(join(legacyDir, 'old1.png')) && existsSync(join(legacyDir, 'nested', 'old2.jpg'))
  const storedFilesExist = assets.every((asset) => existsSync(join(storageDir, asset.storageKey)))
  const second = await service.migrate(tenant.id)
  const assetCountAfter = await prisma.generatedAsset.count({ where: { runId: 'legacy-migration', tenantId: tenant.id } })

  const output = {
    first: { scanned: first.scanned, migrated: first.migrated, skipped: first.skipped, errors: first.errors.length },
    assets: { count: assets.length, keys: assets.map((asset) => asset.storageKey) },
    originalsKept,
    storedFilesExist,
    second: { migrated: second.migrated, skipped: second.skipped },
    assetCountAfter,
  }
  console.log(JSON.stringify(output))

  await prisma.generatedAsset.deleteMany({ where: { runId: 'legacy-migration', tenantId: tenant.id } })
  await prisma.$disconnect()
  rmSync(storageDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  rmSync(legacyDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok =
    first.scanned === 2 &&
    first.migrated === 2 &&
    first.skipped === 0 &&
    first.errors.length === 0 &&
    assets.length === 2 &&
    assets.every((asset) => asset.storageKey.startsWith('legacy/') && asset.sha256 != null) &&
    originalsKept &&
    storedFilesExist &&
    second.migrated === 0 &&
    second.skipped === 2 &&
    assetCountAfter === 2
  process.exit(ok ? 0 : 1)
}

void main()
