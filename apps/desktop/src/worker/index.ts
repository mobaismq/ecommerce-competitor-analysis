import type { CapabilityInvokeMessage, WorkerOutbound } from './protocol'
import { isInvoke } from './protocol'
import { getWorkerPrisma, putBytes, removeBytes, workerDataRoots } from './worker-db'

export interface WorkerHost {
  postMessage: (message: WorkerOutbound) => void
  onMessage: (handler: (msg: unknown) => void) => void
  pid?: number
}

export type CapabilityHandler = (payload: unknown) => Promise<unknown> | unknown

/** worker 侧路由：ready → ack → result/error。未知能力走诚实错误，不伪造成功。 */
export function startWorkerRuntime(host: WorkerHost, handlers: Record<string, CapabilityHandler>) {
  host.onMessage(async (raw) => {
    if (!isInvoke(raw)) return
    const msg = raw as CapabilityInvokeMessage
    host.postMessage({ type: 'capability-ack', msgId: msg.msgId, capability: msg.capability })
    const handler = handlers[msg.capability]
    if (!handler) {
      host.postMessage({
        type: 'capability-error',
        msgId: msg.msgId,
        capability: msg.capability,
        error: { code: 'CAPABILITY_NOT_CONFIGURED', message: `能力「${msg.capability}」尚未接入` },
      })
      return
    }
    try {
      const result = await handler(msg.payload)
      host.postMessage({ type: 'capability-result', msgId: msg.msgId, capability: msg.capability, result })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = (error as { code?: string })?.code || 'CAPABILITY_FAILED'
      host.postMessage({ type: 'capability-error', msgId: msg.msgId, capability: msg.capability, error: { code, message } })
    }
  })
  host.postMessage({ type: 'worker-ready', pid: host.pid })
}

export function createBuiltinHandlers(): Record<string, CapabilityHandler> {
  return {
    ping: async () => ({ ok: true, at: new Date().toISOString() }),
    // 落库+落盘冒烟：写一条能力记录与一个本地文件，读回后立即清理
    'storage.smoke': async () => {
      const db = getWorkerPrisma()
      const id = `smoke-${Date.now()}`
      const roots = workerDataRoots()
      const rel = `tmp/smoke/${id}.txt`
      const full = putBytes(rel, Buffer.from('smoke'), { userRoot: roots.userRoot })
      await db.generatedAsset.create({ data: { id, tenantId: 't-smoke', storageKey: rel, mimeType: 'text/plain', size: 5 } })
      const found = await db.generatedAsset.findUnique({ where: { id } })
      await db.generatedAsset.delete({ where: { id } })
      removeBytes(full)
      return { ok: !!found, storageKey: rel }
    },
  }
}

function electronHost(): WorkerHost | null {
  try {
    // 仅在 Electron utilityProcess 内存在 parentPort
    const { parentPort } = require('electron') as { parentPort?: { postMessage: (m: unknown) => void; on: (e: string, cb: (e: { data: unknown }) => void) => void } }
    if (!parentPort) return null
    return {
      pid: process.pid,
      postMessage: (message) => parentPort!.postMessage(message),
      onMessage: (handler) => parentPort!.on('message', (event) => handler(event.data)),
    }
  } catch {
    return null
  }
}

const host = electronHost()
if (host) startWorkerRuntime(host, createBuiltinHandlers())
