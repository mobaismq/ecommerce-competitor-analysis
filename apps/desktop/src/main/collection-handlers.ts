import { randomUUID } from 'node:crypto'
import { app, ipcMain } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { PrismaClient } from '../generated/prisma'
import { assertCollectionMode, type CollectionMode } from './collection-modes'
import { runLocalCollection } from './collection-runner'
import { resolveEmbeddedPython } from './python-runner'

export interface CollectionStartInput {
  productName?: string
  productUrl?: string
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
  // 单任务互斥：同时只允许一个采集任务。
  let running = false

  ipcMain.handle('collection:start', async (_event, input: CollectionStartInput = {}) => {
    if (running) throw new Error('已有采集任务正在运行，请等待完成')
    const mode = assertCollectionMode(input.mode ?? 'download-and-import')
    const jobId = `local-collection-${Date.now()}-${randomUUID().slice(0, 8)}`
    running = true

    // 不阻塞 IPC：异步执行，调用方用 collection:status 轮询。
    void (async () => {
      try {
        const script = input.downloadScript ?? defaultDownloadScript()
        await runLocalCollection({
          db: prisma,
          jobId,
          mode,
          input: { productName: input.productName, productUrl: input.productUrl, downloadScript: script },
          workDir: workDirFor(jobId),
          runDownload: input.fake
            ? async () => {
                const dir = workDirFor(jobId)
                const file = join(dir, 'product.xlsx')
                mkdirSync(dir, { recursive: true })
                writeFileSync(file, `demo-product:${input.productName ?? ''}`)
                return { files: [file] }
              }
            : undefined,
        })
      } catch (error) {
        console.error('collection failed', error)
      } finally {
        running = false
      }
    })()

    return { jobId, mode }
  })

  ipcMain.handle('collection:cancel', () => {
    // runLocalCollection 当前不支持子进程级中断；这里标记互斥可在下一轮 start 前复位。
    return { cancelled: false, reason: '采集任务为一次性执行，需等待其自然完成' }
  })

  ipcMain.handle('collection:status', async (_event, jobId?: string) => {
    const job = jobId
      ? await prisma.localJob.findUnique({ where: { jobId } })
      : await prisma.localJob.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!job) return null
    const events = await prisma.localJobEvent.findMany({ where: { jobId: job.jobId }, orderBy: { createdAt: 'asc' } })
    return {
      jobId: job.jobId,
      status: job.status,
      type: job.type,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      errorMessage: job.errorMessage,
      resultJson: job.resultJson ? JSON.parse(job.resultJson) : null,
      stages: events.map((event) => JSON.parse(event.data as string)),
      sync: events.filter((event) => event.type === 'sync').map((event) => JSON.parse(event.data as string)),
    }
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
