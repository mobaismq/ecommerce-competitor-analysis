import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { LocalJobQueueService, type JobProcessor, type JobProcessContext } from '../queue/local-job-queue.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { ReportService } from './report.service'

@Injectable()
export class ReportWorker implements JobProcessor, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportService: ReportService,
    private readonly localQueue: LocalJobQueueService,
  ) {}

  onModuleInit() {
    this.localQueue.registerProcessor(QUEUE_NAMES.serverReport, this)
  }

  async process(context: JobProcessContext) {
    const { jobId, tenantId } = context
    if (!jobId || !tenantId) throw new Error('report job missing jobId/tenantId')

    const row = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!row) throw new Error(`job not found: ${jobId}`)
    if (row.status === 'success') return { ok: true, reused: true }
    if (row.status !== 'queued' && row.status !== 'running') {
      throw new Error(`job ${jobId} not runnable: ${row.status}`)
    }

    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'running', stage: 'analyzing', startedAt: row.startedAt ?? new Date() },
    })
    const result = await this.reportService.runReport({ jobId, tenantId, attempt: row.attempt, userId: row.userId ?? undefined })
    await this.localQueue.enqueue(QUEUE_NAMES.flowFinalizer, { jobId, tenantId })
    process.stdout.write(
      JSON.stringify({ level: 30, msg: 'report worker done', jobId, tenantId, reportNo: result.reportNo, reused: result.reused }) + '\n',
    )
    return { ok: true, ...result }
  }
}
