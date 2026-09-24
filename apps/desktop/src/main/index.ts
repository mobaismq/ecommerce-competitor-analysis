import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerCollectionHandlers } from './collection-handlers'
import { ensureDataRoots } from './data-root'
import { registerStoreHandlers } from './store'
import { registerLocalHandlers, startLocalCleanup, getLocalClient } from './local-db'
import { registerCapabilityHandlers, startCapabilityWorker, stopCapabilityWorker } from './capability-handlers'
import { logger } from './logger'

let mainWindow: BrowserWindow | null = null

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

app.whenReady().then(() => {
  ensureDataRoots()
  // 能力已迁 worker 子进程（utilityProcess.fork + IPC），主进程不再内嵌拉起本地 HTTP 后端。
  // 账号/权限/店铺等服务端能力由独立后端服务提供，渲染层经 env 配置的服务端地址访问。
  registerStoreHandlers()
  const prisma = getLocalClient()
  registerLocalHandlers()
  registerCollectionHandlers(prisma)
  startCapabilityWorker((line) => logger.info(line))
  registerCapabilityHandlers()
  startLocalCleanup()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  stopCapabilityWorker()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
