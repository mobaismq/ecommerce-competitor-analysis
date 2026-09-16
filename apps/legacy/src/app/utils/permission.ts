export interface UserPermissions {
  menuPermissionIds: number[];
  buttonPermissionIds: number[];
  storePermissionIds: string[];
}

// 读取当前登录账号的权限（登录后由 LoginPage 写入 localStorage）
export function getUserPermissions(): UserPermissions {
  try {
    const saved = localStorage.getItem("user_permissions");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        menuPermissionIds: Array.isArray(parsed?.menuPermissionIds) ? parsed.menuPermissionIds : [],
        buttonPermissionIds: Array.isArray(parsed?.buttonPermissionIds) ? parsed.buttonPermissionIds : [],
        storePermissionIds: Array.isArray(parsed?.storePermissionIds) ? parsed.storePermissionIds : [],
      };
    }
  } catch {
    // 忽略解析错误
  }
  return { menuPermissionIds: [], buttonPermissionIds: [], storePermissionIds: [] };
}

// 判断是否有某个按钮权限；权限列表为空时视为「全部可见」（兜底，兼容未配置权限的账号）
export function hasButtonPermission(buttonId: number): boolean {
  const perms = getUserPermissions();
  if (perms.buttonPermissionIds.length === 0) return true;
  return perms.buttonPermissionIds.includes(buttonId);
}

// 判断是否有某个菜单权限；权限列表为空时视为「全部可见」
export function hasMenuPermission(menuId: number): boolean {
  const perms = getUserPermissions();
  if (perms.menuPermissionIds.length === 0) return true;
  return perms.menuPermissionIds.includes(menuId);
}

// 判断是否有某个店铺权限；店铺权限列表为空视为无任何店铺权限
export function hasStorePermission(storeId: string): boolean {
  const perms = getUserPermissions();
  return perms.storePermissionIds.includes(storeId);
}
