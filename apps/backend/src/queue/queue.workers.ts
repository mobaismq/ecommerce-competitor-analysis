import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Prisma } from '@prisma/client'
import { Queue, type Job } from 'bullmq'
import IORedis from 'ioredis'
import { PrismaService } from '../prisma.service'
import { QUEUE_NAMES } from './queue-names'

function logConsumed(queueName: string, job: Job) {
  process.stdout.write(JSON.stringify({ level: 30, msg: 'worker consumed', queue: queueName, jobId: job.id }) + '\n')
  return { ok: true, queue: queueName, jobId: job.id }
}

@Processor(QUEUE_NAMES.desktopRpa)
export class DesktopRpaWorker extends WorkerHost {
  async process(job: Job) {
    return logConsumed(QUEUE_NAMES.desktopRpa, job)
  }
}

@Processor(QUEUE_NAMES.flowFinalizer)
export class FlowFinalizerWorker extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async process(job: Job) {
    const jobId = job.data?.jobId as string | undefined
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
      const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6380', { maxRetriesPerRequest: null })
      const queue = new Queue(target.queue, { connection })
      await queue.add(
        target.queue,
        { jobId: downstream.id, tenantId: source.tenantId, type: target.type },
        { jobId: downstream.id },
      )
      await queue.close()
      await connection.quit()
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
    }
  }
}
