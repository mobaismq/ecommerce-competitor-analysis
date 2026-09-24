import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { resolveDataRoots } from '../common/data-root'
import { PrismaService } from '../prisma.service'
import { LocalJobQueueService } from '../queue/local-job-queue.service'
import { QUEUE_NAMES } from '../queue/queue-names'
import { StorageDriverService } from '../storage/storage.service'
import { CollectionResultDto } from './dto/collection-result.dto'

@Injectable()
export class CollectionJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localQueue: LocalJobQueueService,
    private readonly storageDriverService: StorageDriverService,
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
      // 采集图直转：嵌入模式下把数据根内的本地图读字节，经 StorageDriver 落 COS/本地（STORAGE_DRIVER 决定），并回写新 storageKey。
      const ingestCount = await this.ingestLocalFiles(tx, dto.files, tenantId, jobId)

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
        counts: { productCount, skuCount, qaCount, reviewCount, fileCount, ingestCount },
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

  /** 安全护栏：仅接纳数据根内的本地绝对路径（同机嵌入模式）；拒绝 `..` 越界。 */
  private isIngestibleLocalPath(localPath: string, userRoot: string): boolean {
    if (!localPath || localPath.includes('..')) return false
    const rootPrefix = userRoot.replace(/\/+$/, '') + '/'
    return localPath.startsWith(rootPrefix)
  }

  /** 把同步清单里的本地采集图读字节并落 StorageDriver（local→~/ecommerce，oss→COS），回写新 storageKey。 */
  private async ingestLocalFiles(
    tx: Prisma.TransactionClient,
    files: CollectionResultDto['files'],
    tenantId: string,
    jobId: string,
  ): Promise<number> {
    if (!files?.length) return 0
    const userRoot = resolveDataRoots().userRoot.replace(/\/+$/, '')
    const driver = this.storageDriverService.getDriver()
    let ingested = 0
    for (const file of files) {
      const local = file.storageKey
      if (!this.isIngestibleLocalPath(local, userRoot) || !existsSync(local)) continue
      try {
        const buffer = readFileSync(local)
        const configured = process.env.STORAGE_PREFIX
        const prefix = configured && !configured.includes('{') ? configured : process.env.NODE_ENV || 'development'
        const storageKey = `${prefix}/${tenantId}/collection/${jobId}/${basename(local)}`
        const meta = await driver.putObject({ storageKey, buffer, contentType: file.mimeType })
        await tx.sourceFileRecord.updateMany({
          where: { collectionJobId: jobId, storageKey: local },
          data: { storageKey: meta.storageKey, size: meta.size, mimeType: meta.mimeType },
        })
        ingested += 1
      } catch {
        // 读取/上传失败（如远端模式本地路径不存在）如实跳过，保留原清单
      }
    }
    return ingested
  }
}
