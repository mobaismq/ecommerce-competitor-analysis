import { app, safeStorage } from 'electron'
import Store from 'electron-store'

const STORE_NAME = 'local-config-smoke'

app.whenReady().then(() => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage is not available')
  }

  const store = new Store({ name: STORE_NAME })
  const token = 'smoke-token'
  store.set('auth.token', safeStorage.encryptString(token).toString('base64'))
  store.set('config.localRetentionDays', 7)

  const reopened = new Store({ name: STORE_NAME })
  const read = safeStorage.decryptString(Buffer.from(reopened.get('auth.token'), 'base64'))
  const config = reopened.get('config.localRetentionDays')
  reopened.delete('auth.token')
  reopened.delete('config.localRetentionDays')
  const afterClear = reopened.get('auth.token') ?? null

  const result = { readOk: read === token, config, afterClear }
  console.log(JSON.stringify(result))
  app.exit(result.readOk === true && result.config === 7 && result.afterClear === null ? 0 : 1)
})
