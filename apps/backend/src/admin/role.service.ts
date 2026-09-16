import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.role.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
  }

  async create(tenantId: string, dto: CreateRoleDto) {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { tenantId, code: dto.code, name: dto.name, description: dto.description },
      })
      if (dto.permissionIds?.length) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          skipDuplicates: true,
        })
      }
      return role
    })
  }

  async update(id: string, dto: UpdateRoleDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.role.findUnique({ where: { id } })
      if (!existing) throw new NotFoundException('角色不存在')
      const data: Record<string, unknown> = {}
      if (dto.name !== undefined) data.name = dto.name
      if (dto.description !== undefined) data.description = dto.description
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
      return tx.role.findUnique({ where: { id } })
    })
  }
}
