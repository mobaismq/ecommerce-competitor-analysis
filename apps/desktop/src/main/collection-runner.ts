import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { PrismaClient } from '../generated/prisma'
import { assertCollectionMode, buildCollectionPlan, type CollectionMode, type CollectionStage } from './collection-modes'
import { saveLocalResult, submitResultIfSyncEnabled, type SubmitSyncOptions } from './result-store'
import { runPython } from './python-runner'

export interface CollectionInput {
  productName?: string
  productUrl?: string
  existingFiles?: string[]
  downloadScript?: string
  importScript?: string
  params?: Record<string, unknown>
}

export interface CollectionRunContext {
  jobId: string
  mode: CollectionMode
  workDir: string
  input: CollectionInput
}

export interface CollectionDownloadResult {
  files: string[]
}

export interface CollectionImportResult {
  counts: Record<string, number>
  summary?: string
}

export interface RunCollectionOptions {
  db: PrismaClient
  jobId: string
  mode: CollectionMode
  input: CollectionInput
  workDir: string
  runDownload?: (context: CollectionRunContext) => Promise<CollectionDownloadResult>
  runImport?: (context: CollectionRunContext, files: string[]) => Promise<CollectionImportResult>
  sync?: SubmitSyncOptions
}

export interface CollectionRunResult {
  jobId: string
  mode: CollectionMode
  status: 'success' | 'failure'
  stages: CollectionStage[]
  files: string[]
  counts: Record<string, number>
  resultJson: Record<string, unknown>
  sync?: { submitted: boolean; location: string; status?: number }
}

function mimeForFile(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.xlsx' || ext === '.xls') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.json') return 'application/json'
  if (ext === '.html' || ext === '.htm') return 'text/html'
  return 'application/octet-stream'
}

async function defaultDownloader(context: CollectionRunContext): Promise<CollectionDownloadResult> {
  const script = context.input.downloadScript
  if (!script) throw new Error('download mode requires input.downloadScript or a runDownload injector')
  // 店透视采集脚本(run_diantoushi_rpa_cdp.py)使用 --product-name/--product-url 命名参数。
  const args: string[] = []
  if (context.input.productName) args.push('--product-name', context.input.productName)
  if (context.input.productUrl) args.push('--product-url', context.input.productUrl)
  const result = await runPython(script, args, { cwd: context.workDir })
  if (result.exitCode !== 0) {
    throw new Error(`download script failed (${result.exitCode}): ${result.stderr.trim()}`)
  }
  const lastLine = result.stdout.trim().split(/\r?\n/).pop()
  const parsed = lastLine ? JSON.parse(lastLine) : {}
  const files = Array.isArray(parsed.files) ? parsed.files.map(String) : []
  if (files.length === 0) throw new Error('download script did not report any files')
  return { files }
}

async function defaultImporter(context: CollectionRunContext, files: string[]): Promise<CollectionImportResult> {
  const script = context.input.importScript
  if (!script) throw new Error('import mode requires input.importScript or a runImport injector')
  const result = await runPython(script, files, { cwd: context.workDir })
  if (result.exitCode !== 0) {
    throw new Error(`import script failed (${result.exitCode}): ${result.stderr.trim()}`)
  }
  const lastLine = result.stdout.trim().split(/\r?\n/).pop()
  const parsed = lastLine ? JSON.parse(lastLine) : {}
  const counts: Record<string, number> = {}
  for (const [key, value] of Object.entries(parsed.counts ?? {})) {
    if (typeof value === 'number') counts[key] = value
  }
  return { counts, summary: typeof parsed.summary === 'string' ? parsed.summary : undefined }
}

async function markStage(
  db: PrismaClient,
  localJobId: string,
  stage: CollectionStage,
  status: CollectionStage['status'],
  detail?: string,
) {
  stage.status = status
  await db.localJobEvent.create({
    data: { id: randomUUID(), jobId: localJobId, type: `stage:${stage.name}`, data: JSON.stringify({ status, detail }) },
  })
}

function toFilePayload(files: string[]) {
  return files.map((filePath) => {
    const stat = statSync(filePath)
    return {
      storageKey: filePath,
      mimeType: mimeForFile(filePath),
      size: stat.size,
      originalName: basename(filePath),
    }
  })
}

export async function runLocalCollection(options: RunCollectionOptions): Promise<CollectionRunResult> {
  const mode = assertCollectionMode(options.mode)
  const plan = buildCollectionPlan(mode)
  const prisma = options.db
  const localJobId = options.jobId

  await prisma.localJob.upsert({
    where: { jobId: localJobId },
    update: {
      status: 'running',
      type: `collection:${mode}`,
      inputJson: JSON.stringify({ mode, input: options.input }),
      startedAt: new Date(),
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
    },
    create: {
      id: localJobId,
      jobId: localJobId,
      type: `collection:${mode}`,
      status: 'running',
      inputJson: JSON.stringify({ mode, input: options.input }),
      startedAt: new Date(),
    },
  })

  const result: CollectionRunResult = {
    jobId: localJobId,
    mode,
    status: 'success',
    stages: plan.stages,
    files: [],
    counts: {},
    resultJson: {},
  }

  try {
    for (const stage of plan.stages) {
      await markStage(prisma, localJobId, stage, 'running')
      if (stage.name === 'download') {
        const downloader = options.runDownload ?? defaultDownloader
        const downloaded = await downloader({ jobId: localJobId, mode, workDir: options.workDir, input: options.input })
        result.files = downloaded.files
      } else if (stage.name === 'collect-files') {
        const source = mode === 'import-only' ? (options.input.existingFiles ?? []) : result.files
        const validFiles = source.filter((filePath) => existsSync(filePath))
        if (source.length > 0 && validFiles.length !== source.length) {
          throw new Error(`missing collection files: ${source.filter((filePath) => !existsSync(filePath)).join(', ')}`)
        }
        result.files = validFiles
        for (const filePath of validFiles) {
          const stat = statSync(filePath)
          await prisma.tempFile.upsert({
            where: { path: filePath },
            update: {},
            create: {
              id: randomUUID(),
              jobId: localJobId,
              kind: extname(filePath).replace('.', '') || 'file',
              path: filePath,
              size: stat.size,
              status: 'finished',
            },
          })
        }
      } else if (stage.name === 'import') {
        const importer = options.runImport ?? defaultImporter
        const imported = await importer({ jobId: localJobId, mode, workDir: options.workDir, input: options.input }, result.files)
        result.counts = imported.counts
        result.resultJson.summary = imported.summary
      } else if (stage.name === 'sync') {
        const payload = {
          mode,
          dataSnapshotDate: new Date().toISOString().slice(0, 10),
          files: toFilePayload(result.files),
          products: [],
          counts: result.counts,
        }
        result.resultJson = payload
        if (options.sync) {
          const submitted = await submitResultIfSyncEnabled(localJobId, payload, options.sync)
          result.sync = submitted
          await prisma.localJobEvent.create({
            data: { id: randomUUID(), jobId: localJobId, type: 'sync', data: JSON.stringify(submitted) },
          })
        } else {
          result.sync = { submitted: false, location: 'local-only' }
        }
      }
      await markStage(prisma, localJobId, stage, 'done')
    }

    const resultFile = saveLocalResult(join(options.workDir, 'results'), localJobId, result.resultJson)
    await prisma.localJob.update({
      where: { jobId: localJobId },
      data: {
        status: 'success',
        resultJson: JSON.stringify(result.resultJson),
        finishedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    })
    await prisma.tempFile.upsert({
      where: { path: resultFile },
      update: {},
      create: {
        id: randomUUID(),
        jobId: localJobId,
        kind: 'result',
        path: resultFile,
        size: statSync(resultFile).size,
        status: 'finished',
      },
    })
  } catch (error) {
    result.status = 'failure'
    const message = error instanceof Error ? error.message : String(error)
    await prisma.localJob.update({
      where: { jobId: localJobId },
      data: { status: 'failure', errorCode: 'collection_failed', errorMessage: message, finishedAt: new Date() },
    })
    throw error
  }

  return result
}

export async function syncLocalJobToServer(db: PrismaClient, jobId: string, sync: SubmitSyncOptions) {
  const job = await db.localJob.findUnique({ where: { jobId } })
  if (!job) throw new Error(`local job not found: ${jobId}`)
  if (job.status !== 'success') throw new Error(`local job ${jobId} is not in a syncable state: ${job.status}`)
  const payload = job.resultJson ? (JSON.parse(job.resultJson) as Record<string, unknown>) : {}
  const submitted = await submitResultIfSyncEnabled(jobId, payload, sync)
  await db.localJobEvent.create({
    data: { id: randomUUID(), jobId: job.id, type: 'sync', data: JSON.stringify(submitted) },
  })
  return { job, payload, submitted }
}
