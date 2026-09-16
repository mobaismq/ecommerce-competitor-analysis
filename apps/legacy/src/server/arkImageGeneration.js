import fs from 'fs'
import path from 'path'

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.resolve(process.cwd(), fileName)
    if (!fs.existsSync(filePath)) continue
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index <= 0) continue
      const key = trimmed.slice(0, index).trim()
      const rawValue = trimmed.slice(index + 1).trim()
      if (process.env[key] != null) continue
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  }
}

loadLocalEnv()

const OPENROUTER_IMAGE_ENDPOINT = 'https://openrouter.ai/api/v1/images'
const DEFAULT_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'openai/gpt-image-2'

function normalizeGeneratedImages(data) {
  const rawItems = Array.isArray(data?.data) ? data.data : []
  return rawItems
    .map((item) => ({
      url: item.url || item.image_url || '',
      b64Json: item.b64_json || '',
      mediaType: item.media_type || 'image/png',
      revisedPrompt: item.revised_prompt || '',
    }))
    .filter((item) => item.url || item.b64Json)
}

async function saveGeneratedImage(image, index) {
  const outputDir = path.resolve(process.cwd(), 'public/generated/product-sets')
  fs.mkdirSync(outputDir, { recursive: true })

  let buffer
  let contentType = image.mediaType || 'image/png'
  if (image.b64Json) {
    buffer = Buffer.from(image.b64Json, 'base64')
  } else if (image.url.startsWith('data:')) {
    const match = image.url.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
    if (!match) throw new Error('OpenRouter 返回了无法识别的 base64 图片数据')
    contentType = match[1]
    buffer = Buffer.from(match[2], 'base64')
  } else {
    const response = await fetch(image.url)
    if (!response.ok) throw new Error(`下载 OpenRouter 图片失败：${response.status}`)
    contentType = response.headers.get('content-type')?.split(';')[0] || contentType
    buffer = Buffer.from(await response.arrayBuffer())
  }

  const extension = ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' })[contentType] || 'png'
  const fileName = `image-${Date.now()}-${index}.${extension}`
  fs.writeFileSync(path.join(outputDir, fileName), buffer)
  return {
    ...image,
    url: `/generated/product-sets/${fileName}?t=${Date.now()}`,
    dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
    sourceUrl: image.url,
  }
}

function normalizeReferenceImages({ image, images }) {
  const rawImages = Array.isArray(images) ? images : [image]
  return Array.from(new Set(rawImages.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 4)
}

export async function generateProductSetImage({ prompt, image, images, size = '2K', ratio = '', watermark = false }) {
  loadLocalEnv()
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('后台未配置 OPENROUTER_API_KEY，请在服务端环境变量或 .env.local 中配置。')
  }

  const cleanPrompt = String(prompt || '').trim()
  const referenceImages = normalizeReferenceImages({ image, images })
  if (!cleanPrompt) throw new Error('请输入主图提示词')

  const cleanRatio = String(ratio || '').trim()
  const requestBody = {
    model: DEFAULT_MODEL,
    prompt: cleanPrompt,
    quality: 'low',
    n: 1,
  }
  if (cleanRatio) requestBody.aspect_ratio = cleanRatio
  if (referenceImages.length) {
    requestBody.input_references = referenceImages.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }))
  }

  const response = await fetch(OPENROUTER_IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  const raw = await response.text()
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    payload = { raw }
  }
  if (!response.ok) {
    throw new Error(`OpenRouter 生图失败：${raw}`)
  }

  const savedImages = await Promise.all(normalizeGeneratedImages(payload).map(saveGeneratedImage))
  return {
    ok: true,
    model: DEFAULT_MODEL,
    size: String(size || '').trim() || null,
    ratio: cleanRatio || null,
    images: savedImages,
    raw: payload,
  }
}
