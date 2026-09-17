import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, keyword?: string) {
    return this.prisma.product.findMany({
      where: { tenantId, ...(keyword ? { OR: [{ productName: { contains: keyword } }, { productCode: { contains: keyword } }] } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { skus: true },
    })
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