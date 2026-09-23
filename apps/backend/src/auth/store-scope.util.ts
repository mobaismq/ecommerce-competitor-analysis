import type { PrismaService } from '../prisma.service'
import { resolvePermissionContext } from './permission.resolver'

/**
 * 店铺数据范围（权限层能力层，2.2：店铺级权限）。
 * 返回该用户跨所有角色聚合后的合法店铺 ID 集与是否不限（storeScopeAll）。
 * storeScopeAll=true 时视为不限制（先不加权限的宽松默认），配置了店铺后才收窄。
 */
export async function resolveStoreScope(prisma: PrismaService, userId: string) {
  const ctx = await resolvePermissionContext(prisma, userId)
  return { storeIds: ctx.storeIds, storeScopeAll: ctx.storeScopeAll }
}
