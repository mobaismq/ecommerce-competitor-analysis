import { randomUUID } from 'node:crypto'
import { app, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { PrismaClient } from '../generated/prisma'
import {
  closeChrome,
  getCookiesFromChrome,
  isBrowserCdpHealthy,
  launchChromeForRpa,
  probeSystemChrome,
  setDownloadBehavior,
  type LaunchedChrome,
} from './chrome'
import { assertCollectionMode, type CollectionMode } from './collection-modes'
import { runLocalCollection } from './collection-runner'
import { resolveDataRoots } from './data-root'
import { logger } from './logger'
import { resolveEmbeddedPython, killPythonProcesses } from './python-runner'
import { closeLoginTarget, createLoginTarget } from './screencast'
import { shouldBlockClose, type LoginAuthState } from './login-auth-state'

let activeChrome: LaunchedChrome | null = null
/** 当前登录 Tab 所在的容器端口与 targetId，停止时一并关闭，避免累积。 */
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

/** 启动登录态轮询：检测 unb 出现 → waiting-sso → 跳转完成或跨域 Cookie 稳定后立即转为 verified。 */
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
      const hasUnb = cookies.some(
        (c) => (c.domain.includes('taobao.com') || c.domain.includes('tmall.com')) && c.name === 'unb' && c.value.trim().length > 0
      )
      const hasSession = cookies.some(
        (c) => c.domain.includes('taobao.com') && (c.name === 'cookie2' || c.name === '_tb_token_') && c.value.trim().length > 0
      )

      if (!hasUnb) {
        stableCount = 0
        if (loginState !== 'opening') {
          loginState = 'opening'
          pushLoginState()
        }
        return
      }

      // 检查当前登录 Tab 的 URL：若已跳出登录页（例如跳转到 i.taobao.com 或 www.taobao.com），说明 SSO 已经完成
      let hasRedirected = false
      try {
        const listResp = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => [])
        const currentTarget = Array.isArray(listResp)
          ? listResp.find((t: { id?: string }) => t.id === activeLoginTarget?.targetId)
          : null
        const currentUrl = currentTarget?.url || ''
        if (currentUrl && !currentUrl.includes('login.taobao.com') && (currentUrl.includes('taobao.com') || currentUrl.includes('tmall.com'))) {
          hasRedirected = true
        }
      } catch {}

      // 初次检测到 unb：进入 waiting-sso 等待状态
      if (loginState === 'opening') {
        loginState = 'waiting-sso'
        stableCount = 1
        pushLoginState()
        // 若页面已经跳转完成且有 session cookie，无需等待直接通过
        if (hasRedirected && hasSession) {
          loginState = 'verified'
          pushLoginState()
          clearLoginPolling()
        }
        return
      }

      stableCount += 1
      // 满足任意一条即判定授权完成：1) 页面已完成跳转且持有 session；2) unb 与 session 持续稳定 2 秒以上
      if (loginState === 'waiting-sso') {
        if ((hasRedirected && hasSession) || (stableCount >= 2 && hasSession)) {
          loginState = 'verified'
          pushLoginState()
          clearLoginPolling()
        }
      }
    } catch {
      // 容器健康抖动：保持当前状态，下轮重试
    }
  }, 1000)
}

const clearLoginPolling = () => {
  if (loginPollTimer) {
    clearInterval(loginPollTimer)
    loginPollTimer = null
  }
}

export async function ensureChromiumContainer(downloadPath?: string): Promise<LaunchedChrome> {
  if (activeChrome) {
    // 缓存实例同样要过完整健康判据：仅 /json/version 通不代表能采集
    // （用户关掉窗口后 Chrome 进程仍在，会留下 0 page target 的空壳实例）。
    if (await isBrowserCdpHealthy(activeChrome.port)) {
      if (downloadPath) {
        try {
          await setDownloadBehavior(activeChrome.port, downloadPath)
        } catch {}
      }
      return activeChrome
    }
    activeChrome = null
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

/** 安全探测系统 Chrome 安装状态 */
export async function handleProbeChrome() {
  return await probeSystemChrome()
}

/** 安全唤起宿主系统的默认浏览器打开外部网页 */
export async function handleOpenExternalUrl(url: string) {
  if (typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('http://'))) {
    throw new Error('仅允许打开合法的 http/https 链接')
  }
  await shell.openExternal(url)
  return { ok: true }
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
    const script = input.downloadScript ?? defaultDownloadScript()
    if (!input.fake) {
      if (!script) throw new Error('未找到店透视采集脚本')
      const chromeProbe = await probeSystemChrome()
      if (!chromeProbe.installed) {
        throw new Error('CHROME_NOT_FOUND: 本机尚未安装官方 Google Chrome 浏览器，无法启动自动化采集')
      }
    }

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
            const containerLog = `[INFO] 宿主系统真实 Google Chrome 容器已就绪 (CDP: ${cdpUrl}, 独立资料: real-chrome-profile)\n[INFO] 淘宝有头交互窗口已就绪，如遇偶发安全验证可直接在 Chrome 窗口中滑动完成自愈\n`
            appendFileSync(logFile, containerLog)
          } catch (containerErr) {
            logger.warn('启动系统 Google Chrome 容器异常:', containerErr)
            appendFileSync(logFile, `[WARN] 启动系统 Google Chrome 容器警告: ${containerErr instanceof Error ? containerErr.message : String(containerErr)}\n`)
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

  // 暴露系统 Chrome 浏览器感知诊断，供前端判断是否需要提示安装
  ipcMain.handle('collection:probeChrome', async () => {
    return await handleProbeChrome()
  })

  // 安全唤起宿主系统的默认浏览器打开外部网页（如 Chrome 官方下载地址）
  ipcMain.handle('collection:openExternalUrl', async (_event, url: string) => {
    return await handleOpenExternalUrl(url)
  })

  /** 关闭当前登录 Tab（保留持久化 Profile 与真实 Chrome 容器）。 */
  const stopLoginView = async (opts?: { force?: boolean }) => {
    // 防误触：SSO 同步中/已验证但未等用户确认时，阻止立即关闭登录 tab
    if (!opts?.force && shouldBlockClose(loginState, stopByUserRef.current)) {
      stopByUserRef.current = true
      return { ok: false, state: loginState, reason: '登录成功正在同步授权，请稍候片刻再关闭' }
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
   * 方案 A：在真实有头 Chrome 窗口中打开淘宝登录页，用户直接在真实窗口扫码。
   * 桌面端仅保留登录状态轮询与状态推送（opening/waiting-sso/verified），不再投屏。
   */
  const openLoginView = async (event: IpcMainInvokeEvent) => {
    await stopLoginView({ force: true })
    const container = await ensureChromiumContainer()
    const target = await createLoginTarget(container.port, 'https://login.taobao.com')
    // 激活登录 tab 并将真实 Chrome 窗口前置，让用户直接看到登录页
    try {
      await fetch(`http://127.0.0.1:${container.port}/json/activate/${encodeURIComponent(target.targetId)}`)
    } catch {}
    activeLoginTarget = { port: container.port, targetId: target.targetId }
    // 启动登录 cookie/轻量验证轮询（修复"扫码成功立即关闭导致 SSO 未完成"根因）
    stopByUserRef.current = false
    startLoginPolling(container.port, event.sender)
    pushLoginState()
    return {
      ok: true,
      port: container.port,
      targetId: target.targetId,
    }
  }

  ipcMain.handle('collection:openLoginView', openLoginView)
  // 保留旧 IPC 名称作为兼容别名（方案 A：真实 Chrome 窗口直登）。
  ipcMain.handle('collection:openLoginWindow', openLoginView)
  ipcMain.handle('collection:stopLoginView', async () => {
    // waiting-sso 中首次请求被拦截，置位 stopByUser；再次请求强制放行（用户确认离开）
    if (shouldBlockClose(loginState, stopByUserRef.current)) {
      const result = await stopLoginView()
      return result
    }
    return stopLoginView({ force: true })
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

      // 诊断字段：当前为宿主系统真实 Google Chrome 有头运行（专用 real-chrome-profile），
      // 官方签名浏览器 + 真实 GPU，无自动化指纹伪装；仅用于日志/排查，不做任何 stealth 隐藏。
      return {
        isLoggedIn: Boolean(unbCookie),
        taobaoUid: unbCookie?.value || '',
        taobaoNick: nick,
        diagnostics: {
          mode: 'system-chrome-headed',
          webdriverExposed: false,
          note: '宿主系统真实 Chrome 有头运行（real-chrome-profile 独立目录，官方签名与真实 GPU，无自动化伪装）',
        },
      }
    } catch (err) {
      logger.warn('checkLoginStatus failed', err)
      return { isLoggedIn: false, taobaoUid: '', taobaoNick: '', diagnostics: { mode: 'error', note: String(err) } }
    }
  })
}
