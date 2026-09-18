import type { PrismaService } from '../prisma.service'
import type { LocalJobQueueService } from './local-job-queue.service'
import { QUEUE_NAMES } from './queue-names'
import { FlowFinalizerWorker } from './queue.workers'

describe('FlowFinalizerWorker', () => {
  let prisma: any
  let localQueue: any
  let worker: FlowFinalizerWorker

  beforeEach(() => {
    prisma = {
      job: {
        update: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      jobEvent: {
        create: jest.fn(),
      },
      systemConfig: {
        findUnique: jest.fn(),
      },
    }
    localQueue = {
      registerProcessor: jest.fn(),
      enqueue: jest.fn().mockResolvedValue('local-q-id'),
    }
    worker = new FlowFinalizerWorker(
      prisma as unknown as PrismaService,
      localQueue as unknown as LocalJobQueueService,
    )
  })

  it('模块初始化时注册 flowFinalizer 队列处理器', () => {
    worker.onModuleInit()
    expect(localQueue.registerProcessor).toHaveBeenCalledWith(QUEUE_NAMES.flowFinalizer, worker)
  })

  describe('process', () => {
    it('缺失 jobId 时返回错误对象', async () => {
      const res = await worker.process({ id: 'x', jobId: '', tenantId: 't', type: 'analysis', attempt: 0 })
      expect(res).toEqual({ ok: false, reason: 'missing jobId' })
    })

    it('正常终态处理并触发 maybeChain', async () => {
      prisma.job.findUnique.mockResolvedValue(null) // maybeChain 查不到则直接结束

      const res = await worker.process({ id: 'job-1', jobId: 'job-1', tenantId: 'tenant-1', type: 'analysis', attempt: 0 })

      expect(res).toEqual({ ok: true, queue: QUEUE_NAMES.flowFinalizer, jobId: 'job-1' })
      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'success', stage: 'success' },
      })
      expect(prisma.jobEvent.create).toHaveBeenCalledWith({
        data: { jobId: 'job-1', type: 'flow-finalizer', data: { result: 'all children completed' } },
      })
    })
  })

  describe('maybeChain', () => {
    it('当 systemConfig 未开启 autoChain 时不派发下游任务', async () => {
      prisma.job.findUnique.mockResolvedValue({ id: 'job-src', type: 'analysis', tenantId: 't1' })
      prisma.systemConfig.findUnique.mockResolvedValue(null)

      await worker.maybeChain('job-src')

      expect(prisma.job.create).not.toHaveBeenCalled()
      expect(localQueue.enqueue).not.toHaveBeenCalled()
    })

    it('当 analysis 任务成功且开启 analysisToImageGen 时自动创建并入队 image-gen 任务', async () => {
      prisma.job.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'job-src') {
          return Promise.resolve({ id: 'job-src', type: 'analysis', tenantId: 't1' })
        }
        if (where.businessKey === 'job-src:image-gen') {
          return Promise.resolve(null)
        }
        return Promise.resolve(null)
      })
      prisma.systemConfig.findUnique.mockResolvedValue({
        value: JSON.stringify({ analysisToImageGen: true }),
      })
      prisma.job.create.mockResolvedValue({ id: 'job-downstream', type: 'image-gen' })

      await worker.maybeChain('job-src')

      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't1',
          type: 'image-gen',
          businessKey: 'job-src:image-gen',
          status: 'queued',
          stage: 'queued',
          parentJobId: 'job-src',
        },
      })
      expect(localQueue.enqueue).toHaveBeenCalledWith(
        QUEUE_NAMES.serverImageGen,
        {
          jobId: 'job-downstream',
          tenantId: 't1',
          type: 'image-gen',
        },
      )
    })

    it('当 image-gen 任务成功且开启 imageGenToListing 时自动创建并入队 listing 任务', async () => {
      prisma.job.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'job-img') {
          return Promise.resolve({ id: 'job-img', type: 'image-gen', tenantId: 't1' })
        }
        if (where.businessKey === 'job-img:listing') {
          return Promise.resolve(null)
        }
        return Promise.resolve(null)
      })
      prisma.systemConfig.findUnique.mockResolvedValue({
        value: JSON.stringify({ imageGenToListing: true }),
      })
      prisma.job.create.mockResolvedValue({ id: 'job-list', type: 'listing' })

      await worker.maybeChain('job-img')

      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't1',
          type: 'listing',
          businessKey: 'job-img:listing',
          status: 'queued',
          stage: 'queued',
          parentJobId: 'job-img',
        },
      })
      expect(localQueue.enqueue).toHaveBeenCalledWith(
        QUEUE_NAMES.serverListing,
        {
          jobId: 'job-list',
          tenantId: 't1',
          type: 'listing',
        },
      )
    })

    it('下游任务已存在时幂等不重复入队', async () => {
      prisma.job.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'job-src') {
          return Promise.resolve({ id: 'job-src', type: 'analysis', tenantId: 't1' })
        }
        if (where.businessKey === 'job-src:image-gen') {
          return Promise.resolve({ id: 'job-existing-downstream' })
        }
        return Promise.resolve(null)
      })
      prisma.systemConfig.findUnique.mockResolvedValue({
        value: JSON.stringify({ analysisToImageGen: true }),
      })

      await worker.maybeChain('job-src')

      expect(prisma.job.create).not.toHaveBeenCalled()
      expect(localQueue.enqueue).not.toHaveBeenCalled()
    })
  })
})
