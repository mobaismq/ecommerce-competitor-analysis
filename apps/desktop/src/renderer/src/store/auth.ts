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
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  permissions: string[]
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
      set({ user, permissions: data.permissions, isSuper: data.isSuper })
    } catch {
      // 静默：拿到 me 前不根据权限收窄导航
    }
  },
  logout() {
    localStorage.removeItem('eca.token')
    localStorage.removeItem('eca.user')
    void window.desktop?.store.clearToken()
    set({ token: null, user: null, permissions: [], isSuper: false })
  },
}))
