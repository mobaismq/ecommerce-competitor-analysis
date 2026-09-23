import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { resolveStoreScope } from './store-scope.util'

/**
 * 店铺数据范围守卫（权限层能力层，2.2：店铺级权限承载）。
 * 能力层默认"先不加权限"：本守卫只把聚合后的 storeScope({ storeIds, storeScopeAll }) 注入 request.user，
 * 供 service 在启用店铺维度时自行过滤（storeScopeAll=false 且目标店铺不在 storeIds 内则拒绝）。
 * 不强制拦截任何请求，避免在未配置权限阶段误锁店铺数据。
 */
@Injectable()
export class StoreScopeGuard implements CanActivate {
  private readonly prisma: PrismaService

  constructor(prisma?: PrismaService) {
    this.prisma = prisma ?? new PrismaService()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: { sub?: string; storeScope?: unknown } }>()
    const userId = request.user?.sub
    if (userId && request.user) {
      request.user.storeScope = await resolveStoreScope(this.prisma, userId)
    }
    return true
  }
}