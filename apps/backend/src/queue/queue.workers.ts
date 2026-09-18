import { Prisma } from '@prisma/client'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { LocalJobQueueService, type JobProcessor, type JobProcessContext } from './local-job-queue.service'
import { AUTO_CHAIN_RULES, parseAutoChainConfig } from './auto-chain'
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

  async process(context: JobProcessContext) {
    const jobId = context.jobId
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

  public async maybeChain(jobId: string) {
    const source = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!source) return
    const configRow = await this.prisma.systemConfig.findUnique({ where: { key: 'flow.autoChain' } })
    const config = parseAutoChainConfig(configRow?.value)

    // 依据单一规则表解析下游目标链路，新增链路只需在 AUTO_CHAIN_RULES 追加一行
    const rule = AUTO_CHAIN_RULES.find((r) => r.sourceType === source.type && config[r.flagKey])
    if (!rule) return

    const businessKey = `${source.id}:${rule.targetType}`
    const existing = await this.prisma.job.findUnique({ where: { businessKey } })
    if (existing) return

    try {
      const downstream = await this.prisma.job.create({
        data: {
          tenantId: source.tenantId,
          type: rule.targetType,
          businessKey,
          status: 'queued',
          stage: 'queued',
          parentJobId: source.id,
          userId: source.userId ?? undefined,
        },
      })
      await this.localQueue.enqueue(rule.targetQueue, {
        jobId: downstream.id,
        tenantId: source.tenantId,
        type: rule.targetType,
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
    }
  }
}
