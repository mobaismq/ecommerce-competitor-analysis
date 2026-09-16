import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface AiAttemptInput {
  tenantId: string
  jobId?: string
  attemptKey: string
  providerProfileId?: string
  providerType: string
  model?: string
}

export interface AiAttemptPatch {
  status: 'success' | 'failure'
  tokenIn?: number
  tokenOut?: number
  durationMs?: number
  error?: string
}

@Injectable()
export class AiAuditService {
  constructor(private readonly prisma: PrismaService) {}

  recordAttempt(input: AiAttemptInput) {
    return this.prisma.aiUsageLog.create({ data: { ...input, status: 'running' } })
  }

  recordOrReset(input: AiAttemptInput) {
    return this.prisma.aiUsageLog.upsert({
      where: { attemptKey: input.attemptKey },
      update: { ...input, status: 'running' },
      create: { ...input, status: 'running' },
    })
  }

  complete(attemptKey: string, patch: AiAttemptPatch) {
    return this.prisma.aiUsageLog.update({ where: { attemptKey }, data: patch })
  }

  findSuccess(attemptKey: string) {
    return this.prisma.aiUsageLog.findUnique({ where: { attemptKey } })
  }
}
