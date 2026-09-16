import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PlatformAdapterService } from '../platform/platform.service'
import type { PlatformListingInput } from '../platform/platform.types'
import { PrismaService } from '../prisma.service'

@Injectable()
export class ListingFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAdapterService: PlatformAdapterService,
  ) {}

  async uploadAssets(input: { jobId: string; tenantId: string }) {
    const job = await this.prisma.job.findUnique({ where: { id: input.jobId } })
    if (!job || job.tenantId !== input.tenantId) throw new NotFoundException('任务不存在')
    if (job.type !== 'listing') throw new BadRequestException('listing 流程仅处理平台发布任务')

    const latestGen = await this.prisma.job.findFirst({
      where: { tenantId: input.tenantId, status: 'success', type: { in: ['image-gen', 'image_gen'] }, finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    })
    const assets = latestGen
      ? await this.prisma.generatedAsset.findMany({ where: { jobId: latestGen.id }, take: 20 })
      : []
    if (assets.length === 0) throw new BadRequestException('没有可上传的生成资产')
    const contentJson: Prisma.InputJsonValue = {
      sourceGenerationJobId: latestGen?.id,
      assetIds: assets.map((asset) => asset.id),
      storageKeys: assets.map((asset) => asset.storageKey),
    }
    const draft = await this.prisma.listingDraft.upsert({
      where: { jobId: job.id },
      update: { status: 'assets_uploaded', contentJson },
      create: { tenantId: input.tenantId, jobId: job.id, status: 'assets_uploaded', contentJson },
    })
    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: 'running', stage: 'uploading_assets', checkpointStage: 'uploading_assets' },
    })
    await this.prisma.jobEvent.create({
      data: { jobId: job.id, type: 'listing-assets', data: { assetCount: assets.length, storageKeys: (contentJson as { storageKeys: string[] }).storageKeys } },
    })
    return { draftId: draft.id, assetCount: assets.length, storageKeys: (contentJson as { storageKeys: string[] }).storageKeys }
  }

  async submit(input: { jobId: string; tenantId: string; platformCode?: string }) {
    const job = await this.prisma.job.findUnique({ where: { id: input.jobId } })
    if (!job || job.tenantId !== input.tenantId) throw new NotFoundException('任务不存在')
    const draft = await this.prisma.listingDraft.findUnique({ where: { jobId: job.id } })
    if (!draft || draft.status !== 'assets_uploaded') throw new BadRequestException('请先完成资产上传')

    const adapter = this.platformAdapterService.getAdapter(input.platformCode ?? 'taobao')
    const listingInput: PlatformListingInput = { jobId: job.id, draftId: draft.id, title: draft.title ?? undefined, contentJson: draft.contentJson }
    const result = adapter.submitListing ? await adapter.submitListing(listingInput) : { status: 'success' as const, rawPayload: { kind: 'manual' } }
    if (result.status !== 'success') {
      await this.prisma.listingDraft.update({ where: { id: draft.id }, data: { status: 'failed' } })
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failure',
          stage: 'submitting_listing',
          checkpointStage: 'submitting_listing',
          errorCode: 'LISTING_SUBMIT_FAILED',
          errorMessage: result.error ?? '平台发布失败',
        },
      })
      throw new BadRequestException(result.error ?? '平台发布失败')
    }
    await this.prisma.listingDraft.update({ where: { id: draft.id }, data: { status: 'submitted' } })
    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: 'success', stage: 'success', checkpointStage: 'submitting_listing' },
    })
    await this.prisma.jobEvent.create({ data: { jobId: job.id, type: 'listing-submitted', data: { draftId: draft.id } } })
    return { draftId: draft.id, status: 'success', rawPayload: result.rawPayload }
  }
}
