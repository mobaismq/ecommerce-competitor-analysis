import { Injectable, UnauthorizedException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma.service'
import { CompleteTaskDto } from './dto/complete-task.dto'
import { FailTaskDto } from './dto/fail-task.dto'
import { RegisterAgentDto } from './dto/register-agent.dto'

const LEASE_TTL_MS = 120_000

function hashSecret(secret: string) {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async register(tenantId: string, dto: RegisterAgentDto) {
    const deviceSecret = crypto.randomBytes(24).toString('hex')
    const agent = await this.prisma.agent.create({
      data: {
        tenantId,
        name: dto.name,
        platform: dto.platform,
        version: dto.version,
        capabilitiesJson: dto.capabilities ? { capabilities: dto.capabilities } : undefined,
        deviceSecretHash: hashSecret(deviceSecret),
        status: 'idle',
      },
    })
    return { agentId: agent.id, deviceSecret }
  }

  async claim(agentId: string, secret: string) {
    await this.verifyAgent(agentId, secret)
    const now = new Date()
    const leaseUntil = new Date(now.getTime() + LEASE_TTL_MS)
    const candidates = await this.prisma.job.findMany({
      where: { status: 'queued', type: { in: ['analysis', 'collection', 'import'] } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })
    for (const job of candidates) {
      try {
        await this.prisma.$transaction([
          this.prisma.agentAssignment.create({
            data: { agentId, jobId: job.id, status: 'claimed', leaseUntil },
          }),
          this.prisma.job.update({
            where: { id: job.id },
            data: { status: 'active', stage: 'collecting', claimDeadline: leaseUntil },
          }),
        ])
        return { jobId: job.id, type: job.type, leaseUntil }
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error
      }
    }
    return { jobId: null }
  }

  async accept(jobId: string, agentId: string, secret: string) {
    await this.verifyAgent(agentId, secret)
    await this.requireAssignment(jobId, agentId)
    await this.prisma.agentAssignment.update({
      where: { jobId },
      data: { status: 'running' },
    })
    return { ok: true }
  }

  async heartbeat(jobId: string, agentId: string, secret: string) {
    await this.verifyAgent(agentId, secret)
    await this.requireAssignment(jobId, agentId)
    const leaseUntil = new Date(Date.now() + LEASE_TTL_MS)
    await this.prisma.agentAssignment.update({ where: { jobId }, data: { leaseUntil, heartbeatAt: new Date() } })
    const job = await this.prisma.job.findUnique({ where: { id: jobId } })
    return { ok: true, cancelled: job?.status === 'cancelled', leaseUntil }
  }

  async complete(jobId: string, agentId: string, secret: string, dto: CompleteTaskDto) {
    await this.verifyAgent(agentId, secret)
    await this.requireAssignment(jobId, agentId)
    await this.prisma.agentAssignment.update({ where: { jobId }, data: { status: 'completed' } })
    await this.prisma.job.update({ where: { id: jobId }, data: { status: 'success', stage: 'success', finishedAt: new Date() } })
    await this.prisma.jobEvent.create({ data: { jobId, type: 'agent-complete', data: { result: dto.result ?? {} } } })
    return { ok: true }
  }

  async fail(jobId: string, agentId: string, secret: string, dto: FailTaskDto) {
    await this.verifyAgent(agentId, secret)
    await this.requireAssignment(jobId, agentId)
    await this.prisma.agentAssignment.update({ where: { jobId }, data: { status: 'failed' } })
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'failure', stage: 'failure', errorMessage: dto.error, finishedAt: new Date() },
    })
    await this.prisma.jobEvent.create({ data: { jobId, type: 'agent-fail', data: { error: dto.error ?? 'agent failed' } } })
    return { ok: true }
  }

  private async verifyAgent(agentId: string, secret: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, deviceSecretHash: hashSecret(secret), status: { not: 'disabled' } },
    })
    if (!agent) throw new UnauthorizedException('Agent 身份校验失败')
  }

  private async requireAssignment(jobId: string, agentId: string) {
    const assignment = await this.prisma.agentAssignment.findFirst({ where: { jobId, agentId } })
    if (!assignment) throw new UnauthorizedException('未领取该任务')
  }
}
