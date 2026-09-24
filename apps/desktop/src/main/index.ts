import { app, BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BackendRunner } from './backend-runner'
import { registerCollectionHandlers } from './collection-handlers'
import { ensureDataRoots, resolveDataRoots } from './data-root'
import { registerStoreHandlers } from './store'
import { registerLocalHandlers, startLocalCleanup, getLocalClient } from './local-db'
import { logger } from './logger'

let mainWindow: BrowserWindow | null = null
let backendRunner: BackendRunner | null = null

/** 解析打包后的后端入口（打包→resourcesPath，开发→backend/dist）。 */
function resolveBackendEntry(): string | undefined {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'backend', 'dist', 'src', 'main.js'), join(process.resourcesPath, 'backend', 'main.js')]
    : [join(app.getAppPath(), '..', 'backend', 'dist', 'src', 'main.js')]
  return candidates.find((p) => existsSync(p))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: '电商竞品分析 - 桌面客户端',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: join(__dirname, '../preload/index.cjs'),
    },
  })

  // 渲染层即业务 UI（已并入 src/renderer，原独立前端包已删除）。
  // dev 由 electron-vite 注入 ELECTRON_RENDERER_URL；prod 加载本地构建产物 out/renderer/index.html。
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  ensureDataRoots()
  const entry = resolveBackendEntry()
  const runner = new BackendRunner({
    entry,
    port: Number(process.env.BACKEND_PORT || 8787),
    baseUrl: process.env.BACKEND_REMOTE_URL,
    dataRoot: resolveDataRoots().base,
    storageDriver: process.env.STORAGE_DRIVER,
    onLog: (line) => logger.info(line),
  })
  backendRunner = runner
  try {
    const { mode, baseUrl } = await runner.start()
    logger.info('backend runner', { mode, baseUrl })
  } catch (error) {
    logger.warn('内嵌后端未启动，回退外部/远程后端模式', error)
  }
  registerStoreHandlers()
  const prisma = getLocalClient()
  registerLocalHandlers()
  registerCollectionHandlers(prisma)
  startLocalCleanup()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  if (backendRunner) void backendRunner.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})