import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { QUEUE_NAMES, resolveQueueName } from './queue-names'

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

export const MAX_JOB_ATTEMPTS = 3
export const MAX_429_ATTEMPTS = 5

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
    const queueNames = queueNameOrType
      ? [this.normalizeQueueName(queueNameOrType)]
      : Array.from(new Set([...this.queues.keys(), ...this.activeCounts.keys()]))

    for (const name of queueNames) {
      while ((this.queues.get(name)?.length ?? 0) > 0 || (this.activeCounts.get(name) ?? 0) > 0) {
        this.pump(name)
        await new Promise((resolve) => setTimeout(resolve, 5))
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
          // 统一走单一权威 resolveQueueName，与正常派发路径一致；
          // analysis 处于 collecting 阶段正在等待桌面端采集上报，恢复时不提前派发 report。
          const queueName = resolveQueueName(job.type, job.checkpointStage)
          if (!queueName) continue

          const task = { jobId: job.id, tenantId: job.tenantId, type: job.type }
          const retryAt = job.nextRetryAt ? new Date(job.nextRetryAt).getTime() : 0
          if (retryAt > Date.now()) {
            // 429 退避未到期：跨重启保留剩余退避时间再入队
            this.delayedEnqueue(queueName, task, retryAt - Date.now(), job.id)
            continue
          }
          if (retryAt) {
            // 退避已到期，清理后立即入队
            await this.prisma.job.update({ where: { id: job.id }, data: { nextRetryAt: null } }).catch(() => undefined)
          }
          await this.enqueue(queueName, task)
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
    this.queues.clear()
    this.processors.clear()
    this.activeCounts.clear()
  }

  /**
   * 延迟入队：到点后先清退 nextRetryAt（退避截止时间）再入库执行，供 429 退避与跨重启恢复共用。
   */
  private delayedEnqueue(queueName: string, task: EnqueuedTask, delayMs: number, jobId: string) {
    const safeDelay = Math.max(0, delayMs)
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer)
      void this.prisma.job.update({ where: { id: jobId }, data: { nextRetryAt: null } }).catch(() => undefined)
      this.enqueue(queueName, task)
    }, safeDelay)
    this.pendingTimers.add(timer)
  }

  /**
   * 调度器核心：受管并发与自适应退避执行
   */
  private pump(queueName: string) {
    const limit = DEFAULT_CONCURRENCY[queueName] ?? 2
    const currentActive = this.activeCounts.get(queueName) ?? 0
    const availableSlots = limit - currentActive
    if (availableSlots <= 0) return

    const taskQueue = this.queues.get(queueName) ?? []
    if (taskQueue.length === 0) return

    const tasksToRun = taskQueue.splice(0, availableSlots)
    this.activeCounts.set(queueName, currentActive + tasksToRun.length)

    for (const task of tasksToRun) {
      this.runTaskWrapper(queueName, task)
    }
  }

  private async runTaskWrapper(queueName: string, task: EnqueuedTask) {
    try {
      await this.executeTask(queueName, task)
    } catch (err) {
      this.logger.error(`Unexpected task execution error in ${queueName}: ${err}`)
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
      const nextAttempt = job.attempt + 1
      if (nextAttempt > MAX_429_ATTEMPTS) {
        this.logger.error(`Job ${job.id} rate limit exceeded max attempts (${MAX_429_ATTEMPTS}): ${String(error?.message ?? error)}`)
        await this.prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'failure',
            stage: 'failure',
            errorCode: 'RATE_LIMIT_EXCEEDED',
            errorMessage: `429 限流重试超限 (${MAX_429_ATTEMPTS} 次): ${String(error?.message ?? error)}`,
            nextRetryAt: null,
            finishedAt: new Date(),
          },
        })
        await this.prisma.jobEvent.create({
          data: {
            jobId: job.id,
            type: 'rate-limit-exceeded',
            data: { error: String(error?.message ?? error), attempt: nextAttempt },
          },
        })
        return
      }

      // 429 限流自适应指数退避调度：真实 2^nextAttempt 退避，并把到期时间落库 nextRetryAt，
      // 供进程重启后 onModuleInit 自愈保留剩余退避，避免对仍限流的 API 立刻重打。
      const delayMs = Math.min(this.backoffBaseMs * Math.pow(2, nextAttempt), 30000)
      const nextRetryAt = new Date(Date.now() + delayMs)
      this.logger.warn(`Rate limit 429 detected for job ${job.id}, backoff delay: ${delayMs}ms (attempt ${nextAttempt}/${MAX_429_ATTEMPTS})`)
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          attempt: nextAttempt,
          nextRetryAt,
          errorMessage: `429 限流自适应退避至 ${nextRetryAt.toISOString()} (attempt ${nextAttempt}/${MAX_429_ATTEMPTS})`,
        },
      })
      this.delayedEnqueue(queueName, task, delayMs, job.id)
      return
    }

    // 一般错误重试判定
    const nextAttempt = job.attempt + 1
    if (nextAttempt <= MAX_JOB_ATTEMPTS) {
      this.logger.warn(`Job ${job.id} failed, retry attempt ${nextAttempt}/${MAX_JOB_ATTEMPTS}`)
      await this.prisma.job.update({
        where: { id: job.id },
        data: { attempt: nextAttempt, nextRetryAt: null, errorMessage: String(error?.message ?? error) },
      })
      this.enqueue(queueName, task)
    } else {
      this.logger.error(`Job ${job.id} failed permanently: ${String(error?.message ?? error)}`)
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failure',
          stage: 'failure',
          nextRetryAt: null,
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
    // 非显式队列名（如按业务类型入队）时，统一走单一权威 resolveQueueName。
    // resolveQueueName 对 collecting 阶段 analysis 返回 null，此处防御性回落到 server-ai。
    return resolveQueueName(type ?? queueNameOrType) ?? QUEUE_NAMES.serverAi
  }
}
