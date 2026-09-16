import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { PrismaService } from '../prisma.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { ListingFlowService } from '../listings/listing.service'
import { ImageFlowService } from './image.service'

@Processor(QUEUE_NAMES.serverImageGen)
export class ImageGenWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageFlowService: ImageFlowService,
    private readonly listingFlowService: ListingFlowService,
  ) {
    super()
  }

  async process(job: Job) {
    const { jobId, tenantId } = (job.data ?? {}) as { jobId?: string; tenantId?: string }
    if (!jobId || !tenantId) throw new Error('image job missing jobId/tenantId')
    const row = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!row) throw new Error(`job not found: ${jobId}`)
    if (row.status === 'success') return { ok: true, reused: true }
    if (row.status !== 'queued' && row.status !== 'running') throw new Error(`job ${jobId} not runnable: ${row.status}`)
    if (row.type === 'listing') {
      const assets = await this.listingFlowService.uploadAssets({ jobId, tenantId })
      return { ok: true, stage: 'uploading_assets', ...assets }
    }
    const result = await this.imageFlowService.generate({ jobId, tenantId, attempt: row.attempt })
    process.stdout.write(
      JSON.stringify({ level: 30, msg: 'image worker done', jobId, tenantId, assetId: result.assetId, reviewId: result.reviewId }) + '\n',
    )
    return { ok: true, ...result }
  }
}
