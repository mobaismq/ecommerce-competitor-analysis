import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { PlatformRegistry } from './platform-registry'
import type { PublishListingDto } from './dto/publish-listing.dto'

export interface QueryProductsInput {
  platform?: string
  storeId?: string
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
}

@Injectable()
export class PlatformAdapterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PlatformRegistry,
  ) {}

  listPlatforms() {
    return this.prisma.platform.findMany({ orderBy: { code: 'asc' } })
  }

  listAdapterCodes() {
    return this.registry.listCodes()
  }

  getAdapter(code: string) {
    if (this.registry.listCodes().includes(code)) {
      return this.registry.create(code)
    }
    if (['douyin', 'jd', 'pdd', 'tmall', 'xhs'].includes(code.toLowerCase())) {
      return this.registry.create('mock')
    }
    return this.registry.create(code)
  }

  async getCategories(code: string, parentExternalId?: string) {
    const adapter = this.getAdapter(code)
    if (!adapter.supports('categories')) throw new BadRequestException(`平台 ${code} 不支持类目查询`)
    return adapter.fetchCategories(parentExternalId ?? '0')
  }

  async getShops(code: string) {
    const adapter = this.getAdapter(code)
    if (!adapter.supports('shops')) throw new BadRequestException(`平台 ${code} 不支持店铺查询`)
    return adapter.fetchShops()
  }

  async listProducts(tenantId: string, query: QueryProductsInput = {}) {
    const page = Math.max(1, Number(query.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)))

    // 查询上架草稿
    const drafts = await this.prisma.listingDraft.findMany({
      where: {
        tenantId,
        ...(query.platform ? { platformId: query.platform } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.keyword ? { title: { contains: query.keyword } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    })

    // 查询竞品快照作为平台商品数据源之一
    const snapshots = await this.prisma.productSnapshot.findMany({
      where: {
        tenantId,
        ...(query.keyword ? { title: { contains: query.keyword } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
    })

    const items = [
      ...drafts.map((d) => ({
        id: d.id,
        productId: d.id,
        productName: d.title ?? '未命名商品',
        platform: d.platformId ?? 'taobao',
        store: (d.contentJson as Record<string, unknown> | null)?.storeId ? String((d.contentJson as Record<string, unknown>).storeId) : '自营店铺',
        price: (d.contentJson as Record<string, unknown> | null)?.price ? Number((d.contentJson as Record<string, unknown>).price) : 0,
        publishStatus: d.status === 'submitted' ? '已发布' : (d.status === 'failed' ? '发布失败' : '草稿'),
        listingStatus: '上架',
        updateTime: d.updatedAt.toISOString().slice(0, 19).replace('T', ' '),
        productImage: '',
        productCode: d.jobId,
        skus: ((d.contentJson as Record<string, unknown> | null)?.skus as unknown[]) ?? [],
      })),
      ...snapshots.map((s) => ({
        id: s.id,
        productId: s.externalProductId,
        productName: s.title ?? '商品快照',
        platform: 'taobao',
        store: s.shopName ?? '淘宝店铺',
        price: s.price ? Number(s.price) : 0,
        publishStatus: '已发布',
        listingStatus: '上架',
        updateTime: s.updatedAt.toISOString().slice(0, 19).replace('T', ' '),
        productImage: '',
        productCode: s.externalProductId,
        skus: [],
      })),
    ]

    return {
      items: items.slice(0, pageSize),
      total: items.length,
      page,
      pageSize,
    }
  }

  async publishListing(tenantId: string, platformCode: string, dto: PublishListingDto) {
    const adapter = this.getAdapter(platformCode)
    const jobId = `manual-listing-${randomUUID().slice(0, 8)}`

    const contentJson: Prisma.InputJsonValue = {
      storeId: dto.storeId,
      categoryId: dto.categoryId,
      price: dto.price ? Number(dto.price) : undefined,
      skus: (dto.skus ?? []) as unknown as Prisma.InputJsonValue,
      ...(dto.contentJson ?? {}),
    }

    const draft = await this.prisma.listingDraft.create({
      data: {
        tenantId,
        jobId,
        title: dto.title,
        platformId: platformCode,
        contentJson,
        status: 'submitting',
      },
    })


    let result
    try {
      result = adapter.submitListing
        ? await adapter.submitListing({ jobId, draftId: draft.id, title: dto.title, contentJson: draft.contentJson })
        : { status: 'success' as const, rawPayload: { kind: 'manual' } }
    } catch (err) {
      await this.prisma.listingDraft.update({
        where: { id: draft.id },
        data: { status: 'failed' },
      })
      throw err
    }

    const finalStatus = result.status === 'success' ? 'submitted' : 'failed'
    await this.prisma.listingDraft.update({
      where: { id: draft.id },
      data: { status: finalStatus },
    })

    return {
      draftId: draft.id,
      jobId,
      status: finalStatus,
      platform: platformCode,
      title: dto.title,
      rawPayload: result.rawPayload,
    }
  }
}

