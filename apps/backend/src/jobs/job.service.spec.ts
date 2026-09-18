import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import type { PrismaService } from '../prisma.service'
import type { LocalJobQueueService } from '../queue/local-job-queue.service'
import { JobService } from './job.service'

describe('JobService', () => {
  let prisma: any
  let localQueue: any
  let service: JobService

  beforeEach(() => {
    prisma = {
      providerProfile: {
        findUnique: jest.fn(),
      },
      job: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    }
    localQueue = {
      enqueue: jest.fn().mockResolvedValue('local-q-1'),
    }
    service = new JobService(prisma as unknown as PrismaService, localQueue as unknown as LocalJobQueueService)
  })

  describe('create', () => {
    it('正常创建新任务并入队', async () => {
      prisma.job.create.mockResolvedValue({ id: 'job-1' })

      const res = await service.create(
        {
          type: 'analysis',
          businessKey: 'biz-key-1',
        },
        'tenant-1',
      )

      expect(res.created).toBe(true)
      expect(res.jobId).toBe('job-1')
      expect(localQueue.enqueue).toHaveBeenCalledWith(
        'server-report',
        expect.objectContaining({ jobId: 'job-1', tenantId: 'tenant-1', type: 'analysis' }),
      )
    })

    it('businessKey 重复时幂等返回已有任务且不重复入队', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      })
      prisma.job.create.mockRejectedValue(p2002Error)
      prisma.job.findUnique.mockResolvedValue({ id: 'job-existing' })

      const res = await service.create(
        {
          type: 'analysis',
          businessKey: 'biz-key-duplicate',
        },
        'tenant-1',
      )

      expect(res.created).toBe(false)
      expect(res.jobId).toBe('job-existing')
      expect(localQueue.enqueue).not.toHaveBeenCalled()
    })

    it('指定的 providerProfileId 不存在或已禁用时抛出 BadRequestException', async () => {
      prisma.providerProfile.findUnique.mockResolvedValue({ id: 'prof-1', enabled: false })

      await expect(
        service.create(
          {
            type: 'analysis',
            businessKey: 'biz-key-1',
            providerProfileId: 'prof-1',
          },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('未提供 businessKey 且缺少组合字段时抛出异常', async () => {
      await expect(
        service.create(
          {
            type: 'analysis',
          },
          'tenant-1',
        ),
      ).rejects.toThrow('businessKey 或 storeId+keyword+analysisType 必填')
    })
  })

  describe('retry', () => {
    it('重试不存在的任务抛出 NotFoundException', async () => {
      prisma.job.findFirst.mockResolvedValue(null)
      await expect(service.retry('non-exist', 'tenant-1')).rejects.toThrow(NotFoundException)
    })

    it('非终态任务拒绝重试', async () => {
      prisma.job.findFirst.mockResolvedValue({ id: 'j-running', status: 'running' })
      await expect(service.retry('j-running', 'tenant-1')).rejects.toThrow('仅终态任务可重试')
    })

    it('终态任务重试时递增 attempt、重置错误并重新入队', async () => {
      prisma.job.findFirst.mockResolvedValue({
        id: 'j-failed',
        status: 'failure',
        attempt: 1,
        type: 'analysis',
        checkpointStage: 'reporting',
      })
      prisma.job.update.mockResolvedValue({ id: 'j-failed', status: 'queued', attempt: 2 })

      const res = await service.retry('j-failed', 'tenant-1')
      expect(res.status).toBe('queued')
      expect(prisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'j-failed' },
          data: expect.objectContaining({ status: 'queued', stage: 'reporting', attempt: 2 }),
        }),
      )
      expect(localQueue.enqueue).toHaveBeenCalledWith(
        'server-report',
        expect.objectContaining({ jobId: 'j-failed', tenantId: 'tenant-1', type: 'analysis' }),
      )
    })
  })
})
