import type { PrismaService } from '../prisma.service'

/**
 * 解析用户拥有的权限码集合（唯一实现点）。
 * user → user_roles → role_permissions → permissions.code，供 /api/auth/me 与 PermissionGuard 共用。
 */
export async function resolveUserPermissionCodes(prisma: PrismaService, userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true } })
  if (userRoles.length === 0) return []
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: { in: userRoles.map((role) => role.roleId) } },
    select: { permissionId: true },
  })
  if (rolePermissions.length === 0) return []
  const permissions = await prisma.permission.findMany({
    where: { id: { in: rolePermissions.map((item) => item.permissionId) } },
    select: { code: true },
  })
  return permissions.map((item) => item.code)
}