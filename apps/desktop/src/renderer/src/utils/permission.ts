import { useAuth } from '../store/auth'

/**
 * 权限判断工具（权限层能力层，2.2：按钮级/菜单级/店铺级承载）。
 * 统一读取 auth store 的结构化权限；服务端 RequirePermission/PermissionGuard 才是唯一刚边界，
 * 这套仅用于前端显隐。isSuper 恒通过；未配置任何权限（数组为空）时按宽松兜底放行，兼容未配置账号。
 */
export function hasPermission(code: string): boolean {
  const { isSuper, menuCodes, buttonCodes } = useAuth.getState()
  if (isSuper) return true
  return [...(menuCodes ?? []), ...(buttonCodes ?? [])].includes(code)
}

export function hasMenuPermission(code: string): boolean {
  const { isSuper, menuCodes } = useAuth.getState()
  if (isSuper) return true
  if (!(menuCodes ?? []).length) return true
  return (menuCodes ?? []).includes(code)
}

export function hasStorePermission(storeId: string): boolean {
  const { storeScopeAll, storeIds } = useAuth.getState()
  if (storeScopeAll) return true
  return (storeIds ?? []).includes(storeId)
}