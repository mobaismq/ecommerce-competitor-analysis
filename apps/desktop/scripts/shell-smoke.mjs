import { app, BrowserWindow } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const preload = join(root, 'out/preload/index.cjs')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload,
    },
  })

  await win.loadURL('data:text/html,<html><body>smoke</body></html>')
  const result = await win.webContents.executeJavaScript(`({
    hasBridge: typeof window.desktop === 'object',
    hasStoreApi: typeof window.desktop?.store === 'object',
    platform: window.desktop?.platform ?? null,
    hasRequire: typeof globalThis.require !== 'undefined'
  })`)

  console.log(JSON.stringify(result))
  const ok = result.hasBridge === true && result.hasStoreApi === true && result.platform === process.platform && result.hasRequire === false
  app.exit(ok ? 0 : 1)
})
