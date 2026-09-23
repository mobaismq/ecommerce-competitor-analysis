import type { ReactNode } from 'react'
import { hasPermission } from '../utils/permission'

/** 按钮级显隐组件（权限层能力层，2.2：前端可复用 `<Can code="...">`；isSuper/未配置权限时恒显）。 */
export function Can({ code, children }: { code: string; children: ReactNode }) {
  if (!hasPermission(code)) return null
  return <>{children}</>
}