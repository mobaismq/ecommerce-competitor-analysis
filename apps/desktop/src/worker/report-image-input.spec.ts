import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { prepareReportImageInput } from './report-image-input'

const dataUrl = (bytes: Buffer) => `data:image/jpeg;base64,${bytes.toString('base64')}`
const decode = (image: string) => Buffer.from(image.split(',')[1], 'base64')

describe('report vision image input', () => {
  it.each([20232, 24408])('splits a %ipx product detail image without losing its bottom', async (height) => {
    const original = await sharp({ create: { width: 790, height, channels: 3, background: '#1266cc' } })
      .composite([{ input: { create: { width: 790, height: 32, channels: 3, background: '#00ff00' } }, left: 0, top: height - 32 }]).jpeg().toBuffer()
    const input = await prepareReportImageInput(dataUrl(original))
    expect(input).toMatchObject({ width: 790, height, resized: false })
    expect(input.parts.length).toBeGreaterThan(1)
    expect(input.parts.length).toBeLessThanOrEqual(16)
    for (const part of input.parts) {
      const metadata = await sharp(decode(part)).metadata()
      expect(metadata.width).toBe(790)
      expect(metadata.height).toBeLessThanOrEqual(2048)
    }
    const last = decode(input.parts.at(-1)!)
    const metadata = await sharp(last).metadata()
    const pixel = await sharp(last).extract({ left: 400, top: metadata.height! - 5, width: 1, height: 1 }).raw().toBuffer()
    expect(pixel[1]).toBeGreaterThan(220)
    expect(pixel[0]).toBeLessThan(30)
    expect((await sharp(original).metadata()).height).toBe(height)
  })

  it('keeps small originals intact and bounds oversized square images', async () => {
    const small = dataUrl(await sharp({ create: { width: 800, height: 800, channels: 3, background: '#fff' } }).jpeg().toBuffer())
    expect((await prepareReportImageInput(small)).parts).toEqual([small])
    const large = dataUrl(await sharp({ create: { width: 9000, height: 9000, channels: 3, background: '#fff' } }).jpeg().toBuffer())
    // Oversized decode inputs fail locally instead of poisoning a whole provider request.
    await expect(prepareReportImageInput(large)).rejects.toThrow()
    const bounded = await prepareReportImageInput(dataUrl(await sharp({ create: { width: 4000, height: 4000, channels: 3, background: '#fff' } }).jpeg().toBuffer()))
    expect(bounded.parts).toHaveLength(1)
    expect((await sharp(decode(bounded.parts[0])).metadata()).width).toBe(2048)
  })
})
