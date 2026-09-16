import { app, ipcMain } from 'electron'
import Store from 'electron-store'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { createLocalClient, runLocalCleanup } from './local-db-core'

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
let client: ReturnType<typeof createLocalClient> | null = null

export function getLocalDbUrl() {
  const file = app.isPackaged
    ? join(app.getPath('userData'), 'desktop.db')
    : join(app.getAppPath(), 'data/desktop.db')
  return `file:${file}`
}

function getClient() {
  if (!client) client = createLocalClient(getLocalDbUrl())
  return client
}

export function startLocalCleanup() {
  const prisma = getClient()

  const run = async () => {
    try {
      const result = await runLocalCleanup(prisma)
      console.log('local cleanup finished', result)
    } catch (error) {
      console.error('local cleanup failed', error)
    }
  }

  void run()
  const timer = setInterval(run, CLEANUP_INTERVAL_MS)
  timer.unref?.()
}

export function registerLocalHandlers() {
  const prisma = getClient()

  ipcMain.handle('local:get-stats', async () => {
    const store = new Store({ name: 'local-config' })
    const retentionDays = Number(store.get('config.localRetentionDays') ?? 7)
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
    const store = new Store({ name: 'local-config' })
    const retentionDays = Number(store.get('config.localRetentionDays') ?? 7)
    return runLocalCleanup(prisma, { fileRetentionDays: retentionDays })
  })
}
