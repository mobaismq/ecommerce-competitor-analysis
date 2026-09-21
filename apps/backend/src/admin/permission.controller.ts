import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { PrismaService } from '../prisma.service'

@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PermissionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('system:manage')
  list() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } })
  }

  @Get('tree')
  @RequirePermission('role:manage')
  async tree() {
    const permissions = await this.prisma.permission.findMany({ orderBy: { code: 'asc' } })
    const groups = new Map<string, { code: string; name: string; type: string; children: Array<{ code: string; name: string; type: string }> }>()
    for (const permission of permissions) {
      const parts = permission.code.split(':')
      const groupCode = parts[0] ?? permission.code
      const group = groups.get(groupCode) ?? { code: groupCode, name: groupCode, type: 'menu', children: [] }
      if (parts.length > 2) {
        group.children.push({ code: permission.code, name: permission.name, type: permission.type ?? 'button' })
      } else {
        group.name = permission.name
        group.type = permission.type ?? 'menu'
      }
      groups.set(groupCode, group)
    }
    return Array.from(groups.values())
  }
}