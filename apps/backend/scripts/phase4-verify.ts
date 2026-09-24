import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'
import { PlatformRegistry } from '../src/platform/platform-registry'
import { PlatformAdapterService } from '../src/platform/platform.service'
import { StorageDriverService } from '../src/storage/storage.service'
import { ReportExportService } from '../src/reports/report-export.service'

async function main() {
  loadBackendEnv()
  const dataRoot = mkdtempSync(join(tmpdir(), 'eca-phase4-'))
  process.env.ECOMMERCE_DATA_ROOT = dataRoot
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')

  const storageService = new StorageDriverService()
  const registry = new PlatformRegistry()
  const platformService = new PlatformAdapterService(prisma, registry, storageService)
  const driver = storageService.getDriver()
  const out: Record<string, unknown> = { dataRoot }

  // ── Part A：富媒体去内嵌化 —— 字节落盘 + 引用清理（只清理 listings/ 前缀） ──
  const listingKey = `listings/${tenant.id}/media/verify-${Date.now()}.png`
  const otherKey = `assets/${tenant.id}/keep.png`
  await driver.putObject({ storageKey: listingKey, buffer: Buffer.from('fakepng'), contentType: 'image/png' })
  await driver.putObject({ storageKey: otherKey, buffer: Buffer.from('keep'), contentType: 'image/png' })
  const beforeListing = await driver.head(listingKey)
  const cleanup = await platformService.cleanupListingMedia([listingKey, otherKey, ''])
  const afterListing = await driver.head(listingKey)
  const afterOther = await driver.head(otherKey)
  const media = {
    writtenAndHeaded: Boolean(beforeListing),
    removedCount: cleanup.removed,
    listingDeleted: afterListing === null,
    otherKeyIntact: Boolean(afterOther),
    prefixGuard: cleanup.removed === 1,
  }
  out.media = media

  // ── Part B：报告导出入根 —— ~/ecommerce/users/<tenantId>/reports/<runId>/<format> ──
  const run = await prisma.analysisRun.create({
    data: {
      tenantId: tenant.id,
      jobId: `verify-${Date.now()}`,
      analysisType: 'verify',
      status: 'success',
      reportJson: { summary: 'x', priceBands: [], insights: [] },
    },
  })
  const exp = new ReportExportService(prisma)
  const exported = await exp.exportReport({ runId: run.id, tenantId: tenant.id, format: 'markdown' })
  const relPath = `${run.id}/markdown`
  const expectedPath = join(dataRoot, 'ecommerce', 'users', tenant.id, 'reports', relPath)
  const report = {
    storageKey: exported.storageKey,
    fileExists: existsSync(expectedPath),
    underUserReportsDir: expectedPath.includes(`${tenant.id}/reports/${relPath}`),
    mime: exported.mimeType,
  }
  out.report = report

  // 清理：删除导出的 generatedAsset + analysisRun + 落盘文件
  await prisma.generatedAsset.deleteMany({ where: { storageKey: exported.storageKey } })
  await prisma.analysisRun.deleteMany({ where: { id: run.id } })
  rmSync(dataRoot, { recursive: true, force: true })
  await prisma.$disconnect()

  console.log(JSON.stringify(out))
  const ok =
    media.writtenAndHeaded &&
    media.removedCount === 1 &&
    media.listingDeleted &&
    media.otherKeyIntact &&
    media.prefixGuard &&
    report.fileExists &&
    report.underUserReportsDir
  process.exit(ok ? 0 : 1)
}

void main()
