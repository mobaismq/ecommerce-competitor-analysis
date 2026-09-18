import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { buildAttemptKey } from '../ai/ai.types'
import { ProviderRouter } from '../ai/provider-router.service'
import { PrismaService } from '../prisma.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { LocalJobQueueService } from '../queue/local-job-queue.service'
import { storeMockImage } from './mock-image-storage'

export const IMAGE_REVIEW_DECISIONS = ['approved', 'rejected', 'regenerate'] as const
export type ImageReviewDecision = (typeof IMAGE_REVIEW_DECISIONS)[number]
export const MAX_REGENERATE = 3

@Injectable()
export class ImageFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouter,
    private readonly localQueue: LocalJobQueueService,
  ) {}

  async generate(input: { jobId: string; tenantId: string; attempt?: number; prompt?: string }) {
    const job = await this.prisma.job.findUnique({ where: { id: input.jobId } })
    if (!job || job.tenantId !== input.tenantId) throw new NotFoundException('任务不存在')
    if (job.type !== 'image-gen' && job.type !== 'image_gen') {
      throw new BadRequestException('image-gen worker 仅处理图片生成任务')
    }

    const promptEvent = await this.prisma.jobEvent.findFirst({
      where: { jobId: job.id, type: 'image-prompt' },
      orderBy: { createdAt: 'desc' },
    })
    const promptData = promptEvent?.data as { prompt?: string; model?: string } | null
    const prompt = input.prompt ?? promptData?.prompt ?? `为任务 ${job.id} 生成商品主图`
    const attemptKey = buildAttemptKey({
      jobId: job.id,
      capability: 'image',
      attempt: input.attempt ?? job.attempt,
      suffix: 'generate',
    })
    const aiResult = await this.router.execute(
      'image',
      { prompt, count: 1, size: process.env.IMAGE_GEN_SIZE ?? '1024x1024' },
      { tenantId: input.tenantId, jobId: job.id, attemptKey },
    )

    const stored = storeMockImage(job.id, 0)
    const asset = await this.prisma.generatedAsset.create({
      data: {
        tenantId: input.tenantId,
        jobId: job.id,
        runId: job.id,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        size: stored.size,
        sourceUrl: aiResult.images?.[0] ? aiResult.images[0].slice(0, 191) : null,
      },
    })
    const review = await this.prisma.reviewRecord.create({
      data: {
        tenantId: input.tenantId,
        jobId: job.id,
        assetId: asset.id,
        reviewType: 'generated_image',
        decision: 'pending',
      },
    })
    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: 'running', stage: 'reviewing', checkpointStage: 'reviewing' },
    })
    await this.prisma.jobEvent.create({
      data: { jobId: job.id, type: 'image-generated', data: { model: aiResult.model, assetId: asset.id, reviewId: review.id } },
    })
    return { assetId: asset.id, reviewId: review.id, storageKey: stored.storageKey, absolutePath: stored.absolutePath }
  }

  async decideReview(input: { reviewId: string; decision: ImageReviewDecision; reviewerId?: string }) {
    if (!IMAGE_REVIEW_DECISIONS.includes(input.decision)) {
      throw new BadRequestException(`非法审核决策: ${String(input.decision)}`)
    }
    const review = await this.prisma.reviewRecord.findUnique({ where: { id: input.reviewId } })
    if (!review) throw new NotFoundException('审核记录不存在')
    if (review.decision !== 'pending') throw new BadRequestException('审核记录已处理')

    await this.prisma.reviewRecord.update({
      where: { id: review.id },
      data: { decision: input.decision, reviewerId: input.reviewerId, reviewedAt: new Date() },
    })
    const job = await this.prisma.job.findUnique({ where: { id: review.jobId } })
    if (!job) throw new NotFoundException('任务不存在')

    if (input.decision === 'regenerate') {
      const regenerateCount = await this.prisma.reviewRecord.count({
        where: { jobId: job.id, decision: 'regenerate' },
      })
      if (regenerateCount > MAX_REGENERATE) {
        await this.prisma.job.update({
          where: { id: job.id },
          data: { status: 'failure', stage: 'failure', checkpointStage: 'reviewing', errorCode: 'REGENERATE_LIMIT' },
        })
        throw new BadRequestException(`达到重新生成上限 ${MAX_REGENERATE} 次`)
      }
      await this.prisma.job.update({
        where: { id: job.id },
        data: { status: 'queued', stage: 'generating', checkpointStage: 'generating' },
      })
      await this.localQueue.enqueue(
        QUEUE_NAMES.serverImageGen,
        { jobId: job.id, tenantId: job.tenantId, type: job.type },
      )
      return { decision: input.decision, regenerated: true, regenerateCount }
    }

    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: 'success', stage: 'success', checkpointStage: 'reviewing' },
    })
    return { decision: input.decision, regenerated: false }
  }
}
