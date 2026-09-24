import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import { resolveDataRoots } from '../common/data-root'
import { signUploadTicket } from './upload-ticket'
import type { ConfirmUploadInput, SignUploadInput, StorageDriver, StorageObjectMeta, StoragePutObjectInput, StoredBytes, UploadTicket } from './storage.types'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.html': 'text/html',
  '.md': 'text/markdown',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.mp4': 'video/mp4',
}

export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local'
  private readonly baseDir: string

  constructor(baseDir = process.env.STORAGE_LOCAL_DIR || join(resolveDataRoots().userRoot, 'data')) {
    this.baseDir = resolve(baseDir)
  }

  private resolvePath(storageKey: string) {
    const absolute = resolve(this.baseDir, storageKey)
    if (absolute !== this.baseDir && !absolute.startsWith(this.baseDir + resolve('/'))) {
      throw new Error('storageKey 越界')
    }
    return absolute
  }

  private mime(storageKey: string, fallback?: string) {
    return MIME_BY_EXT[extname(storageKey).toLowerCase()] ?? fallback ?? 'application/octet-stream'
  }

  async listObjects(): Promise<string[]> {
    if (!existsSync(this.baseDir)) return []
    const entries = readdirSync(this.baseDir, { recursive: true, withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => relative(this.baseDir, join(entry.parentPath, entry.name)).split('/').join('/'))
      .filter((key) => key && !key.startsWith('..'))
  }

  async putObject(input: StoragePutObjectInput): Promise<StorageObjectMeta> {
    const absolute = this.resolvePath(input.storageKey)
    mkdirSync(resolve(absolute, '..'), { recursive: true })
    writeFileSync(absolute, input.buffer)
    return this.head(input.storageKey) as Promise<StorageObjectMeta>
  }

  async head(storageKey: string): Promise<StorageObjectMeta | null> {
    const absolute = this.resolvePath(storageKey)
    if (!existsSync(absolute)) return null
    const stat = statSync(absolute)
    const sha256 = createHash('sha256').update(readFileSync(absolute)).digest('hex')
    return { storageKey, size: stat.size, mimeType: this.mime(storageKey), sha256, lastModified: stat.mtime }
  }

  async delete(storageKey: string): Promise<boolean> {
    const absolute = this.resolvePath(storageKey)
    if (!existsSync(absolute)) return false
    rmSync(absolute, { force: true })
    return true
  }

  async getReadUrl(storageKey: string): Promise<string> {
    const absolute = this.resolvePath(storageKey)
    if (!existsSync(absolute)) throw new Error(`object not found: ${storageKey}`)
    return absolute
  }

  async readBytes(storageKey: string): Promise<StoredBytes> {
    const absolute = this.resolvePath(storageKey)
    if (!existsSync(absolute)) throw new Error(`object not found: ${storageKey}`)
    return { buffer: readFileSync(absolute), mimeType: this.mime(storageKey) }
  }

  async signUploadUrl(input: SignUploadInput): Promise<UploadTicket> {
    const configured = process.env.STORAGE_PREFIX
    const prefix = configured && !configured.includes('{') ? configured : `${process.env.NODE_ENV || 'development'}`
    const safeName = basename(input.originalName ?? 'object').replace(/[^\w.-]+/g, '_')
    const storageKey = join(prefix, input.tenantId, input.bizType, input.runId ?? 'na', `${randomUUID()}-${safeName}`)
    const uploadId = randomUUID()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const sign = signUploadTicket({ uploadId, storageKey, bizType: input.bizType, expiresAt })
    return {
      uploadId,
      storageKey,
      uploadUrl: process.env.STORAGE_DEV_UPLOAD_URL || 'http://127.0.0.1:8787/api/storage/dev-upload',
      method: 'PUT',
      expiresAt,
      headers: {
        'x-upload-id': uploadId,
        'x-storage-key': storageKey,
        'x-biz-type': input.bizType,
        'x-run-id': input.runId ?? '',
        'x-original-name': input.originalName ?? '',
        'x-content-type': input.contentType ?? '',
        'x-upload-expires': String(expiresAt.getTime()),
        'x-upload-sign': sign,
      },
    }
  }

  async confirmUpload(input: ConfirmUploadInput): Promise<StorageObjectMeta> {
    const meta = await this.head(input.storageKey)
    if (!meta) throw new Error(`upload not found: ${input.storageKey}`)
    if (input.expectedSize != null && meta.size !== input.expectedSize) {
      throw new Error(`size mismatch: expected ${input.expectedSize}, got ${meta.size}`)
    }
    return meta
  }
}
