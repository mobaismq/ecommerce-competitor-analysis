import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  version: process.versions.electron,
  store: {
    getToken: () => ipcRenderer.invoke('store:get-token'),
    setToken: (token: string) => ipcRenderer.invoke('store:set-token', token),
    clearToken: () => ipcRenderer.invoke('store:clear-token'),
    getConfig: (key: string) => ipcRenderer.invoke('store:get-config', key),
    setConfig: (key: string, value: string | number | boolean) => ipcRenderer.invoke('store:set-config', key, value),
    clearConfig: (key: string) => ipcRenderer.invoke('store:clear-config', key),
  },
  local: {
    getStats: () => ipcRenderer.invoke('local:get-stats'),
    runCleanup: () => ipcRenderer.invoke('local:run-cleanup'),
  },
  files: {
    saveImageBatch: (input: { folderName?: string; kind?: 'main' | 'detail'; files: Array<{ name: string; data: Uint8Array }> }) =>
      ipcRenderer.invoke('files:saveImageBatch', input),
    saveImage: (input: { folderName?: string; kind?: 'main' | 'detail'; name: string; data: Uint8Array }) =>
      ipcRenderer.invoke('files:saveImage', input),
  },
  capabilities: {
    invoke: (capability: string, payload?: unknown) => ipcRenderer.invoke('capability:invoke', capability, payload),
    onStream: (listener: (event: { type: string; text?: string; data?: Record<string, unknown> }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, event: { type: string; text?: string; data?: Record<string, unknown> }) => listener(event)
      ipcRenderer.on('capability:stream', handler)
      return () => ipcRenderer.removeListener('capability:stream', handler)
    },
  },
  collection: {
    start: (input: {
      productName?: string
      productUrl?: string
      minPrice?: number | null
      maxPrice?: number | null
      topN?: number
      searchPages?: number
      speedProfile?: string
      importMysql?: boolean
      mode?: string
      downloadScript?: string
      fake?: boolean
    }) => ipcRenderer.invoke('collection:start', input),
    cancel: () => ipcRenderer.invoke('collection:cancel'),
    status: (jobId?: string) => ipcRenderer.invoke('collection:status', jobId),
    list: (limit?: number) => ipcRenderer.invoke('collection:list', limit),
    probe: () => ipcRenderer.invoke('collection:probe'),
    probeChrome: () => ipcRenderer.invoke('collection:probeChrome'),
    openExternalUrl: (url: string) => ipcRenderer.invoke('collection:openExternalUrl', url),
    openLoginView: () => ipcRenderer.invoke('collection:openLoginView'),
    /** 兼容别名：行为与 openLoginView 相同（方案 A：真实 Chrome 窗口直登）。 */
    openLoginWindow: () => ipcRenderer.invoke('collection:openLoginView'),
    stopLoginView: () => ipcRenderer.invoke('collection:stopLoginView'),
    checkLoginStatus: () => ipcRenderer.invoke('collection:checkLoginStatus'),
    getSpeedConfig: () => ipcRenderer.invoke('collection:getSpeedConfig'),
    saveSpeedConfig: (input: { profile: Record<string, number> }) => ipcRenderer.invoke('collection:saveSpeedConfig', input),
    /** 登录授权状态订阅：idle / opening / waiting-sso / verified。 */
    onLoginState: (listener: (state: { state: 'idle' | 'opening' | 'waiting-sso' | 'verified' }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, state: { state: 'idle' | 'opening' | 'waiting-sso' | 'verified' }) => listener(state)
      ipcRenderer.on('collection:login-state', handler)
      return () => ipcRenderer.removeListener('collection:login-state', handler)
    },
  },
})
