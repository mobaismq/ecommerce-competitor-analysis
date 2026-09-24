import { create } from 'zustand'
import { api } from '../api/client'

export interface AuthUser {
  id: string
  tenantId: string
  username: string
  displayName?: string | null
  phone?: string | null
  email?: string | null
  avatarUrl?: string | null
  roles?: string[]
}

interface MePayload extends AuthUser {
  departmentId?: string | null
  isSuper: boolean
  permissions: string[]
  menuCodes?: string[]
  buttonCodes?: string[]
  storeIds?: string[]
  storeScopeAll?: boolean
  dataScope?: 'all' | 'department' | 'self' | string | null
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  permissions: string[]
  menuCodes: string[]
  buttonCodes: string[]
  storeIds: string[]
  storeScopeAll: boolean
  dataScope: string
  isSuper: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  /** 拉取当前用户信息/权限集，用于权限驱动的动态导航 */
  loadMe: () => Promise<void>
}

function readStoredUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem('eca.user') ?? 'null') as AuthUser | null
  } catch {
    return null
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem('eca.token'),
  user: readStoredUser(),
  permissions: [],
  menuCodes: [],
  buttonCodes: [],
  storeIds: [],
  storeScopeAll: true,
  dataScope: 'all',
  isSuper: false,
  async login(username: string, password: string) {
    const { data } = await api.post('/api/auth/login', { username, password })
    localStorage.setItem('eca.token', data.accessToken as string)
    localStorage.setItem('eca.user', JSON.stringify(data.user))
    // 桌面端额外写入 preload 的 safeStorage（加密封存），浏览器环境 window.desktop 为空则跳过
    void window.desktop?.store.setToken(data.accessToken as string)
    set({ token: data.accessToken as string, user: data.user as AuthUser })
    await get().loadMe()
  },
  async loadMe() {
    if (!get().token) return
    try {
      const { data } = await api.get<MePayload>('/api/auth/me')
      const user: AuthUser = {
        id: data.id,
        tenantId: data.tenantId,
        username: data.username,
        displayName: data.displayName,
        phone: data.phone,
        email: data.email,
        avatarUrl: data.avatarUrl,
        roles: data.roles,
      }
      localStorage.setItem('eca.user', JSON.stringify(user))
      set({
        user,
        permissions: data.permissions,
        menuCodes: data.menuCodes ?? [],
        buttonCodes: data.buttonCodes ?? [],
        storeIds: data.storeIds ?? [],
        storeScopeAll: data.storeScopeAll ?? true,
        dataScope: data.dataScope ?? 'all',
        isSuper: data.isSuper,
      })
      // 服务端默认 AI 供应商：接口有值则下发到 worker（加密落盘）；返回空则清除默认（个人自配仍优先）。
      // 失败/离线时不强刷，保留上次默认。
      try {
        const dd = await api.get<{ baseUrl?: string; apiKey?: string; textModel?: string; imageModel?: string; protocol?: string }>('/api/ai/default-config')
        const d = dd.data
        await window.desktop?.capabilities.invoke('ai.defaultConfig.set', { userId: user.id, ...(d?.apiKey ? d : null) })
      } catch {
        /* no-op */
      }
    } catch {
      // 静默：拿到 me 前不根据权限收窄导航
    }
  },
  logout() {
    localStorage.removeItem('eca.token')
    localStorage.removeItem('eca.user')
    void window.desktop?.store.clearToken()
    set({
      token: null,
      user: null,
      permissions: [],
      menuCodes: [],
      buttonCodes: [],
      storeIds: [],
      storeScopeAll: true,
      dataScope: 'all',
      isSuper: false,
    })
  },
}))
