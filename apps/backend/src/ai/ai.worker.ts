import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { PrismaService } from '../prisma.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { buildAttemptKey } from './ai.types'
import { ProviderRouter } from './provider-router.service'

@Processor(QUEUE_NAMES.serverAi)
export class AiWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouter,
  ) {
    super()
  }

  async process(job: Job) {
    const { jobId, tenantId } = (job.data ?? {}) as { jobId?: string; tenantId?: string }
    if (!jobId || !tenantId) throw new Error('AI job missing jobId/tenantId')

    const row = await this.prisma.job.findUnique({ where: { id: jobId } })
    if (!row) throw new Error(`job not found: ${jobId}`)
    if (row.status !== 'queued' && row.status !== 'running') {
      throw new Error(`job ${jobId} not runnable: ${row.status}`)
    }

    if (row.type === 'analysis') {
      await this.prisma.jobEvent.create({
        data: { jobId, type: 'ai-attempt', data: { deferred: true, reason: 'report-pipeline' } },
      })
      return { ok: true, deferred: true, reason: 'report-pipeline' }
    }

    if (row.type === 'image-gen' || row.type === 'image_gen') {
      const promptKey = buildAttemptKey({ jobId, capability: 'text', attempt: row.attempt, suffix: 'prompt' })
      const prompt = await this.router.execute(
        'text',
        {
          prompt: `为任务 ${jobId} 生成商品主图提示词，包含构图、背景、卖点与合规要求。`,
          system: '你是电商主图提示词专家。',
          maxTokens: 2000,
        },
        { tenantId, jobId, attemptKey: promptKey },
      )
      await this.prisma.jobEvent.create({
        data: { jobId, type: 'image-prompt', data: { prompt: prompt.text, model: prompt.model } },
      })
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: 'running', stage: 'prompting', checkpointStage: 'prompting' },
      })
      return { ok: true, stage: 'prompting', model: prompt.model }
    }

    const attemptKey = buildAttemptKey({ jobId, capability: 'text', attempt: row.attempt })
    const result = await this.router.execute(
      'text',
      { prompt: `分析任务 ${jobId}`, system: '你是电商竞品分析助手，请基于采集数据输出结构化结论。' },
      { tenantId, jobId, attemptKey },
    )

    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: row.startedAt ?? new Date() },
    })
    await this.prisma.jobEvent.create({
      data: { jobId, type: 'ai-attempt', data: { attemptKey, status: result.status, model: result.model, cached: result.cached ?? false } },
    })
    process.stdout.write(
      JSON.stringify({ level: 30, msg: 'ai worker done', jobId, tenantId, attemptKey, model: result.model, cached: result.cached ?? false }) + '\n',
    )
    return { ok: true, attemptKey, model: result.model }
  }
}
