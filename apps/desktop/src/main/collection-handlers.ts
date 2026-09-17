import { randomUUID } from 'node:crypto'
import { app, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { PrismaClient } from '../generated/prisma'
import { assertCollectionMode, type CollectionMode } from './collection-modes'
import { runLocalCollection } from './collection-runner'
import { resolveEmbeddedPython } from './python-runner'

export interface CollectionStartInput {
  productName?: string
  productUrl?: string
  minPrice?: number | null
  maxPrice?: number | null
  topN?: number
  searchPages?: number
  speedProfile?: string
  importMysql?: boolean
  mode?: string
  downloadScript?: string
  /** 开发期注入 fake downloader，避免反复触发真实店透视爬虫。 */
  fake?: boolean
}

/** 采集数据工作目录根：用户数据目录下 collection/<jobId>。 */
function workDirFor(jobId: string): string {
  const base = app.isPackaged ? app.getPath('userData') : join(app.getAppPath(), 'data')
  const dir = join(base, 'collection', jobId)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 解析默认店透视采集脚本路径。 */
function defaultDownloadScript(): string {
  const desktopRoot = resolve(__dirname, '..', '..')
  const script = resolve(desktopRoot, '..', '..', 'skills/diantoushi-product-research/scripts/run_diantoushi_rpa_cdp.py')
  return existsSync(script) ? script : ''
}

export function registerCollectionHandlers(prisma: PrismaClient) {
  let running = false
  let currentJobId: string | null = null

  ipcMain.handle('collection:start', async (_event, input: CollectionStartInput = {}) => {
    if (running) throw new Error('已有采集任务正在运行，请等待完成或停止当前任务')
    const mode = assertCollectionMode(input.mode ?? 'download-and-import')
    const jobId = `local-collection-${Date.now()}-${randomUUID().slice(0, 8)}`
    const workDir = workDirFor(jobId)
    const logFile = join(workDir, 'run.log')
    running = true
    currentJobId = jobId

    const topN = Number(input.topN || 100)
    const searchPages = Number(input.searchPages || 8)
    const minPrice = input.minPrice === '' || input.minPrice == null ? null : Number(input.minPrice)
    const maxPrice = input.maxPrice === '' || input.maxPrice == null ? null : Number(input.maxPrice)
    const speedProfile = ['conservative', 'balanced', 'fast'].includes(String(input.speedProfile || ''))
      ? String(input.speedProfile)
      : 'fast'
    const importMysql = input.importMysql !== false

    const initialLog = [
      `[${new Date().toISOString()}] [INFO] 启动店透视 RPA 采集任务...`,
      `[INFO] 任务编号: ${jobId}`,
      `[INFO] 目标商品: ${input.productName || '默认商品'}`,
      `[INFO] 价格区间: ${minPrice != null ? minPrice : '不限'} ~ ${maxPrice != null ? maxPrice : '不限'} 元`,
      `[INFO] 采集参数: Top ${topN} | 搜索页数: ${searchPages} | 模式: ${mode} | 速率: ${speedProfile}`,
      `[INFO] 工作目录: ${workDir}`,
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

        const script = input.downloadScript ?? defaultDownloadScript()
        await runLocalCollection({
          db: prisma,
          jobId,
          mode,
          input: {
            productName: input.productName,
            productUrl: input.productUrl,
            downloadScript: script,
            params: {
              topN,
              searchPages,
              minPrice,
              maxPrice,
              speedProfile,
              importMysql,
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
                  importMysql ? `=== mysql import\n[INFO] 本地商品快照清洗入库完毕` : `[INFO] 跳过自动入库`,
                  `[INFO] 采集流程全部成功完成！`,
                ].join('\n') + '\n'

                writeFileSync(logFile, initialLog + simulateLog, 'utf8')
                return { files: [file] }
              }
            : undefined,
        })
      } catch (error) {
        console.error('collection failed', error)
        try {
          const errLog = `\n[${new Date().toISOString()}] [ERROR] 任务异常失败: ${error instanceof Error ? error.message : String(error)}\n`
          writeFileSync(logFile, errLog, { flag: 'a' })
        } catch {}
      } finally {
        running = false
        if (currentJobId === jobId) currentJobId = null
      }
    })()

    return { jobId, mode, runDir: workDir, logFile, pid: currentPid }
  })

  ipcMain.handle('collection:cancel', async () => {
    if (!running || !currentJobId) {
      return { cancelled: false, reason: '当前无正在运行的采集任务' }
    }
    const targetJobId = currentJobId
    running = false
    currentJobId = null
    try {
      await prisma.localJob.updateMany({
        where: { jobId: targetJobId },
        data: {
          status: 'cancelled',
          errorMessage: '用户手动中止采集任务',
          finishedAt: new Date(),
        },
      })
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
}
