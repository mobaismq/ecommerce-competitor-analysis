import { LocalJobQueueService, type JobProcessor } from './local-job-queue.service'
import { QUEUE_NAMES } from './queue-names'

describe('LocalJobQueueService', () => {
  let prisma: any
  let service: LocalJobQueueService

  beforeEach(() => {
    prisma = {
      job: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      jobEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    }
    service = new LocalJobQueueService(prisma)
    service.backoffBaseMs = 15 // 测试使用极短退避基准
  })

  afterEach(() => {
    service.onModuleDestroy()
  })

  it('registerProcessor: 支持 Registry 模式注册与获取 Processor', () => {
    const fakeProcessor: JobProcessor = {
      process: jest.fn().mockResolvedValue({ ok: true }),
    }
    service.registerProcessor(QUEUE_NAMES.serverAi, fakeProcessor)
    expect(service.getProcessor(QUEUE_NAMES.serverAi)).toBe(fakeProcessor)
  })

  it('enqueue 与 drain: 调度并在受管并发内执行 Processor', async () => {
    const fakeProcessor: JobProcessor = {
      process: jest.fn().mockResolvedValue({ ok: true, stage: 'analyzing' }),
    }
    service.registerProcessor(QUEUE_NAMES.serverReport, fakeProcessor)

    prisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      type: 'analysis',
      tenantId: 'tenant-1',
      attempt: 1,
      status: 'queued',
    })

    await service.enqueue(QUEUE_NAMES.serverReport, {
      jobId: 'job-1',
      tenantId: 'tenant-1',
      type: 'analysis',
    })

    await service.drain(QUEUE_NAMES.serverReport)

    expect(fakeProcessor.process).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-1',
        type: 'analysis',
        tenantId: 'tenant-1',
        attempt: 1,
      }),
    )
  })

  it('429 限流自适应退避: 捕获 429 异常后按指数退避延时重新排队', async () => {
    const error429 = new Error('Rate limit exceeded: 429')
    ;(error429 as any).status = 429

    const fakeProcessor: JobProcessor = {
      process: jest.fn().mockRejectedValueOnce(error429).mockResolvedValue({ ok: true }),
    }
    service.registerProcessor(QUEUE_NAMES.serverAi, fakeProcessor)

    prisma.job.findUnique.mockResolvedValue({
      id: 'job-429',
      type: 'ai',
      tenantId: 'tenant-1',
      attempt: 1,
      status: 'running',
    })

    await service.enqueue(QUEUE_NAMES.serverAi, {
      jobId: 'job-429',
      tenantId: 'tenant-1',
      type: 'ai',
    })

    // 执行首次任务，遭遇 429
    await service.drain(QUEUE_NAMES.serverAi)

    const data429 = prisma.job.update.mock.calls[0][0].data
    expect(data429).toEqual(expect.objectContaining({
      attempt: 2,
      errorMessage: expect.stringContaining('429 限流自适应退避至'),
      nextRetryAt: expect.any(Date),
    }))
    expect(data429.nextRetryAt.getTime()).toBeGreaterThan(Date.now())

    // 等待 15 * 2^2 = 60ms 退避定时器触发
    await new Promise((resolve) => setTimeout(resolve, 80))
    await service.drain(QUEUE_NAMES.serverAi)

    expect(fakeProcessor.process).toHaveBeenCalledTimes(2)
  })

  it('429 限流重试超过最大上限 MAX_429_ATTEMPTS 时熔断置为 failure', async () => {
    const rateLimitError = new Error('Rate limit exceeded (429)')
    ;(rateLimitError as any).status = 429
    const fakeProcessor: JobProcessor = {
      process: jest.fn().mockRejectedValue(rateLimitError),
    }
    service.registerProcessor(QUEUE_NAMES.serverAi, fakeProcessor)

    prisma.job.findUnique.mockResolvedValue({
      id: 'job-429-max',
      type: 'ai',
      tenantId: 'tenant-1',
      attempt: 5, // 已达最大尝试次数
      status: 'running',
    })

    await service.enqueue(QUEUE_NAMES.serverAi, {
      jobId: 'job-429-max',
      tenantId: 'tenant-1',
      type: 'ai',
    })

    await service.drain(QUEUE_NAMES.serverAi)

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-429-max' },
        data: expect.objectContaining({
          status: 'failure',
          stage: 'failure',
          errorCode: 'RATE_LIMIT_EXCEEDED',
        }),
      }),
    )
    expect(prisma.jobEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: 'job-429-max',
          type: 'rate-limit-exceeded',
        }),
      }),
    )
  })

  it('超过最大重试次数时标记为 failure 并记录 jobEvent', async () => {
    const generalError = new Error('Permanent database failure')
    const fakeProcessor: JobProcessor = {
      process: jest.fn().mockRejectedValue(generalError),
    }
    service.registerProcessor(QUEUE_NAMES.serverListing, fakeProcessor)

    prisma.job.findUnique.mockResolvedValue({
      id: 'job-fail',
      type: 'listing',
      tenantId: 'tenant-1',
      attempt: 3, // 已是最大次数
      status: 'running',
    })

    await service.enqueue(QUEUE_NAMES.serverListing, {
      jobId: 'job-fail',
      tenantId: 'tenant-1',
      type: 'listing',
    })

    await service.drain(QUEUE_NAMES.serverListing)

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-fail' },
        data: expect.objectContaining({
          status: 'failure',
          stage: 'failure',
        }),
      }),
    )
    expect(prisma.jobEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: 'job-fail',
          type: 'job-failed',
        }),
      }),
    )
  })

  it('onModuleInit: 自动恢复 queued 与 running 状态的遗留任务', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: 'job-dangle-1', type: 'analysis', tenantId: 't-1', status: 'queued', checkpointStage: 'analyzing' },
      { id: 'job-dangle-2', type: 'image-gen', tenantId: 't-1', status: 'running', checkpointStage: 'generating' },
    ])

    const spyEnqueue = jest.spyOn(service, 'enqueue')
    await service.onModuleInit()

    expect(spyEnqueue).toHaveBeenCalledTimes(2)
    expect(spyEnqueue).toHaveBeenCalledWith(QUEUE_NAMES.serverReport, expect.objectContaining({ jobId: 'job-dangle-1' }))
    expect(spyEnqueue).toHaveBeenCalledWith(QUEUE_NAMES.serverImageGen, expect.objectContaining({ jobId: 'job-dangle-2' }))
  })

  it('onModuleInit: 恢复时跳过仍在 collecting 等待采集的 analysis 任务，不提前派发 report', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: 'job-collecting', type: 'analysis', tenantId: 't-1', status: 'queued', checkpointStage: 'collecting' },
      { id: 'job-analyzing', type: 'analysis', tenantId: 't-1', status: 'running', checkpointStage: 'analyzing' },
    ])

    const spyEnqueue = jest.spyOn(service, 'enqueue')
    await service.onModuleInit()

    expect(spyEnqueue).toHaveBeenCalledTimes(1)
    expect(spyEnqueue).toHaveBeenCalledWith(QUEUE_NAMES.serverReport, expect.objectContaining({ jobId: 'job-analyzing' }))
    expect(spyEnqueue).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ jobId: 'job-collecting' }))
  })

  it('onModuleInit: 429 退避未过期时跨重启保留剩余退避，不立即入队', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: 'job-429-pending', type: 'ai', tenantId: 't-1', status: 'queued', checkpointStage: null, nextRetryAt: new Date(Date.now() + 300) },
    ])
    const processor: JobProcessor = { process: jest.fn().mockResolvedValue({ ok: true }) }
    service.registerProcessor(QUEUE_NAMES.serverAi, processor)
    prisma.job.findUnique.mockResolvedValue({
      id: 'job-429-pending',
      type: 'ai',
      tenantId: 't-1',
      attempt: 0,
      status: 'running',
    })

    const spyEnqueue = jest.spyOn(service, 'enqueue')
    await service.onModuleInit()

    // 退避未到期：恢复时不应立即入队
    expect(spyEnqueue).not.toHaveBeenCalled()

    // 等待退避到期后应自动执行
    await new Promise((resolve) => setTimeout(resolve, 400))
    await service.drain(QUEUE_NAMES.serverAi)
    expect(processor.process).toHaveBeenCalledTimes(1)
  })
})
