import type { PrismaService } from '../prisma.service'
import { LeaseSweeper } from './lease-sweeper'

function makePrismaMock(expired: { jobId: string }[]) {
  return {
    agentAssignment: {
      findMany: jest.fn().mockResolvedValue(expired),
      update: jest.fn(),
    },
    job: { update: jest.fn() },
    jobEvent: { create: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
  }
}

describe('LeaseSweeper', () => {
  it('没有过期 assignment 时不触发任何事务', async () => {
    const prisma = makePrismaMock([])
    const sweeper = new LeaseSweeper(prisma as unknown as PrismaService)
    await sweeper.run()
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.agentAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['claimed', 'running'] },
          leaseUntil: { lt: expect.any(Date) },
        }),
      }),
    )
  })

  it('存在过期 assignment 时将其置为 expired、任务失败并记录事件', async () => {
    const prisma = makePrismaMock([{ jobId: 'j1' }])
    const sweeper = new LeaseSweeper(prisma as unknown as PrismaService)
    await sweeper.run()

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.agentAssignment.update).toHaveBeenCalledWith({
      where: { jobId: 'j1' },
      data: { status: 'expired' },
    })
    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: { status: 'failure', stage: 'failure', errorMessage: 'agent lease expired' },
    })
    expect(prisma.jobEvent.create).toHaveBeenCalledWith({
      data: { jobId: 'j1', type: 'lease-expired', data: {} },
    })
  })

  it('多个过期 assignment 各自触发一次事务', async () => {
    const prisma = makePrismaMock([{ jobId: 'j1' }, { jobId: 'j2' }, { jobId: 'j3' }])
    const sweeper = new LeaseSweeper(prisma as unknown as PrismaService)
    await sweeper.run()
    expect(prisma.$transaction).toHaveBeenCalledTimes(3)
    expect(prisma.agentAssignment.update).toHaveBeenCalledWith({ where: { jobId: 'j3' }, data: { status: 'expired' } })
  })
})