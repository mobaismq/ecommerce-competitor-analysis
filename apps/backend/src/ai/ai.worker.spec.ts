import type { PrismaService } from '../prisma.service'
import type { LocalJobQueueService } from '../queue/local-job-queue.service'
import type { ProviderRouter } from './provider-router.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { AiWorker } from './ai.worker'

describe('AiWorker', () => {
  let prisma: any
  let router: any
  let localQueue: any
  let worker: AiWorker

  beforeEach(() => {
    prisma = { job: { findUnique: jest.fn(), update: jest.fn() }, jobEvent: { create: jest.fn() } }
    router = { execute: jest.fn() }
    localQueue = { registerProcessor: jest.fn(), enqueue: jest.fn() }
    worker = new AiWorker(
      prisma as unknown as PrismaService,
      router as unknown as ProviderRouter,
      localQueue as unknown as LocalJobQueueService,
    )
  })

  it('onModuleInit: 注册 server-ai 队列处理器', () => {
    worker.onModuleInit()
    expect(localQueue.registerProcessor).toHaveBeenCalledWith(QUEUE_NAMES.serverAi, worker)
  })

  it('process(analysis): 仅记录延期事件，不调用大模型，不派发下游', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'j1', type: 'analysis', tenantId: 't1', status: 'queued', attempt: 0 })

    const res = await worker.process({ id: 'j1', jobId: 'j1', type: 'analysis', tenantId: 't1', attempt: 0 })

    expect(res).toEqual({ ok: true, deferred: true, reason: 'report-pipeline' })
    expect(router.execute).not.toHaveBeenCalled()
    expect(localQueue.enqueue).not.toHaveBeenCalled()
    expect(prisma.jobEvent.create).toHaveBeenCalledWith({
      data: { jobId: 'j1', type: 'ai-attempt', data: { deferred: true, reason: 'report-pipeline' } },
    })
  })

  it('process: 缺失 jobId/tenantId 时抛出异常', async () => {
    await expect(worker.process({ id: '', jobId: '', type: 'ai', tenantId: '', attempt: 0 })).rejects.toThrow()
  })
})