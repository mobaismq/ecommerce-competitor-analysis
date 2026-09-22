import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    options: { keyword?: string; status?: string; page?: number; pageSize?: number } = {},
  ) {
    const where: Prisma.RoleWhereInput = { tenantId, deletedAt: null }
    if (options.keyword) {
      where.OR = [{ code: { contains: options.keyword } }, { name: { contains: options.keyword } }]
    }
    if (options.status) where.status = options.status
    const base: Prisma.RoleFindManyArgs = { where, orderBy: { createdAt: 'asc' } }

    let roles
    if (options.page !== undefined && options.pageSize !== undefined) {
      const page = Math.max(1, options.page)
      const pageSize = Math.max(1, options.pageSize)
      const [rows, total] = await Promise.all([
        this.prisma.role.findMany({ ...base, skip: (page - 1) * pageSize, take: pageSize }),
        this.prisma.role.count({ where }),
      ])
      roles = { rows, total, page, pageSize }
    } else {
      roles = await this.prisma.role.findMany(base)
    }
    const list = Array.isArray(roles) ? roles : roles.rows
    const roleIds = list.map((role) => role.id)
    const [permissions, stores] = await Promise.all([
      this.prisma.rolePermission.findMany({ where: { roleId: { in: roleIds } } }),
      this.prisma.roleStore.findMany({ where: { roleId: { in: roleIds } } }),
    ])
    const enriched = list.map((role) => ({
      ...role,
      permissionIds: permissions.filter((item) => item.roleId === role.id).map((item) => item.permissionId),
      storeIds: stores.filter((item) => item.roleId === role.id).map((item) => item.storeId),
    }))
    return Array.isArray(roles) ? enriched : { ...roles, rows: enriched }
  }

  async create(tenantId: string, dto: CreateRoleDto) {
    const duplicate = await this.findDuplicate(tenantId, dto.code)
    if (duplicate) throw new BadRequestException('角色编码已存在')
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
          status: dto.status ?? 'active',
        },
      })
      if (dto.permissionIds?.length) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          skipDuplicates: true,
        })
      }
      if (dto.storeIds?.length) {
        await tx.roleStore.createMany({
          data: dto.storeIds.map((storeId) => ({ roleId: role.id, storeId })),
          skipDuplicates: true,
        })
      }
      return role
    })
  }

  async update(tenantId: string, id: string, dto: UpdateRoleDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.role.findFirst({ where: { id, tenantId, deletedAt: null } })
      if (!existing) throw new NotFoundException('角色不存在')
      const data: Record<string, unknown> = {}
      if (dto.name !== undefined) data.name = dto.name
      if (dto.description !== undefined) data.description = dto.description
      if (dto.status !== undefined) data.status = dto.status
      if (Object.keys(data).length) await tx.role.update({ where: { id }, data })
      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } })
        if (dto.permissionIds.length) {
          await tx.rolePermission.createMany({
            data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
            skipDuplicates: true,
          })
        }
      }
      if (dto.storeIds) {
        await tx.roleStore.deleteMany({ where: { roleId: id } })
        if (dto.storeIds.length) {
          await tx.roleStore.createMany({
            data: dto.storeIds.map((storeId) => ({ roleId: id, storeId })),
            skipDuplicates: true,
          })
        }
      }
      return tx.role.findFirst({ where: { id, tenantId } })
    })
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.role.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new NotFoundException('角色不存在')
    await this.prisma.role.update({ where: { id }, data: { deletedAt: new Date(), status: 'disabled' } })
    return { ok: true, id }
  }

  async findDuplicate(tenantId: string, code?: string) {
    const normalized = code?.trim()
    if (!normalized) return null
    const existing = await this.prisma.role.findFirst({ where: { tenantId, code: normalized, deletedAt: null }, select: { id: true } })
    return existing ? '角色编码' : null
  }
}
