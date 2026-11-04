import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs'
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
  extraArgs?: string[]
  /** headless 下 Screencast 的视口基准（追加 --window-size）。默认 1280x800。 */
  viewport?: { width: number; height: number }
}

export interface LaunchedChrome {
  child?: ChildProcess
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

export const GOOGLE_CHROME_DOWNLOAD_URL = 'https://www.google.cn/chrome/'

export interface SystemChromeProbeResult {
  installed: boolean
  path?: string
  version?: string
  downloadUrl: string
}

/** 获取宿主系统官方 Google Chrome 的常见候选安装路径 */
export function getSystemChromeCandidates(): string[] {
  const home = process.env.HOME || ''
  const localAppData = process.env.LOCALAPPDATA || ''
  const progFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
  const progFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'

  const candidates: (string | undefined)[] = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    home ? join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome') : undefined,
    // Windows
    join(progFiles, 'Google/Chrome/Application/chrome.exe'),
    join(progFilesX86, 'Google/Chrome/Application/chrome.exe'),
    localAppData ? join(localAppData, 'Google/Chrome/Application/chrome.exe') : undefined,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ]
  return Array.from(new Set(candidates.filter((p): p is string => Boolean(p))))
}

/** 探测宿主系统外部已安装的官方 Google Chrome 可执行文件路径 */
export function findSystemChromePath(): string {
  const candidates = getSystemChromeCandidates()
  const found = candidates.find(existsSync)
  if (!found) {
    const error = new Error('CHROME_NOT_FOUND: 未检测到本机安装的 Google Chrome 浏览器')
    ;(error as unknown as { code: string }).code = 'CHROME_NOT_FOUND'
    throw error
  }
  return found
}

/** 安全探测宿主系统 Google Chrome 安装状态、版本号及下载引导信息 */
export async function probeSystemChrome(): Promise<SystemChromeProbeResult> {
  try {
    const chromePath = findSystemChromePath()
    const version = await resolveChromeVersion(chromePath)
    return {
      installed: true,
      path: chromePath,
      version: version ?? undefined,
      downloadUrl: GOOGLE_CHROME_DOWNLOAD_URL,
    }
  } catch {
    return {
      installed: false,
      downloadUrl: GOOGLE_CHROME_DOWNLOAD_URL,
    }
  }
}

/** 获取最终采纳的系统真实 Google Chrome 可执行文件路径（坚决不降级到内置无头便携版） */
export function resolveChromiumPath(): { path: string; isBuiltin: boolean } {
  return { path: findSystemChromePath(), isBuiltin: false }
}

/** 获取店透视专属用户数据目录 (独立 real-chrome-profile，与日常 Chrome 彻底隔离) */
export function getDefaultDtsProfileDir(): string {
  let baseDir: string
  try {
    baseDir = app.getPath('userData')
  } catch {
    baseDir = join(process.cwd(), '.test-user-data')
  }
  const newProfile = join(baseDir, 'real-chrome-profile')
  const oldProfile = join(baseDir, 'dts-profile')
  // 平滑升级：若老 profile 存在而新 profile 尚未创建，重命名/迁移以延续既有登录态
  if (existsSync(oldProfile) && !existsSync(newProfile)) {
    try {
      renameSync(oldProfile, newProfile)
    } catch {}
  }
  return newProfile
}

async function isDevToolsPortAlive(port: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1000)
    const resp = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: controller.signal })
    clearTimeout(timer)
    return resp.ok
  } catch {
    return false
  }
}

/**
 * 浏览器级 CDP 健康检查：HTTP /json/version 通只代表 DevTools 端口在监听，
 * 不代表浏览器级 WebSocket 可用。长期运行的孤儿 Chrome 可能进入「HTTP 通、
 * Browser.* 域全 bad」的僵尸态（playwright connect_over_cdp 会报
 * "Browser.setDownloadBehavior: Browser context management is not supported"）。
 * 另外 macOS 上关掉所有窗口后 Chrome 进程不会退出，会留下「端口通、WS 通、
 * 但 /json/list 为 0 个 page target」的空壳实例，Python 侧仍要新建 page 才能采集。
 * 因此健康 = Browser.getVersion 往返成功 且 至少存在一个 page target。
 */
export async function isBrowserCdpHealthy(port: number, timeoutMs = 2500): Promise<boolean> {
  try {
    const versionResp = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).catch(() => null) as { webSocketDebuggerUrl?: string } | null
    const wsUrl = versionResp?.webSocketDebuggerUrl
    if (!wsUrl) return false
    const WebSocketCtor = (globalThis as unknown as { WebSocket?: new (url: string) => WebSocket }).WebSocket
    if (!WebSocketCtor) return false
    const wsHealthy = await new Promise<boolean>((resolveHealthy) => {
      let settled = false
      const ws = new WebSocketCtor(wsUrl)
      const finish = (healthy: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        try { ws.close() } catch {}
        resolveHealthy(healthy)
      }
      const timer = setTimeout(() => finish(false), timeoutMs)
      ws.onopen = () => {
        try { ws.send(JSON.stringify({ id: 1, method: 'Browser.getVersion' })) } catch { finish(false) }
      }
      ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown }
          if (message.id === 1 && message.result) finish(true)
        } catch {}
      }
      ws.onerror = () => finish(false)
      ws.onclose = () => finish(false)
    })
    if (!wsHealthy) return false
    return await hasLivePageTarget(port)
  } catch {
    return false
  }
}

/** 判断实例是否存在可操作的 page target；0 page 的空壳实例无法直接承接采集。 */
async function hasLivePageTarget(port: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1000)
    const list = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: controller.signal }).then((r) => r.json()) as unknown
    clearTimeout(timer)
    if (!Array.isArray(list)) return false
    return list.some((target) => (target as { type?: string })?.type === 'page')
  } catch {
    return false
  }
}

/** 按监听端口找出并终止僵尸 Chrome 主进程（严禁按进程名批量杀，避免误伤日常 Chrome）。 */
async function killChromeOnPort(port: number): Promise<void> {
  const pids: number[] = []
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('netstat', ['-ano'], { timeout: 5000 })
      for (const line of String(stdout).split(/\r?\n/)) {
        if (line.includes(`:${port}`) && /LISTENING/i.test(line)) {
          const pid = Number(line.trim().split(/\s+/).pop())
          if (Number.isInteger(pid) && pid > 0) pids.push(pid)
        }
      }
    } else {
      const { stdout } = await execFileAsync('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN'], { timeout: 5000 }).catch(() => ({ stdout: '' }))
      for (const token of String(stdout).trim().split(/\s+/)) {
        const pid = Number(token)
        if (Number.isInteger(pid) && pid > 0) pids.push(pid)
      }
    }
  } catch {}
  await terminateChromePids(pids)
}

/** 按 Profile 目录回收仍占用该目录的 Chrome 浏览器主进程（端口文件丢失/失效时兜底）。 */
async function killChromeByProfileDir(profileDir: string): Promise<void> {
  if (process.platform === 'win32') return
  const needle = `--user-data-dir=${profileDir}`
  const pids: number[] = []
  try {
    const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,command='], { timeout: 5000, maxBuffer: 8 * 1024 * 1024 })
    for (const line of String(stdout).split(/\r?\n/)) {
      const match = /^\s*(\d+)\s+(.+)$/.exec(line)
      if (!match) continue
      const command = match[2]
      // 只回收指定 Profile 的浏览器主进程；--type= 是 renderer/gpu/utility 子进程，随主进程自然退出，不单独处理
      if (command.includes(needle) && !command.includes('--type=')) {
        const pid = Number(match[1])
        if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) pids.push(pid)
      }
    }
  } catch {}
  await terminateChromePids(pids)
}

async function terminateChromePids(pids: number[]): Promise<void> {
  for (const pid of Array.from(new Set(pids))) {
    try {
      if (process.platform === 'win32') {
        await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], { timeout: 5000 }).catch(() => undefined)
      } else {
        process.kill(pid, 'SIGTERM')
      }
    } catch {}
  }
  // SIGTERM 后给主进程留出清理时间；仍存活则升级 SIGKILL。
  await new Promise((r) => setTimeout(r, 800))
  for (const pid of Array.from(new Set(pids))) {
    try {
      process.kill(pid, 0)
      process.kill(pid, 'SIGKILL')
    } catch {}
  }
}

const execFileAsync = promisify(execFile)
/** 缓存同一进程内多次启动时解析到的 Chrome 版本号（UA 覆写需要，避免每次启动都跑一次 --version）。 */
let cachedChromeVersion: string | null | undefined

/** 解析捆绑/系统 Chromium 的完整版本号（如 153.0.8010.12），供真实 UA 覆写使用。 */
async function resolveChromeVersion(chromeExe: string): Promise<string | null> {
  if (cachedChromeVersion !== undefined) return cachedChromeVersion
  cachedChromeVersion = null
  try {
    const { stdout } = await execFileAsync(chromeExe, ['--version'], { timeout: 5000 })
    const match = String(stdout).match(/(\d+\.\d+\.\d+\.\d+)/)
    if (match) cachedChromeVersion = match[1]
  } catch {}
  return cachedChromeVersion
}

/**
 * 构造与真实 Chrome 一致的 User-Agent（去掉 HeadlessChrome 标识）。
 * TMD（天猫盾）风控会识别 headless 自动化指纹（navigator.webdriver=true + HeadlessChrome UA）,
 * 把搜索商品接口 redirect 到 ____tmd____/punish，导致页面永远卡在"加载中"。
 * 方案 C：最小指纹净化 —— 仅消除自动化标识，不 mock 数据，采集结果仍为真实淘宝数据。
 */
function buildRealChromeUserAgent(version: string): string {
  const platformToken =
    process.platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : process.platform === 'linux'
        ? 'X11; Linux x86_64'
        : 'Macintosh; Intel Mac OS X 10_15_7'
  return `Mozilla/5.0 (${platformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
}

function waitForDevToolsPort(profileDir: string, child: ReturnType<typeof spawn>, timeoutMs = 15000): Promise<number> {
  const file = join(profileDir, 'DevToolsActivePort')
  const started = Date.now()
  return new Promise((resolvePort, reject) => {
    let resolved = false

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (!resolved) {
        resolved = true
        reject(new Error(`Chromium 进程异常退出 (code: ${code}, signal: ${signal})`))
      }
    }
    child.once('exit', onExit)

    const poll = async () => {
      if (resolved) return
      try {
        if (existsSync(file)) {
          const content = readFileSync(file, 'utf8')
          const firstLine = content.split(/\r?\n/)[0]
          const port = Number(firstLine)
          if (Number.isInteger(port) && port > 0) {
            const alive = await isDevToolsPortAlive(port)
            if (alive) {
              resolved = true
              child.removeListener('exit', onExit)
              resolvePort(port)
              return
            }
          }
        }
      } catch {}
      if (Date.now() - started > timeoutMs) {
        resolved = true
        child.removeListener('exit', onExit)
        reject(new Error(`等待 Chromium DevToolsActivePort 超时 (${profileDir})`))
        return
      }
      setTimeout(poll, 120)
    }
    void poll()
  })
}

/**
 * 通过浏览器级 CDP (Extensions.loadUnpacked) 确保店透视解包扩展已挂载并激活。
 * 背景：Google Chrome 137+ / 156+ 正式版已废弃 --load-extension 命令行参数（静默忽略），
 * 且若携带 --disable-extensions-except 会把动态挂载的扩展也一并禁用。
 * 必须配合 --enable-unsafe-extension-debugging 启动参数 + CDP Extensions.loadUnpacked 挂载。
 */
export async function ensureExtensionLoadedViaCdp(port: number, extensionPath?: string | null): Promise<boolean> {
  if (!extensionPath) return true
  const normalizedExt = extensionPath.replace(/\\/g, '/')

  const hasDtsServiceWorker = async (): Promise<boolean> => {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()) as Array<{ url?: string; type?: string }>
      if (!Array.isArray(list)) return false
      return list.some((t) => String(t?.url || '').includes('/script/service_worker.js'))
    } catch {
      return false
    }
  }

  if (await hasDtsServiceWorker()) return true

  try {
    const versionResp = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).catch(() => null) as { webSocketDebuggerUrl?: string } | null
    const wsUrl = versionResp?.webSocketDebuggerUrl
    if (!wsUrl) return false

    const WebSocketCtor = (globalThis as unknown as { WebSocket?: new (url: string) => WebSocket }).WebSocket
    if (!WebSocketCtor) return false

    const loadedId = await new Promise<string | null>((resolveLoad) => {
      const ws = new WebSocketCtor(wsUrl)
      const timer = setTimeout(() => {
        try { ws.close() } catch {}
        resolveLoad(null)
      }, 4000)

      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: 202,
          method: 'Extensions.loadUnpacked',
          params: { path: normalizedExt },
        }))
      }

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data)) as { id?: number; result?: { id?: string }; error?: unknown }
          if (msg.id === 202) {
            clearTimeout(timer)
            try { ws.close() } catch {}
            resolveLoad(msg.result?.id || null)
          }
        } catch {
          clearTimeout(timer)
          try { ws.close() } catch {}
          resolveLoad(null)
        }
      }

      ws.onerror = () => {
        clearTimeout(timer)
        try { ws.close() } catch {}
        resolveLoad(null)
      }
    })

    if (!loadedId) return false
    // 等待扩展 Service Worker 启动注册到 CDP Target 列表
    for (let i = 0; i < 6; i++) {
      if (await hasDtsServiceWorker()) return true
      await new Promise((r) => setTimeout(r, 250))
    }
    return false
  } catch {
    return false
  }
}

/**
 * 方案 A（软重置）：不杀 Chrome 进程（保留淘宝内存级信任态与店透视 Service Worker 热态），
 * 自动关闭多余的历史标签页，仅保留 1 个主工作标签页并将其重置为 about:blank，清空上一轮残留弹窗与 DOM。
 */
export async function softResetChromeTabs(port: number): Promise<void> {
  try {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => []) as Array<{
      id?: string
      type?: string
      url?: string
      webSocketDebuggerUrl?: string
    }>
    if (!Array.isArray(list)) return

    const pageTargets = list.filter((t) => {
      if (t?.type !== 'page' || !t.id) return false
      const u = String(t.url || '')
      return !u.startsWith('devtools://') && !u.startsWith('chrome-extension://')
    })

    if (pageTargets.length === 0) return

    const primary = pageTargets[0]
    // 关闭多余的历史标签页，防止多轮采集或插件打开新标签导致窗口堆积
    for (const extra of pageTargets.slice(1)) {
      if (extra.id) {
        await fetch(`http://127.0.0.1:${port}/json/close/${extra.id}`).catch(() => {})
      }
    }

    if (primary.id) {
      await fetch(`http://127.0.0.1:${port}/json/activate/${primary.id}`).catch(() => {})
    }

    // 若主标签页当前不在 about:blank，将其软重置到 about:blank，卸载上一轮残留的商品页 DOM 与弹窗
    if (primary.url && primary.url !== 'about:blank' && primary.webSocketDebuggerUrl) {
      const WebSocketCtor = (globalThis as unknown as { WebSocket?: new (url: string) => WebSocket }).WebSocket
      if (WebSocketCtor) {
        await new Promise<void>((resolveNav) => {
          const ws = new WebSocketCtor(primary.webSocketDebuggerUrl!)
          const timer = setTimeout(() => {
            try { ws.close() } catch {}
            resolveNav()
          }, 1500)
          ws.onopen = () => {
            ws.send(JSON.stringify({
              id: 301,
              method: 'Page.navigate',
              params: { url: 'about:blank' },
            }))
          }
          ws.onmessage = (event: MessageEvent) => {
            try {
              const msg = JSON.parse(String(event.data)) as { id?: number }
              if (msg.id === 301) {
                clearTimeout(timer)
                try { ws.close() } catch {}
                resolveNav()
              }
            } catch {}
          }
          ws.onerror = () => {
            clearTimeout(timer)
            try { ws.close() } catch {}
            resolveNav()
          }
        })
      }
    }
  } catch {
    // 忽略软重置过程中的偶发非致命异常
  }
}

/** 启动专属 Chromium 采集容器 */
export async function launchChromeForRpa(options: LaunchChromeOptions = {}): Promise<LaunchedChrome> {
  const { path: chromeExe, isBuiltin } = resolveChromiumPath()
  const isPersistent = options.persistent !== false
  const profileDir = options.profileDir ?? (isPersistent ? getDefaultDtsProfileDir() : join(tmpdir(), `eca-rpa-profile-${Date.now()}`))
  mkdirSync(profileDir, { recursive: true })

  // 提前解析店透视扩展路径（供复用健康校验与新启动挂载共用）
  const extPath = options.extensionPath !== undefined ? options.extensionPath : (() => {
    try {
      return resolveActiveExtensionPath()
    } catch {
      return null
    }
  })()
  const normalizedExt = extPath ? extPath.replace(/\\/g, '/') : null

  // 1. 如果当前 profile 已有活着的 DevTools 端口且不需要切换 url/模式，尝试复用
  const activePortFile = join(profileDir, 'DevToolsActivePort')
  if (existsSync(activePortFile)) {
    try {
      const port = Number(readFileSync(activePortFile, 'utf8').split(/\r?\n/)[0])
      if (Number.isInteger(port) && port > 0 && await isDevToolsPortAlive(port)) {
        // HTTP 端口通不代表浏览器级 CDP 可用：长期运行的孤儿实例可能已是僵尸态，
        // 直接复用会让 Python 侧 playwright connect_over_cdp 失败。先做 Browser.getVersion 往返。
        const cdpHealthy = await isBrowserCdpHealthy(port)
        const extHealthy = cdpHealthy ? await ensureExtensionLoadedViaCdp(port, normalizedExt) : false
        if (cdpHealthy && extHealthy) {
          // 如果当前实例活着且外部未指定要单独打开 URL，可直接复用已有实例
          if (!options.url || options.url === 'about:blank') {
            if (options.downloadPath) {
              try { await setDownloadBehavior(port, options.downloadPath) } catch {}
            }
            return {
              port,
              profileDir,
              debugUrl: `http://127.0.0.1:${port}`,
              isBuiltin,
              executablePath: chromeExe,
            }
          }
        } else {
          // 端口活着但 CDP 已坏，或旧实例缺少扩展调试支持（如携带了旧的 --disable-extensions-except）：
          // 按 PID 终止后走全新拉起，自动恢复店透视插件挂载（持久化 Profile 登录态无损保留）。
          await killChromeOnPort(port)
        }
      }
    } catch {}
  }

  // 2. 启动新实例前，先回收仍占用该 Profile 的浏览器进程（端口文件失效时的兜底），再清理残留锁文件
  try {
    await killChromeByProfileDir(profileDir)
    rmSync(activePortFile, { force: true })
    rmSync(join(profileDir, 'SingletonLock'), { force: true })
    rmSync(join(profileDir, 'SingletonSocket'), { force: true })
    rmSync(join(profileDir, 'SingletonCookie'), { force: true })
  } catch {}

  // 跨平台规范化路径，避免 Windows 反斜杠转义
  const normalizedProfile = profileDir.replace(/\\/g, '/')

  const args = [
    `--user-data-dir=${normalizedProfile}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-restore-session-state',
    '--disable-background-networking',
    '--disable-features=Translate,OptimizationHints',
    // 关键反爬指纹净化：在 Blink 引擎内核彻底消除 AutomationControlled 特征（navigator.webdriver=false）
    // 防止阿里天猫盾 TMD 识别出机器人导致滑块验证死循环报错 error:dwMz3
    '--disable-blink-features=AutomationControlled',
    // 搭配 --test-type 参数：Chromium 会在内部抑制 BadFlagsPrompt，绝对不会弹出黄色的“不受支持的命令行标记”警告条！
    '--test-type',
  ]

  if (normalizedExt) {
    // 兼容旧版 Chromium (<137)
    args.push(`--load-extension=${normalizedExt}`)
    // 兼容新版官方 Google Chrome (137+ ~ 156+)：开启 CDP Extensions.loadUnpacked 调试通道
    // 注意：严禁再传 --disable-extensions-except，否则 Chrome 137+ 会将动态挂载的店透视扩展强行禁用！
    args.push('--enable-unsafe-extension-debugging')
  }

  // 默认采用真实系统 Chrome 窗口（有头运行），彻底告别无头猫鼠游戏与 TMD 拦截
  // 仅当调用方显式传 options.headless === true 时才开启无头（一般供纯后台回归单测使用）
  if (options.headless === true) {
    args.unshift('--headless=new')
  }

  // 视口尺寸基准（默认 1280x800），保持舒适的窗口展示比例
  const viewport = options.viewport ?? { width: 1280, height: 800 }
  args.push(`--window-size=${viewport.width},${viewport.height}`)

  // 注入官方真实 UA（与宿主系统版本严格一致）
  const chromeVersion = await resolveChromeVersion(chromeExe)
  if (chromeVersion) {
    args.push(`--user-agent=${buildRealChromeUserAgent(chromeVersion)}`)
  }

  if (options.extraArgs?.length) {
    args.push(...options.extraArgs)
  }

  // 仅当调用方显式指定 URL 时才作为命令行参数传入；不追加默认外部页面，
  // 避免与系统自带首 Tab 叠加成双 Tab（由业务管理器通过 Target CDP 统一激活与导航）。
  const hasAppArg = options.extraArgs?.some((a) => a.startsWith('--app='))
  if (!hasAppArg && options.url) {
    args.push(options.url)
  }

  const child = spawn(chromeExe, args, {
    stdio: 'ignore',
    windowsHide: Boolean(options.headless),
    detached: process.platform !== 'win32',
  })

  try {
    const port = await waitForDevToolsPort(profileDir, child)
    if (normalizedExt) {
      await ensureExtensionLoadedViaCdp(port, normalizedExt)
    }
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

export interface ChromeCookieItem {
  name: string
  value: string
  domain: string
  path?: string
  expires?: number
}

/** 通过 CDP 浏览器级连接获取容器中已持久化的全量 Cookies，用于零破坏探测淘宝与店透视登录态。 */
export async function getCookiesFromChrome(port: number): Promise<ChromeCookieItem[]> {
  try {
    const versionResp = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).catch(() => null) as { webSocketDebuggerUrl?: string } | null
    const wsUrl = versionResp?.webSocketDebuggerUrl
    if (!wsUrl) return []

    const WebSocketCtor = (globalThis as unknown as { WebSocket?: new (url: string) => WebSocket }).WebSocket
    if (!WebSocketCtor) return []

    return await new Promise<ChromeCookieItem[]>((resolveCookies) => {
      const socket = new WebSocketCtor(wsUrl)
      const timer = setTimeout(() => {
        try { socket.close() } catch {}
        resolveCookies([])
      }, 4000)

      socket.onopen = () => {
        socket.send(JSON.stringify({ id: 101, method: 'Storage.getCookies' }))
      }

      socket.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(String(event.data)) as { id?: number; result?: { cookies?: ChromeCookieItem[] } }
          if (message.id === 101) {
            clearTimeout(timer)
            try { socket.close() } catch {}
            resolveCookies(message.result?.cookies || [])
          }
        } catch {
          clearTimeout(timer)
          try { socket.close() } catch {}
          resolveCookies([])
        }
      }

      socket.onerror = () => {
        clearTimeout(timer)
        resolveCookies([])
      }
    })
  } catch {
    return []
  }
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
  if (
    cleanTemporary &&
    launched.profileDir &&
    !launched.profileDir.includes('real-chrome-profile') &&
    !launched.profileDir.includes('dts-profile')
  ) {
    try {
      rmSync(launched.profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {}
  }
}
