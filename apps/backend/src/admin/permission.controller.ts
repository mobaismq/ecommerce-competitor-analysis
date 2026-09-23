import { Controller, Get, Req, UseGuards } from '@nestjs/common'
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

  /** 权限树（权限层能力层，2.2：角色页三级勾选用）。
   *  按 code 首段分组为「菜单组」，组内为具体权限（含菜单/按钮），并返回当前租户可用店铺列表。
   *  后端数据已含 parentCode 供未来显式父子；此处确定性分组保证无 parentCode 种子数据也能正确成树。 */
  @Get('tree')
  @RequirePermission('role:manage')
  async tree(@Req() request: { user: { tenantId: string } }) {
    const [permissions, stores] = await Promise.all([
      this.prisma.permission.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.store.findMany({
        where: { tenantId: request.user.tenantId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])
    const groups = new Map<
      string,
      { code: string; name: string; type: string; children: Array<{ id: string; code: string; name: string; type: string }> }
    >()
    for (const permission of permissions) {
      const seg = (permission.code.split(':')[0] || 'other').toLowerCase()
      const group = groups.get(seg) ?? { code: seg, name: seg, type: 'menu', children: [] }
      group.children.push({ id: permission.id, code: permission.code, name: permission.name, type: permission.type ?? 'menu' })
      groups.set(seg, group)
    }
    return { groups: Array.from(groups.values()), stores }
  }
}