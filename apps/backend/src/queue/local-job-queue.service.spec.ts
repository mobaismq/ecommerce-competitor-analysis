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

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-429' },
        data: expect.objectContaining({
          errorMessage: expect.stringContaining('429 限流自适应退避等待中'),
        }),
      }),
    )

    // 等待 15 * 2 = 30ms 退避定时器触发
    await new Promise((resolve) => setTimeout(resolve, 60))
    await service.drain(QUEUE_NAMES.serverAi)

    expect(fakeProcessor.process).toHaveBeenCalledTimes(2)
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
})
