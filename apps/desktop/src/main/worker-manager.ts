import { utilityProcess } from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { CapabilityErrorMessage, CapabilityResultMessage, CapabilityStreamMessage, WorkerOutbound } from '../worker/protocol'

export interface WorkerManagerOptions {
  entry?: string
  onLog?: (line: string) => void
  restartDelayMs?: number
  forkImpl?: (entry: string) => UtilityChild
}

export interface UtilityChild {
  pid?: number
  postMessage: (message: unknown) => void
  on: (event: 'message' | 'exit', listener: (...args: unknown[]) => void) => void
  kill?: () => void
}

export interface InvokeOptions {
  timeoutMs?: number
  onStream?: (event: { type: string; text?: string; data?: Record<string, unknown> }) => void
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  onStream?: (event: { type: string; text?: string; data?: Record<string, unknown> }) => void
}

/** 主进程能力 worker 生命周期：fork、ready 握手、请求-响应、崩溃重启、退出清理。 */
export class WorkerManager {
  private child: UtilityChild | null = null
  private ready = false
  private stopping = false
  private readonly pending = new Map<string, Pending>()
  private readonly entry: string

  constructor(private readonly opts: WorkerManagerOptions = {}) {
    this.entry = opts.entry ?? join(__dirname, 'worker/index.js')
  }

  get isReady() {
    return this.ready
  }

  start() {
    if (this.child) return
    this.stopping = false
    const fork = this.opts.forkImpl ?? ((entry) => utilityProcess.fork(entry, [], { serviceName: 'capability-worker', stdio: 'inherit' }) as unknown as UtilityChild)
    const child = fork(this.entry)
    this.child = child
    this.ready = false
    child.on('message', (raw) => this.onMessage(raw as WorkerOutbound))
    child.on('exit', (exitInfo) => {
      this.child = null
      this.ready = false
      const code = (exitInfo as { exitCode?: number })?.exitCode
      const signal = (exitInfo as { signal?: string })?.signal
      this.opts.onLog?.(`capability worker 退出(exitCode=${code ?? '?'},signal=${signal ?? '?'})`)
      this.rejectAll(new Error('能力 worker 已退出'))
      if (!this.stopping) {
        const delay = this.opts.restartDelayMs ?? 1000
        setTimeout(() => {
          if (!this.stopping && !this.child) this.start()
        }, delay).unref?.()
      }
    })
  }

  stop() {
    this.stopping = true
    this.child?.kill?.()
    this.child = null
    this.ready = false
    this.rejectAll(new Error('能力 worker 已停止'))
  }

  /** 渲染层调用：能力 worker 就绪则同步派发（ready 在 worker 加载时即置位，早于渲染层首屏），未就绪时诚实拒绝。 */
  invoke(capability: string, payload?: unknown, opts: InvokeOptions = {}): Promise<unknown> {
    if (!this.child || !this.ready) return Promise.reject(new Error('能力 worker 未就绪'))
    const msgId = randomUUID()
    const timeoutMs = opts.timeoutMs ?? 30_000
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(msgId)
        reject(new Error(`能力「${capability}」调用超时`))
      }, timeoutMs)
      this.pending.set(msgId, { resolve, reject, timer, onStream: opts.onStream })
      this.child!.postMessage({ type: 'capability-invoke', msgId, capability, payload })
    })
  }

  private onMessage(msg: WorkerOutbound) {
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'worker-ready') {
      this.ready = true
      this.opts.onLog?.(`capability worker ready pid=${msg.pid ?? this.child?.pid ?? '?'}`)
      return
    }
    if (msg.type === 'capability-ack') return
    const pending = this.pending.get(msg.msgId)
    if (!pending) return
    if (msg.type === 'capability-stream') {
      pending.onStream?.((msg as CapabilityStreamMessage).event)
      return
    }
    clearTimeout(pending.timer)
    this.pending.delete(msg.msgId)
    if (msg.type === 'capability-result') pending.resolve((msg as CapabilityResultMessage).result)
    else pending.reject(Object.assign(new Error((msg as CapabilityErrorMessage).error.message), { code: (msg as CapabilityErrorMessage).error.code }))
  }

  private rejectAll(error: Error) {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }
}
