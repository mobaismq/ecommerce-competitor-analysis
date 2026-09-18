import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { LocalJobQueueService, type JobProcessor, type JobProcessContext } from '../queue/local-job-queue.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { buildAttemptKey } from './ai.types'
import { ProviderRouter } from './provider-router.service'
import { buildImagePromptGenerationPrompt, DEFAULT_SLOT_CONFIGS } from '../images/image-prompt'

@Injectable()
export class AiWorker implements JobProcessor, OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouter,
    private readonly localQueue: LocalJobQueueService,
  ) {}

  onModuleInit() {
    this.localQueue.registerProcessor(QUEUE_NAMES.serverAi, this)
  }

  async process(context: JobProcessContext) {
    const { jobId, tenantId } = context
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
      // 用迁移的提示词引擎生成主图 5 图位的结构化提示词请求（无商品文本时用默认图位/内联规则）。
      const workflowPrompt = buildImagePromptGenerationPrompt({
        settings: {},
        promptSlots: DEFAULT_SLOT_CONFIGS,
      })
      const prompt = await this.router.execute(
        'text',
        {
          prompt: workflowPrompt,
          system: '你是电商主图提示词专家，严格按给定的图位规范输出一个可直接用于生图的综合主图提示词。',
          maxTokens: Number(process.env.IMAGE_PROMPT_MAX_TOKENS ?? 2000),
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
