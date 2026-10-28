import { spawn, type ChildProcess } from 'node:child_process'
import { app } from 'electron'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolveActiveExtensionPath } from './extension-manager'

export interface LaunchChromeOptions {
  headless?: boolean
  profileDir?: string
  persistent?: boolean
  url?: string
  downloadPath?: string
  extensionPath?: string | null
}

export interface LaunchedChrome {
  child: ChildProcess
  port: number
  profileDir: string
  debugUrl: string
  isBuiltin: boolean
  executablePath: string
}

/** 递归在指定目录下查找有效可执行文件 */
function findExecutableInDir(dir: string): string | null {
  if (!existsSync(dir)) return null
  if (process.platform === 'win32') {
    const candidates = [
      join(dir, 'chrome.exe'),
      join(dir, 'chrome-win', 'chrome.exe'),
      join(dir, 'chrome-win64', 'chrome.exe'),
    ]
    for (const cand of candidates) {
      if (existsSync(cand)) return cand
    }
    // 递归两层查找 chrome.exe
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sub = join(dir, entry.name, 'chrome.exe')
          if (existsSync(sub)) return sub
        }
      }
    } catch {}
    return null
  }
  if (process.platform === 'darwin') {
    const searchApp = (current: string): string | null => {
      try {
        const entries = readdirSync(current, { withFileTypes: true })
        for (const entry of entries) {
          const full = join(current, entry.name)
          if (entry.isDirectory() && entry.name.endsWith('.app')) {
            const macosDir = join(full, 'Contents', 'MacOS')
            if (existsSync(macosDir)) {
              const bins = readdirSync(macosDir)
              if (bins.length > 0) return join(macosDir, bins[0])
            }
          } else if (entry.isDirectory()) {
            const found = searchApp(full)
            if (found) return found
          }
        }
      } catch {}
      return null
    }
    return searchApp(dir)
  }
  return null
}

/** 解析出厂打包或工程内置的绿色便携版 Chromium 路径 */
export function resolveBuiltinChromiumPath(): string | null {
  const isPackaged = app?.isPackaged ?? false
  const base = isPackaged && process.resourcesPath
    ? join(process.resourcesPath, 'chromium')
    : resolve(__dirname, '..', '..', 'resources', 'chromium')

  const exe = findExecutableInDir(base)
  if (exe && process.platform !== 'win32') {
    try {
      chmodSync(exe, 0o755)
    } catch {}
  }
  return exe
}

/** 探测宿主系统外部已安装的 Chrome/Edge 作为降级兜底 */
export function findSystemChromePath(): string {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  const found = candidates.find(existsSync)
  if (!found) throw new Error('未找到任何内置或系统可用的 Chromium 浏览器')
  return found
}

/** 获取最终采纳的 Chromium 可执行路径 (优先内置专属容器) */
export function resolveChromiumPath(): { path: string; isBuiltin: boolean } {
  const builtin = resolveBuiltinChromiumPath()
  if (builtin) {
    return { path: builtin, isBuiltin: true }
  }
  return { path: findSystemChromePath(), isBuiltin: false }
}

/** 获取店透视专属用户数据目录 (用于会话与登录态终身持久化) */
export function getDefaultDtsProfileDir(): string {
  try {
    return join(app.getPath('userData'), 'dts-profile')
  } catch {
    return join(process.cwd(), '.test-user-data', 'dts-profile')
  }
}

function waitForDevToolsPort(profileDir: string, timeoutMs = 20000): Promise<number> {
  const file = join(profileDir, 'DevToolsActivePort')
  const started = Date.now()
  return new Promise((resolvePort, reject) => {
    const poll = async () => {
      try {
        if (existsSync(file)) {
          const content = readFileSync(file, 'utf8')
          const firstLine = content.split(/\r?\n/)[0]
          const port = Number(firstLine)
          if (Number.isInteger(port) && port > 0) {
            // 验证真实 HTTP 连通性，防止读到未清理的旧端口
            try {
              const resp = await fetch(`http://127.0.0.1:${port}/json/version`)
              if (resp.ok) {
                resolvePort(port)
                return
              }
            } catch {}
          }
        }
      } catch {}
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`等待 Chromium DevToolsActivePort 超时 (${profileDir})`))
        return
      }
      setTimeout(poll, 150)
    }
    void poll()
  })
}

/** 启动专属 Chromium 采集容器 */
export async function launchChromeForRpa(options: LaunchChromeOptions = {}): Promise<LaunchedChrome> {
  const { path: chromeExe, isBuiltin } = resolveChromiumPath()
  const isPersistent = options.persistent !== false
  const profileDir = options.profileDir ?? (isPersistent ? getDefaultDtsProfileDir() : join(tmpdir(), `eca-rpa-profile-${Date.now()}`))
  mkdirSync(profileDir, { recursive: true })

  // 启动前先清理旧残留端口文件，彻底避免读到上一次进程的历史旧端口
  try {
    rmSync(join(profileDir, 'DevToolsActivePort'), { force: true })
  } catch {}

  // 跨平台规范化路径，避免 Windows 反斜杠转义
  const normalizedProfile = profileDir.replace(/\\/g, '/')

  const args = [
    `--user-data-dir=${normalizedProfile}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-features=Translate,OptimizationHints',
  ]

  // 挂载店透视扩展
  const extPath = options.extensionPath !== undefined ? options.extensionPath : (() => {
    try {
      return resolveActiveExtensionPath()
    } catch {
      return null
    }
  })()

  if (extPath) {
    const normalizedExt = extPath.replace(/\\/g, '/')
    args.push(`--load-extension=${normalizedExt}`)
    args.push(`--disable-extensions-except=${normalizedExt}`)
  }

  // 方案 A 核心：默认全面开启全新无头模式（headless: new），后台静默运行，杜绝弹窗与 Dock 图标
  const isHeadless = options.headless !== false
  if (isHeadless) {
    args.unshift('--headless=new')
  }

  args.push(options.url ?? 'about:blank')

  const child = spawn(chromeExe, args, {
    stdio: 'ignore',
    windowsHide: true,
    detached: process.platform !== 'win32',
  })

  try {
    const port = await waitForDevToolsPort(profileDir)
    const launched: LaunchedChrome = {
      child,
      port,
      profileDir,
      debugUrl: `http://127.0.0.1:${port}`,
      isBuiltin,
      executablePath: chromeExe,
    }

    if (options.downloadPath) {
      try {
        await setDownloadBehavior(port, options.downloadPath)
      } catch {}
    }

    return launched
  } catch (err) {
    if (!child.killed) child.kill('SIGKILL')
    throw err
  }
}

/** 重定向 Chromium 下载目录到指定采集任务工作区 */
export async function setDownloadBehavior(port: number, downloadPath: string): Promise<void> {
  mkdirSync(downloadPath, { recursive: true })
  const normalizedPath = downloadPath.replace(/\\/g, '/')
  const list = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json())
  const target = Array.isArray(list) && list.length > 0 ? list[0] : null
  if (!target?.webSocketDebuggerUrl) return

  const WebSocketCtor = (globalThis as unknown as { WebSocket?: new (url: string) => WebSocket }).WebSocket
  if (!WebSocketCtor) return

  await new Promise<void>((resolveDone) => {
    const ws = new WebSocketCtor(target.webSocketDebuggerUrl)
    const timer = setTimeout(() => {
      try { ws.close() } catch {}
      resolveDone()
    }, 4000)

    ws.onopen = () => {
      // 通过 CDP 设置下载行为
      ws.send(JSON.stringify({
        id: 100,
        method: 'Page.setDownloadBehavior',
        params: {
          behavior: 'allow',
          downloadPath: normalizedPath,
        },
      }))
      setTimeout(() => {
        clearTimeout(timer)
        try { ws.close() } catch {}
        resolveDone()
      }, 500)
    }
    ws.onerror = () => {
      clearTimeout(timer)
      resolveDone()
    }
  })
}

export async function evaluatePage(port: number, expression: string, url = 'about:blank'): Promise<unknown> {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((response) => response.json())
  const WebSocketCtor = (globalThis as unknown as { WebSocket?: new (url: string) => WebSocket }).WebSocket
  if (!WebSocketCtor) throw new Error('当前 Node 不支持全局 WebSocket')

  return new Promise((resolveEval, reject) => {
    const socket = new WebSocketCtor(target.webSocketDebuggerUrl)
    const timer = setTimeout(() => reject(new Error('CDP evaluate timeout')), 10000)
    socket.onopen = () => {
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }))
    }
    socket.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data))
      if (message.id === 1) {
        clearTimeout(timer)
        socket.close()
        resolveEval(message.result?.result?.value)
      }
    }
    socket.onerror = () => {
      clearTimeout(timer)
      reject(new Error('CDP WebSocket 连接失败'))
    }
  })
}

/** 安全关闭 Chromium 容器进程（杜绝删除持久化 profile） */
export function closeChrome(launched: LaunchedChrome, cleanTemporary = false) {
  if (!launched?.child) return
  try {
    if (!launched.child.killed) {
      if (process.platform !== 'win32' && launched.child.pid) {
        try {
          process.kill(-launched.child.pid, 'SIGTERM')
        } catch {
          launched.child.kill('SIGTERM')
        }
      } else {
        launched.child.kill('SIGTERM')
      }
    }
  } catch {}

  // 严格守卫：仅当明确为临时且非持久 profile 时才删除临时目录
  if (cleanTemporary && launched.profileDir && !launched.profileDir.includes('dts-profile')) {
    try {
      rmSync(launched.profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {}
  }
}
