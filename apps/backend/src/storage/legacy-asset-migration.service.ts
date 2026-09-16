import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { StorageDriverService } from './storage.service'

function allowedExtensions() {
  const configured = process.env.LEGACY_ASSET_EXTENSIONS
  return new Set(
    (configured ?? '.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm,.svg')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  )
}

function mimeFor(filePath: string) {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.mov') return 'video/quicktime'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

@Injectable()
export class LegacyAssetMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageDriverService: StorageDriverService,
  ) {}

  private legacyDirs() {
    const configured = process.env.LEGACY_ASSET_DIRS
    if (configured) return configured.split(',').map((item) => resolve(item.trim())).filter(Boolean)
    return [resolve(process.cwd(), 'app', 'public', 'generated', 'product-sets')]
  }

  private walkFiles(dir: string): string[] {
    if (!existsSync(dir)) return []
    const extensions = allowedExtensions()
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && extensions.has(extname(entry.name).toLowerCase()))
      .map((entry) => resolve(join(entry.parentPath, entry.name)))
  }

  async migrate(tenantId: string, options: { cleanupSources?: 'never' | 'after' } = {}) {
    const cleanupSources = options.cleanupSources ?? 'never'
    const driver = this.storageDriverService.getDriver()
    const files = this.legacyDirs().flatMap((dir) => this.walkFiles(dir))
    const result = { scanned: files.length, migrated: 0, skipped: 0, cleaned: 0, errors: [] as string[] }
    for (const file of files) {
      try {
        const buffer = readFileSync(file)
        const sha256 = createHash('sha256').update(buffer).digest('hex')
        const storageKey = `legacy/${sha256.slice(0, 16)}/${basename(file)}`
        const existing = await this.prisma.generatedAsset.findUnique({ where: { storageKey } })
        if (existing) {
          result.skipped += 1
        } else {
          await driver.putObject({ storageKey, buffer, contentType: mimeFor(file) })
          await this.prisma.generatedAsset.create({
            data: {
              tenantId,
              runId: 'legacy-migration',
              storageKey,
              mimeType: mimeFor(file),
              size: buffer.length,
              originalName: file.split(/[\\/]/).pop(),
              sha256,
              sourceUrl: `legacy://${file}`,
            } satisfies Prisma.GeneratedAssetCreateInput,
          })
          result.migrated += 1
        }
        if (cleanupSources === 'after') {
          rmSync(file, { force: true })
          result.cleaned += 1
        }
      } catch (error) {
        result.errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return result
  }
}
