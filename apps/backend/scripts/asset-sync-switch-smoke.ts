import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'
import { AssetWriteService } from '../src/storage/asset-write.service'

async function main() {
  loadBackendEnv()
  const dir = mkdtempSync(join(tmpdir(), 'eca-asset-sync-'))
  process.env.STORAGE_LOCAL_DIR = dir
  process.env.SYNC_ASSET = 'false'
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)
  const service = new AssetWriteService(prisma)

  const first = await service.writeAsset({ tenantId: tenant.id, bizType: 'generated', runId: `r-${suffix}`, originalName: 'a.png', contentType: 'image/png', buffer: Buffer.from('same-data') })
  const second = await service.writeAsset({ tenantId: tenant.id, bizType: 'generated', runId: `r-${suffix}`, originalName: 'a.png', contentType: 'image/png', buffer: Buffer.from('same-data') })
  const localFiles = existsSync(join(dir, first.storageKey))

  process.env.SYNC_ASSET = 'true'
  const syncOn = await service.writeAsset({ tenantId: tenant.id, bizType: 'generated', runId: `r-${suffix}`, originalName: 'b.png', contentType: 'image/png', buffer: Buffer.from('other-data') })

  process.env.SYNC_ASSET = 'false'
  const syncOff = await service.writeAsset({ tenantId: tenant.id, bizType: 'generated', runId: `r-${suffix}`, originalName: 'c.png', contentType: 'image/png', buffer: Buffer.from('third-data') })

  const totalAssets = await prisma.generatedAsset.count({ where: { runId: `r-${suffix}` } })
  const output = {
    localOnly: { reused: first.reused, syncEnabled: first.sync.enabled, remoteStatus: first.sync.remoteStatus, localFiles },
    idempotent: { reused: second.reused, sameAssetId: second.assetId === first.assetId, totalAssets },
    syncOn: { enabled: syncOn.sync.enabled, remoteStatus: syncOn.sync.remoteStatus, errorCaptured: syncOn.sync.error != null },
    syncOff: { enabled: syncOff.sync.enabled, remoteStatus: syncOff.sync.remoteStatus },
  }
  console.log(JSON.stringify(output))

  await prisma.generatedAsset.deleteMany({ where: { runId: `r-${suffix}` } })
  await prisma.$disconnect()
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok =
    output.localOnly.reused === false &&
    output.localOnly.syncEnabled === false &&
    output.localOnly.remoteStatus === 'skipped' &&
    output.localOnly.localFiles === true &&
    output.idempotent.reused === true &&
    output.idempotent.sameAssetId === true &&
    totalAssets === 3 &&
    output.syncOn.enabled === true &&
    output.syncOn.remoteStatus === 'not-ready' &&
    output.syncOn.errorCaptured === true &&
    output.syncOff.enabled === false &&
    output.syncOff.remoteStatus === 'skipped'
  process.exit(ok ? 0 : 1)
}

void main()
