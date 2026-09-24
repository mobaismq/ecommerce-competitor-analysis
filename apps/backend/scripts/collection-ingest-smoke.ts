/** 2.7 采集图直转验证：嵌入模式下，同步清单里的本地采集图被读字节落 StorageDriver（本地驱动）。不触发真实爬虫。 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'
import { LocalJobQueueService } from '../src/queue/local-job-queue.service'
import { StorageDriverService } from '../src/storage/storage.service'
import { CollectionJobService } from '../src/jobs/collection-job.service'

async function main() {
  loadBackendEnv()
  const tmpBase = join(tmpdir(), `eca-collect-${Date.now()}`)
  const userRoot = join(tmpBase, 'ecommerce')
  const collectionsDir = join(userRoot, 'collections', 'job-x')
  mkdirSync(collectionsDir, { recursive: true })
  // 覆盖为本地驱动 + 临时两树根，避免真上 COS
  process.env.ECOMMERCE_DATA_ROOT = tmpBase
  process.env.STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_DIR = join(tmpBase, 'storage-local')
  process.env.STORAGE_PREFIX = 'dev'

  const imgBytes = Buffer.from('fake-png-bytes-for-collection', 'utf8')
  const localPath = join(collectionsDir, 'product-1.png')
  writeFileSync(localPath, imgBytes)

  const prisma = new PrismaService()
  const storage = new StorageDriverService()
  const service = new CollectionJobService(prisma, new LocalJobQueueService(prisma), storage)
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')

  const job = await prisma.job.create({
    data: { tenantId: tenant.id, type: 'collection', businessKey: `collect-ingest-${Date.now()}`, status: 'queued', stage: 'queued' },
  })

  const result = await service.importResults(job.id, tenant.id, {
    dataSnapshotDate: new Date().toISOString().slice(0, 10),
    files: [
      {
        storageKey: localPath,
        mimeType: 'image/png',
        size: imgBytes.length,
        originalName: 'product-1.png',
      },
    ],
    products: [],
  })

  const ingestCount = 'counts' in result ? result.counts.ingestCount : 0
  const record = await prisma.sourceFileRecord.findFirst({ where: { collectionJobId: job.id } })
  const driver = storage.getDriver()
  const persisted = record ? await driver.head(record.storageKey) : null
  const persistedLocalPath = record ? join(process.env.STORAGE_LOCAL_DIR as string, record.storageKey) : null

  const output = {
    ingestCount,
    fileRecordStorageKey: record?.storageKey,
    persistedOnDisk: persistedLocalPath ? existsSync(persistedLocalPath) : false,
    persistedSize: persisted?.size,
    originalSize: imgBytes.length,
  }
  console.log(JSON.stringify(output))

  const ok =
    output.ingestCount === 1 &&
    output.persistedOnDisk &&
    output.persistedSize === imgBytes.length &&
    output.fileRecordStorageKey?.startsWith('dev/') &&
    output.fileRecordStorageKey !== localPath

  await prisma.sourceFileRecord.deleteMany({ where: { collectionJobId: job.id } })
  await prisma.job.deleteMany({ where: { id: job.id } })
  await prisma.$disconnect()
  rmSync(tmpBase, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  process.exit(ok ? 0 : 1)
}

void main()