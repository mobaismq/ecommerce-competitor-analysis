import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { PrismaClient } from '../generated/prisma'
import { resolveDataRoots } from '../main/data-root'

export function getWorkerDbUrl(env: Record<string, string | undefined> = process.env) {
  return `file:${join(resolveDataRoots(env).internalRoot, 'desktop.db')}`
}

/** worker 内独立打开的本地 SQLite（与主进程各持一棵连接，互不影响）。 */
let prisma: PrismaClient | null = null
export function getWorkerPrisma() {
  if (!prisma) prisma = new PrismaClient({ datasources: { db: { url: getWorkerDbUrl() } } })
  return prisma
}

export interface WorkerDataRoots {
  internalRoot: string
  userRoot: string
}

export function workerDataRoots(env: Record<string, string | undefined> = process.env): WorkerDataRoots {
  const { internalRoot, userRoot } = resolveDataRoots(env)
  return { internalRoot, userRoot }
}

export function putBytes(relPath: string, bytes: Uint8Array | Buffer, opts: { userRoot: string }): string {
  const full = join(opts.userRoot, relPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, bytes)
  return full
}

export function removeBytes(fullPath: string): void {
  if (existsSync(fullPath)) unlinkSync(fullPath)
}

/** raw 读取统一入口：按 storageKey 从用户根目录读真实字节（对齐后端 readBytes 语义），不存在返回 null。 */
export function readBytesByKey(storageKey: string, roots: WorkerDataRoots): Buffer | null {
  const full = join(roots.userRoot, storageKey)
  if (!existsSync(full)) return null
  return readFileSync(full)
}

/** Resolve the main image reference (URL, dataUrl, or userRoot-relative storageKey) from a collected ProductSnapshot rawJson. */
export function resolveSnapshotMainImageKey(raw: Record<string, unknown>, userRoot: string): string | null {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const direct = str(raw.mainImage) ?? str(raw.imageUrl) ?? str(raw.picUrl)
  if (direct) return direct
  const sourceData = raw.sourceData && typeof raw.sourceData === 'object' && !Array.isArray(raw.sourceData) ? raw.sourceData as Record<string, unknown> : null
  const imagesObj = sourceData?.images && typeof sourceData.images === 'object' && !Array.isArray(sourceData.images) ? sourceData.images as Record<string, unknown> : null
  const list = Array.isArray(imagesObj?.images) ? imagesObj.images : []
  if (!list.length) return null
  const pick = list.find((item) => {
    const t = String((item as Record<string, unknown>)?.image_type ?? '').toLowerCase()
    return t.includes('main') || t.includes('主图') || t.includes('cover')
  }) ?? list[0]
  const row = pick && typeof pick === 'object' && !Array.isArray(pick) ? pick as Record<string, unknown> : null
  if (!row) return null
  const storagePath = str(row.storage_path)
  const exportDir = str(sourceData?.exportDirectory)
  if (storagePath && (isAbsolute(storagePath) || exportDir)) {
    const full = isAbsolute(storagePath) ? resolve(storagePath) : resolve(exportDir!, storagePath)
    const rel = relative(resolve(userRoot), full).replace(/\\/g, '/')
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return rel
  }
  return str(row.source_url)
}

/** Read a snapshot's main image as a data URL (or keep remote http/https URL) for direct <img> rendering. */
export function resolveSnapshotMainImageDataUrl(raw: Record<string, unknown>, roots: WorkerDataRoots): string | null {
  const ref = resolveSnapshotMainImageKey(raw, roots.userRoot)
  if (!ref) return null
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('data:')) return ref
  const bytes = readBytesByKey(ref, roots)
  if (!bytes) return null
  const ext = extname(ref).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg'
  return `data:${mime};base64,${bytes.toString('base64')}`
}

/** 对所有本地能力表生效的 raw 字节定位：storageKey → 用户根相对路径。 */
export function storageKeyToLocalPath(storageKey: string, roots: WorkerDataRoots): string {
  return join(roots.userRoot, storageKey)
}