export interface StoragePutObjectInput {
  storageKey: string
  buffer: Buffer
  contentType?: string
  size?: number
}

export interface StorageObjectMeta {
  storageKey: string
  size: number
  mimeType: string
  sha256?: string
  lastModified: Date
}

export interface StoredBytes {
  buffer: Buffer
  mimeType: string
}

export interface UploadTicket {
  uploadId: string
  storageKey: string
  uploadUrl: string
  method: 'PUT'
  expiresAt: Date
  headers?: Record<string, string>
}

export interface SignUploadInput {
  tenantId: string
  bizType: string
  runId?: string
  originalName?: string
  contentType?: string
}

export interface ConfirmUploadInput {
  uploadId: string
  storageKey: string
  expectedSize?: number
}

export interface StorageDriver {
  readonly name: string
  listObjects(): Promise<string[]>
  putObject(input: StoragePutObjectInput): Promise<StorageObjectMeta>
  head(storageKey: string): Promise<StorageObjectMeta | null>
  delete(storageKey: string): Promise<boolean>
  getReadUrl(storageKey: string): Promise<string>
  /** 读取对象字节（local 用 readFile，oss 用 fetch/getObject）。raw/流式展示统一走这里，避免 local 语义泄漏到 COS。 */
  readBytes(storageKey: string): Promise<StoredBytes>
  signUploadUrl(input: SignUploadInput): Promise<UploadTicket>
  confirmUpload(input: ConfirmUploadInput): Promise<StorageObjectMeta>
}
