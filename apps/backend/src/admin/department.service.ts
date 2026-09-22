import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, options: { keyword?: string; page?: number; pageSize?: number } = {}) {
    const where: Prisma.DepartmentWhereInput = { tenantId, deletedAt: null }
    if (options.keyword) where.name = { contains: options.keyword }
    const base: Prisma.DepartmentFindManyArgs = { where, orderBy: { createdAt: 'asc' } }
    if (options.page !== undefined && options.pageSize !== undefined) {
      const page = Math.max(1, options.page)
      const pageSize = Math.max(1, options.pageSize)
      const [rows, total] = await Promise.all([
        this.prisma.department.findMany({ ...base, skip: (page - 1) * pageSize, take: pageSize }),
        this.prisma.department.count({ where }),
      ])
      return { rows, total, page, pageSize }
    }
    return this.prisma.department.findMany(base)
  }

  create(tenantId: string, dto: CreateDepartmentDto) {
    return this.prisma.department.create({ data: { tenantId, name: dto.name, parentId: dto.parentId } })
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new NotFoundException('部门不存在')
    return this.prisma.department.update({ where: { id }, data: { name: dto.name, parentId: dto.parentId } })
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new NotFoundException('部门不存在')
    const children = await this.prisma.department.count({ where: { parentId: id, deletedAt: null } })
    if (children > 0) throw new NotFoundException('存在子部门，请先删除子部门')
    await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date() } })
    return { ok: true, id }
  }
}
