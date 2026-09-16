import { create } from 'zustand'
import { api } from '../api/client'

export interface AuthUser {
  id: string
  tenantId: string
  username: string
  displayName?: string | null
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

function readStoredUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem('eca.user') ?? 'null') as AuthUser | null
  } catch {
    return null
  }
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('eca.token'),
  user: readStoredUser(),
  async login(username: string, password: string) {
    const { data } = await api.post('/api/auth/login', { username, password })
    localStorage.setItem('eca.token', data.accessToken as string)
    localStorage.setItem('eca.user', JSON.stringify(data.user))
    set({ token: data.accessToken as string, user: data.user as AuthUser })
  },
  logout() {
    localStorage.removeItem('eca.token')
    localStorage.removeItem('eca.user')
    set({ token: null, user: null })
  },
}))
