import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { nanoid } from 'nanoid'

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

export interface StoredImage {
  storageKey: string
  absolutePath: string
  size: number
  mimeType: string
}

export function storeMockImage(prefix: string, index: number): StoredImage {
  const dir = resolve(process.env.MOCK_ASSET_DIR || join(process.cwd(), 'data', 'mock-assets'))
  mkdirSync(dir, { recursive: true })
  const fileName = `${prefix}-${nanoid(8)}-${index}.png`
  const absolutePath = join(dir, fileName)
  writeFileSync(absolutePath, ONE_PX_PNG)
  return {
    storageKey: `mock-assets/${fileName}`,
    absolutePath,
    size: ONE_PX_PNG.length,
    mimeType: 'image/png',
  }
}
