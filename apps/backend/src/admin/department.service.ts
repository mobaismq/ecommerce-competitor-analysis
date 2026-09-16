import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.department.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  }

  create(tenantId: string, dto: CreateDepartmentDto) {
    return this.prisma.department.create({ data: { tenantId, name: dto.name, parentId: dto.parentId } })
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId } })
    if (!existing) throw new NotFoundException('部门不存在')
    return this.prisma.department.update({ where: { id }, data: { name: dto.name, parentId: dto.parentId } })
  }
}
