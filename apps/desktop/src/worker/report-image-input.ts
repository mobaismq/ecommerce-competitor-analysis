import sharp from 'sharp'

const TILE_EDGE = 2048
const OVERLAP = 96
const MAX_PARTS = 16
const MAX_LONG_EDGE = TILE_EDGE + (MAX_PARTS - 1) * (TILE_EDGE - OVERLAP)

/** Prepare inference copies only. The collected originals are never changed. */
export async function prepareReportImageInput(image: string): Promise<{ parts: string[]; width?: number; height?: number; resized?: boolean }> {
  if (/^https?:\/\//i.test(image)) return { parts: [image] }
  const match = /^data:image\/(?:jpeg|png|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(image)
  if (!match) throw new Error('图片输入不是可读取的 JPEG、PNG、GIF 或 WebP')
  const bytes = Buffer.from(match[1], 'base64')
  const options = { limitInputPixels: 80_000_000, animated: false }
  const metadata = await sharp(bytes, options).metadata()
  if (!metadata.width || !metadata.height) throw new Error('图片缺少有效尺寸')
  const rotated = metadata.orientation != null && metadata.orientation >= 5 && metadata.orientation <= 8
  const width = rotated ? metadata.height : metadata.width
  const height = rotated ? metadata.width : metadata.height
  const long = Math.max(width, height), short = Math.min(width, height)
  const tiled = long > TILE_EDGE && long / short > 3
  if (!tiled && long <= TILE_EDGE && (!metadata.orientation || metadata.orientation === 1)) return { parts: [image], width, height }

  const vertical = height >= width
  const normalized = await sharp(bytes, options).rotate().resize({
    width: tiled ? vertical ? 1600 : MAX_LONG_EDGE : TILE_EDGE,
    height: tiled ? vertical ? MAX_LONG_EDGE : 1600 : TILE_EDGE,
    fit: 'inside', withoutEnlargement: true,
  }).flatten({ background: '#fff' }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true })
  const size = normalized.info
  if (!tiled) return { parts: [`data:image/jpeg;base64,${normalized.data.toString('base64')}`], width, height, resized: size.width !== width || size.height !== height }

  const extent = vertical ? size.height : size.width
  const count = Math.max(1, Math.ceil((extent - OVERLAP) / (TILE_EDGE - OVERLAP)))
  const parts: string[] = []
  for (let index = 0; index < count; index += 1) {
    const offset = index * (TILE_EDGE - OVERLAP)
    const length = Math.min(TILE_EDGE, extent - offset)
    const crop = vertical ? { left: 0, top: offset, width: size.width, height: length } : { left: offset, top: 0, width: length, height: size.height }
    const part = await sharp(normalized.data, options).extract(crop).jpeg({ quality: 90 }).toBuffer()
    parts.push(`data:image/jpeg;base64,${part.toString('base64')}`)
  }
  return { parts, width, height, resized: size.width !== width || size.height !== height }
}
