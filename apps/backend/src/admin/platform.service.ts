import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { CreatePlatformDto } from './dto/create-platform.dto'
import { UpdatePlatformDto } from './dto/update-platform.dto'

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: { keyword?: string; page?: number; pageSize?: number } = {}) {
    const where: Prisma.PlatformWhereInput = { deletedAt: null }
    if (options.keyword) {
      where.OR = [{ code: { contains: options.keyword } }, { name: { contains: options.keyword } }]
    }
    const base: Prisma.PlatformFindManyArgs = { where, orderBy: { code: 'asc' } }
    if (options.page !== undefined && options.pageSize !== undefined) {
      const page = Math.max(1, options.page)
      const pageSize = Math.max(1, options.pageSize)
      const [rows, total] = await Promise.all([
        this.prisma.platform.findMany({ ...base, skip: (page - 1) * pageSize, take: pageSize }),
        this.prisma.platform.count({ where }),
      ])
      return { rows, total, page, pageSize }
    }
    return this.prisma.platform.findMany(base)
  }

  create(dto: CreatePlatformDto) {
    return this.prisma.platform.create({ data: { code: dto.code, name: dto.name, logo: dto.logo, enabled: dto.enabled ?? true } })
  }

  async update(id: string, dto: UpdatePlatformDto) {
    const existing = await this.prisma.platform.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundException('平台不存在')
    return this.prisma.platform.update({ where: { id }, data: { name: dto.name, logo: dto.logo, enabled: dto.enabled } })
  }

  /** 软删除平台（对照旧版 platform delete，is_deleted 语义 → deletedAt），同时停用。 */
  async remove(id: string) {
    const existing = await this.prisma.platform.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundException('平台不存在')
    await this.prisma.platform.update({ where: { id }, data: { deletedAt: new Date(), enabled: false } })
    return { ok: true, id }
  }
}
