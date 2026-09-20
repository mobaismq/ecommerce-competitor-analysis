import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { LocalJobQueueService } from '../queue/local-job-queue.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { CollectionResultDto } from './dto/collection-result.dto'

@Injectable()
export class CollectionJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localQueue: LocalJobQueueService,
  ) {}

  async importResults(jobId: string, tenantId: string, dto: CollectionResultDto) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, tenantId } })
    if (!job) throw new NotFoundException('任务不存在')

    const existing = await this.prisma.collectionJob.findUnique({ where: { jobId } })
    if (existing?.status === 'success') return { imported: false, jobId, existing: true }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.collectionJob.upsert({
        where: { jobId },
        update: { status: 'success', rawResultJson: dto as unknown as Prisma.InputJsonValue },
        create: {
          tenantId,
          jobId,
          type: job.type,
          status: 'success',
          rawResultJson: dto as unknown as Prisma.InputJsonValue,
        },
      })

      let fileCount = 0
      if (dto.files?.length) {
        await tx.sourceFileRecord.createMany({
          data: dto.files.map((file) => ({
            tenantId,
            collectionJobId: jobId,
            storageKey: file.storageKey,
            mimeType: file.mimeType,
            size: file.size,
            originalName: file.originalName,
            sha256: file.sha256,
            sourceUrl: file.sourceUrl,
          })),
          skipDuplicates: true,
        })
        fileCount = dto.files.length
      }

      let skuCount = 0
      let qaCount = 0
      let reviewCount = 0
      const productCount = dto.products?.length ?? 0
      for (const product of dto.products ?? []) {
        const snapshotTime = new Date(dto.dataSnapshotDate)
        // 采集侧可选回传的月销/商品主图写入 rawJson（无则不动），供富报告使用
        const rawJson: Prisma.InputJsonValue | undefined =
          product.sold !== undefined || product.imageUrl !== undefined
            ? { sold: product.sold, imageUrl: product.imageUrl }
            : undefined
        await tx.productSnapshot.upsert({
          where: {
            collectionJobId_externalProductId: {
              collectionJobId: jobId,
              externalProductId: product.externalProductId,
            },
          },
          update: {
            title: product.title,
            price: product.price,
            shopId: product.shopId,
            shopName: product.shopName,
            rawJson,
            snapshotTime,
            dataSnapshotDate: dto.dataSnapshotDate,
          },
          create: {
            tenantId,
            collectionJobId: jobId,
            externalProductId: product.externalProductId,
            title: product.title,
            price: product.price,
            shopId: product.shopId,
            shopName: product.shopName,
            rawJson,
            snapshotTime,
            dataSnapshotDate: dto.dataSnapshotDate,
          },
        })

        const productRow = await tx.productSnapshot.findUnique({
          where: {
            collectionJobId_externalProductId: {
              collectionJobId: jobId,
              externalProductId: product.externalProductId,
            },
          },
          select: { id: true },
        })
        if (!productRow) continue

        if (product.skus?.length) {
          await tx.productSkuSnapshot.createMany({
            data: product.skus.map((sku) => ({
              productSnapshotId: productRow.id,
              skuId: sku.skuId,
              name: sku.name,
              price: sku.price,
              imageUrl: sku.imageUrl,
            })),
          })
          skuCount += product.skus.length
        }
        if (product.qas?.length) {
          await tx.productQaSnapshot.createMany({
            data: product.qas.map((qa) => ({
              productSnapshotId: productRow.id,
              question: qa.question,
              answer: qa.answer,
            })),
          })
          qaCount += product.qas.length
        }
        if (product.reviews?.length) {
          await tx.productReviewSnapshot.createMany({
            data: product.reviews.map((review) => ({
              productSnapshotId: productRow.id,
              content: review.content,
              rating: review.rating,
            })),
          })
          reviewCount += product.reviews.length
        }
      }

      if (job.type === 'analysis') {
        await tx.job.update({
          where: { id: jobId },
          data: { status: 'queued', stage: 'analyzing', checkpointStage: 'analyzing' },
        })
      } else {
        await tx.job.update({
          where: { id: jobId },
          data: { status: 'success', stage: 'success' },
        })
      }

      return {
        imported: true,
        jobId,
        counts: { productCount, skuCount, qaCount, reviewCount, fileCount },
      }
    })

    if (job.type === 'analysis') {
      await this.localQueue.enqueue(QUEUE_NAMES.serverReport, {
        jobId,
        tenantId,
        type: job.type,
      })
    }

    return result
  }
}
