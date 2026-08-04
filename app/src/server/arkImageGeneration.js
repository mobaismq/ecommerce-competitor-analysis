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

const ARK_IMAGE_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
const DEFAULT_MODEL = process.env.ARK_IMAGE_MODEL || 'doubao-seedream-5-0-260128'

function normalizeGeneratedImages(data) {
  const rawItems = Array.isArray(data?.data) ? data.data : []
  return rawItems
    .map((item) => ({
      url: item.url || item.image_url || item.b64_json || '',
      revisedPrompt: item.revised_prompt || '',
    }))
    .filter((item) => item.url)
}

async function saveGeneratedImage(image, index) {
  const outputDir = path.resolve(process.cwd(), 'public/generated/product-sets')
  fs.mkdirSync(outputDir, { recursive: true })

  let buffer
  let contentType = 'image/png'
  if (image.url.startsWith('data:')) {
    const match = image.url.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
    if (!match) throw new Error('Ark 返回了无法识别的 base64 图片数据')
    contentType = match[1]
    buffer = Buffer.from(match[2], 'base64')
  } else {
    const response = await fetch(image.url)
    if (!response.ok) throw new Error(`下载 Ark 图片失败：${response.status}`)
    contentType = response.headers.get('content-type')?.split(';')[0] || contentType
    buffer = Buffer.from(await response.arrayBuffer())
  }

  const extension = ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[contentType] || 'png'
  const fileName = `image-${Date.now()}-${index}.${extension}`
  fs.writeFileSync(path.join(outputDir, fileName), buffer)
  return {
    ...image,
    url: `/generated/product-sets/${fileName}?t=${Date.now()}`,
    dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
    sourceUrl: image.url,
  }
}

export async function generateProductSetImage({ prompt, image, size = '2K', watermark = false }) {
  loadLocalEnv()
  const apiKey = process.env.ARK_API_KEY
  if (!apiKey) {
    throw new Error('后台未配置 ARK_API_KEY，请在服务端环境变量或 .env.local 中配置。')
  }

  const cleanPrompt = String(prompt || '').trim()
  const cleanImage = String(image || '').trim()
  if (!cleanPrompt) throw new Error('请输入主图提示词')
  if (!cleanImage) throw new Error('请先上传商品原图')

  const response = await fetch(ARK_IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      prompt: cleanPrompt,
      image: cleanImage,
      sequential_image_generation: 'disabled',
      response_format: 'url',
      size,
      stream: false,
      watermark,
    }),
  })

  const raw = await response.text()
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    payload = { raw }
  }
  if (!response.ok) {
    throw new Error(`Ark 图生图失败：${raw}`)
  }

  const images = await Promise.all(normalizeGeneratedImages(payload).map(saveGeneratedImage))
  return {
    ok: true,
    model: DEFAULT_MODEL,
    images,
    raw: payload,
  }
}
