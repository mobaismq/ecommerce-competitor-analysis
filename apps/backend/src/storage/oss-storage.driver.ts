import { createHash, randomUUID } from 'node:crypto'
import { basename, extname, join } from 'node:path'
import COS from 'cos-nodejs-sdk-v5'
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

interface CosEndpointOptions {
  region?: string
  bucket?: string
  secretId?: string
  secretKey?: string
  endpoint?: string
  publicBaseUrl?: string
}

export class OssStorageDriver implements StorageDriver {
  readonly name = 'oss'
  private readonly opts: CosEndpointOptions
  private cos?: COS

  constructor(opts: CosEndpointOptions = {}) {
    this.opts = {
      region: opts.region ?? process.env.OSS_REGION,
      bucket: opts.bucket ?? process.env.OSS_BUCKET,
      secretId: opts.secretId ?? process.env.OSS_ACCESS_KEY_ID,
      secretKey: opts.secretKey ?? process.env.OSS_ACCESS_KEY_SECRET,
      endpoint: opts.endpoint ?? process.env.OSS_ENDPOINT,
      publicBaseUrl: opts.publicBaseUrl ?? process.env.OSS_PUBLIC_BASE_URL,
    }
  }

  private client(): COS {
    if (this.cos) return this.cos
    const { region, bucket, secretId, secretKey, endpoint } = this.opts
    if (!region || !bucket || !secretId || !secretKey) {
      throw new Error('OSS 驱动未配置：需要 OSS_REGION / OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET')
    }
    const options: COS.COSOptions = {
      SecretId: secretId,
      SecretKey: secretKey,
      Protocol: 'https:',
    }
    if (endpoint) options.Domain = endpoint.replace(/^https?:\/\//, '')
    this.cos = new COS(options)
    return this.cos
  }

  private par(): { Bucket: string; Region: string } {
    const { bucket, region } = this.opts
    if (!bucket || !region) throw new Error('OSS 驱动未配置：需要 OSS_REGION / OSS_BUCKET')
    return { Bucket: bucket, Region: region }
  }

  // headObject 未返回正文，用上传时一致的本地 mime/推算 + head 响应头兜底
  private mime(storageKey: string, fallbackContentType?: string): string {
    return MIME_BY_EXT[extname(storageKey).toLowerCase()] ?? fallbackContentType ?? 'application/octet-stream'
  }

  async listObjects(): Promise<string[]> {
    const { Bucket, Region } = this.par()
    const res = await this.client().getBucket({ Bucket, Region })
    return (res.Contents ?? []).map((item) => item.Key).filter(Boolean)
  }

  async putObject(input: StoragePutObjectInput): Promise<StorageObjectMeta> {
    const { Bucket, Region } = this.par()
    await this.client().putObject({
      Bucket,
      Region,
      Key: input.storageKey,
      Body: input.buffer,
      ContentType: input.contentType,
      ContentLength: input.buffer.length,
    })
    const contentType = input.contentType || this.mime(input.storageKey)
    return {
      storageKey: input.storageKey,
      size: input.buffer.length,
      mimeType: contentType,
      sha256: createHash('sha256').update(input.buffer).digest('hex'),
      lastModified: new Date(),
    }
  }

  async head(storageKey: string): Promise<StorageObjectMeta | null> {
    const { Bucket, Region } = this.par()
    try {
      const res = await this.client().headObject({ Bucket, Region, Key: storageKey })
      const headers = res.headers ?? {}
      const size = Number(headers['content-length'])
      return {
        storageKey,
        size: Number.isFinite(size) ? size : 0,
        mimeType: this.mime(storageKey, headers['content-type']),
        lastModified: headers['last-modified'] ? new Date(headers['last-modified']) : new Date(),
      }
    } catch (error) {
      if ((error as { statusCode?: number })?.statusCode === 404) return null
      throw error
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    const { Bucket, Region } = this.par()
    try {
      await this.client().deleteObject({ Bucket, Region, Key: storageKey })
      return true
    } catch (error) {
      if ((error as { statusCode?: number })?.statusCode === 404) return false
      throw error
    }
  }

  async getReadUrl(storageKey: string): Promise<string> {
    const { Bucket, Region } = this.par()
    const { publicBaseUrl } = this.opts
    if (publicBaseUrl) return `${publicBaseUrl.replace(/\/+$/, '')}/${storageKey}`
    return this.client().getObjectUrl({ Bucket, Region, Key: storageKey, Sign: true, Expires: 3600, Protocol: 'https:' })
  }

  async readBytes(storageKey: string): Promise<StoredBytes> {
    const url = await this.getReadUrl(storageKey)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`读取 COS 对象失败: HTTP ${res.status}`)
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType: res.headers.get('content-type') || this.mime(storageKey),
    }
  }

  async signUploadUrl(input: SignUploadInput): Promise<UploadTicket> {
    const { Bucket, Region } = this.par()
    const configured = process.env.STORAGE_PREFIX
    const prefix = configured && !configured.includes('{') ? configured : `${process.env.NODE_ENV || 'development'}`
    const safeName = basename(input.originalName ?? 'object').replace(/[^\w.-]+/g, '_')
    const storageKey = join(prefix, input.tenantId, input.bizType, input.runId ?? 'na', `${randomUUID()}-${safeName}`)
    const uploadId = randomUUID()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const uploadUrl = this.client().getObjectUrl({
      Bucket,
      Region,
      Key: storageKey,
      Sign: true,
      Method: 'PUT',
      Protocol: 'https:',
      Expires: 15 * 60,
    })
    return {
      uploadId,
      storageKey,
      uploadUrl,
      method: 'PUT',
      expiresAt,
      headers: {},
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