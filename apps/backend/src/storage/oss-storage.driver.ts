import type { ConfirmUploadInput, SignUploadInput, StorageDriver, StorageObjectMeta, StoragePutObjectInput, UploadTicket } from './storage.types'

function notReady(): never {
  throw new Error('OSS 驱动待接入：配置 STORAGE_DRIVER=oss 且补齐 OSS_* 后可用')
}

export class OssStorageDriver implements StorageDriver {
  readonly name = 'oss'

  async listObjects(): Promise<string[]> {
    return notReady()
  }

  async putObject(_input: StoragePutObjectInput): Promise<StorageObjectMeta> {
    return notReady()
  }

  async head(_storageKey: string): Promise<StorageObjectMeta | null> {
    return notReady()
  }

  async delete(_storageKey: string): Promise<boolean> {
    return notReady()
  }

  async getReadUrl(_storageKey: string): Promise<string> {
    return notReady()
  }

  async signUploadUrl(_input: SignUploadInput): Promise<UploadTicket> {
    return notReady()
  }

  async confirmUpload(_input: ConfirmUploadInput): Promise<StorageObjectMeta> {
    return notReady()
  }
}
