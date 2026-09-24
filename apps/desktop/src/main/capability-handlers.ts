import { ipcMain } from 'electron'
import { WorkerManager } from './worker-manager'

let manager: WorkerManager | null = null

export function startCapabilityWorker(onLog?: (line: string) => void) {
  if (!manager) manager = new WorkerManager({ onLog })
  manager.start()
  return manager
}

export function stopCapabilityWorker() {
  manager?.stop()
}

export function registerCapabilityHandlers(existing?: WorkerManager) {
  const active = existing ?? manager
  ipcMain.handle('capability:invoke', async (_event, capability: string, payload?: unknown) => {
    if (!active) throw new Error('能力 worker 未启动')
    return active.invoke(capability, payload)
  })
}
