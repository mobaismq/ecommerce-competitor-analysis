import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { CreateStoreDto } from './dto/create-store.dto'
import { UpdateStoreDto } from './dto/update-store.dto'

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    options: { keyword?: string; platformId?: string; status?: string; authStatus?: string; page?: number; pageSize?: number } = {},
  ) {
    const where: Prisma.StoreWhereInput = { tenantId, deletedAt: null }
    if (options.keyword) {
      where.OR = [{ name: { contains: options.keyword } }, { externalId: { contains: options.keyword } }]
    }
    if (options.platformId) where.platformId = options.platformId
    if (options.status) where.status = options.status

    const base: Prisma.StoreFindManyArgs = { where, include: { platform: true }, orderBy: { createdAt: 'asc' } }
    const derive = <T extends { authExpiresAt: Date | null; platform?: { logo?: string | null } | null }>(rows: T[]) =>
      rows.map((row) => ({
        ...row,
        authStatus: this.deriveAuthStatus(row.authExpiresAt),
        // storeLogo 由 platform.logo 派生（对照旧版 mapStoreRow 的 platformLogo→storeLogo）
        storeLogo: row.platform?.logo ?? null,
      }))

    if (options.page !== undefined && options.pageSize !== undefined) {
      const page = Math.max(1, options.page)
      const pageSize = Math.max(1, options.pageSize)
      const [rows, total] = await Promise.all([
        this.prisma.store.findMany({ ...base, skip: (page - 1) * pageSize, take: pageSize }),
        this.prisma.store.count({ where }),
      ])
      return { rows: derive(rows), total, page, pageSize }
    }
    return derive(await this.prisma.store.findMany(base))
  }

  /** 派生店铺授权状态（对照旧版 authStatus：0已过期/1有效 → 'valid'/'expired'/'none'）。 */
  private deriveAuthStatus(authExpiresAt: Date | null): 'valid' | 'expired' | 'none' {
    if (!authExpiresAt) return 'none'
    return authExpiresAt.getTime() < Date.now() ? 'expired' : 'valid'
  }

  async create(tenantId: string, dto: CreateStoreDto) {
    const platform = await this.prisma.platform.findUnique({ where: { id: dto.platformId } })
    if (!platform) throw new NotFoundException('平台不存在')
    const duplicate = await this.findDuplicate(tenantId, { platformId: dto.platformId, externalId: dto.externalId })
    if (duplicate) throw new BadRequestException('同一平台下店铺标识已存在')
    return this.prisma.store.create({
      data: {
        tenantId,
        platformId: dto.platformId,
        name: dto.name,
        externalId: dto.externalId,
        status: dto.status,
        authorizedBy: dto.authorizedBy,
        authExpiresAt: dto.authExpiresAt ? new Date(dto.authExpiresAt) : undefined,
      },
      include: { platform: true },
    })
  }

  async update(tenantId: string, id: string, dto: UpdateStoreDto) {
    const existing = await this.prisma.store.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new NotFoundException('店铺不存在')
    const duplicate = await this.findDuplicate(tenantId, { platformId: existing.platformId, externalId: dto.externalId }, id)
    if (duplicate) throw new BadRequestException('同一平台下店铺标识已存在')
    const data: Record<string, unknown> = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.externalId !== undefined) data.externalId = dto.externalId
    if (dto.status !== undefined) data.status = dto.status
    if (dto.authorizedBy !== undefined) data.authorizedBy = dto.authorizedBy
    if (dto.authExpiresAt !== undefined) data.authExpiresAt = new Date(dto.authExpiresAt)
    if (dto.isDeleted) data.deletedAt = new Date()
    return this.prisma.store.update({
      where: { id },
      data,
      include: { platform: true },
    })
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.store.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new NotFoundException('店铺不存在')
    await this.prisma.store.update({ where: { id }, data: { deletedAt: new Date() } })
    return { ok: true, id }
  }

  async findDuplicate(tenantId: string, values: { platformId?: string; externalId?: string }, excludeId?: string) {
    const platformId = values.platformId?.trim()
    const externalId = values.externalId?.trim()
    if (!platformId || !externalId) return null
    const existing = await this.prisma.store.findFirst({
      where: { tenantId, platformId, externalId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
    return existing ? '店铺标识' : null
  }
}
