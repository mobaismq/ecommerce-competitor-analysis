import type { PrismaService } from '../prisma.service'
import { normalizeDataScope } from './data-scope.util'

/** 角色权限全选哨兵：permissionId 存 '*' 表示「全部权限（含未来新增）」，对照旧版 menuPermissionAll 存 '*'。 */
export const ALL_PERMISSION_MARKER = '*'

/** 解析后的结构化权限上下文（权限层能力层，2.2/5.11：me() 返回）。按类型分菜单/按钮、聚合店铺权限、推导数据范围。 */
export async function resolvePermissionContext(prisma: PrismaService, userId: string) {
  const userRoles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true } })
  const roleIds = userRoles.map((role) => role.roleId)
  if (roleIds.length === 0) {
    return { menuCodes: [], buttonCodes: [], storeIds: [], storeScopeAll: true, dataScope: 'all' }
  }
  const [rolePermissions, roleStores, user] = await Promise.all([
    prisma.rolePermission.findMany({ where: { roleId: { in: roleIds } }, select: { permissionId: true } }),
    prisma.roleStore.findMany({ where: { roleId: { in: roleIds } }, select: { storeId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { dataScope: true } }),
  ])
  const hasAll = rolePermissions.some((item) => item.permissionId === ALL_PERMISSION_MARKER)
  const permissions = await prisma.permission.findMany({
    ...(hasAll ? {} : { where: { id: { in: rolePermissions.map((item) => item.permissionId) } } }),
    select: { code: true, type: true },
  })
  const menuCodes = [...new Set(permissions.filter((p) => p.type !== 'button').map((p) => p.code))]
  const buttonCodes = [...new Set(permissions.filter((p) => p.type === 'button').map((p) => p.code))]
  const storeIds = [...new Set(roleStores.map((item) => item.storeId))]
  return {
    menuCodes,
    buttonCodes,
    storeIds,
    // 未给任何角色配置店铺时视为不限制（先不加权限的宽松默认），配置后才收窄
    storeScopeAll: storeIds.length === 0,
    dataScope: normalizeDataScope(user?.dataScope),
  }
}

/**
 * 解析用户拥有的权限码集合（唯一实现点）。
 * user → user_roles → role_permissions → permissions.code，供 /api/auth/me 与 PermissionGuard 共用。
 * 任一角色带 '*' 哨兵时展开为当前全部权限码，使之后新增的权限自动覆盖。
 */
export async function resolveUserPermissionCodes(prisma: PrismaService, userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true } })
  if (userRoles.length === 0) return []
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: { in: userRoles.map((role) => role.roleId) } },
    select: { permissionId: true },
  })
  if (rolePermissions.length === 0) return []
  const hasAll = rolePermissions.some((item) => item.permissionId === ALL_PERMISSION_MARKER)
  const permissions = await prisma.permission.findMany({
    ...(hasAll ? {} : { where: { id: { in: rolePermissions.map((item) => item.permissionId) } } }),
    select: { code: true },
  })
  return [...new Set(permissions.map((item) => item.code))]
}