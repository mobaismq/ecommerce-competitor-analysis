import * as crypto from 'crypto'
import { UnauthorizedException } from '@nestjs/common'
import type { PrismaService } from '../prisma.service'
import type { QueueService } from '../queue/queue.service'
import { AgentService } from './agent.service'

function hashSecret(secret: string) {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

describe('AgentService', () => {
  let prisma: any
  let queueService: any
  let mockBullJob: any
  let service: AgentService

  beforeEach(() => {
    prisma = {
      agent: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'agent-1', ...data })),
        findFirst: jest.fn(),
      },
      job: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'job-100', status: 'active' }),
        update: jest.fn().mockResolvedValue({ id: 'job-100' }),
      },
      agentAssignment: {
        create: jest.fn().mockResolvedValue({ id: 'assign-1' }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'assign-1' }),
      },
      jobEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
    }

    mockBullJob = {
      moveToCompleted: jest.fn().mockResolvedValue(undefined),
      moveToFailed: jest.fn().mockResolvedValue(undefined),
    }

    queueService = {
      getQueue: jest.fn().mockReturnValue({
        getJob: jest.fn().mockResolvedValue(mockBullJob),
      }),
      addJob: jest.fn().mockResolvedValue({ id: 'q-job-1' }),
    }

    service = new AgentService(prisma as unknown as PrismaService, queueService as unknown as QueueService)
  })

  it('register: 正确注册设备并返回原始 secret', async () => {
    const res = await service.register('tenant-1', {
      name: 'Agent-Mac',
      platform: 'darwin',
      version: '1.0.0',
    })

    expect(res.agentId).toBe('agent-1')
    expect(res.deviceSecret).toBeDefined()
    expect(prisma.agent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Agent-Mac',
          status: 'idle',
        }),
      }),
    )
  })

  it('claim: 凭证无效时抛出 UnauthorizedException', async () => {
    prisma.agent.findFirst.mockResolvedValue(null)
    await expect(service.claim('agent-1', 'bad-secret')).rejects.toThrow(UnauthorizedException)
  })

  it('claim: 存在候选任务时在事务中创建认领与更新状态', async () => {
    const rawSecret = 'valid-secret-token'
    prisma.agent.findFirst.mockResolvedValue({
      id: 'agent-1',
      deviceSecretHash: hashSecret(rawSecret),
    })
    prisma.job.findMany.mockResolvedValue([
      { id: 'job-100', type: 'analysis', status: 'queued' },
    ])

    const res = await service.claim('agent-1', rawSecret)
    expect(res).toBeDefined()
    expect(res?.jobId).toBe('job-100')
    expect(res?.type).toBe('analysis')
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.agentAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agentId: 'agent-1', jobId: 'job-100', status: 'claimed' }),
      }),
    )
  })

  it('heartbeat: 延长 assignment 租约并返回状态', async () => {
    const rawSecret = 'valid-secret-token'
    prisma.agent.findFirst.mockResolvedValue({
      id: 'agent-1',
      deviceSecretHash: hashSecret(rawSecret),
    })
    prisma.agentAssignment.findFirst.mockResolvedValue({
      id: 'assign-1',
      status: 'claimed',
      jobId: 'job-100',
    })

    const res = await service.heartbeat('job-100', 'agent-1', rawSecret)
    expect(res.ok).toBe(true)
    expect(res.leaseUntil).toBeDefined()
    expect(prisma.agentAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: 'job-100' },
        data: expect.objectContaining({ leaseUntil: expect.any(Date) }),
      }),
    )
  })

  it('complete: 更新任务与认领状态为完成', async () => {
    const rawSecret = 'valid-secret-token'
    prisma.agent.findFirst.mockResolvedValue({
      id: 'agent-1',
      deviceSecretHash: hashSecret(rawSecret),
    })
    prisma.agentAssignment.findFirst.mockResolvedValue({
      id: 'assign-1',
      status: 'claimed',
      jobId: 'job-100',
    })

    const res = await service.complete('job-100', 'agent-1', rawSecret, {
      result: { competitorCount: 5 },
    })
    expect(res.ok).toBe(true)
    expect(prisma.agentAssignment.update).toHaveBeenCalledWith({
      where: { jobId: 'job-100' },
      data: { status: 'completed' },
    })
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-100' },
        data: expect.objectContaining({ status: 'success', stage: 'success' }),
      }),
    )
    expect(mockBullJob.moveToCompleted).toHaveBeenCalled()
  })

  it('fail: 认领与任务标记为失败', async () => {
    const rawSecret = 'valid-secret-token'
    prisma.agent.findFirst.mockResolvedValue({
      id: 'agent-1',
      deviceSecretHash: hashSecret(rawSecret),
    })
    prisma.agentAssignment.findFirst.mockResolvedValue({
      id: 'assign-1',
      status: 'claimed',
      jobId: 'job-100',
    })

    const res = await service.fail('job-100', 'agent-1', rawSecret, {
      error: 'RPA network timeout',
    })
    expect(res.ok).toBe(true)
    expect(prisma.agentAssignment.update).toHaveBeenCalledWith({
      where: { jobId: 'job-100' },
      data: { status: 'failed' },
    })
    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-100' },
        data: expect.objectContaining({ status: 'failure', errorMessage: 'RPA network timeout' }),
      }),
    )
    expect(mockBullJob.moveToFailed).toHaveBeenCalled()
  })
})
