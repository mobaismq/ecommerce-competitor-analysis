/**
 * 端到端真实自测：真调一次 OpenRouter 生图 + 真落 COS 测试桶。
 * 仅手动运行，验证真实图像 provider(COS 密钥/OpenRouter key)是否已真正接通。
 * 运行：pnpm --filter backend tsx scripts/live-image-cos-verify.ts
 */
import { loadBackendEnv } from '../src/env'
import { OpenRouterProvider } from '../src/ai/providers/openrouter.provider'
import { OssStorageDriver } from '../src/storage/oss-storage.driver'

async function resolveImageBuffer(imageRef: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (imageRef.startsWith('data:')) {
    const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(imageRef)
    if (!match) throw new Error('data URL 无法解析')
    return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] || 'image/png' }
  }
  const res = await fetch(imageRef)
  if (!res.ok) throw new Error(`下载返回图失败: HTTP ${res.status}`)
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || 'image/png' }
}

async function main() {
  loadBackendEnv()
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY.includes('YOUR_')) {
    throw new Error('未配置真实 OPENROUTER_API_KEY，无法做真实生图')
  }

  // 1) 真实生图（一次）
  const provider = new OpenRouterProvider({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_BASE_URL,
    model: process.env.OPENROUTER_IMAGE_MODEL,
  })
  const started = Date.now()
  const result = await provider.generateImage({ prompt: '一张白色背景的净水器商品主图，商拍质感，简洁', count: 1 })
  const imageRef = result.images?.[0]
  console.log(JSON.stringify({ step: 'openrouter', model: result.model, imageCount: result.images?.length ?? 0, isUrl: /^https?:/.test(imageRef ?? ''), isDataUrl: (imageRef ?? '').startsWith('data:'), elapsedMs: Date.now() - started }))
  if (!imageRef) throw new Error('OpenRouter 未返回图片')

  // 2) 转真实字节
  const { buffer, contentType } = await resolveImageBuffer(imageRef)

  // 3) 真落 COS 测试桶
  const driver = new OssStorageDriver()
  const storageKey = `verify/${Date.now()}-live-${contentType === 'image/jpeg' ? 'jpg' : 'png'}`
  const meta = await driver.putObject({ storageKey, buffer, contentType })
  const head = await driver.head(storageKey)
  const inList = (await driver.listObjects()).includes(storageKey)
  const readUrl = await driver.getReadUrl(storageKey)

  console.log(JSON.stringify({ step: 'cos', storageKey, size: meta.size, mime: meta.mimeType, sha256: meta.sha256, headOk: head != null && head.size === meta.size, inList, readUrl }))

  const ok = result.images?.length === 1 && head != null && head.size === buffer.length && inList
  process.exit(ok ? 0 : 1)
}

void main()