import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'

export interface ListProductsOptions {
  keyword?: string
  status?: string
  storeId?: string
  createTimeFrom?: string
  createTimeTo?: string
  /** 传 page+pageSize 时返回 { rows, total, page, pageSize }，否则返回全量数组（向后兼容） */
  page?: number
  pageSize?: number
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, opts: ListProductsOptions = {}) {
    const where: Prisma.ProductWhereInput = { tenantId }
    if (opts.keyword?.trim()) {
      where.OR = [
        { productName: { contains: opts.keyword.trim() } },
        { productCode: { contains: opts.keyword.trim() } },
      ]
    }
    if (opts.status) where.status = opts.status
    if (opts.storeId) where.storeId = opts.storeId
    const createdAtFilter: Prisma.DateTimeFilter = {}
    if (opts.createTimeFrom) createdAtFilter.gte = new Date(opts.createTimeFrom)
    if (opts.createTimeTo) createdAtFilter.lte = new Date(opts.createTimeTo)
    if (Object.keys(createdAtFilter).length) where.createdAt = createdAtFilter

    const include = { skus: true } as const
    const orderBy = { createdAt: 'desc' } as const

    if (opts.page != null && opts.pageSize != null) {
      return this.prisma.$transaction(async (tx) => {
        const [rows, total] = await Promise.all([
          tx.product.findMany({ where, orderBy, include, skip: (opts.page! - 1) * opts.pageSize!, take: opts.pageSize }),
          tx.product.count({ where }),
        ])
        return { rows, total, page: opts.page, pageSize: opts.pageSize }
      })
    }
    return this.prisma.product.findMany({ where, orderBy, include })
  }

  async create(tenantId: string, dto: CreateProductDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          productCode: dto.productCode,
          productName: dto.productName,
          brand: dto.brand,
          productImage: dto.productImage,
          storeId: dto.storeId ?? null,
          status: dto.status ?? 'enabled',
          skus: dto.skus?.length
            ? { create: dto.skus.map((s) => toSkuData(s)) }
            : undefined,
        },
        include: { skus: true },
      })
      return product
    })
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({ where: { id, tenantId } })
      if (!existing) throw new NotFoundException('商品不存在')
      const data: Prisma.ProductUpdateInput = {}
      if (dto.productCode !== undefined) data.productCode = dto.productCode
      if (dto.productName !== undefined) data.productName = dto.productName
      if (dto.brand !== undefined) data.brand = dto.brand
      if (dto.productImage !== undefined) data.productImage = dto.productImage
      if (dto.storeId !== undefined) data.storeId = dto.storeId
      if (dto.status !== undefined) data.status = dto.status
      if (dto.skus !== undefined) {
        data.skus = {
          deleteMany: {},
          create: dto.skus.map((s) => toSkuData(s)),
        }
      }
      return tx.product.update({ where: { id }, data, include: { skus: true } })
    })
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, tenantId } })
    if (!existing) throw new NotFoundException('商品不存在')
    await this.prisma.$transaction([
      this.prisma.productSku.deleteMany({ where: { productId: id } }),
      this.prisma.product.delete({ where: { id } }),
    ])
    return { ok: true, id }
  }
}

function toSkuData(s: { skuCode: string; specName?: string; specImage?: string; costPrice?: number; standardPrice?: number }) {
  return {
    skuCode: s.skuCode,
    specName: s.specName,
    specImage: s.specImage,
    costPrice: s.costPrice,
    standardPrice: s.standardPrice,
  }
}