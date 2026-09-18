import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { LocalJobQueueService, type JobProcessor, type JobProcessContext } from '../queue/local-job-queue.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { ListingFlowService } from '../listings/listing.service'
import { ImageFlowService } from './image.service'

@Injectable()
export class ImageGenWorker implements JobProcessor, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageFlowService: ImageFlowService,
    private readonly listingFlowService: ListingFlowService,
    private readonly localQueue: LocalJobQueueService,
  ) {}

  onModuleInit() {
    this.localQueue.registerProcessor(QUEUE_NAMES.serverImageGen, this)
  }

  async process(jobOrContext: JobProcessContext | { data?: { jobId?: string; tenantId?: string } }) {
    const data = 'data' in jobOrContext ? jobOrContext.data : undefined
    const jobId = 'jobId' in jobOrContext ? jobOrContext.jobId : (data?.jobId as string | undefined)
    const tenantId = (data?.tenantId ?? ('tenantId' in jobOrContext ? jobOrContext.tenantId : undefined)) as string | undefined
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
