import type { PrismaService } from '../prisma.service'

/** 角色权限全选哨兵：permissionId 存 '*' 表示「全部权限（含未来新增）」，对照旧版 menuPermissionAll 存 '*'。 */
export const ALL_PERMISSION_MARKER = '*'

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