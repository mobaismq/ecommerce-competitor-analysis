import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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

/** 对所有本地能力表生效的 raw 字节定位：storageKey → 用户根相对路径。 */
export function storageKeyToLocalPath(storageKey: string, roots: WorkerDataRoots): string {
  return join(roots.userRoot, storageKey)
}