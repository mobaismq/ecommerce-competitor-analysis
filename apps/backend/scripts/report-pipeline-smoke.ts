import { join, resolve } from 'node:path'
import { AiAuditService } from '../src/ai/ai-audit.service'
import { buildAttemptKey } from '../src/ai/ai.types'
import { ProviderRegistry } from '../src/ai/provider-registry'
import { ProviderRouter } from '../src/ai/provider-router.service'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'
import { ReportService } from '../src/reports/report.service'
import { ReportWorker } from '../src/reports/report.worker'
import { LocalJobQueueService } from '../src/queue/local-job-queue.service'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

async function createReportFixture(prisma: PrismaService, tenantId: string, suffix: string) {
  const job = await prisma.job.create({
    data: { tenantId, type: 'analysis', businessKey: `report-smoke-${suffix}`, status: 'queued', stage: 'queued' },
  })
  const collectionJob = await prisma.collectionJob.create({
    data: { tenantId, jobId: job.id, type: 'analysis', status: 'success' },
  })
  const today = new Date().toISOString().slice(0, 10)
  await prisma.productSnapshot.createMany({
    data: [
      { tenantId, collectionJobId: collectionJob.id, externalProductId: `p1-${suffix}`, price: 99, snapshotTime: new Date(), dataSnapshotDate: today },
      { tenantId, collectionJobId: collectionJob.id, externalProductId: `p2-${suffix}`, price: 199, snapshotTime: new Date(), dataSnapshotDate: today },
      { tenantId, collectionJobId: collectionJob.id, externalProductId: `p3-${suffix}`, price: 299, snapshotTime: new Date(), dataSnapshotDate: today },
    ],
  })
  return { job, collectionJob }
}

async function cleanupFixture(prisma: PrismaService, jobId: string, attemptKeys: string[]) {
  const run = await prisma.analysisRun.findUnique({ where: { jobId } })
  if (run) {
    await prisma.analysisPriceBand.deleteMany({ where: { analysisRunId: run.id } })
    await prisma.analysisInsight.deleteMany({ where: { analysisRunId: run.id } })
    await prisma.analysisRun.deleteMany({ where: { id: run.id } })
  }
  const collection = await prisma.collectionJob.findUnique({ where: { jobId } })
  if (collection) {
    await prisma.productSnapshot.deleteMany({ where: { collectionJobId: collection.id } })
    await prisma.collectionJob.deleteMany({ where: { id: collection.id } })
  }
  await prisma.job.deleteMany({ where: { id: jobId } })
  await prisma.aiUsageLog.deleteMany({ where: { attemptKey: { in: attemptKeys } } })
}

async function directPipeline(prisma: PrismaService, tenantId: string, suffix: string) {
  const registry = new ProviderRegistry()
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, registry, audit)
  const service = new ReportService(prisma, router)
  const { job } = await createReportFixture(prisma, tenantId, suffix)

  const first = await service.runReport({ jobId: job.id, tenantId })
  const run = await prisma.analysisRun.findUnique({ where: { jobId: job.id } })
  const bands = run ? await prisma.analysisPriceBand.findMany({ where: { analysisRunId: run.id } }) : []
  const insights = run ? await prisma.analysisInsight.findMany({ where: { analysisRunId: run.id } }) : []
  const jobAfter = await prisma.job.findUnique({ where: { id: job.id } })

  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'failure', stage: 'reporting', checkpointStage: 'reporting', errorCode: 'simulated' },
  })
  const second = await service.runReport({ jobId: job.id, tenantId })

  const attemptKey = buildAttemptKey({ jobId: job.id, capability: 'text', attempt: 0, suffix: 'report' })
  const usageCount = await prisma.aiUsageLog.count({ where: { attemptKey } })

  const result = {
    first: { reused: first.reused, status: first.status, reportNo: first.reportNo != null, reportHash: first.reportHash != null, competitorCount: first.competitorCount },
    run: { status: run?.status, competitorCount: run?.competitorCount, bandCount: bands.length, insightCount: insights.length },
    jobAfter: { status: jobAfter?.status, stage: jobAfter?.stage, checkpointStage: jobAfter?.checkpointStage },
    second: { reused: second.reused, reportNo: second.reportNo != null },
    usageCount,
  }
  console.log(JSON.stringify(result))

  await cleanupFixture(prisma, job.id, [attemptKey])
  const ok =
    first.reused === false &&
    first.status === 'success' &&
    first.reportNo != null &&
    first.reportHash != null &&
    first.competitorCount === 3 &&
    run?.status === 'success' &&
    run.competitorCount === 3 &&
    bands.length > 0 &&
    insights.length === 1 &&
    jobAfter?.status === 'success' &&
    jobAfter?.stage === 'success' &&
    jobAfter?.checkpointStage === 'reporting' &&
    second.reused === true &&
    usageCount === 1
  return ok
}

async function waitForWorker(prisma: PrismaService, jobId: string, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const row = await prisma.job.findUnique({ where: { id: jobId } })
    if (row?.status === 'success') return row
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`report queue job timeout: ${jobId}`)
}

async function queuePipeline(prisma: PrismaService, tenantId: string, suffix: string) {
  const { job } = await createReportFixture(prisma, tenantId, suffix)

  const localQueue = new LocalJobQueueService(prisma)
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, new ProviderRegistry(), audit)
  const reportService = new ReportService(prisma, router)
  const worker = new ReportWorker(prisma, reportService, localQueue)

  localQueue.registerProcessor('server-report', worker)
  await localQueue.enqueue('server-report', { jobId: job.id, tenantId, type: 'analysis' })
  await localQueue.drain('server-report')

  const done = await waitForWorker(prisma, job.id)
  const finished = done.status === 'success'

  const run = await prisma.analysisRun.findUnique({ where: { jobId: job.id } })
  const result = { finished, reportStatus: run?.status, reportNo: run?.reportNo != null }
  console.log(JSON.stringify(result))

  const attemptKey = buildAttemptKey({ jobId: job.id, capability: 'text', attempt: 0, suffix: 'report' })
  await cleanupFixture(prisma, job.id, [attemptKey])
  return finished && run?.status === 'success' && run.reportNo != null
}

async function main() {
  loadBackendEnv()
  delete process.env.OPENROUTER_API_KEY
  process.env.AI_MOCK_MODEL = 'mock-model'
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing, run pnpm --filter backend db:seed first')

  const suffix = Date.now().toString(36)
  const directOk = await directPipeline(prisma, tenant.id, suffix)
  const queueOk = await queuePipeline(prisma, tenant.id, `${suffix}-q`)
  await prisma.$disconnect()
  console.log(JSON.stringify({ directOk, queueOk }))
  process.exit(directOk && queueOk ? 0 : 1)
}

void main()
