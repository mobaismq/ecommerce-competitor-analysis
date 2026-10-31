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
    openLoginView: () => ipcRenderer.invoke('collection:openLoginView'),
    /** 兼容别名：行为与 openLoginView 相同（不再打开外部窗口）。 */
    openLoginWindow: () => ipcRenderer.invoke('collection:openLoginView'),
    stopLoginView: () => ipcRenderer.invoke('collection:stopLoginView'),
    checkLoginStatus: () => ipcRenderer.invoke('collection:checkLoginStatus'),
    sendLoginInput: (input: {
      type: 'mousePressed' | 'mouseReleased' | 'mouseMoved'
      x: number
      y: number
      button?: 'left' | 'right' | 'middle' | 'none'
      clickCount?: number
    }) => ipcRenderer.invoke('collection:loginInput', input),
    sendLoginCursor: (input: { x: number; y: number }) => ipcRenderer.invoke('collection:loginCursor', input),
    sendLoginKey: (input: {
      type: 'keyDown' | 'keyUp' | 'rawKeyDown' | 'char'
      key?: string
      code?: string
      text?: string
      windowsVirtualKeyCode?: number
      modifiers?: number
    }) => ipcRenderer.invoke('collection:loginKey', input),
    sendLoginInsertText: (text: string) => ipcRenderer.invoke('collection:loginInsertText', text),
    onScreencastFrame: (listener: (frame: { data: string; width: number; height: number; timestamp: number }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, frame: { data: string; width: number; height: number; timestamp: number }) => listener(frame)
      ipcRenderer.on('collection:screencast', handler)
      return () => ipcRenderer.removeListener('collection:screencast', handler)
    },
    onScreencastStatus: (listener: (status: { status: string; error?: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, status: { status: string; error?: string }) => listener(status)
      ipcRenderer.on('collection:screencast-status', handler)
      return () => ipcRenderer.removeListener('collection:screencast-status', handler)
    },
    onLoginState: (listener: (state: { state: 'idle' | 'opening' | 'waiting-sso' | 'verified' }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, state: { state: 'idle' | 'opening' | 'waiting-sso' | 'verified' }) => listener(state)
      ipcRenderer.on('collection:login-state', handler)
      return () => ipcRenderer.removeListener('collection:login-state', handler)
    },
  },
})
