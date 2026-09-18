import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { QUEUE_NAMES } from './queue-names'

export interface JobProcessResult {
  ok: boolean
  stage?: string
  [key: string]: unknown
}

export interface JobProcessContext {
  id: string
  jobId: string
  type: string
  tenantId: string
  attempt: number
  data?: Record<string, unknown>
}

export interface JobProcessor {
  process(context: JobProcessContext): Promise<JobProcessResult>
}

interface EnqueuedTask {
  jobId: string
  type: string
  tenantId: string
}

const DEFAULT_CONCURRENCY: Record<string, number> = {
  [QUEUE_NAMES.serverAi]: 3,
  [QUEUE_NAMES.serverReport]: 2,
  [QUEUE_NAMES.serverImageGen]: 2,
  [QUEUE_NAMES.serverListing]: 2,
  [QUEUE_NAMES.flowFinalizer]: 3,
}

const MAX_JOB_ATTEMPTS = 3

@Injectable()
export class LocalJobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocalJobQueueService.name)
  private readonly processors = new Map<string, JobProcessor>()
  private readonly queues = new Map<string, EnqueuedTask[]>()
  private readonly activeCounts = new Map<string, number>()
  private readonly pendingTimers = new Set<NodeJS.Timeout>()
  private isShuttingDown = false

  /** 429 退避基准时间，默认为 1000ms，单测可缩短加速 */
  public backoffBaseMs = 1000

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 注册指定队列/类型的任务处理器（Registry 模式，单向依赖杜绝循环引用）
   */
  registerProcessor(queueNameOrType: string, processor: JobProcessor) {
    this.processors.set(queueNameOrType, processor)
    this.logger.log(`Processor registered for: ${queueNameOrType}`)
  }

  getProcessor(queueNameOrType: string): JobProcessor | undefined {
    return this.processors.get(queueNameOrType)
  }

  /**
   * 将任务放入轻量内存调度队列
   */
  async enqueue(queueNameOrType: string, payload: { jobId: string; tenantId: string; type?: string }) {
    if (this.isShuttingDown) return
    const queueName = this.normalizeQueueName(queueNameOrType, payload.type)
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, [])
    }
    this.queues.get(queueName)!.push({
      jobId: payload.jobId,
      type: payload.type ?? queueName,
      tenantId: payload.tenantId,
    })
    // 异步触发队列调度
    setImmediate(() => this.pump(queueName))
  }

  /**
   * 排空并执行指定队列中的全部等待任务（供测试与即时调度使用）
   */
  async drain(queueNameOrType?: string) {
    if (queueNameOrType) {
      const queueName = this.normalizeQueueName(queueNameOrType)
      while ((this.queues.get(queueName)?.length ?? 0) > 0) {
        await this.pump(queueName)
      }
    } else {
      for (const name of Array.from(this.queues.keys())) {
        while ((this.queues.get(name)?.length ?? 0) > 0) {
          await this.pump(name)
        }
      }
    }
  }

  /**
   * 启动断电自愈：扫描未完成任务并重新加入调度队列
   */
  async onModuleInit() {
    try {
      const danglingJobs = await this.prisma.job.findMany({
        where: { status: { in: ['queued', 'running'] } },
        orderBy: { createdAt: 'asc' },
      })
      if (danglingJobs.length > 0) {
        this.logger.log(`Found ${danglingJobs.length} dangling jobs to recover`)
        for (const job of danglingJobs) {
          const queueName = this.queueNameFor(job.type, job.checkpointStage)
          await this.enqueue(queueName, {
            jobId: job.id,
            tenantId: job.tenantId,
            type: job.type,
          })
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to recover dangling jobs on init: ${String(error)}`)
    }
  }

  onModuleDestroy() {
    this.isShuttingDown = true
    for (const timer of this.pendingTimers) {
      clearTimeout(timer)
    }
    this.pendingTimers.clear()
  }

  /**
   * 调度器核心：受管并发与自适应退避执行
   */
  private async pump(queueName: string) {
    if (this.isShuttingDown) return
    const queue = this.queues.get(queueName)
    if (!queue || queue.length === 0) return

    const limit = DEFAULT_CONCURRENCY[queueName] ?? 2
    const currentActive = this.activeCounts.get(queueName) ?? 0
    if (currentActive >= limit) return

    const task = queue.shift()
    if (!task) return

    this.activeCounts.set(queueName, currentActive + 1)

    try {
      await this.executeTask(queueName, task)
    } finally {
      const remaining = (this.activeCounts.get(queueName) ?? 1) - 1
      this.activeCounts.set(queueName, Math.max(0, remaining))
      // 继续调度下一个任务
      setImmediate(() => this.pump(queueName))
    }
  }

  private async executeTask(queueName: string, task: EnqueuedTask) {
    const job = await this.prisma.job.findUnique({ where: { id: task.jobId } })
    if (!job) return
    if (job.status === 'success' || job.status === 'cancelled') return

    const processor = this.processors.get(queueName) ?? this.processors.get(task.type)
    if (!processor) {
      this.logger.warn(`No processor found for queue/type: ${queueName}/${task.type}`)
      return
    }

    try {
      await processor.process({
        id: job.id,
        jobId: job.id,
        type: job.type,
        tenantId: job.tenantId,
        attempt: job.attempt,
      })
    } catch (error: any) {
      await this.handleExecutionError(queueName, task, job, error)
    }
  }

  private async handleExecutionError(
    queueName: string,
    task: EnqueuedTask,
    job: { id: string; attempt: number; type: string },
    error: any,
  ) {
    const isRateLimit =
      error?.status === 429 ||
      error?.statusCode === 429 ||
      String(error?.message ?? '').toLowerCase().includes('rate limit') ||
      String(error?.message ?? '').includes('429')

    if (isRateLimit) {
      // 429 限流自适应指数退避调度
      const delayMs = Math.min(this.backoffBaseMs * Math.pow(2, job.attempt), 30000)
      this.logger.warn(`Rate limit 429 detected for job ${job.id}, backoff delay: ${delayMs}ms`)
      await this.prisma.job.update({
        where: { id: job.id },
        data: { errorMessage: `429 限流自适应退避等待中 (${delayMs}ms)` },
      })
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer)
        this.enqueue(queueName, task)
      }, delayMs)
      this.pendingTimers.add(timer)
      return
    }

    // 一般错误重试判定
    const nextAttempt = job.attempt + 1
    if (nextAttempt <= MAX_JOB_ATTEMPTS) {
      this.logger.warn(`Job ${job.id} failed, retry attempt ${nextAttempt}/${MAX_JOB_ATTEMPTS}`)
      await this.prisma.job.update({
        where: { id: job.id },
        data: { attempt: nextAttempt, errorMessage: String(error?.message ?? error) },
      })
      this.enqueue(queueName, task)
    } else {
      this.logger.error(`Job ${job.id} failed permanently: ${String(error?.message ?? error)}`)
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failure',
          stage: 'failure',
          errorMessage: String(error?.message ?? error),
          finishedAt: new Date(),
        },
      })
      await this.prisma.jobEvent.create({
        data: {
          jobId: job.id,
          type: 'job-failed',
          data: { error: String(error?.message ?? error), attempt: job.attempt },
        },
      })
    }
  }

  private normalizeQueueName(queueNameOrType: string, type?: string): string {
    if (queueNameOrType.startsWith('server-') || queueNameOrType === QUEUE_NAMES.flowFinalizer) {
      return queueNameOrType
    }
    return this.queueNameFor(type ?? queueNameOrType)
  }

  private queueNameFor(type: string, stage?: string | null): string {
    if (type === 'analysis' || type === 'collection' || type === 'import') {
      return QUEUE_NAMES.serverReport
    }
    if (type === 'image-gen' || type === 'image_gen') return QUEUE_NAMES.serverImageGen
    if (type === 'listing') return QUEUE_NAMES.serverListing
    return QUEUE_NAMES.serverAi
  }
}
