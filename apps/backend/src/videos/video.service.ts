import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { nanoid } from 'nanoid'
import { PrismaService } from '../prisma.service'
import { StorageDriverService } from '../storage/storage.service'
import { NotConfiguredVideoProvider } from './not-configured-video.provider'
import type { VideoProvider } from './video.types'
import { VideoProviderRegistry } from './video-registry'

@Injectable()
export class VideoReplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: VideoProviderRegistry,
    private readonly storageDriverService: StorageDriverService,
  ) {}

  async replicate(input: { tenantId: string; sourceUrl?: string; sourceStorageKey?: string; title?: string }) {
    if (!input.sourceUrl && !input.sourceStorageKey) throw new BadRequestException('sourceUrl 或 sourceStorageKey 必填')
    // 诚实回落：未显式配置 VIDEO_PROVIDER 时不返回假 mp4，明确报"未接入"；测试/开发期可显式 VIDEO_PROVIDER=mock 用演示数据。
    const providerType = process.env.VIDEO_PROVIDER?.trim()
    const provider: VideoProvider = providerType
      ? this.registry.create(providerType)
      : new NotConfiguredVideoProvider('视频复刻')
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

  /** 流式读取视频文件（按 mediaAsset 查询，配合 /api/videos/:id/raw）。 */
  async raw(assetId: string, tenantId: string) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id: assetId, tenantId } })
    if (!asset) throw new NotFoundException('视频素材不存在')
    const driver = this.storageDriverService.getDriver()
    const meta = await driver.head(asset.storageKey)
    if (!meta) throw new NotFoundException('视频文件不存在')
    // readBytes 兼容 local 与 oss，避免 COS 下 getReadUrl 返回 URL 被 readFileSync 误用。
    const { buffer, mimeType } = await driver.readBytes(asset.storageKey)
    return { buffer, mimeType }
  }
}
