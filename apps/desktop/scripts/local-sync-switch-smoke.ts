import { execFileSync } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalClient } from '../src/main/local-db-core'
import { runLocalCollection, syncLocalJobToServer } from '../src/main/collection-runner'

interface RecordedRequest {
  jobId: string
  body: unknown
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const tmp = join(tmpdir(), `eca-local-sync-switch-${Date.now()}`)
  const dbUrl = `file:${join(tmp, 'sync-switch.db')}`
  const workDir = join(tmp, 'work')
  mkdirSync(workDir, { recursive: true })

  execFileSync(process.execPath, [join(root, 'scripts/apply-local-migration.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DESKTOP_DB_URL: dbUrl },
  })
  const prisma = createLocalClient(dbUrl)

  const requests: RecordedRequest[] = []
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()))
    req.on('end', () => {
      res.setHeader('content-type', 'application/json')
      if (req.method === 'POST' && req.url?.startsWith('/api/collection-jobs/')) {
        const jobId = req.url.split('/')[3] ?? 'unknown'
        requests.push({ jobId, body: JSON.parse(raw) })
        const existing = requests.filter((item) => item.jobId === jobId).length > 1
        res.end(JSON.stringify(existing ? { imported: false, jobId, existing: true } : { imported: true, jobId }))
        return
      }
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'not found' }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const baseUrl = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : ''

  const productFile = join(workDir, 'product.xlsx')
  writeFileSync(productFile, 'product-data')

  const localRun = await runLocalCollection({
    db: prisma,
    jobId: 'job-switch',
    mode: 'download-and-import',
    input: { productName: '开关测试' },
    workDir,
    runDownload: async () => ({ files: [productFile] }),
    runImport: async (_ctx, files) => ({ counts: { productCount: 1, fileCount: files.length } }),
  })
  const requestsBeforeSync = requests.length
  const fileStillLocal = existsSync(productFile)
  const localJobBefore = await prisma.localJob.findUnique({ where: { jobId: 'job-switch' } })

  const firstSync = await syncLocalJobToServer(prisma, 'job-switch', {
    category: 'collection',
    enabled: true,
    baseUrl,
  })
  const secondSync = await syncLocalJobToServer(prisma, 'job-switch', {
    category: 'collection',
    enabled: true,
    baseUrl,
  })

  const output = {
    localOnlySubmitted: localRun.sync,
    requestsBeforeSync,
    fileStillLocal,
    localJobStatusBefore: localJobBefore?.status,
    firstSync: firstSync.submitted,
    secondSync: secondSync.submitted,
    serverRequests: requests.length,
    serverJobIds: requests.map((item) => item.jobId),
  }
  console.log(JSON.stringify(output))

  const localJobAfter = await prisma.localJob.findUnique({
    where: { jobId: 'job-switch' },
    include: { events: true, tempFiles: true },
  })
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await prisma.$disconnect()
  rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const syncEvents = localJobAfter?.events.filter((event) => event.type === 'sync').length ?? 0
  const ok =
    output.localOnlySubmitted?.submitted === false &&
    output.localOnlySubmitted?.location === 'local-only' &&
    output.requestsBeforeSync === 0 &&
    output.fileStillLocal &&
    output.localJobStatusBefore === 'success' &&
    output.firstSync.submitted === true &&
    output.secondSync.submitted === true &&
    output.serverRequests === 2 &&
    output.serverJobIds.every((jobId) => jobId === 'job-switch') &&
    syncEvents >= 2 &&
    localJobAfter !== null &&
    localJobAfter.resultJson !== null &&
    localJobAfter.tempFiles.length > 0
  process.exit(ok ? 0 : 1)
}

void main()
