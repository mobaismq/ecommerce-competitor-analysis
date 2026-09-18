import type { PrismaService } from '../prisma.service'
import type { LocalJobQueueService } from '../queue/local-job-queue.service'
import type { ReportService } from './report.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { ReportWorker } from './report.worker'

describe('ReportWorker', () => {
  let prisma: any
  let reportService: any
  let localQueue: any
  let worker: ReportWorker

  beforeEach(() => {
    prisma = { job: { findUnique: jest.fn(), update: jest.fn() } }
    reportService = { runReport: jest.fn() }
    localQueue = { registerProcessor: jest.fn(), enqueue: jest.fn() }
    worker = new ReportWorker(
      prisma as unknown as PrismaService,
      reportService as unknown as ReportService,
      localQueue as unknown as LocalJobQueueService,
    )
  })

  it('onModuleInit: 注册 server-report 队列处理器', () => {
    worker.onModuleInit()
    expect(localQueue.registerProcessor).toHaveBeenCalledWith(QUEUE_NAMES.serverReport, worker)
  })

  it('process 成功: 置 running、生成报告、并投递 flow-finalizer 触发链式编排', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'j1', type: 'analysis', tenantId: 't1', status: 'queued', attempt: 1 })
    prisma.job.update.mockResolvedValue({})
    reportService.runReport.mockResolvedValue({ ok: true, reportNo: 'R20260918ABCD' })

    const res = await worker.process({ id: 'j1', jobId: 'j1', type: 'analysis', tenantId: 't1', attempt: 1 })

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: expect.objectContaining({ status: 'running', stage: 'analyzing' }),
    })
    expect(reportService.runReport).toHaveBeenCalledWith({ jobId: 'j1', tenantId: 't1', attempt: 1 })
    expect(localQueue.enqueue).toHaveBeenCalledWith(QUEUE_NAMES.flowFinalizer, { jobId: 'j1', tenantId: 't1' })
    expect(res).toEqual(expect.objectContaining({ ok: true, reportNo: 'R20260918ABCD' }))
  })

  it('process 复用: job 已是 success 时不重复生成报告', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: 'j1', type: 'analysis', tenantId: 't1', status: 'success', attempt: 0 })

    const res = await worker.process({ id: 'j1', jobId: 'j1', type: 'analysis', tenantId: 't1', attempt: 0 })

    expect(res).toEqual({ ok: true, reused: true })
    expect(reportService.runReport).not.toHaveBeenCalled()
  })
})