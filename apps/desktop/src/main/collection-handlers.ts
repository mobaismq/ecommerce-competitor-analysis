import { randomUUID } from 'node:crypto'
import { app, BrowserWindow, ipcMain } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { PrismaClient } from '../generated/prisma'
import { closeChrome, launchChromeForRpa, setDownloadBehavior, type LaunchedChrome } from './chrome'
import { assertCollectionMode, type CollectionMode } from './collection-modes'
import { runLocalCollection } from './collection-runner'
import { resolveDataRoots } from './data-root'
import { logger } from './logger'
import { resolveEmbeddedPython, killPythonProcesses } from './python-runner'

let activeChrome: LaunchedChrome | null = null

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

  // 方案 A：供前端侧边抽屉一键唤起独立登录扫码窗口
  ipcMain.handle('collection:openLoginWindow', async () => {
    if (activeChrome) {
      try {
        closeChrome(activeChrome)
      } catch {}
      activeChrome = null
    }

    // 获取当前主窗口几何坐标，让扫码窗口紧贴主窗口右侧
    const allWindows = BrowserWindow.getAllWindows()
    const mainWin = allWindows.find((w) => !w.isDestroyed())
    const bounds = mainWin?.getBounds() ?? { x: 200, y: 150, width: 1100, height: 750 }

    const popupX = Math.round(bounds.x + bounds.width + 10)
    const popupY = Math.round(bounds.y)
    const popupW = 460
    const popupH = Math.round(bounds.height)

    const loginWin = await launchChromeForRpa({
      headless: false,
      persistent: true,
      url: 'https://login.taobao.com',
      extraArgs: [
        `--app=https://login.taobao.com`,
        `--window-position=${popupX},${popupY}`,
        `--window-size=${popupW},${popupH}`,
      ],
    })
    activeChrome = loginWin
    return { ok: true, port: loginWin.port }
  })
}
