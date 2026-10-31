import { randomUUID } from 'node:crypto'
import { app, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { PrismaClient } from '../generated/prisma'
import { closeChrome, getCookiesFromChrome, launchChromeForRpa, setDownloadBehavior, type LaunchedChrome } from './chrome'
import { assertCollectionMode, type CollectionMode } from './collection-modes'
import { runLocalCollection } from './collection-runner'
import { resolveDataRoots } from './data-root'
import { logger } from './logger'
import { resolveEmbeddedPython, killPythonProcesses } from './python-runner'
import {
  closeLoginTarget,
  connectScreencast,
  createLoginTarget,
  type CdpKeyType,
  type CdpMouseType,
  type ScreencastSession,
} from './screencast'
import { shouldBlockClose, type LoginAuthState } from './login-auth-state'

let activeChrome: LaunchedChrome | null = null
let activeLoginScreencast: ScreencastSession | null = null
/** 当前登录投射所在的容器端口与 tab，停止时一并关闭 tab，避免累积。 */
let activeLoginTarget: { port: number; targetId: string } | null = null

/**
 * 登录授权状态机（修复"扫码成功后秒关 tab 导致 SSO 握手中断"根因）。
 * 判据与轮询全部在主进程，renderer 不自造业务字段；状态定义与阻止关闭
 * 判据收敛在 login-auth-state.ts（唯一权威），此处仅引用。
 */
let loginState: LoginAuthState = 'idle'
/** 登录视图的渲染窗口（用于推送 collection:login-state 事件）。 */
let loginSender: Electron.WebContents | null = null
/** 用户主动请求关闭交换（waiting-sso 中首次请求被拦截后置位，二次请求放行）。 */
let stopByUserRef: { current: boolean } = { current: false }
/** SSO 轮询定时器句柄。 */
let loginPollTimer: ReturnType<typeof setInterval> | null = null

const pushLoginState = () => {
  if (loginSender && !loginSender.isDestroyed()) {
    loginSender.send('collection:login-state', { state: loginState })
  }
}

/** 启动登录 cookie/轻量页轮询：检测 unb 出现 → waiting-sso → 稳定后轻量验证 → verified。 */
const startLoginPolling = (port: number, sender: Electron.WebContents) => {
  loginSender = sender
  clearLoginPolling()
  loginState = 'opening'
  pushLoginState()
  let stableCount = 0
  loginPollTimer = setInterval(async () => {
    if (!activeLoginTarget || activeLoginTarget.port !== port) return
    if (loginState === 'verified') return
    try {
      const cookies = await getCookiesFromChrome(port)
      const hasUnb = cookies.some((c) => (c.domain.includes('taobao.com') || c.domain.includes('tmall.com')) && c.name === 'unb' && c.value.trim().length > 0)
      if (!hasUnb) {
        stableCount = 0
        if (loginState !== 'opening') { loginState = 'opening'; pushLoginState() }
        return
      }
      // 检测到登录 cookie：进入 SSO 等待，要求连续稳定（给跨域跳转/写 cookie 时间）
      if (loginState === 'opening') {
        loginState = 'waiting-sso'
        stableCount = 1
        pushLoginState()
        return
      }
      stableCount += 1
      if (stableCount >= 3 && loginState === 'waiting-sso') {
        // 轻量验证：不触发真实搜索，仅确认身份页可见
        const verified = await verifyLoginLightweight(port)
        loginState = verified ? 'verified' : 'waiting-sso'
        stableCount = verified ? 99 : 0
        pushLoginState()
      }
    } catch {
      // 容器健康抖动：保持当前状态，下轮重试
    }
  }, 1200)
}

const clearLoginPolling = () => {
  if (loginPollTimer) {
    clearInterval(loginPollTimer)
    loginPollTimer = null
  }
}

/**
 * 轻量登录验证：检索 tbToken/uid 主 cookie 后，打开 https://www.taobao.com 检查
 * 返回页面是否出现"亲，请登录"/登录二维码/极小空骨架。不触发任何搜索接口。
 */
async function verifyLoginLightweight(port: number): Promise<boolean> {
  try {
    const container = await ensureChromiumContainer()
    if (container.port !== port) return false
    // 用独立 target 验证，避免污染登录 tab；验证完即关
    const target = await createLoginTarget(port, 'https://www.taobao.com')
    try {
      const ws = new WebSocket(target.wsUrl)
      const result = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 8000)
        ws.onopen = () => {
          ws.send(JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: {
              expression: `(() => {
                const text = (document.body && document.body.innerText || '').slice(0, 800);
                return JSON.stringify({
                  len: text.length,
                  needLogin: text.includes('亲，请登录'),
                  qr: text.includes('扫码') || text.includes('登录二维码'),
                });
              })()`,
              returnByValue: true,
            },
          }))
        }
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data)) as { id?: number; result?: { result?: { value?: string } } }
            if (msg.id === 1) {
              clearTimeout(timer)
              try { ws.close() } catch {}
              const value = msg.result?.result?.value
              if (!value) return resolve(false)
              const parsed = JSON.parse(value) as { len: number; needLogin: boolean; qr: boolean }
              resolve(parsed.len > 120 && !parsed.needLogin && !parsed.qr)
            }
          } catch {}
        }
        ws.onerror = () => resolve(false)
      })
      return result
    } finally {
      try { await closeLoginTarget(port, target.targetId) } catch {}
    }
  } catch {
    return false
  }
}

export async function ensureChromiumContainer(downloadPath?: string): Promise<LaunchedChrome> {
  if (activeChrome) {
    try {
      const resp = await fetch(`http://127.0.0.1:${activeChrome.port}/json/version`)
      if (resp.ok) {
        if (downloadPath) {
          try {
            await setDownloadBehavior(activeChrome.port, downloadPath)
          } catch {}
        }
        return activeChrome
      }
    } catch {}
  }

  activeChrome = await launchChromeForRpa({
    persistent: true,
    downloadPath,
  })
  return activeChrome
}

export interface CollectionStartInput {
  productName?: string
  productUrl?: string
  minPrice?: number | string | null
  maxPrice?: number | string | null
  topN?: number
  limit?: number | string | null
  searchPages?: number
  speedProfile?: string
  importMysql?: boolean
  mode?: string
  downloadScript?: string
  /** 落库到报告快照表的归属维度（缺省 local）。 */
  tenantId?: string
  /** 报告检索用关键词（缺省取 productName）。 */
  keyword?: string
  /** 开发期注入 fake downloader，避免反复触发真实店透视爬虫。 */
  fake?: boolean
}

/** 采集数据工作目录根：用户可见工作区根下 collection/<jobId>。 */
function workDirFor(jobId: string): string {
  const dir = join(resolveDataRoots().userRoot, 'collections', jobId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 解析默认店透视采集脚本路径。 */
function defaultDownloadScript(): string {
  const desktopRoot = resolve(__dirname, '..', '..')
  const skillsRoot = app.isPackaged ? join(process.resourcesPath, 'skills') : resolve(desktopRoot, '..', '..', 'skills')
  const script = join(skillsRoot, 'diantoushi-product-research/scripts/run_desktop_collection.py')
  return existsSync(script) ? script : ''
}

export function registerCollectionHandlers(prisma: PrismaClient) {
  let running = false
  let currentJobId: string | null = null

  ipcMain.handle('collection:start', async (_event, input: CollectionStartInput = {}) => {
    if (running) throw new Error('已有采集任务正在运行，请等待完成或停止当前任务')
    const mode = assertCollectionMode(input.mode ?? 'download-and-import')
    const topN = Number(input.topN ?? input.limit ?? 1)
    const searchPages = Number(input.searchPages ?? 8)
    const minPrice = input.minPrice === '' || input.minPrice == null ? null : Number(input.minPrice)
    const maxPrice = input.maxPrice === '' || input.maxPrice == null ? null : Number(input.maxPrice)
    if (!input.productName?.trim()) throw new Error('请输入采集关键词')
    if (!Number.isInteger(topN) || topN < 1 || topN > 100) throw new Error('竞品数量需为 1-100 之间的整数')
    if (!Number.isInteger(searchPages) || searchPages < 1 || searchPages > 100) throw new Error('翻页深度需为 1-100 之间的整数')
    if ([minPrice, maxPrice].some((price) => price !== null && (!Number.isFinite(price) || price < 0))) throw new Error('价格必须是大于等于 0 的数字')
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw new Error('最低价不能高于最高价')
    const script = input.downloadScript ?? defaultDownloadScript()
    if (!input.fake && !script) throw new Error('未找到店透视采集脚本')
    const jobId = `local-collection-${Date.now()}-${randomUUID().slice(0, 8)}`
    const workDir = workDirFor(jobId)
    const logFile = join(workDir, 'run.log')
    running = true
    currentJobId = jobId

    const speedProfile = ['conservative', 'balanced', 'fast'].includes(String(input.speedProfile || ''))
      ? String(input.speedProfile)
      : 'fast'
    // Desktop reports read SQLite; the optional standalone MySQL pipeline is not used here.
    const importLocal = mode === 'download-and-import' || mode === 'import-only'

    const initialLog = [
      `[${new Date().toISOString()}] [INFO] 启动店透视 RPA 采集任务...`,
      `[INFO] 任务编号: ${jobId}`,
      `[INFO] 目标商品: ${input.productName || '默认商品'}`,
      `[INFO] 价格区间: ${minPrice != null ? minPrice : '不限'} ~ ${maxPrice != null ? maxPrice : '不限'} 元`,
      `[INFO] 采集参数: Top ${topN} | 搜索页数: ${searchPages} | 模式: ${mode} | 速率: ${speedProfile}`,
      `[INFO] 工作目录: ${workDir}`,
      `[INFO] 采集器: 店透视 Mac 完整版；数据保存至本机${importLocal ? '并写入报告数据库' : ''}`,
    ].join('\n') + '\n'
    writeFileSync(logFile, initialLog, 'utf8')

    // 更新 PID
    const currentPid = process.pid

    // 异步执行
    void (async () => {
      try {
        await prisma.localJob.updateMany({
          where: { jobId },
          data: { pid: currentPid },
        })

        let cdpUrl: string | undefined
        if (!input.fake) {
          try {
            const container = await ensureChromiumContainer(workDir)
            cdpUrl = container.debugUrl
            const containerLog = `[INFO] 内置独立绿色 Chromium 容器已就绪 (CDP: ${cdpUrl}, isBuiltin: ${container.isBuiltin})\n[INFO] 请扫码登录淘宝与店透视账号（若尚未登录，自动化将自动等待就绪）\n`
            appendFileSync(logFile, containerLog)
          } catch (containerErr) {
            logger.warn('启动内置 Chromium 容器异常:', containerErr)
            appendFileSync(logFile, `[WARN] 启动内置 Chromium 容器警告: ${containerErr instanceof Error ? containerErr.message : String(containerErr)}\n`)
          }
        }

        await runLocalCollection({
          db: prisma,
          jobId,
          mode,
          input: {
            productName: input.productName,
            productUrl: input.productUrl,
            tenantId: input.tenantId,
            keyword: input.keyword ?? input.productName,
            downloadScript: script,
            params: {
              topN,
              searchPages,
              minPrice,
              maxPrice,
              speedProfile,
              cdpUrl,
            },
          },
          workDir,
          runDownload: input.fake
            ? async () => {
                const dir = workDir
                const file = join(dir, 'product.xlsx')
                mkdirSync(dir, { recursive: true })
                writeFileSync(file, `demo-product:${input.productName ?? ''}`)

                // 演示模式下按序追加结构化模拟日志，供 parseRpaProgress 解析
                const simulateLog = [
                  `[INFO] 演示模式运行中（离线样本仿真）...`,
                  `=== batch item 1/${topN}`,
                  `[INFO] 抓取第 1 个候选商品元数据完成`,
                  `=== batch item ${Math.max(1, Math.floor(topN / 2))}/${topN}`,
                  `[INFO] 批量抓取中，已处理一半商品列表`,
                  `=== batch item ${topN}/${topN}`,
                  `[INFO] 全部 ${topN} 个商品抓取完成`,
                  `=== batch summary`,
                  `[INFO] 生成导出清单与明细表格: product.xlsx`,
                  `[INFO] 离线演示不写入商品快照`,
                  `[INFO] 采集流程全部成功完成！`,
                ].join('\n') + '\n'

                writeFileSync(logFile, initialLog + simulateLog, 'utf8')
                return { files: [file] }
              }
            : undefined,
        })
      } catch (error) {
        const job = await prisma.localJob.findUnique({ where: { jobId }, select: { status: true } })
        if (job?.status === 'cancelled') return
        logger.error('collection failed', error)
        try {
          const errLog = `\n[${new Date().toISOString()}] [ERROR] 任务异常失败: ${error instanceof Error ? error.message : String(error)}\n`
          writeFileSync(logFile, errLog, { flag: 'a' })
        } catch {}
      } finally {
        if (currentJobId === jobId) { currentJobId = null; running = false }
      }
    })()

    return { jobId, mode, runDir: workDir, logFile, pid: currentPid }
  })

  ipcMain.handle('collection:cancel', async () => {
    if (!running || !currentJobId) {
      return { cancelled: false, reason: '当前无正在运行的采集任务' }
    }
    const targetJobId = currentJobId
    try {
      // 真正终止 Python 子进程，避免后台继续写入结果
      await prisma.localJob.updateMany({
        where: { jobId: targetJobId },
        data: {
          status: 'cancelled',
          errorMessage: '用户手动中止采集任务',
          finishedAt: new Date(),
        },
      })
      killPythonProcesses(targetJobId)
      const workDir = workDirFor(targetJobId)
      const logFile = join(workDir, 'run.log')
      if (existsSync(logFile)) {
        writeFileSync(logFile, `\n[${new Date().toISOString()}] [WARN] 任务已被用户手动停止。\n`, { flag: 'a' })
      }
      return { cancelled: true, jobId: targetJobId }
    } catch (err) {
      return { cancelled: false, reason: String(err) }
    }
  })

  ipcMain.handle('collection:status', async (_event, jobId?: string) => {
    const job = jobId
      ? await prisma.localJob.findUnique({ where: { jobId } })
      : await prisma.localJob.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!job) return null
    const events = await prisma.localJobEvent.findMany({ where: { jobId: job.jobId }, orderBy: { createdAt: 'asc' } })

    const workDir = workDirFor(job.jobId)
    const logFile = join(workDir, 'run.log')
    let logTail = ''
    if (existsSync(logFile)) {
      try {
        const fullContent = readFileSync(logFile, 'utf8')
        logTail = fullContent.slice(-12000)
      } catch {}
    }

    let inputData: Record<string, unknown> = {}
    if (job.inputJson) {
      try {
        inputData = JSON.parse(job.inputJson)
      } catch {}
    }

    return {
      jobId: job.jobId,
      status: job.status,
      type: job.type,
      pid: job.pid ?? (running && job.jobId === currentJobId ? process.pid : null),
      runDir: workDir,
      logFile,
      logTail,
      input: inputData,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      errorMessage: job.errorMessage,
      resultJson: job.resultJson ? JSON.parse(job.resultJson) : null,
      stages: events.map((event) => {
        try {
          return JSON.parse(event.data as string)
        } catch {
          return { status: 'unknown' }
        }
      }),
      sync: events.filter((event) => event.type === 'sync').map((event) => {
        try {
          return JSON.parse(event.data as string)
        } catch {
          return {}
        }
      }),
    }
  })

  ipcMain.handle('collection:list', async (_event, limit = 20) => {
    const jobs = await prisma.localJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 50),
    })
    return jobs.map((job) => {
      let inputData: Record<string, unknown> = {}
      if (job.inputJson) {
        try {
          inputData = JSON.parse(job.inputJson)
        } catch {}
      }
      return {
        id: job.id,
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        pid: job.pid,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt,
        errorMessage: job.errorMessage,
        input: inputData,
      }
    })
  })

  // 暴露 Python 运行时可用性，供前端诊断。
  ipcMain.handle('collection:probe', () => {
    const script = defaultDownloadScript()
    return {
      python: resolveEmbeddedPython(),
      hasDownloadScript: Boolean(script),
      downloadScript: script,
    }
  })

  /** 停止当前登录画面投射，关闭登录 tab，但保留无头 Chromium 与持久化 Profile。 */
  const stopLoginView = async (opts?: { force?: boolean }) => {
    // 防误触：SSO 同步中/已验证但未等用户确认时，阻止立即关闭登录 tab
    if (!opts?.force && shouldBlockClose(loginState, stopByUserRef.current)) {
      stopByUserRef.current = true
      return { ok: false, state: loginState, reason: '登录成功正在同步授权，请稍候片刻再关闭' }
    }
    if (activeLoginScreencast) {
      await activeLoginScreencast.stop()
      activeLoginScreencast = null
    }
    if (activeLoginTarget) {
      const { port, targetId } = activeLoginTarget
      activeLoginTarget = null
      try {
        await closeLoginTarget(port, targetId)
      } catch {}
    }
    clearLoginPolling()
    loginState = 'idle'
    loginSender = null
    stopByUserRef.current = false
    return { ok: true }
  }

  /**
   * 方案 B：复用无头采集容器，在 Electron 右侧 Drawer 投射淘宝登录页。
   * 不关闭 activeChrome、不切换 headless、不创建外部窗口，避免 Profile 锁冲突。
   */
  const openLoginView = async (event: IpcMainInvokeEvent) => {
    await stopLoginView({ force: true })
    const container = await ensureChromiumContainer()
    const target = await createLoginTarget(container.port, 'https://login.taobao.com')
    const sender = event.sender
    const session = connectScreencast(target, {
      onFrame: (frame) => {
        if (!sender.isDestroyed()) sender.send('collection:screencast', frame)
      },
      onClose: (error) => {
        if (!sender.isDestroyed()) {
          sender.send('collection:screencast-status', {
            status: 'closed',
            error: error?.message,
          })
        }
      },
    })
    activeLoginScreencast = session
    activeLoginTarget = { port: container.port, targetId: target.targetId }
    if (!sender.isDestroyed()) {
      sender.send('collection:screencast-status', { status: 'connected' })
    }
    // 启动登录 cookie/轻量验证轮询（修复"扫码成功立即关闭导致 SSO 未完成"根因）
    stopByUserRef.current = false
    startLoginPolling(container.port, sender)
    pushLoginState()
    return {
      ok: true,
      port: container.port,
      targetId: target.targetId,
      viewport: target.viewport,
    }
  }

  ipcMain.handle('collection:openLoginView', openLoginView)
  // 保留旧 IPC 名称作为兼容别名，但行为已切换为方案 B，不再打开外部窗口。
  ipcMain.handle('collection:openLoginWindow', openLoginView)
  ipcMain.handle('collection:stopLoginView', async () => {
    // waiting-sso 中首次请求被拦截，置位 stopByUser；再次请求强制放行（用户确认离开）
    if (shouldBlockClose(loginState, stopByUserRef.current)) {
      const result = await stopLoginView()
      return result
    }
    return stopLoginView({ force: true })
  })
  ipcMain.handle('collection:loginInput', async (_event, input: {
    type: CdpMouseType
    x: number
    y: number
    button?: 'left' | 'right' | 'middle' | 'none'
    clickCount?: number
  }) => {
    if (!activeLoginScreencast?.alive) throw new Error('登录画面投射尚未连接')
    if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) throw new Error('无效的 CDP 输入坐标')
    activeLoginScreencast.dispatchMouse({
      type: input.type,
      x: input.x,
      y: input.y,
      button: input.button,
      clickCount: input.clickCount,
    })
    return { ok: true }
  })
  ipcMain.handle('collection:loginCursor', async (_event, input: { x: number; y: number }) => {
    if (!activeLoginScreencast?.alive) return ''
    if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return ''
    return activeLoginScreencast.queryCursor(input.x, input.y)
  })
  ipcMain.handle('collection:loginKey', async (_event, input: {
    type: CdpKeyType
    key?: string
    code?: string
    text?: string
    windowsVirtualKeyCode?: number
    modifiers?: number
  }) => {
    if (!activeLoginScreencast?.alive) throw new Error('登录画面投射尚未连接')
    activeLoginScreencast.dispatchKey(input)
    return { ok: true }
  })
  ipcMain.handle('collection:loginInsertText', async (_event, text: string) => {
    if (!activeLoginScreencast?.alive) throw new Error('登录画面投射尚未连接')
    if (typeof text !== 'string') throw new Error('无效的文本输入')
    activeLoginScreencast.insertText(text)
    return { ok: true }
  })
  ipcMain.handle('collection:checkLoginStatus', async () => {
    try {
      const container = await ensureChromiumContainer()
      const cookies = await getCookiesFromChrome(container.port)
      const unbCookie = cookies.find((c) => (c.domain.includes('taobao.com') || c.domain.includes('tmall.com')) && c.name === 'unb' && c.value.trim().length > 0)
      const nickCookie = cookies.find((c) => (c.domain.includes('taobao.com') || c.domain.includes('tmall.com')) && (c.name === 'tracknick' || c.name === '_nk_') && c.value.trim().length > 0)

      let nick = ''
      if (nickCookie) {
        try {
          nick = decodeURIComponent(nickCookie.value)
        } catch {
          nick = nickCookie.value
        }
      }

      // 诊断字段：当前为 headless + CDP 驱动（Chrome for Testing），浏览器暴露自动化特征属于可预期的事实。
      // 仅用于日志/排查，不做任何 stealth 隐藏（遵守平台规则与诚实原则）。
      return {
        isLoggedIn: Boolean(unbCookie),
        taobaoUid: unbCookie?.value || '',
        taobaoNick: nick,
        diagnostics: {
          mode: 'headless-cdp',
          webdriverExposed: true,
          note: 'headless 容器暴露 navigator.webdriver=true（诊断用，未做隐藏）',
        },
      }
    } catch (err) {
      logger.warn('checkLoginStatus failed', err)
      return { isLoggedIn: false, taobaoUid: '', taobaoNick: '', diagnostics: { mode: 'error', note: String(err) } }
    }
  })
}
