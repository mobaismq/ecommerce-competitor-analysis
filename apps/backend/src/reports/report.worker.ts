import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { PrismaService } from '../prisma.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { ReportService } from './report.service'

@Processor(QUEUE_NAMES.serverReport)
export class ReportWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportService: ReportService,
  ) {
    super()
  }

  async process(job: Job) {
    const { jobId, tenantId } = (job.data ?? {}) as { jobId?: string; tenantId?: string }
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
    const result = await this.reportService.runReport({ jobId, tenantId, attempt: row.attempt })
    process.stdout.write(
      JSON.stringify({ level: 30, msg: 'report worker done', jobId, tenantId, reportNo: result.reportNo, reused: result.reused }) + '\n',
    )
    return { ok: true, ...result }
  }
}
