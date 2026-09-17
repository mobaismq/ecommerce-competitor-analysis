import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

const SWEEP_INTERVAL_MS = 5000

@Injectable()
export class LeaseSweeper implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: NodeJS.Timeout
  private readonly prisma: PrismaService

  constructor(prisma?: PrismaService) {
    this.prisma = prisma ?? new PrismaService()
  }

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.run(), SWEEP_INTERVAL_MS)
    this.timer.unref?.()
  }

  async run() {
    const expired = await this.prisma.agentAssignment.findMany({
      where: { status: { in: ['claimed', 'running'] }, leaseUntil: { lt: new Date() } },
      select: { jobId: true },
    })
    for (const assignment of expired) {
      await this.prisma.$transaction([
        this.prisma.agentAssignment.update({
          where: { jobId: assignment.jobId },
          data: { status: 'expired' },
        }),
        this.prisma.job.update({
          where: { id: assignment.jobId },
          data: { status: 'failure', stage: 'failure', errorMessage: 'agent lease expired' },
        }),
        this.prisma.jobEvent.create({
          data: { jobId: assignment.jobId, type: 'lease-expired', data: {} },
        }),
      ])
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }
}
