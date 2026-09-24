import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'

/**
 * 嵌入式后端起拉器：把打包后的后端(node dist/main.js)作为子进程拉起，注入本地数据根，做 /health 就绪轮询、
 * 崩溃自动重启、退出清理。后端仍是独立 API 服务本体，本类只负责在桌面侧创建一个本地副本进程。
 * 设计为 electron-free，便于独立 node/tsx 实测；Electron 侧在 index.ts 注入 entry 与数据根。
 */
export interface BackendRunnerOptions {
  /** 后端入口（打包后的 dist/main.js）绝对路径；未配置或不存在则无法嵌入式启动。 */
  entry?: string
  port?: number
  /** 远程后端 URL；配置后跳过内嵌启动（远程模式）。 */
  baseUrl?: string
  /** 要注入的本地数据根基（ECOMMERCE_DATA_ROOT）。 */
  dataRoot?: string
  /** 要注入的存储开关（STORAGE_DRIVER）。 */
  storageDriver?: string
  /** 是否允许嵌入式 spawn 后端。false=开发态（pnpm dev 已单独起 api）直接用外部后端，避免双后端抢端口。默认允许。 */
  embeddedEnabled?: boolean
  startupTimeoutMs?: number
  startupPollMs?: number
  restartBackoffMs?: number
  /** 日志/stdio 回调。 */
  onLog?: (line: string) => void
}

export type BackendRunMode = 'embedded' | 'external' | 'remote'

export class BackendRunner {
  private child: ChildProcess | null = null
  private stopping = false
  private started = false
  private restartTimer: NodeJS.Timeout | null = null
  private backoff = 0
  private readonly opts: BackendRunnerOptions
  private readonly port: number
  private readonly startupTimeoutMs: number
  private readonly startupPollMs: number
  private readonly restartBackoffMs: number

  constructor(options: BackendRunnerOptions = {}) {
    this.opts = options
    this.port = options.port ?? 8787
    this.startupTimeoutMs = options.startupTimeoutMs ?? 30_000
    this.startupPollMs = options.startupPollMs ?? 500
    this.restartBackoffMs = options.restartBackoffMs ?? 1000
  }

  get baseUrl(): string {
    return this.opts.baseUrl ?? `http://127.0.0.1:${this.port}`
  }

  hasEntry(): boolean {
    return !!this.opts.entry && existsSync(this.opts.entry)
  }

  /** 启动：远程模式(配了远程 URL)跳过内嵌；本地端口已有可用后端则复用（避免 dev 双后端抢端口）；开发态不 spawn；否则 spawn 后端并等 /health 就绪。 */
  async start(): Promise<{ mode: BackendRunMode; baseUrl: string }> {
    if (this.opts.baseUrl) return { mode: 'remote', baseUrl: this.opts.baseUrl }
    // 端口上已有健康后端（如 dev 下另起的 backend），不重复 spawn，直接复用，避免 EADDRINUSE。
    if (await this.isHealthy()) return { mode: 'external', baseUrl: this.baseUrl }
    // 开发态（pnpm dev 会单独起 api）：不 spawn 嵌入式后端，直接复用 8787（api 正在/即将就绪），避免双后端抢端口。
    if (this.opts.embeddedEnabled === false) return { mode: 'external', baseUrl: this.baseUrl }
    const entry = this.opts.entry
    if (!entry || !existsSync(entry)) {
      throw new Error(`未配置后端入口或入口不存在，无法嵌入式启动: ${entry ?? '(null)'}`)
    }
    await this.stop()
    await this.spawnAndWait(entry)
    return { mode: 'embedded', baseUrl: this.baseUrl }
  }

  private async spawnAndWait(entry: string): Promise<void> {
    const env: Record<string, string | undefined> = {
      ...process.env,
      PORT: String(this.port),
      HOST: '127.0.0.1',
      ...(this.opts.dataRoot ? { ECOMMERCE_DATA_ROOT: this.opts.dataRoot } : {}),
      ...(this.opts.storageDriver ? { STORAGE_DRIVER: this.opts.storageDriver } : {}),
    }
    return new Promise<void>((resolvePromise, reject) => {
      let fail: ((error: Error) => void) | null = reject
      const clearPoll = (): void => {
        if (poll) {
          clearTimeout(poll)
          poll = null
        }
      }
      const child = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'pipe'] })
      this.child = child
      child.on('error', (err) => {
        clearPoll()
        this.child = null
        const rejectStartup = fail
        fail = null
        rejectStartup?.(err)
      })
      child.stdout?.on('data', (d) => this.opts.onLog?.(`[backend] ${String(d).trim()}`))
      child.stderr?.on('data', (d) => this.opts.onLog?.(`[backend:err] ${String(d).trim()}`))
      child.on('exit', (code, signal) => {
        const wasStopping = this.stopping
        const rejectStartup = fail
        fail = null
        this.child = null
        if (!wasStopping && !this.started) {
          // 启动期即退出：快速失败，避免 start 永远挂起
          clearPoll()
          rejectStartup?.(new Error(`后端启动即退出(code=${code},signal=${signal})`))
          return
        }
        if (!wasStopping && this.started) this.scheduleRestart(code, signal)
      })

      const startedAt = Date.now()
      let poll: NodeJS.Timeout | null = null
      const check = async (): Promise<void> => {
        if (this.child == null) {
          clearPoll()
          return
        }
        if (await this.isHealthy()) {
          clearPoll()
          this.started = true
          this.backoff = 0
          fail = null
          resolvePromise()
          return
        }
        if (Date.now() - startedAt > this.startupTimeoutMs) {
          clearPoll()
          const rejectStartup = fail
          fail = null
          rejectStartup?.(new Error(`后端启动超时(${this.startupTimeoutMs}ms)`))
          return
        }
        poll = setTimeout(check, this.startupPollMs)
      }
      void check()
    })
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`)
      return res.ok
    } catch {
      return false
    }
  }

  private scheduleRestart(code: number | null, signal: string | null): void {
    if (this.stopping) return
    const entry = this.opts.entry
    if (!entry) return
    const delay = Math.min(this.restartBackoffMs * (1 + this.backoff), 15_000)
    this.backoff += 1
    this.opts.onLog?.(`[backend] 进程退出(code=${code},signal=${signal})，${delay}ms 后重启`)
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      void this.spawnAndWait(entry).catch((e) => this.opts.onLog?.(`[backend] 重启失败: ${String(e)}`))
    }, delay)
  }

  /** 退出清理：停止重启、SIGTERM 子进程并等待退出，超时 SIGKILL。 */
  async stop(): Promise<void> {
    this.stopping = true
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    const child = this.child
    this.child = null
    if (child && child.exitCode === null) {
      try {
        child.kill('SIGTERM')
      } catch {
        /* no-op */
      }
      await new Promise<void>((resolvePromise) => {
        const timer = setTimeout(() => {
          try {
            child.kill('SIGKILL')
          } catch {
            /* no-op */
          }
          resolvePromise()
        }, 3000)
        child.once('exit', () => {
          clearTimeout(timer)
          resolvePromise()
        })
        if (child.exitCode !== null) {
          clearTimeout(timer)
          resolvePromise()
        }
      })
    }
  }
}