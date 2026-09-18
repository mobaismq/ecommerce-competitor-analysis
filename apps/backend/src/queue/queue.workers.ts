import { Prisma } from '@prisma/client'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { LocalJobQueueService, type JobProcessor, type JobProcessContext } from './local-job-queue.service'
import { QUEUE_NAMES } from './queue-names'

@Injectable()
export class FlowFinalizerWorker implements JobProcessor, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localQueue: LocalJobQueueService,
  ) {}

  onModuleInit() {
    this.localQueue.registerProcessor(QUEUE_NAMES.flowFinalizer, this)
  }

  async process(jobOrContext: JobProcessContext | { data?: { jobId?: string; tenantId?: string } }) {
    const data = 'data' in jobOrContext ? jobOrContext.data : undefined
    const jobId = (data?.jobId ?? ('jobId' in jobOrContext ? jobOrContext.jobId : undefined)) as string | undefined
    if (!jobId) return { ok: false, reason: 'missing jobId' }
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'success', stage: 'success' },
    })
    await this.prisma.jobEvent.create({
      data: { jobId, type: 'flow-finalizer', data: { result: 'all children completed' } },
    })
    await this.maybeChain(jobId)
    process.stdout.write(JSON.stringify({ level: 30, msg: 'flow finalizer done', jobId }) + '\n')
    return { ok: true, queue: QUEUE_NAMES.flowFinalizer, jobId }
  }

  private async maybeChain(jobId: string) {
    const source = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!source) return
    const configRow = await this.prisma.systemConfig.findUnique({ where: { key: 'flow.autoChain' } })
    if (!configRow?.value) return
    let config: Record<string, boolean>
    try {
      config = JSON.parse(configRow.value)
    } catch {
      return
    }
    const target =
      source.type === 'analysis' && config.analysisToImageGen
        ? { type: 'image-gen', queue: QUEUE_NAMES.serverImageGen }
        : source.type === 'image-gen' && config.imageGenToListing
          ? { type: 'listing', queue: QUEUE_NAMES.serverListing }
          : null
    if (!target) return

    const businessKey = `${source.id}:${target.type}`
    const existing = await this.prisma.job.findUnique({ where: { businessKey } })
    if (existing) return

    try {
      const downstream = await this.prisma.job.create({
        data: {
          tenantId: source.tenantId,
          type: target.type,
          businessKey,
          status: 'queued',
          stage: 'queued',
          parentJobId: source.id,
        },
      })
      await this.localQueue.enqueue(target.queue, {
        jobId: downstream.id,
        tenantId: source.tenantId,
        type: target.type,
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
    }
  }
}
