import { app, ipcMain } from 'electron'
import { mkdirSync, writeFileSync, writeFile } from 'node:fs'
import { join, resolve, normalize, extname } from 'node:path'
import { randomUUID } from 'node:crypto'

interface SaveImageInput {
  /** 文件夹名（会拼时间戳，如 商品主图_20261014_093000），空则按 kind 生成 */
  folderName?: string
  /** 目标分类：main=商品主图；detail=详情图（决定文件夹前缀） */
  kind?: 'main' | 'detail'
  files: Array<{
    /** 文件名（不含扩展名），会做安全清洗并强制 .jpg */
    name: string
    /** 图片字节 */
    data: Uint8Array
  }>
}

function sanitizeFileName(name: string): string {
  const cleaned = String(name || 'image')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)
  return cleaned || 'image'
}

function kindPrefix(kind?: 'main' | 'detail'): string {
  return kind === 'detail' ? '详情图' : '商品主图'
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/**
 * 批量保存生成的图片到用户桌面文件夹（走查 M16：批量下载=文件夹到桌面）。
 * 常规 Electron 边界：主进程负责 app.getPath('desktop')、目录创建与文件写入；
 * worker 子进程不直接访问用户桌面目录。
 */
export function registerFilesHandlers() {
  ipcMain.handle('files:saveImageBatch', (_event, input: SaveImageInput) => {
    if (!input || !Array.isArray(input.files) || input.files.length === 0) {
      throw new Error('没有可保存的图片')
    }
    if (input.files.length > 200) {
      throw new Error('单次保存图片数量超过 200 张上限')
    }
    const desktop = app.getPath('desktop')
    const baseName = sanitizeFileName(input.folderName || kindPrefix(input.kind))
    const folder = join(desktop, `${baseName}_${timestamp()}`)
    mkdirSync(folder, { recursive: true })

    const saved: string[] = []
    for (const file of input.files) {
      if (!file || !(file.data instanceof Uint8Array) || !file.data.byteLength) {
        throw new Error('存在无效图片数据，已中止保存')
      }
      const safeName = sanitizeFileName(file.name)
      const ext = extname(safeName).toLowerCase()
      // 强制 jpg 扩展名：data 已是转码后的 jpeg 字节
      const filename = ext === '.jpg' || ext === '.jpeg' ? safeName : `${safeName}.jpg`
      const filePath = resolve(folder, filename)
      // 防目录穿越：最终路径必须仍在目标文件夹内
      if (!normalize(filePath).startsWith(normalize(folder))) {
        throw new Error(`非法文件名: ${file.name}`)
      }
      writeFileSync(filePath, Buffer.from(file.data))
      saved.push(filename)
    }

    return { ok: true, folderPath: folder, count: saved.length, files: saved }
  })

  // 单文件异步写入（供长图等单文件落盘，路径同上约束）
  ipcMain.handle('files:saveImage', (_event, input: { folderName?: string; kind?: 'main' | 'detail'; name: string; data: Uint8Array }) => {
    if (!input || !(input.data instanceof Uint8Array) || !input.data.byteLength) {
      throw new Error('没有可保存的图片数据')
    }
    const desktop = app.getPath('desktop')
    const baseName = sanitizeFileName(input.folderName || kindPrefix(input.kind))
    const folder = join(desktop, `${baseName}_${timestamp()}`)
    mkdirSync(folder, { recursive: true })
    const safeName = sanitizeFileName(input.name)
    const filename = extname(safeName).toLowerCase() === '.jpg' ? safeName : `${safeName}.jpg`
    const filePath = resolve(folder, filename)
    if (!normalize(filePath).startsWith(normalize(folder))) {
      throw new Error(`非法文件名: ${input.name}`)
    }
    const id = randomUUID().slice(0, 8)
    const writePath = extname(filePath) ? filePath : `${filePath}_${id}.jpg`
    return new Promise<{ ok: boolean; folderPath: string; path: string; name: string }>((resolvePromise, reject) => {
      writeFile(writePath, Buffer.from(input.data), (err) => {
        if (err) reject(new Error(`写入失败: ${err.message}`))
        else resolvePromise({ ok: true, folderPath: folder, path: writePath, name: writePath.split('/').pop() ?? '' })
      })
    })
  })
}