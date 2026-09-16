import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'
import { StorageCleanupService } from '../src/storage/storage-cleanup.service'
import { StorageDriverService } from '../src/storage/storage.service'

async function main() {
  loadBackendEnv()
  const dir = mkdtempSync(join(tmpdir(), 'eca-storage-cleanup-'))
  process.env.STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_DIR = dir
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')

  mkdirSync(join(dir, 'objects'), { recursive: true })
  writeFileSync(join(dir, 'objects/orphan1.png'), 'orphan')
  writeFileSync(join(dir, 'objects/failed-upload.png'), 'failed')
  writeFileSync(join(dir, 'objects/referenced.png'), 'referenced')
  const asset = await prisma.generatedAsset.create({
    data: {
      tenantId: tenant.id,
      runId: 'cleanup-run',
      storageKey: 'objects/referenced.png',
      mimeType: 'image/png',
      size: 10,
      originalName: 'referenced.png',
    },
  })

  const cleanup = new StorageCleanupService(prisma, new StorageDriverService())
  const result = await cleanup.cleanupOrphans()
  const output = {
    cleanup: result,
    orphan1Gone: !existsSync(join(dir, 'objects/orphan1.png')),
    failedUploadGone: !existsSync(join(dir, 'objects/failed-upload.png')),
    referencedKept: existsSync(join(dir, 'objects/referenced.png')),
  }
  console.log(JSON.stringify(output))

  await prisma.generatedAsset.deleteMany({ where: { id: asset.id } })
  await prisma.$disconnect()
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok =
    result.scanned === 3 &&
    result.referencedCount >= 1 &&
    result.orphanCount === 2 &&
    result.deleted === 2 &&
    result.errors.length === 0 &&
    output.orphan1Gone &&
    output.failedUploadGone &&
    output.referencedKept
  process.exit(ok ? 0 : 1)
}

void main()
