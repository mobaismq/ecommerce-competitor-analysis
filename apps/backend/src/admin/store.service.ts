import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CreateStoreDto } from './dto/create-store.dto'
import { UpdateStoreDto } from './dto/update-store.dto'

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.store.findMany({
      where: { tenantId },
      include: { platform: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(tenantId: string, dto: CreateStoreDto) {
    const platform = await this.prisma.platform.findUnique({ where: { id: dto.platformId } })
    if (!platform) throw new NotFoundException('平台不存在')
    return this.prisma.store.create({
      data: { tenantId, platformId: dto.platformId, name: dto.name, externalId: dto.externalId, status: dto.status },
      include: { platform: true },
    })
  }

  async update(tenantId: string, id: string, dto: UpdateStoreDto) {
    const existing = await this.prisma.store.findFirst({ where: { id, tenantId } })
    if (!existing) throw new NotFoundException('店铺不存在')
    return this.prisma.store.update({
      where: { id },
      data: { name: dto.name, externalId: dto.externalId, status: dto.status },
      include: { platform: true },
    })
  }
}
