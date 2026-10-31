/**
 * 登录授权状态机的纯判据（唯一权威定义，renderer/主进程均引用此处语义）。
 *
 * 状态含义：
 *   idle          —— 未在登录
 *   opening       —— 已打开登录页，等待用户扫码/输密码
 *   waiting-sso   —— 检测到登录 cookie，等待跨域授权写入稳定
 *   verified      —— 轻量页验证通过（无"亲，请登录"/空骨架）
 *
 * 修复背景：扫码成功后秒关登录 tab 会中断淘宝多域 SSO 握手，导致搜索页
 * 返回未登录空骨架。因此 waiting-sso 期间禁止立即关闭，需用户二次确认。
 */

export type LoginAuthState = 'idle' | 'opening' | 'waiting-sso' | 'verified'

/** SSO 同步中且用户尚未二次确认时，阻止关闭登录视图。 */
export function shouldBlockClose(state: LoginAuthState, stopByUser: boolean): boolean {
  return state === 'waiting-sso' && !stopByUser
}

/** 从推送/初始化的任意字符串安全收敛为合法状态。 */
export function isLoginAuthState(value: unknown): value is LoginAuthState {
  return value === 'idle' || value === 'opening' || value === 'waiting-sso' || value === 'verified'
}