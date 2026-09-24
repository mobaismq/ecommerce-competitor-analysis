import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { AiAuditService } from '../src/ai/ai-audit.service'
import { ProviderRegistry } from '../src/ai/provider-registry'
import { ProviderRouter } from '../src/ai/provider-router.service'
import type { AiProvider } from '../src/ai/ai.types'
import { loadBackendEnv } from '../src/env'
import { ImageFlowService, MAX_REGENERATE } from '../src/images/image.service'
import { ImageGenWorker } from '../src/images/image.worker'
import { LocalJobQueueService } from '../src/queue/local-job-queue.service'
import { PrismaService } from '../src/prisma.service'
import { StorageDriverService } from '../src/storage/storage.service'

const backendRoot = resolve(__dirname, '..')

// 1x1 透明 PNG，作为离线 smoke 的"真实图像字节"，走完整落盘链路（非 mock:// 伪造）。
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function smokeProviderRegistry(): ProviderRegistry {
  const provider: AiProvider = {
    type: 'mock',
    supports: (capability) => capability === 'text' || capability === 'vision' || capability === 'image',
    generateText: async (request) => ({ status: 'success', text: `mock-reply:${request.prompt.slice(0, 32)}`, model: 'smoke-image', durationMs: 1 }),
    analyzeImage: async (request) => ({ status: 'success', text: `mock-vision:${request.prompt.slice(0, 32)}`, model: 'smoke-image', durationMs: 1 }),
    generateImage: async (request) => ({ status: 'success', images: [TINY_PNG], model: 'smoke-image', durationMs: 1, rawPayload: { kind: 'smoke-image', fake: true } }),
  }
  const registry = new ProviderRegistry()
  registry.register('mock', () => provider)
  return registry
}

interface FakeQueueService {
  addJob: () => Promise<{ ok: true }>
  enqueue: () => Promise<void>
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

async function directFlow(prisma: PrismaService, tenantId: string, suffix: string, storage: StorageDriverService) {
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, smokeProviderRegistry(), audit)
  const queueService: FakeQueueService = { addJob: async () => ({ ok: true }), enqueue: async () => undefined }
  const service = new ImageFlowService(prisma, router, queueService as never, storage)
  const job = await createImageJob(prisma, tenantId, suffix)

  const generated = await service.generate({ jobId: job.id, tenantId })
  const asset = await prisma.generatedAsset.findUnique({ where: { id: generated.assetId } })
  const review = await prisma.reviewRecord.findUnique({ where: { id: generated.reviewId } })
  const persisted = await storage.getDriver().head(asset!.storageKey)
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
    generate: { asset: asset?.storageKey != null, review: review?.decision, persisted: persisted != null, jobStage: jobAfterGenerate?.stage },
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
    persisted != null &&
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

async function queueFlow(prisma: PrismaService, tenantId: string, suffix: string, storage: StorageDriverService) {
  const job = await createImageJob(prisma, tenantId, `${suffix}-queue`)
  const localQueue = new LocalJobQueueService(prisma)
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, smokeProviderRegistry(), audit)
  const imageService = new ImageFlowService(prisma, router, localQueue, storage)
  const worker = new ImageGenWorker(prisma, imageService, {} as any, localQueue)
  localQueue.registerProcessor('server-image-gen', worker)

  await localQueue.enqueue('server-image-gen', { jobId: job.id, tenantId, type: 'image_gen' })
  await localQueue.drain('server-image-gen')

  const review = await waitForReview(prisma, job.id)
  const reviewId = review.id

  const asset = await prisma.generatedAsset.findFirst({ where: { jobId: job.id } })
  const persisted = asset ? await storage.getDriver().head(asset.storageKey) : null
  const output = { reviewCreated: reviewId !== '', assetCreated: asset != null, storageKey: asset?.storageKey != null, persisted: persisted != null }
  console.log(JSON.stringify(output))
  await cleanupImageJob(prisma, job.id)
  return output.reviewCreated && output.assetCreated && output.storageKey && output.persisted
}

async function main() {
  loadBackendEnv()
  delete process.env.OPENROUTER_API_KEY
  process.env.AI_MOCK_MODEL = 'mock-model'
  const assetDir = join(tmpdir(), `eca-image-flow-${Date.now()}`)
  mkdirSync(assetDir, { recursive: true })
  // smoke 离线跑：图像落本地磁盘，不真上 COS。
  process.env.STORAGE_DRIVER = 'local'
  process.env.STORAGE_LOCAL_DIR = assetDir
  const storage = new StorageDriverService()
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)
  const directOk = await directFlow(prisma, tenant.id, suffix, storage)
  const queueOk = await queueFlow(prisma, tenant.id, suffix, storage)
  await prisma.$disconnect()
  rmSync(assetDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  console.log(JSON.stringify({ directOk, queueOk }))
  process.exit(directOk && queueOk ? 0 : 1)
}

void main()