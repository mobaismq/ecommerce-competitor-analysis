import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { CollectionResultDto } from './dto/collection-result.dto'

@Injectable()
export class CollectionJobService {
  constructor(private readonly prisma: PrismaService) {}

  async importResults(jobId: string, tenantId: string, dto: CollectionResultDto) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, tenantId } })
    if (!job) throw new NotFoundException('任务不存在')

    const existing = await this.prisma.collectionJob.findUnique({ where: { jobId } })
    if (existing?.status === 'success') return { imported: false, jobId, existing: true }

    return this.prisma.$transaction(async (tx) => {
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

      await tx.job.update({ where: { id: jobId }, data: { status: 'success', stage: 'success' } })
      return {
        imported: true,
        jobId,
        counts: { productCount, skuCount, qaCount, reviewCount, fileCount },
      }
    })
  }
}
