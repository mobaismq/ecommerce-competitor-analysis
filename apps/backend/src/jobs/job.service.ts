import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { LocalJobQueueService } from '../queue/local-job-queue.service'
import { resolveQueueName } from '../queue/queue-names'
import { PrismaService } from '../prisma.service'
import { CreateJobDto } from './dto/create-job.dto'

export interface ListJobsOptions {
  type?: string
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
}

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localQueue: LocalJobQueueService,
  ) {}

  async create(dto: CreateJobDto, tenantId: string, userId?: string) {
    const businessKey = dto.businessKey ?? this.buildBusinessKey(dto)
    if (dto.providerProfileId) {
      const profile = await this.prisma.providerProfile.findUnique({ where: { id: dto.providerProfileId } })
      if (!profile || !profile.enabled) throw new BadRequestException('ProviderProfile 不存在或已禁用')
    }
    const initialStage = dto.type === 'analysis' ? 'collecting' : 'queued'
    const params = {
      ...(dto.minPrice !== undefined ? { minPrice: dto.minPrice } : {}),
      ...(dto.maxPrice !== undefined ? { maxPrice: dto.maxPrice } : {}),
      ...(dto.topN !== undefined ? { topN: dto.topN } : {}),
      ...(dto.limit !== undefined ? { limit: dto.limit } : {}),
      ...(dto.searchPages !== undefined ? { searchPages: dto.searchPages } : {}),
      ...(dto.autoParse !== undefined ? { autoParse: dto.autoParse } : {}),
    }
    let job
    try {
      job = await this.prisma.job.create({
        data: {
          tenantId,
          type: dto.type,
          businessKey,
          status: 'queued',
          stage: initialStage,
          providerProfileId: dto.providerProfileId,
          userId,
          ...(Object.keys(params).length ? { paramsJson: params as Prisma.InputJsonValue } : {}),
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

    const queueName = resolveQueueName(dto.type, initialStage)
    if (queueName) {
      await this.localQueue.enqueue(
        queueName,
        { jobId: job.id, tenantId, type: dto.type },
      )
    }

    return { jobId: job.id, businessKey, created: true }
  }

  find(id: string, tenantId: string) {
    return this.prisma.job.findFirst({ where: { id, tenantId } })
  }

  async list(tenantId: string, options: ListJobsOptions = {}) {
    const { type, status, keyword } = options
    const where: Prisma.JobWhereInput = {
      tenantId,
      ...(type?.trim() ? { type: type.trim() } : {}),
      ...(status?.trim() ? { status: status.trim() } : {}),
      ...(keyword?.trim() ? { businessKey: { contains: keyword.trim() } } : {}),
    }
    const page = options.page && options.page > 0 ? options.page : undefined
    const pageSize = options.pageSize && options.pageSize > 0 ? Math.min(options.pageSize, 100) : undefined
    if (page === undefined || pageSize === undefined) {
      return this.prisma.job.findMany({ where, orderBy: { createdAt: 'desc' } })
    }
    const [rows, total] = await Promise.all([
      this.prisma.job.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.job.count({ where }),
    ])
    return { rows, total, page, pageSize }
  }

  /** 取消任务：仅在可取消状态（queued/running/collecting/analyzing/reporting）生效，并落库终态 cancelled。 */
  async cancel(id: string, tenantId: string) {
    const job = await this.prisma.job.findFirst({ where: { id, tenantId } })
    if (!job) throw new NotFoundException('任务不存在')
    const cancellable = ['queued', 'running', 'collecting', 'analyzing', 'reporting']
    if (!cancellable.includes(job.status)) {
      throw new BadRequestException('仅进行中或排队任务可取消')
    }
    return this.prisma.job.update({
      where: { id },
      data: { status: 'cancelled', stage: job.stage, finishedAt: new Date() },
    })
  }

  async retry(id: string, tenantId: string) {
    const job = await this.prisma.job.findFirst({ where: { id, tenantId } })
    if (!job) throw new NotFoundException('任务不存在')
    if (job.status !== 'failure' && job.status !== 'cancelled') {
      throw new BadRequestException('仅终态任务可重试')
    }
    const stage = job.checkpointStage ?? (job.type === 'analysis' ? 'collecting' : 'queued')
    const updated = await this.prisma.job.update({
      where: { id },
      data: { status: 'queued', stage, attempt: job.attempt + 1, errorCode: null, errorMessage: null },
    })
    const queueName = resolveQueueName(job.type, stage)
    if (queueName) {
      await this.localQueue.enqueue(
        queueName,
        { jobId: job.id, tenantId, type: job.type },
      )
    }
    return updated
  }

  private buildBusinessKey(dto: CreateJobDto) {
    if (dto.storeId && dto.keyword && dto.analysisType) {
      return `${dto.storeId}|${dto.keyword.trim().toLowerCase()}|${dto.analysisType}`
    }
    throw new BadRequestException('businessKey 或 storeId+keyword+analysisType 必填')
  }
}
