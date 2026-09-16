import { createHash } from 'node:crypto'
import { basename, extname } from 'node:path'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { LocalStorageDriver } from './local-storage.driver'
import { OssStorageDriver } from './oss-storage.driver'

export interface WriteAssetInput {
  tenantId: string
  bizType: string
  runId?: string
  originalName?: string
  contentType?: string
  buffer: Buffer
}

function syncEnabled() {
  const value = process.env.SYNC_ASSET
  return value === 'true' || value === '1'
}

function mimeFor(input: WriteAssetInput) {
  const ext = extname(input.originalName ?? '').toLowerCase()
  const byExt: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.json': 'application/json',
    '.html': 'text/html',
    '.md': 'text/markdown',
    '.mp4': 'video/mp4',
  }
  return input.contentType || byExt[ext] || 'application/octet-stream'
}

@Injectable()
export class AssetWriteService {
  constructor(private readonly prisma: PrismaService) {}

  async writeAsset(input: WriteAssetInput) {
    const sha256 = createHash('sha256').update(input.buffer).digest('hex')
    const safeName = basename(input.originalName ?? 'asset').replace(/[^\w.-]+/g, '_')
    const storageKey = `assets/${input.bizType}/${input.runId ?? 'na'}/${sha256.slice(0, 16)}/${safeName}`
    const local = new LocalStorageDriver()
    await local.putObject({ storageKey, buffer: input.buffer, contentType: mimeFor(input) })

    const existing = await this.prisma.generatedAsset.findUnique({ where: { storageKey } })
    const isMedia = input.bizType === 'collection' || input.bizType === 'media'
    let assetId: string
    if (existing) {
      assetId = existing.id
    } else if (isMedia) {
      const asset = await this.prisma.mediaAsset.create({
        data: {
          tenantId: input.tenantId,
          sourceType: 'upload',
          storageKey,
          mimeType: mimeFor(input),
          size: input.buffer.length,
          originalName: input.originalName,
        },
      })
      assetId = asset.id
    } else {
      const asset = await this.prisma.generatedAsset.create({
        data: {
          tenantId: input.tenantId,
          runId: input.runId,
          storageKey,
          mimeType: mimeFor(input),
          size: input.buffer.length,
          originalName: input.originalName,
          sha256,
        } satisfies Prisma.GeneratedAssetCreateInput,
      })
      assetId = asset.id
    }

    const sync = { enabled: syncEnabled(), remoteStatus: 'skipped' as string, error: undefined as string | undefined }
    if (sync.enabled) {
      try {
        await new OssStorageDriver().putObject({ storageKey, buffer: input.buffer, contentType: mimeFor(input) })
        sync.remoteStatus = 'synced'
      } catch (error) {
        sync.remoteStatus = 'not-ready'
        sync.error = error instanceof Error ? error.message : String(error)
      }
    }
    return { assetId, storageKey, size: input.buffer.length, mimeType: mimeFor(input), sync, reused: Boolean(existing) }
  }
}
