import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { LocalJobQueueService } from '../queue/local-job-queue.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { PrismaService } from '../prisma.service'
import { CreateJobDto } from './dto/create-job.dto'

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localQueue: LocalJobQueueService,
  ) {}

  async create(dto: CreateJobDto, tenantId: string) {
    const businessKey = dto.businessKey ?? this.buildBusinessKey(dto)
    if (dto.providerProfileId) {
      const profile = await this.prisma.providerProfile.findUnique({ where: { id: dto.providerProfileId } })
      if (!profile || !profile.enabled) throw new BadRequestException('ProviderProfile 不存在或已禁用')
    }
    let job
    try {
      job = await this.prisma.job.create({
        data: {
          tenantId,
          type: dto.type,
          businessKey,
          status: 'queued',
          stage: 'queued',
          providerProfileId: dto.providerProfileId,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.job.findUnique({ where: { businessKey } })
        if (!existing) throw error
        return { jobId: existing.id, businessKey, created: false }
      }
      throw error
    }

    const queueName = this.queueNameFor(dto.type)
    await this.localQueue.enqueue(
      queueName,
      { jobId: job.id, tenantId, type: dto.type },
    )

    return { jobId: job.id, businessKey, created: true }
  }

  find(id: string, tenantId: string) {
    return this.prisma.job.findFirst({ where: { id, tenantId } })
  }

  async retry(id: string, tenantId: string) {
    const job = await this.prisma.job.findFirst({ where: { id, tenantId } })
    if (!job) throw new NotFoundException('任务不存在')
    if (job.status !== 'failure' && job.status !== 'cancelled') {
      throw new BadRequestException('仅终态任务可重试')
    }
    const stage = job.checkpointStage ?? 'queued'
    const updated = await this.prisma.job.update({
      where: { id },
      data: { status: 'queued', stage, attempt: job.attempt + 1, errorCode: null, errorMessage: null },
    })
    await this.localQueue.enqueue(
      this.queueNameFor(job.type, job.checkpointStage),
      { jobId: job.id, tenantId, type: job.type },
    )
    return updated
  }

  private buildBusinessKey(dto: CreateJobDto) {
    if (dto.storeId && dto.keyword && dto.analysisType) {
      return `${dto.storeId}|${dto.keyword.trim().toLowerCase()}|${dto.analysisType}`
    }
    throw new BadRequestException('businessKey 或 storeId+keyword+analysisType 必填')
  }

  private queueNameFor(type: string, stage?: string | null) {
    if (type === 'analysis' || type === 'collection' || type === 'import') {
      return QUEUE_NAMES.serverReport
    }
    if (type === 'image-gen' || type === 'image_gen') return QUEUE_NAMES.serverImageGen
    if (type === 'listing') return QUEUE_NAMES.serverListing
    return QUEUE_NAMES.serverAi
  }
}
