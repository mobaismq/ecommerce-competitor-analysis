import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { PrismaService } from '../prisma.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { ListingFlowService } from './listing.service'

@Processor(QUEUE_NAMES.serverListing)
export class ListingWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingFlowService: ListingFlowService,
  ) {
    super()
  }

  async process(job: Job) {
    const { jobId, tenantId } = (job.data ?? {}) as { jobId?: string; tenantId?: string }
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
