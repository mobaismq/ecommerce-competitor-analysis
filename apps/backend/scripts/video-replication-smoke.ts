import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'
import { StorageDriverService } from '../src/storage/storage.service'
import { VideoProviderRegistry } from '../src/videos/video-registry'
import { VideoReplicationService } from '../src/videos/video.service'

async function main() {
  loadBackendEnv()
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)

  const registry = new VideoProviderRegistry()
  const service = new VideoReplicationService(prisma, registry, new StorageDriverService())

  const replicated = await service.replicate({
    tenantId: tenant.id,
    sourceUrl: `https://example.com/source-${suffix}.mp4`,
    title: `测试视频-${suffix}`,
  })
  const sourceAsset = await prisma.mediaAsset.findUnique({ where: { id: replicated.sourceAssetId } })
  const outputAsset = await prisma.mediaAsset.findUnique({ where: { id: replicated.outputAssetId } })
  const jobRow = await prisma.job.findUnique({ where: { id: replicated.jobId } })
  const detail = await service.find(replicated.jobId, tenant.id)

  let missingRejected = false
  try {
    await service.replicate({ tenantId: tenant.id })
  } catch (error) {
    missingRejected = error instanceof Error && error.message.includes('必填')
  }

  const output = {
    replicate: { status: replicated.status, provider: replicated.provider },
    source: { sourceType: sourceAsset?.sourceType, storageKey: sourceAsset?.storageKey },
    output: { sourceType: outputAsset?.sourceType, storageKey: outputAsset?.storageKey, mimeType: outputAsset?.mimeType },
    job: { status: jobRow?.status, stage: jobRow?.stage, eventCount: detail.events.length },
    missingRejected,
  }
  console.log(JSON.stringify(output))

  await prisma.mediaAsset.deleteMany({ where: { id: { in: [replicated.sourceAssetId, replicated.outputAssetId] } } })
  await prisma.jobEvent.deleteMany({ where: { jobId: replicated.jobId } })
  await prisma.job.deleteMany({ where: { id: replicated.jobId } })
  await prisma.$disconnect()

  const ok =
    replicated.status === 'success' &&
    replicated.provider === 'mock' &&
    sourceAsset?.sourceType === 'video_source' &&
    outputAsset?.sourceType === 'video_replication' &&
    outputAsset.storageKey === `mock-videos/${replicated.jobId}.mp4` &&
    outputAsset.mimeType === 'video/mp4' &&
    jobRow?.status === 'success' &&
    jobRow?.stage === 'success' &&
    detail.events.length === 1 &&
    missingRejected
  process.exit(ok ? 0 : 1)
}

void main()
