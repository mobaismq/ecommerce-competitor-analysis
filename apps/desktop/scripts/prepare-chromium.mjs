#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cpSync, chmodSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const chromiumDir = join(root, 'resources', 'chromium')
const isForce = process.argv.includes('--force')

// 查找目标目录下的有效可执行文件
function findExecutable(dir) {
  if (!existsSync(dir)) return null
  if (process.platform === 'win32') {
    const candidates = [
      join(dir, 'chrome.exe'),
      join(dir, 'chrome-win', 'chrome.exe'),
      join(dir, 'chrome-win64', 'chrome.exe'),
    ]
    for (const cand of candidates) {
      if (existsSync(cand)) return cand
    }
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sub = join(dir, entry.name, 'chrome.exe')
          if (existsSync(sub)) return sub
        }
      }
    } catch {}
  } else if (process.platform === 'darwin') {
    // 递归查找 .app/Contents/MacOS 下的可执行文件
    const searchApp = (current) => {
      try {
        const entries = readdirSync(current, { withFileTypes: true })
        for (const entry of entries) {
          const full = join(current, entry.name)
          if (entry.isDirectory() && entry.name.endsWith('.app')) {
            const macosDir = join(full, 'Contents', 'MacOS')
            if (existsSync(macosDir)) {
              const bins = readdirSync(macosDir)
              if (bins.length > 0) return join(macosDir, bins[0])
            }
          } else if (entry.isDirectory()) {
            const found = searchApp(full)
            if (found) return found
          }
        }
      } catch {}
      return null
    }
    return searchApp(dir)
  }
  return null
}

const existingExe = findExecutable(chromiumDir)
if (!isForce && existingExe) {
  console.log(`[prepare-chromium] 内置 Chromium 容器已就绪: ${existingExe}`)
  process.exit(0)
}

console.log('[prepare-chromium] 正在准备内置便携版 Chromium 容器...')

// 1. 查找 Playwright 本地缓存目录
function getPlaywrightCacheDir() {
  const home = homedir()
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local')
    return join(localAppData, 'ms-playwright')
  }
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Caches', 'ms-playwright')
  }
  return join(home, '.cache', 'ms-playwright')
}

const cacheBase = getPlaywrightCacheDir()
let sourceChromiumDir = null

if (existsSync(cacheBase)) {
  const candidates = readdirSync(cacheBase)
    .filter((name) => name.startsWith('chromium-') && !name.includes('headless_shell'))
    .sort()
    .reverse()

  for (const cand of candidates) {
    const candDir = join(cacheBase, cand)
    const candExe = findExecutable(candDir)
    if (candExe) {
      sourceChromiumDir = candDir
      break
    }
  }
}

// 2. 若本地无缓存，调用 Python playwright install chromium 下载
if (!sourceChromiumDir) {
  console.log('[prepare-chromium] 未检测到本地 Playwright Chromium 缓存，正在按需拉取...')
  const pythonBin = process.platform === 'win32'
    ? join(root, 'resources', 'python', 'python.exe')
    : join(root, 'resources', 'python', 'bin', 'python3')
  const pythonExec = existsSync(pythonBin) ? pythonBin : (process.platform === 'win32' ? 'python' : 'python3')

  try {
    execFileSync(pythonExec, ['-m', 'playwright', 'install', 'chromium'], { stdio: 'inherit' })
  } catch (err) {
    console.warn(`[prepare-chromium] playwright install chromium 警告: ${err.message}`)
  }

  // 再次查找
  if (existsSync(cacheBase)) {
    const candidates = readdirSync(cacheBase)
      .filter((name) => name.startsWith('chromium-') && !name.includes('headless_shell'))
      .sort()
      .reverse()

    for (const cand of candidates) {
      const candDir = join(cacheBase, cand)
      const candExe = findExecutable(candDir)
      if (candExe) {
        sourceChromiumDir = candDir
        break
      }
    }
  }
}

if (!sourceChromiumDir) {
  throw new Error('未能定位或下载 Playwright Chromium 容器，请检查网络或 Playwright 环境')
}

// 3. 归拢复制至 resources/chromium
console.log(`[prepare-chromium] 从缓存复制 Chromium 容器: ${sourceChromiumDir} -> ${chromiumDir}`)
rmSync(chromiumDir, { recursive: true, force: true })
mkdirSync(chromiumDir, { recursive: true })
cpSync(sourceChromiumDir, chromiumDir, { recursive: true })

// 4. 自动自愈 Mac/Linux 执行权限
const copiedExe = findExecutable(chromiumDir)
if (!copiedExe) {
  throw new Error(`复制完成但在目标目录未找到可执行文件: ${chromiumDir}`)
}

if (process.platform !== 'win32') {
  try {
    chmodSync(copiedExe, 0o755)
    console.log(`[prepare-chromium] 成功为二进制设置可执行权限: ${copiedExe}`)
  } catch (err) {
    console.warn(`[prepare-chromium] 设置权限警告: ${err.message}`)
  }
}

console.log(`[prepare-chromium] ✅ 便携 Chromium 容器安装就绪: ${copiedExe}`)
