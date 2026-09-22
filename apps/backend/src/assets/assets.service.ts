import { readFileSync } from 'node:fs'
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { StorageDriverService } from '../storage/storage.service'

@Injectable()
export class AssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageDriverService: StorageDriverService,
  ) {}

  async find(assetId: string, tenantId: string) {
    const asset = await this.prisma.generatedAsset.findFirst({ where: { id: assetId, tenantId } })
    if (!asset) throw new NotFoundException('资产不存在')
    const driver = this.storageDriverService.getDriver()
    const readUrl = await driver.getReadUrl(asset.storageKey).catch(() => null)
    return {
      id: asset.id,
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      size: asset.size,
      runId: asset.runId,
      sourceUrl: asset.sourceUrl,
      originalName: asset.originalName,
      sha256: asset.sha256,
      readUrl,
    }
  }

  list(tenantId: string) {
    return this.prisma.generatedAsset.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async raw(assetId: string, tenantId: string) {
    const asset = await this.prisma.generatedAsset.findFirst({ where: { id: assetId, tenantId } })
    if (!asset) throw new NotFoundException('资产不存在')
    const driver = this.storageDriverService.getDriver()
    const meta = await driver.head(asset.storageKey)
    if (!meta) throw new NotFoundException('资产文件不存在')
    const absolute = await driver.getReadUrl(asset.storageKey)
    return { buffer: readFileSync(absolute), mimeType: meta.mimeType }
  }

  async remove(assetId: string, tenantId: string) {
    const asset = await this.prisma.generatedAsset.findFirst({ where: { id: assetId, tenantId } })
    if (!asset) throw new NotFoundException('资产不存在')
    await this.prisma.generatedAsset.delete({ where: { id: assetId } })
    return { ok: true, id: assetId }
  }
}
