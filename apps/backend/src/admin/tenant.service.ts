import { Injectable } from '@nestjs/common'
import { hashPassword } from '../auth/password'
import { PrismaService } from '../prisma.service'
import { CreateTenantDto } from './dto/create-tenant.dto'

const PLATFORM_PERMISSIONS = new Set(['system:tenant:manage'])

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } })
  }

  create(dto: CreateTenantDto) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: dto.name } })
      const adminRole = await tx.role.create({
        data: { tenantId: tenant.id, code: 'admin', name: '租户管理员' },
      })
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          username: dto.adminUsername,
          passwordHash: hashPassword(dto.adminPassword),
          displayName: dto.adminDisplayName,
          dataScope: 'all',
        },
      })
      await tx.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } })

      const permissions = await tx.permission.findMany()
      await tx.rolePermission.createMany({
        data: permissions
          .filter((permission) => !PLATFORM_PERMISSIONS.has(permission.code))
          .map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })),
        skipDuplicates: true,
      })

      return { tenant, adminUser, adminRole }
    })
  }
}
