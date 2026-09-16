import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { AiAuditService } from '../src/ai/ai-audit.service'
import { ProviderRegistry } from '../src/ai/provider-registry'
import { ProviderRouter } from '../src/ai/provider-router.service'
import { loadBackendEnv } from '../src/env'
import { ImageFlowService, MAX_REGENERATE } from '../src/images/image.service'
import { PrismaService } from '../src/prisma.service'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

interface FakeQueueService {
  addJob: () => Promise<{ ok: true }>
}

async function createImageJob(prisma: PrismaService, tenantId: string, suffix: string) {
  const job = await prisma.job.create({
    data: { tenantId, type: 'image_gen', businessKey: `image-flow-${suffix}`, status: 'queued', stage: 'queued' },
  })
  await prisma.jobEvent.create({
    data: { jobId: job.id, type: 'image-prompt', data: { prompt: `为 ${job.id} 生成白底主图`, model: 'mock' } },
  })
  return job
}

async function cleanupImageJob(prisma: PrismaService, jobId: string) {
  const reviews = await prisma.reviewRecord.findMany({ where: { jobId }, select: { id: true } })
  const assets = await prisma.generatedAsset.findMany({ where: { jobId }, select: { id: true } })
  await prisma.reviewRecord.deleteMany({ where: { id: { in: reviews.map((item) => item.id) } } })
  await prisma.generatedAsset.deleteMany({ where: { id: { in: assets.map((item) => item.id) } } })
  await prisma.jobEvent.deleteMany({ where: { jobId } })
  await prisma.job.deleteMany({ where: { id: jobId } })
}

async function directFlow(prisma: PrismaService, tenantId: string, suffix: string) {
  const registry = new ProviderRegistry()
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, registry, audit)
  const queueService: FakeQueueService = { addJob: async () => ({ ok: true }) }
  const service = new ImageFlowService(prisma, router, queueService as never)
  const job = await createImageJob(prisma, tenantId, suffix)

  const generated = await service.generate({ jobId: job.id, tenantId })
  const asset = await prisma.generatedAsset.findUnique({ where: { id: generated.assetId } })
  const review = await prisma.reviewRecord.findUnique({ where: { id: generated.reviewId } })
  const fileExists = existsSync(generated.absolutePath)
  const jobAfterGenerate = await prisma.job.findUnique({ where: { id: job.id } })

  const approved = await service.decideReview({ reviewId: review!.id, decision: 'approved', reviewerId: 'smoke-reviewer' })
  const jobAfterApprove = await prisma.job.findUnique({ where: { id: job.id } })

  let rejectedDecision: string | null = null
  const rejectedJob = await createImageJob(prisma, tenantId, `${suffix}-reject`)
  const rejectedGenerate = await service.generate({ jobId: rejectedJob.id, tenantId })
  const rejectedReview = await prisma.reviewRecord.findUnique({ where: { id: rejectedGenerate.reviewId } })
  await service.decideReview({ reviewId: rejectedReview!.id, decision: 'rejected', reviewerId: 'smoke-reviewer' })
  const rejectedJobRow = await prisma.job.findUnique({ where: { id: rejectedJob.id } })
  rejectedDecision = rejectedJobRow?.status ?? null

  let limitReached = false
  const limitJob = await createImageJob(prisma, tenantId, `${suffix}-limit`)
  const limitReviews = []
  for (let index = 0; index <= MAX_REGENERATE; index += 1) {
    const row = await prisma.reviewRecord.create({
      data: { tenantId, jobId: limitJob.id, assetId: asset!.id, reviewType: 'generated_image', decision: 'pending' },
    })
    limitReviews.push(row)
  }
  for (let index = 0; index <= MAX_REGENERATE; index += 1) {
    try {
      await service.decideReview({ reviewId: limitReviews[index].id, decision: 'regenerate', reviewerId: 'smoke-reviewer' })
    } catch {
      if (index === MAX_REGENERATE) limitReached = true
    }
  }
  const limitJobRow = await prisma.job.findUnique({ where: { id: limitJob.id } })

  const output = {
    generate: { asset: asset?.storageKey != null, review: review?.decision, fileExists, jobStage: jobAfterGenerate?.stage },
    approved: { decision: approved.decision, jobStatus: jobAfterApprove?.status },
    rejected: { jobStatus: rejectedDecision },
    regenerate: { limitReached, jobStatus: limitJobRow?.status, regenerateCount: MAX_REGENERATE + 1 },
  }
  console.log(JSON.stringify(output))

  await cleanupImageJob(prisma, job.id)
  await cleanupImageJob(prisma, rejectedJob.id)
  await cleanupImageJob(prisma, limitJob.id)
  const ok =
    asset?.storageKey != null &&
    review?.decision === 'pending' &&
    fileExists &&
    jobAfterGenerate?.stage === 'reviewing' &&
    approved.decision === 'approved' &&
    jobAfterApprove?.status === 'success' &&
    rejectedDecision === 'success' &&
    limitReached &&
    limitJobRow?.status === 'failure'
  return ok
}

async function waitForReview(prisma: PrismaService, jobId: string, timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const review = await prisma.reviewRecord.findFirst({ where: { jobId } })
    if (review) return review
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`image queue job timeout: ${jobId}`)
}

async function queueFlow(prisma: PrismaService, tenantId: string, suffix: string) {
  execFileSync('pnpm', ['--filter', 'backend', 'build'], { cwd: workspaceRoot, stdio: 'inherit' })
  const job = await createImageJob(prisma, tenantId, `${suffix}-queue`)
  const connection = new IORedis('redis://127.0.0.1:6380', { maxRetriesPerRequest: null })
  const queue = new Queue('server-image-gen', { connection })
  await queue.add('generate', { jobId: job.id, tenantId, type: 'image_gen' }, { jobId: job.id })

  let worker: ChildProcess | null = null
  let reviewId = ''
  try {
    worker = spawn('node', ['dist/src/worker.js'], { cwd: backendRoot, stdio: 'ignore' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const review = await waitForReview(prisma, job.id)
    reviewId = review.id
  } finally {
    if (worker && !worker.killed) worker.kill('SIGTERM')
    await queue.close()
    await connection.quit()
  }

  const asset = await prisma.generatedAsset.findFirst({ where: { jobId: job.id } })
  const output = { reviewCreated: reviewId !== '', assetCreated: asset != null, storageKey: asset?.storageKey != null }
  console.log(JSON.stringify(output))
  await cleanupImageJob(prisma, job.id)
  return output.reviewCreated && output.assetCreated && output.storageKey
}

async function main() {
  loadBackendEnv()
  const assetDir = join(tmpdir(), `eca-image-flow-${Date.now()}`)
  mkdirSync(assetDir, { recursive: true })
  process.env.MOCK_ASSET_DIR = assetDir
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)
  const directOk = await directFlow(prisma, tenant.id, suffix)
  const queueOk = await queueFlow(prisma, tenant.id, suffix)
  await prisma.$disconnect()
  rmSync(assetDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  console.log(JSON.stringify({ directOk, queueOk }))
  process.exit(directOk && queueOk ? 0 : 1)
}

void main()
