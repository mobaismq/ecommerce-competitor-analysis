import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PrismaService } from '../prisma.service'
import { PERMISSIONS_KEY } from './permission.decorator'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required?.length) return true

    const request = context.switchToHttp().getRequest<{ user?: { sub?: string } }>()
    const userId = request.user?.sub
    if (!userId) throw new UnauthorizedException()

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    })
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: userRoles.map((role) => role.roleId) } },
      select: { permissionId: true },
    })
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: rolePermissions.map((item) => item.permissionId) } },
      select: { code: true },
    })
    const codes = new Set(permissions.map((item) => item.code))
    if (!required.every((code) => codes.has(code))) {
      throw new ForbiddenException('无权限')
    }
    return true
  }
}
