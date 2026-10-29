/**
 * CDP Screencast 帧中继与输入注入（方案 B：无头容器画面投射）。
 *
 * 职责：
 * - createLoginTarget: 在已运行的无头 Chromium 上开新 tab（/json/new），返回其 WebSocket 调试地址；
 * - connectScreencast: 对该 tab 建立长连接，Page.startScreencast 拉取帧流，自动回 ack，
 *   并把帧回调给调用方（collection-handlers 转发 renderer）；
 * - dispatchMouse: 坐标映射后的鼠标事件注入（Input.dispatchMouseEvent），供登录点击与滑块拖拽。
 *
 * 设计约束：与 chrome.ts 保持一致——使用 Node 全局 WebSocket，单命令请求-响应风格，
 * 不引入额外依赖；长连接由本模块统一管理生命周期（stop 幂等，进程保留）。
 */
import type { LaunchedChrome } from './chrome'

/** 登录 tab 描述（/json/new 的返回片段）。 */
export interface LoginTarget {
  targetId: string
  /** 目标页专属 WS；保留用于诊断和兼容。 */
  wsUrl: string
  /** 浏览器级 CDP WS，负责 attach/activate 和 session 路由。 */
  browserWsUrl: string
  /** CDP 视口基准尺寸（headless 下由 --window-size 决定）；真实帧尺寸以后续 screencastFrame 的 metadata 为准。 */
  viewport: { width: number; height: number }
}

/** 从 CDP Page.screencastFrame 提取后转发 renderer 的帧负载。 */
export interface ScreencastFrame {
  /** base64 编码的 JPEG 帧数据（不含 data: 前缀） */
  data: string
  width: number
  height: number
  timestamp: number
}

/** 注入的鼠标事件类型（CDP Input.dispatchMouseEvent 的 type 子集）。 */
export type CdpMouseType = 'mousePressed' | 'mouseReleased' | 'mouseMoved'

export interface MouseInput {
  type: CdpMouseType
  x: number
  y: number
  button?: 'left' | 'right' | 'middle' | 'none'
  clickCount?: number
}

/** 注入的键盘事件类型 */
export type CdpKeyType = 'keyDown' | 'keyUp' | 'rawKeyDown' | 'char'

export interface KeyInput {
  type: CdpKeyType
  key?: string
  code?: string
  text?: string
  unmodifiedText?: string
  windowsVirtualKeyCode?: number
  modifiers?: number
}

export interface ConnectScreencastOptions {
  /** JPEG 质量，默认 70 */
  quality?: number
  /** 帧宽度上限，默认 1280 */
  maxWidth?: number
  /** 帧高度上限，默认 800 */
  maxHeight?: number
  /** 每收到一帧就回调（页面画面变化即触发） */
  onFrame: (frame: ScreencastFrame) => void
  /** 连接异常或被动关闭时回调；stop() 主动关闭不触发 */
  onClose?: (err?: Error) => void
}

export interface ScreencastSession {
  /** 长连接是否仍可用 */
  readonly alive: boolean
  /** CDP WebSocket 就绪（onopen）即 resolve；供调用方在连接建立后再开始等帧，避免竞态。 */
  readonly ready: Promise<void>
  /** 停止推流并关闭连接（幂等；不销毁 Chromium 进程） */
  stop: () => Promise<void>
  /** 注入一次鼠标事件（坐标系为 CDP 视口） */
  dispatchMouse: (input: MouseInput) => void
  /** 注入一次键盘事件（供输入账号密码与控制键） */
  dispatchKey: (input: KeyInput) => void
  /** 在当前焦点元素直接插入纯文本（支持中文与快捷粘贴） */
  insertText: (text: string) => void
}

export const DEFAULT_LOGIN_VIEWPORT = { width: 1280, height: 800 } as const

type SocketLike = {
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onerror: (() => void) | null
  onclose: (() => void) | null
}

function connectSocket(wsUrl: string): SocketLike {
  const Ctor = (globalThis as unknown as { WebSocket?: new (url: string) => SocketLike }).WebSocket
  if (!Ctor) throw new Error('当前 Node 不支持全局 WebSocket')
  const raw = new Ctor(wsUrl)
  const socket: SocketLike = {
    send: (data) => raw.send(data),
    close: () => raw.close(),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  }
  raw.onopen = () => socket.onopen?.()
  raw.onmessage = (ev) => socket.onmessage?.(ev)
  raw.onerror = () => socket.onerror?.()
  raw.onclose = () => socket.onclose?.()
  return socket
}

/**
 * 在已运行的无头 Chromium 上创建登录 tab 并返回其调试连接信息。
 * 复用容器（不重启、不改变 headless），URL 通过 /json/new 打开。
 * 同时从 /json/version 取浏览器级 WS，供 attach/activate 使用。
 */
export async function createLoginTarget(port: number, url = 'https://login.taobao.com'): Promise<LoginTarget> {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  const target = await response.json().catch(() => null) as { id?: string; webSocketDebuggerUrl?: string } | null
  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`创建登录 tab 失败: 未返回 webSocketDebuggerUrl (port=${port})`)
  }
  const versionResponse = await fetch(`http://127.0.0.1:${port}/json/version`)
  const version = await versionResponse.json().catch(() => null) as { webSocketDebuggerUrl?: string } | null
  if (!version?.webSocketDebuggerUrl) {
    throw new Error(`创建登录 tab 失败: 未返回浏览器级 webSocketDebuggerUrl (port=${port})`)
  }
  return {
    targetId: target.id ?? '',
    wsUrl: target.webSocketDebuggerUrl,
    browserWsUrl: version.webSocketDebuggerUrl,
    viewport: { ...DEFAULT_LOGIN_VIEWPORT },
  }
}

/** 关闭由 createLoginTarget 创建的 tab，避免反复打开登录视图造成 tab 累积。 */
export async function closeLoginTarget(port: number, targetId: string): Promise<void> {
  if (!targetId) return
  const response = await fetch(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(targetId)}`)
  if (!response.ok) {
    throw new Error(`关闭登录 tab 失败: HTTP ${response.status}`)
  }
}

/**
 * 建立 Screencast 长连接。连接就绪后自动 Page.enable → Page.startScreencast；
 * 每收到 Page.screencastFrame 回调 onFrame 并自动回 screencastFrameAck。
 * 返回会话句柄；stop() 幂等停止。
 */
export function connectScreencast(target: LoginTarget, options: ConnectScreencastOptions): ScreencastSession {
  const socket = connectSocket(target.browserWsUrl)
  let msgId = 0
  let aliveState = true
  let stopped = false
  let sessionId: string | null = null
  let resolveReady: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  const pending = new Map<number, (message: { result?: unknown; error?: { message?: string } }) => void>()

  const send = (
    method: string,
    params?: Record<string, unknown>,
    sid?: string | null,
  ): Promise<{ result?: unknown; error?: { message?: string } }> => {
    if (!aliveState) return Promise.resolve({})
    const id = ++msgId
    const payload: Record<string, unknown> = { id, method, params: params ?? {} }
    if (sid) payload.sessionId = sid
    socket.send(JSON.stringify(payload))
    return new Promise<{ result?: unknown; error?: { message?: string } }>((resolve) => pending.set(id, resolve))
  }

  const failPending = (error: { message: string }) => {
    for (const resolve of pending.values()) resolve({ error })
    pending.clear()
  }

  socket.onopen = async () => {
    const attach = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
    if (attach.error) {
      aliveState = false
      failPending({ message: attach.error.message ?? 'CDP attach 失败' })
      options.onClose?.(new Error(attach.error.message ?? 'CDP attach 失败'))
      return
    }
    sessionId = (attach.result as { sessionId?: string } | undefined)?.sessionId ?? null
    if (!sessionId) {
      aliveState = false
      options.onClose?.(new Error('CDP attach 未返回 sessionId'))
      return
    }

    const activate = await send('Target.activateTarget', { targetId: target.targetId })
    if (activate.error) {
      options.onClose?.(new Error(activate.error.message ?? 'CDP 激活登录页失败'))
      return
    }
    const enable = await send('Page.enable', undefined, sessionId)
    if (enable.error) {
      options.onClose?.(new Error(enable.error.message ?? 'CDP Page.enable 失败'))
      return
    }
    const started = await send('Page.startScreencast', {
      format: 'jpeg',
      quality: options.quality ?? 70,
      maxWidth: options.maxWidth ?? 1280,
      maxHeight: options.maxHeight ?? 800,
      everyNthFrame: 1,
    }, sessionId)
    if (started.error) {
      options.onClose?.(new Error(started.error.message ?? 'CDP Page.startScreencast 失败'))
      return
    }
    resolveReady()
  }

  socket.onmessage = (ev) => {
    let parsed: {
      id?: number
      method?: string
      sessionId?: string
      params?: { data?: string; sessionId?: string; metadata?: { width?: number; height?: number } }
      result?: unknown
      error?: { message?: string }
    } | null = null
    try {
      parsed = JSON.parse(String(ev.data))
    } catch {
      return
    }
    if (typeof parsed?.id === 'number') {
      pending.get(parsed.id)?.(parsed)
      pending.delete(parsed.id)
      return
    }
    if (parsed?.method !== 'Page.screencastFrame' || parsed.sessionId !== sessionId) return
    const p = parsed.params ?? {}
    if (!p.data) return
    options.onFrame({
      data: p.data,
      width: p.metadata?.width ?? target.viewport.width,
      height: p.metadata?.height ?? target.viewport.height,
      timestamp: Date.now(),
    })
    if (p.sessionId) {
      void send('Page.screencastFrameAck', { sessionId: p.sessionId }, sessionId)
    }
  }

  socket.onclose = () => {
    if (!aliveState) return
    aliveState = false
    failPending({ message: 'CDP Screencast 连接已关闭' })
    if (!stopped) options.onClose?.()
  }
  socket.onerror = () => {
    if (!stopped) {
      aliveState = false
      failPending({ message: 'CDP Screencast 连接错误' })
      options.onClose?.(new Error('CDP Screencast 连接错误'))
    }
  }

  return {
    get alive() {
      return aliveState
    },
    ready,
    stop: async () => {
      if (stopped) return
      stopped = true
      if (sessionId) await send('Page.stopScreencast', undefined, sessionId)
      try {
        socket.close()
      } catch {}
      aliveState = false
      failPending({ message: 'CDP Screencast 已停止' })
    },
    dispatchMouse: (input: MouseInput) => {
      void send('Input.dispatchMouseEvent', {
        type: input.type,
        x: Math.round(input.x),
        y: Math.round(input.y),
        button: input.button ?? 'left',
        clickCount: input.clickCount ?? (input.type === 'mousePressed' || input.type === 'mouseReleased' ? 1 : 0),
      }, sessionId)
    },
    dispatchKey: (input: KeyInput) => {
      void send('Input.dispatchKeyEvent', {
        type: input.type,
        key: input.key,
        code: input.code,
        text: input.text,
        unmodifiedText: input.unmodifiedText,
        windowsVirtualKeyCode: input.windowsVirtualKeyCode,
        modifiers: input.modifiers ?? 0,
      }, sessionId)
    },
    insertText: (text: string) => {
      void send('Input.insertText', { text }, sessionId)
    },
  }
}

/** 便捷：从已启动的容器快速建立登录 tab + screencast 会话。 */
export async function startLoginScreencast(
  container: LaunchedChrome,
  options: Omit<ConnectScreencastOptions, 'onFrame'> & { onFrame: ConnectScreencastOptions['onFrame'] },
  loginUrl?: string,
): Promise<{ target: LoginTarget; session: ScreencastSession }> {
  const target = await createLoginTarget(container.port, loginUrl)
  const session = connectScreencast(target, options)
  return { target, session }
}