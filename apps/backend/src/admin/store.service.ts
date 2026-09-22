import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CreateStoreDto } from './dto/create-store.dto'
import { UpdateStoreDto } from './dto/update-store.dto'

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.store
      .findMany({
        where: { tenantId, deletedAt: null },
        include: { platform: true },
        orderBy: { createdAt: 'asc' },
      })
      .then((rows) => rows.map((row) => ({ ...row, authStatus: this.deriveAuthStatus(row.authExpiresAt) })))
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
