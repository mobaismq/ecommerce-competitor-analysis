import { useMemo, useRef, useState } from 'react'
import { buildCompositedImage, computeResizeDimensions, concatVerticalImages, type ImageSize } from './image-tools'

type Tool = 'resize' | 'text' | 'concat'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

export function ImageEditPage() {
  const [tool, setTool] = useState<Tool>('resize')
  const [files, setFiles] = useState<File[]>([])
  const [text, setText] = useState('')
  const [maxWidth, setMaxWidth] = useState(1024)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const run = async () => {
    if (files.length === 0) return
    const images = await Promise.all(files.map(loadImage))
    let canvas: HTMLCanvasElement
    if (tool === 'concat') {
      canvas = concatVerticalImages(images, text || undefined)
    } else if (tool === 'text') {
      const source = images[0]
      canvas = buildCompositedImage(source, { width: source.naturalWidth, height: source.naturalHeight }, text || undefined)
    } else {
      const target: ImageSize = computeResizeDimensions({ width: images[0].naturalWidth, height: images[0].naturalHeight }, maxWidth)
      canvas = buildCompositedImage(images[0], target)
    }
    setPreviewUrl(canvas.toDataURL('image/png'))
  }

  const canRun = useMemo(() => (tool === 'concat' ? files.length >= 2 : files.length >= 1), [files.length, tool])
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={tool === 'resize' ? 'active' : 'ghost'} onClick={() => setTool('resize')}>改尺寸</button>
        <button className={tool === 'text' ? 'active' : 'ghost'} onClick={() => setTool('text')}>改字</button>
        <button className={tool === 'concat' ? 'active' : 'ghost'} onClick={() => setTool('concat')}>拼接长图</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'end' }}>
        <button className="ghost" onClick={() => inputRef.current?.click()}>选择图片</button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
        {tool === 'resize' && (
          <label>
            目标宽度
            <input type="number" value={maxWidth} onChange={(event) => setMaxWidth(Number(event.target.value))} />
          </label>
        )}
        {tool !== 'resize' && (
          <label>
            文案
            <input value={text} onChange={(event) => setText(event.target.value)} />
          </label>
        )}
        <button disabled={!canRun} onClick={() => void run()}>处理</button>
      </div>
      {previewUrl && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
          <img src={previewUrl} alt="处理结果" style={{ maxHeight: 200, border: '1px solid #ddd', borderRadius: 6 }} />
          <a href={previewUrl} download="result.png"><button className="ghost">下载</button></a>
        </div>
      )}
    </section>
  )
}
