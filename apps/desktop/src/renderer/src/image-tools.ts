export interface ImageSize {
  width: number
  height: number
}

export function computeResizeDimensions(size: ImageSize, maxWidth: number): ImageSize {
  if (size.width <= maxWidth) return { ...size }
  const ratio = maxWidth / size.width
  return { width: maxWidth, height: Math.max(1, Math.round(size.height * ratio)) }
}

export function buildVerticalLayout(images: ImageSize[]): ImageSize {
  if (images.length === 0) return { width: 0, height: 0 }
  const width = Math.max(...images.map((image) => image.width))
  const height = images.reduce((total, image) => total + image.height, 0)
  return { width, height }
}

export function buildCompositedImage(source: HTMLImageElement, target: ImageSize, text?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas not available')
  context.drawImage(source, 0, 0, target.width, target.height)
  if (text) {
    context.font = `${Math.max(20, Math.round(target.width / 12))}px sans-serif`
    context.fillStyle = '#ffffff'
    context.strokeStyle = '#000000'
    context.lineWidth = 4
    context.textAlign = 'center'
    context.strokeText(text, target.width / 2, target.height - 32)
    context.fillText(text, target.width / 2, target.height - 32)
  }
  return canvas
}

export function concatVerticalImages(images: HTMLImageElement[], text?: string): HTMLCanvasElement {
  const layout = buildVerticalLayout(images.map((image) => ({ width: image.naturalWidth, height: image.naturalHeight })))
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas not available')
  let offsetY = 0
  for (const image of images) {
    const width = layout.width
    const height = Math.round((image.naturalHeight * width) / image.naturalWidth)
    context.drawImage(image, 0, offsetY, width, height)
    offsetY += height
  }
  if (text) {
    context.font = '24px sans-serif'
    context.fillStyle = '#ffffff'
    context.strokeStyle = '#000000'
    context.lineWidth = 4
    context.textAlign = 'center'
    context.strokeText(text, layout.width / 2, 48)
    context.fillText(text, layout.width / 2, 48)
  }
  return canvas
}

/** 将图片引用（dataURL/html/src）转成 JPG Blob（走查 M16 单张下载 jpg）。 */
export function imageSourceToJpegBlob(source: string | HTMLImageElement | HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas not available')

  if (source instanceof HTMLCanvasElement) {
    canvas.width = source.width
    canvas.height = source.height
    context.drawImage(source, 0, 0)
    return Promise.resolve(dataUrlToBlob(canvas.toDataURL('image/jpeg', quality)))
  }

  const image = source instanceof HTMLImageElement ? source : new Image()
  const ready = typeof source === 'string'
    ? new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('图片加载失败，无法转 jpg'))
        image.src = source
      })
    : Promise.resolve(image)

  return ready.then((img) => {
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    // 白底填充再绘制，避免 PNG 透明区域在 JPG 中变黑
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(img, 0, 0)
    return dataUrlToBlob(canvas.toDataURL('image/jpeg', quality))
  })
}

/** dataURL → Blob（不做 mime 转换）。 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const mime = /data:([^;,]+)/.exec(head)?.[1] ?? 'image/png'
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
