import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eca.token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('eca.token')
      localStorage.removeItem('eca.user')
      void window.desktop?.store.clearToken()
      // HashRouter 下统一用 hash 定位登录页，兼容 Electron file:// 与浏览器 http
      if (!window.location.hash.startsWith('#/login')) window.location.hash = '#/login'
    }
    return Promise.reject(error)
  },
)
