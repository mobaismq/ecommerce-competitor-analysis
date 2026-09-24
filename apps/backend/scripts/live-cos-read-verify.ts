/** 只读验证：对 COS 测试桶已存在对象跑 head + readBytes（不烧生图、不新增对象）。 */
import { loadBackendEnv } from '../src/env'
import { OssStorageDriver } from '../src/storage/oss-storage.driver'

async function main() {
  loadBackendEnv()
  const driver = new OssStorageDriver()
  const key = process.env.COS_VERIFY_KEY || 'verify/1790174577854-live-png'
  const meta = await driver.head(key)
  const bytes = await driver.readBytes(key)
  const ok = bytes.buffer.length > 0 && meta != null && bytes.buffer.length === meta.size
  console.log(JSON.stringify({ ok, size: bytes.buffer.length, metaSize: meta?.size, mime: bytes.mimeType }))
  process.exit(ok ? 0 : 1)
}

void main()