import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function findChromePath(): string {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  const found = candidates.find(existsSync)
  if (!found) throw new Error('未找到系统 Chrome')
  return found
}

export interface LaunchChromeOptions {
  headless?: boolean
  profileDir?: string
  url?: string
}

export interface LaunchedChrome {
  child: ChildProcess
  port: number
  profileDir: string
  debugUrl: string
}

function waitForDevToolsPort(profileDir: string, timeoutMs = 15000): Promise<number> {
  const file = join(profileDir, 'DevToolsActivePort')
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const poll = () => {
      try {
        if (existsSync(file)) {
          const port = Number(readFileSync(file, 'utf8').split(/\r?\n/)[0])
          if (Number.isInteger(port) && port > 0) {
            resolve(port)
            return
          }
        }
      } catch {}
      if (Date.now() - started > timeoutMs) {
        reject(new Error('等待 Chrome DevToolsActivePort 超时'))
        return
      }
      setTimeout(poll, 200)
    }
    poll()
  })
}

export async function launchChromeForRpa(options: LaunchChromeOptions = {}): Promise<LaunchedChrome> {
  const chrome = findChromePath()
  const profileDir = options.profileDir ?? join(tmpdir(), `eca-rpa-profile-${Date.now()}`)
  mkdirSync(profileDir, { recursive: true })

  const args = [
    `--user-data-dir=${profileDir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    options.url ?? 'about:blank',
  ]
  if (options.headless) args.unshift('--headless=new')

  const child = spawn(chrome, args, { stdio: 'ignore' })
  const port = await waitForDevToolsPort(profileDir)
  return { child, port, profileDir, debugUrl: `http://127.0.0.1:${port}` }
}

export async function evaluatePage(port: number, expression: string, url = 'about:blank'): Promise<unknown> {
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((response) => response.json())
  const WebSocketCtor = (globalThis as { WebSocket?: new (url: string) => WebSocket }).WebSocket
  if (!WebSocketCtor) throw new Error('当前 Node 不支持全局 WebSocket')

  return new Promise((resolve, reject) => {
    const socket = new WebSocketCtor(target.webSocketDebuggerUrl)
    const timer = setTimeout(() => reject(new Error('CDP evaluate timeout')), 10000)
    socket.onopen = () => {
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }))
    }
    socket.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data))
      if (message.id === 1) {
        clearTimeout(timer)
        socket.close()
        resolve(message.result?.result?.value)
      }
    }
    socket.onerror = () => {
      clearTimeout(timer)
      reject(new Error('CDP WebSocket 连接失败'))
    }
  })
}

export function closeChrome(launched: LaunchedChrome) {
  if (!launched.child.killed) launched.child.kill('SIGTERM')
  try {
    rmSync(launched.profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  } catch {}
}
