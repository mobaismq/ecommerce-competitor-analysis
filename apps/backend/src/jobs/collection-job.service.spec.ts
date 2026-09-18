import { NotFoundException } from '@nestjs/common'
import type { PrismaService } from '../prisma.service'
import type { LocalJobQueueService } from '../queue/local-job-queue.service'
import { CollectionJobService } from './collection-job.service'

describe('CollectionJobService', () => {
  let prisma: any
  let localQueue: any
  let service: CollectionJobService

  beforeEach(() => {
    prisma = {
      job: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      collectionJob: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      sourceFileRecord: {
        createMany: jest.fn(),
      },
      productSnapshot: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      productSkuSnapshot: {
        createMany: jest.fn(),
      },
      productQaSnapshot: {
        createMany: jest.fn(),
      },
      productReviewSnapshot: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    }

    localQueue = {
      enqueue: jest.fn().mockResolvedValue('local-q-id'),
    }

    service = new CollectionJobService(
      prisma as unknown as PrismaService,
      localQueue as unknown as LocalJobQueueService,
    )
  })

  it('任务不存在时抛出 NotFoundException', async () => {
    prisma.job.findFirst.mockResolvedValue(null)

    await expect(
      service.importResults('non-exist', 'tenant-1', {
        dataSnapshotDate: '2026-09-18',
        products: [],
      }),
    ).rejects.toThrow(NotFoundException)
  })

  it('已导入成功的数据幂等返回且不重复入队', async () => {
    prisma.job.findFirst.mockResolvedValue({ id: 'job-1', type: 'analysis' })
    prisma.collectionJob.findUnique.mockResolvedValue({ id: 'cj-1', status: 'success' })

    const res = await service.importResults('job-1', 'tenant-1', {
      dataSnapshotDate: '2026-09-18',
      products: [],
    })

    expect(res).toEqual({ imported: false, jobId: 'job-1', existing: true })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(localQueue.enqueue).not.toHaveBeenCalled()
  })

  it('analysis 任务导入数据后更新 stage 为 analyzing 并派发 server-report 任务', async () => {
    prisma.job.findFirst.mockResolvedValue({ id: 'job-analysis', type: 'analysis' })
    prisma.collectionJob.findUnique.mockResolvedValue(null)
    prisma.productSnapshot.findUnique.mockResolvedValue({ id: 'snap-1' })

    const res = await service.importResults('job-analysis', 'tenant-1', {
      dataSnapshotDate: '2026-09-18',
      products: [
        {
          externalProductId: 'p-1',
          title: '测试竞品',
          price: '99.9',
          skus: [{ skuId: 'sku-1', name: '规格1', price: '99.9' }],
          reviews: [{ content: '好评', rating: 5 }],
          qas: [{ question: '好用吗？', answer: '好用' }],
        },
      ],
    })

    expect(res.imported).toBe(true)
    if ('counts' in res) {
      expect(res.counts.productCount).toBe(1)
      expect(res.counts.skuCount).toBe(1)
      expect(res.counts.reviewCount).toBe(1)
      expect(res.counts.qaCount).toBe(1)
    } else {
      throw new Error('expected counts in res')
    }

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-analysis' },
      data: {
        status: 'queued',
        stage: 'analyzing',
        checkpointStage: 'analyzing',
      },
    })

    expect(localQueue.enqueue).toHaveBeenCalledWith(
      'server-report',
      {
        jobId: 'job-analysis',
        tenantId: 'tenant-1',
        type: 'analysis',
      },
    )
  })

  it('纯 collection 任务导入后直接更新为 success 且不入队 server-report', async () => {
    prisma.job.findFirst.mockResolvedValue({ id: 'job-col', type: 'collection' })
    prisma.collectionJob.findUnique.mockResolvedValue(null)

    const res = await service.importResults('job-col', 'tenant-1', {
      dataSnapshotDate: '2026-09-18',
      products: [],
    })

    expect(res.imported).toBe(true)
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-col' },
      data: {
        status: 'success',
        stage: 'success',
      },
    })
    expect(localQueue.enqueue).not.toHaveBeenCalled()
  })
})
