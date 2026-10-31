import { describe, expect, it } from 'vitest'
import { isLoginAuthState, shouldBlockClose } from './login-auth-state'

describe('login-auth-state 登录授权状态判据', () => {
  it('waiting-sso 且用户未二次确认时阻止关闭（保护 SSO 握手）', () => {
    expect(shouldBlockClose('waiting-sso', false)).toBe(true)
  })

  it('waiting-sso 且用户已二次确认（stopByUser=true）时放行', () => {
    expect(shouldBlockClose('waiting-sso', true)).toBe(false)
  })

  it('非 waiting-sso 状态不阻止关闭', () => {
    expect(shouldBlockClose('idle', false)).toBe(false)
    expect(shouldBlockClose('opening', false)).toBe(false)
    expect(shouldBlockClose('verified', false)).toBe(false)
    // 已验证后即使 stopByUser = false 也可正常关闭
    expect(shouldBlockClose('verified', false)).toBe(false)
  })

  it('isLoginAuthState 只收敛合法状态', () => {
    expect(isLoginAuthState('idle')).toBe(true)
    expect(isLoginAuthState('opening')).toBe(true)
    expect(isLoginAuthState('waiting-sso')).toBe(true)
    expect(isLoginAuthState('verified')).toBe(true)
    expect(isLoginAuthState('running')).toBe(false)
    expect(isLoginAuthState(undefined)).toBe(false)
    expect(isLoginAuthState(null)).toBe(false)
  })
})