import { randomUUID } from 'node:crypto'
import { resolveEffectiveConfig, CapabilityNotConfiguredError } from './ai-config'
import { getWorkerPrisma, putBytes } from './worker-db'

export interface ImageProvider {
  generate(input: { prompt: string; count: number; size?: string; aspectRatio?: string; referenceImageUrls: string[] }): Promise<string[]>
}

export interface GenerateImageInput {
  userId: string
  tenantId: string
  prompt: string
  count?: number
  size?: string
  ratio?: string
  image?: string
  images?: string[]
  name?: string
  slotType?: string
  productName?: string
  productId?: string
  createdBy?: string
}

function references(image?: string, images?: string[]) {
  const raw = Array.isArray(images) && images.length ? images : image ? [image] : []
  return [...new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 4)
}

async function resolveBytes(imageRef: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (imageRef.startsWith('data:')) {
    const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(imageRef)
    if (!match) throw new Error('模型返回的图片 data URL 无法解析')
    return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] || 'image/png' }
  }
  if (!/^https?:\/\//i.test(imageRef)) throw new Error('模型返回的图片引用不是可下载的 URL')
  const response = await fetch(imageRef)
  if (!response.ok) throw new Error(`下载模型返回图片失败: HTTP ${response.status}`)
  return { buffer: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'image/png' }
}

export function createRealImageProvider(userId: string): ImageProvider {
  const config = resolveEffectiveConfig(userId)
  if (!config) throw new CapabilityNotConfiguredError()
  return {
    async generate(input) {
      // 统一走 images/generations；OpenRouter 类支持参考图（input_references），OpenAI 兼容类走 size
      const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/images/generations`
      const body: Record<string, unknown> = { model: config.imageModel, prompt: input.prompt, n: input.count }
      if (config.kind === 'openrouter') {
        if (input.aspectRatio) body.aspect_ratio = input.aspectRatio
        if (input.referenceImageUrls.length) body.input_references = input.referenceImageUrls.map((url) => ({ type: 'image_url', image_url: { url } }))
      } else body.size = input.size ?? '1024x1024'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs ?? 120_000),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(`AI 生图请求失败: HTTP ${response.status}`)
      return ((payload as { data?: Array<{ url?: string; b64_json?: string; media_type?: string }> }).data ?? [])
        .map((item) => item.url || (item.b64_json ? `data:${item.media_type || 'image/png'};base64,${item.b64_json}` : ''))
        .filter(Boolean)
    },
  }
}

export async function generateImageCapability(input: GenerateImageInput, provider?: ImageProvider, userRoot = '') {
  const selected = provider ?? createRealImageProvider(input.userId)
  const images = await selected.generate({
    prompt: input.prompt,
    count: input.count ?? 1,
    size: input.size,
    aspectRatio: input.ratio,
    referenceImageUrls: references(input.image, input.images),
  })
  if (!images.length) throw new Error('AI 未返回可用的生成图片')
  const db = getWorkerPrisma()
  const jobId = `product-sets-${Date.now()}-${randomUUID().slice(0, 8)}`
  const assetIds: string[] = []
  const resultImages: Array<{ id: string; url: string; dataUrl: string; mimeType: string }> = []
  for (const [index, image] of images.entries()) {
    const { buffer, contentType } = await resolveBytes(image)
    const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png'
    const storageKey = `users/${input.userId}/product-sets/${jobId}/image-${index}-${randomUUID().slice(0, 8)}.${ext}`
    if (userRoot) putBytes(storageKey, buffer, { userRoot })
    const asset = await db.generatedAsset.create({
      data: { tenantId: input.tenantId, jobId, storageKey, mimeType: contentType, size: buffer.length, sourceUrl: image.startsWith('data:') ? null : image, originalName: input.name, category: input.slotType, prompt: input.prompt, ratio: input.ratio, productName: input.productName, productId: input.productId, createdBy: input.createdBy },
    })
    assetIds.push(asset.id)
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`
    resultImages.push({ id: asset.id, url: dataUrl, dataUrl, mimeType: contentType })
  }
  return { ok: true, jobId, assetIds, count: assetIds.length, images: resultImages }
}

export { CapabilityNotConfiguredError }
