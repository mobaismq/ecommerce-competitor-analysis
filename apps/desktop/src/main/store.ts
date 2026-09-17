import { ipcMain, safeStorage } from 'electron'
import RawStore from 'electron-store'

const Store = ((RawStore as any)?.default || RawStore) as typeof RawStore

export const localStore = new Store({ name: 'local-config' })

const CONFIG_KEYS = new Set(['localRetentionDays', 'syncCollection', 'syncReport', 'syncAsset'])

type ConfigValue = string | number | boolean

function assertConfigKey(key: string) {
  if (typeof key !== 'string' || !CONFIG_KEYS.has(key)) {
    throw new Error(`unknown config key: ${key}`)
  }
}

function requireEncryption() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage is not available')
  }
}

export function registerStoreHandlers() {
  const store = localStore

  ipcMain.handle('store:get-token', () => {
    const encrypted = store.get('auth.token')
    if (encrypted == null) return null
    requireEncryption()
    return safeStorage.decryptString(Buffer.from(String(encrypted), 'base64'))
  })

  ipcMain.handle('store:set-token', (_event, token: string) => {
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('invalid token')
    }
    requireEncryption()
    store.set('auth.token', safeStorage.encryptString(token).toString('base64'))
    return true
  })

  ipcMain.handle('store:clear-token', () => {
    store.delete('auth.token')
    return true
  })

  ipcMain.handle('store:get-config', (_event, key: string) => {
    assertConfigKey(key)
    return store.get(`config.${key}`) ?? null
  })

  ipcMain.handle('store:set-config', (_event, key: string, value: ConfigValue) => {
    assertConfigKey(key)
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error('invalid config value')
    }
    store.set(`config.${key}`, value)
    return true
  })

  ipcMain.handle('store:clear-config', (_event, key: string) => {
    assertConfigKey(key)
    store.delete(`config.${key}`)
    return true
  })
}
