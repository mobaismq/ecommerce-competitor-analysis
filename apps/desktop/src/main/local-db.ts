import { ipcMain } from 'electron'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { createLocalClient, runLocalCleanup } from './local-db-core'
import { resolveDataRoots } from './data-root'
import { logger } from './logger'
import { localStore } from './store'

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
let client: ReturnType<typeof createLocalClient> | null = null

export function getLocalDbUrl() {
  // 本地状态库归内部根 ~/.ecommerce/desktop.db（用户电脑上的标准桌面数据根）。
  const file = join(resolveDataRoots().internalRoot, 'desktop.db')
  return `file:${file}`
}

/** 桌面端本地 SQLite 的单例 client，采集/清理/查询共用。 */
export function getLocalClient() {
  if (!client) client = createLocalClient(getLocalDbUrl())
  return client
}

export function startLocalCleanup() {
  const prisma = getLocalClient()

  const run = async () => {
    try {
      const result = await runLocalCleanup(prisma)
      logger.info('local cleanup finished', result)
    } catch (error) {
      logger.error('local cleanup failed', error)
    }
  }

  void run()
  const timer = setInterval(run, CLEANUP_INTERVAL_MS)
  timer.unref?.()
}

export function registerLocalHandlers() {
  const prisma = getLocalClient()

  ipcMain.handle('local:get-stats', async () => {
    const retentionDays = Number(localStore.get('config.localRetentionDays') ?? 7)
    const aggregate = await prisma.tempFile.aggregate({ _sum: { size: true }, _count: true })
    const dbPath = getLocalDbUrl().replace(/^file:/, '')
    let dbBytes = 0
    try {
      dbBytes = statSync(dbPath).size
    } catch {}
    return {
      retentionDays,
      tempFileCount: aggregate._count,
      tempBytes: aggregate._sum.size ?? 0,
      dbBytes,
    }
  })

  ipcMain.handle('local:run-cleanup', async () => {
    const retentionDays = Number(localStore.get('config.localRetentionDays') ?? 7)
    return runLocalCleanup(prisma, { fileRetentionDays: retentionDays })
  })
}
