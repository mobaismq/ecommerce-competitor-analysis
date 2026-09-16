import { PrismaClient } from '../generated/prisma'
import { existsSync, unlinkSync } from 'node:fs'

export const TERMINAL_STATUSES = ['success', 'failure', 'cancelled']
export const DEFAULT_RECORD_RETENTION_DAYS = 30
export const DEFAULT_FILE_RETENTION_DAYS = 7
export const DEFAULT_CAP_BYTES = 2 * 1024 ** 3

const DAY_MS = 24 * 60 * 60 * 1000

export interface LocalCleanupOptions {
  recordRetentionDays?: number
  fileRetentionDays?: number
  capBytes?: number
  now?: Date
}

export interface LocalCleanupResult {
  deletedJobs: number
  deletedJobFileCount: number
  deletedExpiredFiles: number
  deletedCapFiles: number
}

export function createLocalClient(url: string) {
  return new PrismaClient({ datasources: { db: { url } } })
}

function removeFile(filePath: string) {
  if (!existsSync(filePath)) return true
  try {
    unlinkSync(filePath)
    return true
  } catch (error) {
    console.error(`local cleanup cannot remove file ${filePath}`, error)
    return false
  }
}

export async function runLocalCleanup(
  prisma: PrismaClient,
  options: LocalCleanupOptions = {},
): Promise<LocalCleanupResult> {
  const now = options.now ?? new Date()
  const recordCutoff = new Date(now.getTime() - (options.recordRetentionDays ?? DEFAULT_RECORD_RETENTION_DAYS) * DAY_MS)
  const fileCutoff = new Date(now.getTime() - (options.fileRetentionDays ?? DEFAULT_FILE_RETENTION_DAYS) * DAY_MS)
  const capBytes = options.capBytes ?? DEFAULT_CAP_BYTES

  const expiredJobs = await prisma.localJob.findMany({
    where: { status: { in: TERMINAL_STATUSES }, updatedAt: { lt: recordCutoff } },
    include: { tempFiles: true },
  })

  let deletedJobFileCount = 0
  for (const job of expiredJobs) {
    for (const file of job.tempFiles) {
      if (removeFile(file.path)) deletedJobFileCount += 1
    }
  }
  const deletedJobs = await prisma.localJob.deleteMany({
    where: { id: { in: expiredJobs.map((job) => job.id) } },
  })

  const expiredFiles = await prisma.tempFile.findMany({
    where: {
      createdAt: { lt: fileCutoff },
      job: { status: { in: TERMINAL_STATUSES } },
    },
  })
  let deletedExpiredFiles = 0
  for (const file of expiredFiles) {
    if (removeFile(file.path)) deletedExpiredFiles += 1
  }
  await prisma.tempFile.deleteMany({ where: { id: { in: expiredFiles.map((file) => file.id) } } })

  const aggregate = await prisma.tempFile.aggregate({ _sum: { size: true } })
  let totalBytes = aggregate._sum.size ?? 0
  let deletedCapFiles = 0
  if (totalBytes > capBytes) {
    const candidates = await prisma.tempFile.findMany({
      where: { job: { status: { in: TERMINAL_STATUSES } } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, path: true, size: true },
    })
    for (const file of candidates) {
      if (totalBytes <= capBytes) break
      if (removeFile(file.path)) {
        await prisma.tempFile.delete({ where: { id: file.id } })
        totalBytes -= file.size
        deletedCapFiles += 1
      }
    }
  }

  return {
    deletedJobs: deletedJobs.count,
    deletedJobFileCount,
    deletedExpiredFiles,
    deletedCapFiles,
  }
}
