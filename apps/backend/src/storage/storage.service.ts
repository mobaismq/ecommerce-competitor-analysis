import { Injectable } from '@nestjs/common'
import { LocalStorageDriver } from './local-storage.driver'
import { OssStorageDriver } from './oss-storage.driver'
import type { StorageDriver } from './storage.types'

@Injectable()
export class StorageDriverService {
  getDriver(): StorageDriver {
    if (process.env.STORAGE_DRIVER === 'oss') return new OssStorageDriver()
    return new LocalStorageDriver()
  }
}
