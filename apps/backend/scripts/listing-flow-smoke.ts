import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { join, resolve } from 'node:path'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { loadBackendEnv } from '../src/env'
import { ListingFlowService } from '../src/listings/listing.service'
import { PlatformAdapterService } from '../src/platform/platform.service'
import { PlatformRegistry } from '../src/platform/platform-registry'
import type { PlatformAdapter, PlatformCategory, PlatformListingInput, PlatformListingResult, PlatformMethod, PlatformShop } from '../src/platform/platform.types'
import { PrismaService } from '../src/prisma.service'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

class FailingPlatformAdapter implements PlatformAdapter {
  readonly code = 'failing-platform'

  supports(_method: PlatformMethod) {
    return true
  }

  async fetchCategories(): Promise<PlatformCategory[]> {
    return []
  }

  async fetchShops(): Promise<PlatformShop[]> {
    return []
  }

  async submitListing(_input: PlatformListingInput): Promise<PlatformListingResult> {
    return { status: 'failure', error: 'simulated listing failure', rawPayload: { kind: 'failing' } }
  }
}

async function createGenAsset(prisma: PrismaService, tenantId: string, suffix: string) {
  const genJob = await prisma.job.create({
    data: { tenantId, type: 'image_gen', businessKey: `gen-${suffix}`, status: 'success', stage: 'success', finishedAt: new Date() },
  })
  const asset = await prisma.generatedAsset.create({
    data: {
      tenantId,
      jobId: genJob.id,
      runId: genJob.id,
      storageKey: `mock-assets/${suffix}.png`,
      mimeType: 'image/png',
      size: 1,
    },
  })
  return { genJob, asset }
}

async function createListingJob(prisma: PrismaService, tenantId: string, suffix: string) {
  return prisma.job.create({
    data: { tenantId, type: 'listing', businessKey: `listing-${suffix}`, status: 'queued', stage: 'queued' },
  })
}

async function cleanupListing(prisma: PrismaService, jobId: string, genJobId?: string) {
  await prisma.listingDraft.deleteMany({ where: { jobId } })
  await prisma.jobEvent.deleteMany({ where: { jobId } })
  await prisma.job.deleteMany({ where: { id: jobId } })
  if (genJobId) {
    await prisma.generatedAsset.deleteMany({ where: { jobId: genJobId } })
    await prisma.job.deleteMany({ where: { id: genJobId } })
  }
}

async function directFlow(prisma: PrismaService, tenantId: string, suffix: string) {
  const registry = new PlatformRegistry()
  registry.register('failing-platform', () => new FailingPlatformAdapter())
  const platformService = new PlatformAdapterService(prisma, registry)
  const service = new ListingFlowService(prisma, platformService)
  const { genJob, asset } = await createGenAsset(prisma, tenantId, suffix)
  const job = await createListingJob(prisma, tenantId, suffix)

  const uploaded = await service.uploadAssets({ jobId: job.id, tenantId })
  const draftAfterUpload = await prisma.listingDraft.findUnique({ where: { jobId: job.id } })
  const jobAfterUpload = await prisma.job.findUnique({ where: { id: job.id } })

  const submitted = await service.submit({ jobId: job.id, tenantId, platformCode: 'mock' })
  const draftAfterSubmit = await prisma.listingDraft.findUnique({ where: { jobId: job.id } })
  const jobAfterSubmit = await prisma.job.findUnique({ where: { id: job.id } })

  const failJob = await createListingJob(prisma, tenantId, `${suffix}-fail`)
  await service.uploadAssets({ jobId: failJob.id, tenantId })
  let failureMessage = ''
  try {
    await service.submit({ jobId: failJob.id, tenantId, platformCode: 'failing-platform' })
  } catch (error) {
    failureMessage = error instanceof Error ? error.message : String(error)
  }
  const failJobRow = await prisma.job.findUnique({ where: { id: failJob.id } })
  const failDraft = await prisma.listingDraft.findUnique({ where: { jobId: failJob.id } })

  await service.uploadAssets({ jobId: failJob.id, tenantId })
  const retried = await service.submit({ jobId: failJob.id, tenantId, platformCode: 'mock' })
  const retriedJob = await prisma.job.findUnique({ where: { id: failJob.id } })

  const output = {
    upload: { assetCount: uploaded.assetCount, draftStatus: draftAfterUpload?.status, jobStage: jobAfterUpload?.stage, assetReferenced: (draftAfterUpload?.contentJson as { assetIds?: string[] } | null)?.assetIds?.includes(asset.id) ?? false },
    submit: { status: submitted.status, draftStatus: draftAfterSubmit?.status, jobStatus: jobAfterSubmit?.status },
    failure: { message: failureMessage, jobStatus: failJobRow?.status, errorCode: failJobRow?.errorCode, draftStatus: failDraft?.status },
    retry: { status: retried.status, jobStatus: retriedJob?.status },
  }
  console.log(JSON.stringify(output))

  await cleanupListing(prisma, job.id, genJob.id)
  await cleanupListing(prisma, failJob.id)
  const ok =
    output.upload.assetCount === 1 &&
    output.upload.draftStatus === 'assets_uploaded' &&
    output.upload.jobStage === 'uploading_assets' &&
    output.upload.assetReferenced &&
    output.submit.status === 'success' &&
    output.submit.draftStatus === 'submitted' &&
    output.submit.jobStatus === 'success' &&
    failureMessage.includes('simulated listing failure') &&
    output.failure.jobStatus === 'failure' &&
    output.failure.errorCode === 'LISTING_SUBMIT_FAILED' &&
    output.failure.draftStatus === 'failed' &&
    output.retry.status === 'success' &&
    output.retry.jobStatus === 'success'
  return ok
}

async function pollUntil(prisma: PrismaService, check: () => Promise<boolean>, timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await check()) return true
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

async function queueFlow(prisma: PrismaService, tenantId: string, suffix: string) {
  execFileSync('pnpm', ['--filter', 'backend', 'build'], { cwd: workspaceRoot, stdio: 'inherit' })
  const { genJob } = await createGenAsset(prisma, tenantId, `${suffix}-queue`)
  const job = await createListingJob(prisma, tenantId, `${suffix}-queue`)
  const connection = new IORedis('redis://127.0.0.1:6380', { maxRetriesPerRequest: null })
  const imageQueue = new Queue('server-image-gen', { connection })
  const listingQueue = new Queue('server-listing', { connection })
  await imageQueue.add('upload-assets', { jobId: job.id, tenantId, type: 'listing' }, { jobId: job.id })

  let worker: ChildProcess | null = null
  let ok = false
  try {
    worker = spawn('node', ['dist/src/worker.js'], { cwd: backendRoot, stdio: 'ignore' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const uploaded = await pollUntil(prisma, async () => {
      const draft = await prisma.listingDraft.findUnique({ where: { jobId: job.id } })
      return draft?.status === 'assets_uploaded'
    })
    if (!uploaded) throw new Error('upload-assets queue timeout')
    await listingQueue.add('submit', { jobId: job.id, tenantId, type: 'listing' }, { jobId: job.id })
    const submitted = await pollUntil(prisma, async () => {
      const row = await prisma.job.findUnique({ where: { id: job.id } })
      return row?.status === 'success'
    })
    const draft = await prisma.listingDraft.findUnique({ where: { jobId: job.id } })
    ok = submitted && draft?.status === 'submitted'
  } finally {
    if (worker && !worker.killed) worker.kill('SIGTERM')
    await imageQueue.close()
    await listingQueue.close()
    await connection.quit()
    await cleanupListing(prisma, job.id, genJob.id)
  }

  const output = { ok }
  console.log(JSON.stringify(output))
  return ok
}

async function main() {
  loadBackendEnv()
  process.env.PLATFORM_MOCK = 'true'
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)
  const directOk = await directFlow(prisma, tenant.id, suffix)
  const queueOk = await queueFlow(prisma, tenant.id, suffix)
  await prisma.$disconnect()
  console.log(JSON.stringify({ directOk, queueOk }))
  process.exit(directOk && queueOk ? 0 : 1)
}

void main()
