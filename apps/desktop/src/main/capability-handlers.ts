import { ipcMain, type WebContents } from 'electron'
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
  ipcMain.handle('capability:invoke', async (event, capability: string, payload?: unknown) => {
    if (!active) throw new Error('能力 worker 未启动')
    const sender: WebContents = event.sender
    // 流式事件经主进程转发回发起该调用的渲染层（worker→主→渲染，替代 SSE HTTP）
    return active.invoke(capability, payload, {
      onStream: (streamEvent) => {
        if (!sender.isDestroyed()) sender.send('capability:stream', streamEvent)
      },
    })
  })
}
