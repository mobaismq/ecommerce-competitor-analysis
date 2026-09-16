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
  collection: {
    start: (input: {
      productName?: string
      productUrl?: string
      mode?: string
      downloadScript?: string
      fake?: boolean
    }) => ipcRenderer.invoke('collection:start', input),
    cancel: () => ipcRenderer.invoke('collection:cancel'),
    status: (jobId?: string) => ipcRenderer.invoke('collection:status', jobId),
    probe: () => ipcRenderer.invoke('collection:probe'),
  },
})
