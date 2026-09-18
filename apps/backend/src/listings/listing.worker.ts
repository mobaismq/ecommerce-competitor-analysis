import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { LocalJobQueueService, type JobProcessor, type JobProcessContext } from '../queue/local-job-queue.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { ListingFlowService } from './listing.service'

@Injectable()
export class ListingWorker implements JobProcessor, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingFlowService: ListingFlowService,
    private readonly localQueue: LocalJobQueueService,
  ) {}

  onModuleInit() {
    this.localQueue.registerProcessor(QUEUE_NAMES.serverListing, this)
  }

  async process(jobOrContext: JobProcessContext | { data?: { jobId?: string; tenantId?: string } }) {
    const data = 'data' in jobOrContext ? jobOrContext.data : undefined
    const jobId = 'jobId' in jobOrContext ? jobOrContext.jobId : (data?.jobId as string | undefined)
    const tenantId = (data?.tenantId ?? ('tenantId' in jobOrContext ? jobOrContext.tenantId : undefined)) as string | undefined
    if (!jobId || !tenantId) throw new Error('listing job missing jobId/tenantId')
    const row = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!row) throw new Error(`job not found: ${jobId}`)
    if (row.status === 'success') return { ok: true, reused: true }
    if (row.status !== 'queued' && row.status !== 'running') throw new Error(`job ${jobId} not runnable: ${row.status}`)
    const result = await this.listingFlowService.submit({ jobId, tenantId })
    process.stdout.write(
      JSON.stringify({ level: 30, msg: 'listing worker done', jobId, tenantId, draftId: result.draftId, status: result.status }) + '\n',
    )
    return { ok: true, ...result }
  }
}
