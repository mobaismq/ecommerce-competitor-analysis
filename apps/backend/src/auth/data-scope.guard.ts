import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { normalizeDataScope } from './data-scope.util'

@Injectable()
export class DataScopeGuard implements CanActivate {
  private readonly prisma: PrismaService

  constructor(prisma?: PrismaService) {
    this.prisma = prisma ?? new PrismaService()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { sub?: string; tenantId?: string; dataScope?: string; departmentId?: string | null }
      params?: Record<string, string>
      query?: Record<string, string | string[]>
      body?: Record<string, unknown>
    }>()
    const user = request.user
    if (!user?.sub) return true

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { dataScope: true, departmentId: true },
    })
    user.dataScope = normalizeDataScope(dbUser?.dataScope)
    user.departmentId = dbUser?.departmentId ?? null

    const requestedStoreId =
      request.params?.storeId ?? (typeof request.query?.storeId === 'string' ? request.query.storeId : undefined) ?? request.body?.storeId
    if (typeof requestedStoreId === 'string' && user.dataScope !== 'all') {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: user.sub },
        select: { roleId: true },
      })
      const roleStores = await this.prisma.roleStore.findMany({
        where: { roleId: { in: userRoles.map((role) => role.roleId) } },
        select: { storeId: true },
      })
      if (!roleStores.some((item) => item.storeId === requestedStoreId)) {
        throw new ForbiddenException('店铺范围外')
      }
    }
    return true
  }
}
