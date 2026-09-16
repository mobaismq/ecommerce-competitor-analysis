import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CreatePlatformDto } from './dto/create-platform.dto'
import { UpdatePlatformDto } from './dto/update-platform.dto'

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.platform.findMany({ orderBy: { code: 'asc' } })
  }

  create(dto: CreatePlatformDto) {
    return this.prisma.platform.create({ data: { code: dto.code, name: dto.name, enabled: dto.enabled ?? true } })
  }

  async update(id: string, dto: UpdatePlatformDto) {
    const existing = await this.prisma.platform.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('平台不存在')
    return this.prisma.platform.update({ where: { id }, data: { name: dto.name, enabled: dto.enabled } })
  }
}
