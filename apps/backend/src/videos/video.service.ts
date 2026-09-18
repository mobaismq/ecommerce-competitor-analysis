import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { nanoid } from 'nanoid'
import { PrismaService } from '../prisma.service'
import { VideoProviderRegistry } from './video-registry'

@Injectable()
export class VideoReplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: VideoProviderRegistry,
  ) {}

  async replicate(input: { tenantId: string; sourceUrl?: string; sourceStorageKey?: string; title?: string }) {
    if (!input.sourceUrl && !input.sourceStorageKey) throw new BadRequestException('sourceUrl 或 sourceStorageKey 必填')
    const provider = this.registry.create(process.env.VIDEO_PROVIDER ?? 'mock')
    const sourceKey = input.sourceStorageKey ?? `video-sources/${nanoid()}.mp4`
    const source = await this.prisma.mediaAsset.create({
      data: {
        tenantId: input.tenantId,
        sourceType: 'video_source',
        storageKey: sourceKey,
        mimeType: 'video/mp4',
        size: 0,
        sourceUrl: input.sourceUrl,
        originalName: input.title,
      },
    })
    const job = await this.prisma.job.create({
      data: {
        tenantId: input.tenantId,
        type: 'video_replication',
        businessKey: `video-replication:${input.tenantId}:${source.id}:${nanoid(8)}`,
        status: 'running',
        stage: 'processing',
        startedAt: new Date(),
      },
    })
    const result = await provider.replicate({ jobId: job.id, sourceUrl: input.sourceUrl, sourceStorageKey: source.storageKey, title: input.title })
    if (result.status !== 'success' || !result.storageKey) {
      await this.prisma.job.update({ where: { id: job.id }, data: { status: 'failure', stage: 'failure', errorCode: 'VIDEO_REPLICATION_FAILED', errorMessage: result.error } })
      throw new BadRequestException(result.error ?? '视频复刻失败')
    }
    const output = await this.prisma.mediaAsset.create({
      data: {
        tenantId: input.tenantId,
        sourceType: 'video_replication',
        storageKey: result.storageKey,
        mimeType: result.mimeType ?? 'video/mp4',
        size: result.size ?? 0,
        sourceUrl: input.sourceUrl,
        originalName: input.title ? `${input.title}-复刻` : 'mock-video-replication',
      },
    })
    await this.prisma.job.update({ where: { id: job.id }, data: { status: 'success', stage: 'success', finishedAt: new Date() } })
    await this.prisma.jobEvent.create({ data: { jobId: job.id, type: 'video-replicated', data: { sourceAssetId: source.id, outputAssetId: output.id, provider: provider.type } } })
    return { jobId: job.id, status: 'success', sourceAssetId: source.id, outputAssetId: output.id, provider: provider.type }
  }

  async find(jobId: string, tenantId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, tenantId, type: 'video_replication' } })
    if (!job) throw new NotFoundException('视频复刻任务不存在')
    const events = await this.prisma.jobEvent.findMany({ where: { jobId }, orderBy: { createdAt: 'asc' } })
    return { job, events }
  }

  list(tenantId: string) {
    return this.prisma.mediaAsset.findMany({
      where: { tenantId, sourceType: { in: ['video_source', 'video_replication'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }
}
