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
    return this.createWithLevel(tenantId, dto.name, dto.parentId, dto.enabled)
  }

  private async createWithLevel(tenantId: string, name: string, parentId?: string, enabled?: boolean) {
    const level = await this.computeLevel(tenantId, parentId)
    return this.prisma.department.create({ data: { tenantId, name, parentId, level, enabled: enabled ?? true } })
  }

  /** 层级 = 父级 level + 1（对照旧版 deptManagement: 按父级 deptLevel+1 自动生成），无父级为一级。 */
  private async computeLevel(tenantId: string, parentId?: string): Promise<number> {
    if (!parentId) return 1
    const parent = await this.prisma.department.findFirst({ where: { id: parentId, tenantId, deletedAt: null } })
    return parent ? (parent.level ?? 1) + 1 : 1
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new NotFoundException('部门不存在')
    const data: Prisma.DepartmentUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.parentId !== undefined) {
      data.parentId = dto.parentId || null
      data.level = await this.computeLevel(tenantId, dto.parentId)
    }
    if (dto.enabled !== undefined) data.enabled = dto.enabled
    return this.prisma.department.update({ where: { id }, data })
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
