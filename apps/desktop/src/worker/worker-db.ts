import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
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