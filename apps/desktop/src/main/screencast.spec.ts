import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createLoginTarget, closeLoginTarget, connectScreencast, type LoginTarget } from './screencast'

/** 模拟浏览器级 CDP WS：记录 send 数据、自动回复命令（attach 返回 sessionId）、可手动触发事件。 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  /** 是否自动回复命令（默认 true，模拟真实 CDP 端点） */
  autoReply = true

  constructor(_url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
    if (!this.autoReply) return
    const msg = JSON.parse(data) as { id?: number; method?: string }
    if (typeof msg.id !== 'number') return
    // 模拟 CDP 命令响应：attach 需要返回 sessionId
    const result = msg.method === 'Target.attachToTarget' ? { sessionId: 'session-1' } : {}
    setTimeout(() => {
      this.onmessage?.({ data: JSON.stringify({ id: msg.id, result }) })
    }, 0)
  }

  close() {
    this.closed = true
  }

  /** 测试辅助：模拟服务端推送一条 CDP 事件消息 */
  emit(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
}

describe('screencast 帧中继与输入注入 (方案 B, 浏览器级 attach)', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const fakeTarget: LoginTarget = {
    targetId: 'target-1',
    wsUrl: 'ws://127.0.0.1:1/devtools/page/target-1',
    browserWsUrl: 'ws://127.0.0.1:1/devtools/browser/0000',
    viewport: { width: 1280, height: 800 },
  }

  it('createLoginTarget 从 /json/new 取 page WS、从 /json/version 取浏览器 WS', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/json/version')) {
        return { json: async () => ({ webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/browser/bb' }) }
      }
      return { json: async () => ({ id: 'abc123', webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/page/abc123' }) }
    })
    vi.stubGlobal('fetch', fetchMock)

    const target = await createLoginTarget(9876, 'https://login.taobao.com')
    expect(target.targetId).toBe('abc123')
    expect(target.wsUrl).toContain('ws://127.0.0.1:9/devtools/page/abc123')
    expect(target.browserWsUrl).toContain('ws://127.0.0.1:9/devtools/browser/bb')
    expect(target.viewport).toEqual({ width: 1280, height: 800 })

    const [newUrl, newInit] = fetchMock.mock.calls[0]
    expect(String(newUrl)).toContain('/json/new?')
    expect(String(newUrl)).toContain('9876')
    expect((newInit as RequestInit).method).toBe('PUT')
    const [versionUrl] = fetchMock.mock.calls[1]
    expect(String(versionUrl)).toContain('/json/version')
  })

  it('createLoginTarget 无 page webSocketDebuggerUrl 时抛错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({}) }))
    await expect(createLoginTarget(1)).rejects.toThrow(/webSocketDebuggerUrl/)
  })

  it('createLoginTarget 无浏览器级 webSocketDebuggerUrl 时抛错', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/json/version')) return { json: async () => ({}) }
      return { json: async () => ({ id: 'abc123', webSocketDebuggerUrl: 'ws://127.0.0.1:9/devtools/page/abc123' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(createLoginTarget(1)).rejects.toThrow(/浏览器级 webSocketDebuggerUrl/)
  })

  it('连接建立后自动 attach → activateTarget → Page.enable → Page.startScreencast，ready 在成功后 resolve', async () => {
    const onFrame = vi.fn()
    const session = connectScreencast(fakeTarget, { onFrame })
    expect(FakeWebSocket.instances).toHaveLength(1)
    const ws = FakeWebSocket.instances[0]
    expect(ws.closed).toBe(false)

    // ready 在 attach+activate+enable+startScreencast 全部成功后 resolve
    let readyResolved = false
    void session.ready.then(() => {
      readyResolved = true
    })
    await Promise.resolve()
    expect(readyResolved).toBe(false)

    ws.onopen?.()
    await session.ready
    expect(readyResolved).toBe(true)

    // 前 4 条命令顺序：attach → activate → enable → startScreencast
    const commands = ws.sent.slice(0, 4).map((s) => JSON.parse(s) as { method: string; params?: Record<string, unknown>; sessionId?: string })
    expect(commands[0].method).toBe('Target.attachToTarget')
    expect(commands[0].params).toEqual({ targetId: 'target-1', flatten: true })
    expect(commands[1].method).toBe('Target.activateTarget')
    expect(commands[1].params).toEqual({ targetId: 'target-1' })
    expect(commands[2].method).toBe('Page.enable')
    expect(commands[2].sessionId).toBe('session-1')
    expect(commands[3].method).toBe('Page.startScreencast')
    expect(commands[3].params).toMatchObject({ format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 })
    expect(commands[3].sessionId).toBe('session-1')
    expect(session.alive).toBe(true)

    await session.stop()
  })

  it('attach 返回错误时 ready 永不 resolve 且触发 onClose', async () => {
    const onClose = vi.fn()
    const session = connectScreencast(fakeTarget, { onFrame: vi.fn(), onClose })
    const ws = FakeWebSocket.instances[0]
    // 关闭自动回复，手动返回 attach 错误
    ws.autoReply = false
    ws.onopen?.()
    ws.emit({ id: 1, error: { message: 'Target not found' } })

    await new Promise((r) => setTimeout(r, 10))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose.mock.calls[0][0].message).toContain('Target not found')
    expect(session.alive).toBe(false)
  })

  it('收到 Page.screencastFrame 回调帧数据并带 sessionId 自动回 ack（flatten 事件带顶层 sessionId）', async () => {
    const onFrame = vi.fn()
    const session = connectScreencast(fakeTarget, { onFrame })
    const ws = FakeWebSocket.instances[0]
    ws.onopen?.()
    await session.ready
    ws.sent.length = 0

    ws.emit({
      method: 'Page.screencastFrame',
      sessionId: 'session-1',
      params: {
        data: 'aGVsbG8=', // base64("hello")
        metadata: { width: 1920, height: 1080 },
        sessionId: 'frame-session-1',
      },
    })

    expect(onFrame).toHaveBeenCalledTimes(1)
    const frame = onFrame.mock.calls[0][0] as { data: string; width: number; height: number }
    expect(frame.data).toBe('aGVsbG8=')
    expect(frame.width).toBe(1920)
    expect(frame.height).toBe(1080)

    // ack 已发送，且带 sessionId 路由
    const ack = ws.sent.find((s) => s.includes('screencastFrameAck'))
    expect(ack).toBeDefined()
    const ackMsg = JSON.parse(ack!) as { params: { sessionId: string }; sessionId: string }
    expect(ackMsg.params.sessionId).toBe('frame-session-1')
    expect(ackMsg.sessionId).toBe('session-1')

    await session.stop()
  })

  it('其他 session、无 data 帧、非 screencastFrame 消息不回调', async () => {
    const onFrame = vi.fn()
    const session = connectScreencast(fakeTarget, { onFrame })
    const ws = FakeWebSocket.instances[0]
    ws.onopen?.()
    await session.ready

    ws.emit({ method: 'Page.screencastFrame', sessionId: 'other-session', params: { data: 'eA==', sessionId: 'x' } }) // 其它 session
    ws.emit({ method: 'Page.screencastFrame', sessionId: 'session-1', params: { sessionId: 'x' } }) // 无 data
    ws.emit({ method: 'Network.requestWillBeSent', sessionId: 'session-1', params: {} })
    expect(onFrame).not.toHaveBeenCalled()

    await session.stop()
  })

  it('dispatchMouse 发送 Input.dispatchMouseEvent 且带 sessionId、参数正确', async () => {
    const onFrame = vi.fn()
    const session = connectScreencast(fakeTarget, { onFrame })
    const ws = FakeWebSocket.instances[0]
    ws.onopen?.()
    await session.ready
    ws.sent.length = 0

    session.dispatchMouse({ type: 'mousePressed', x: 100.4, y: 200.6 })
    session.dispatchMouse({ type: 'mouseMoved', x: 300, y: 220 })
    session.dispatchMouse({ type: 'mouseReleased', x: 300, y: 220, clickCount: 1 })

    // 等 microtask 派发完成
    await new Promise((r) => setTimeout(r, 10))
    const inputs = ws.sent
      .map((s) => JSON.parse(s) as { method: string; params: Record<string, unknown>; sessionId: string })
      .filter((m) => m.method === 'Input.dispatchMouseEvent')
    expect(inputs).toHaveLength(3)
    expect(inputs[0].params.type).toBe('mousePressed')
    expect(inputs[0].params.x).toBe(100)
    expect(inputs[0].params.y).toBe(201)
    expect(inputs[0].params.button).toBe('left')
    expect(inputs[0].params.clickCount).toBe(1)
    expect(inputs[1].params.type).toBe('mouseMoved')
    expect(inputs[1].params.clickCount).toBe(0)
    expect(inputs[2].params.type).toBe('mouseReleased')
    expect(inputs[0].sessionId).toBe('session-1')

    await session.stop()
  })

  it('dispatchKey 与 insertText 发送对应 CDP 命令且参数正确', async () => {
    const session = connectScreencast(fakeTarget, { onFrame: vi.fn() })
    const ws = FakeWebSocket.instances[0]
    ws.onopen?.()
    await session.ready
    ws.sent.length = 0

    session.dispatchKey({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    session.insertText('test_username_123')

    await new Promise((r) => setTimeout(r, 10))
    const keyCmd = ws.sent
      .map((s) => JSON.parse(s) as { method: string; params: Record<string, unknown>; sessionId: string })
      .find((m) => m.method === 'Input.dispatchKeyEvent')
    expect(keyCmd).toBeDefined()
    expect(keyCmd?.params.key).toBe('Enter')
    expect(keyCmd?.params.windowsVirtualKeyCode).toBe(13)
    expect(keyCmd?.sessionId).toBe('session-1')

    const textCmd = ws.sent
      .map((s) => JSON.parse(s) as { method: string; params: Record<string, unknown>; sessionId: string })
      .find((m) => m.method === 'Input.insertText')
    expect(textCmd).toBeDefined()
    expect(textCmd?.params.text).toBe('test_username_123')
    expect(textCmd?.sessionId).toBe('session-1')

    await session.stop()
  })

  it('stop 幂等：Page.stopScreencast + close，重复 stop 不重复发送', async () => {
    const onFrame = vi.fn()
    const session = connectScreencast(fakeTarget, { onFrame })
    const ws = FakeWebSocket.instances[0]
    ws.onopen?.()
    await session.ready
    ws.sent.length = 0

    await session.stop()
    await session.stop()

    const stopCmd = ws.sent.filter((s) => s.includes('Page.stopScreencast'))
    expect(stopCmd).toHaveLength(1)
    expect(ws.closed).toBe(true)
    expect(session.alive).toBe(false)
  })

  it('onClose 在连接被动关闭时触发，stop 主动关闭不触发', async () => {
    const onClose = vi.fn()
    const session = connectScreencast(fakeTarget, { onFrame: vi.fn(), onClose })
    const ws = FakeWebSocket.instances[0]
    ws.onopen?.()
    await session.ready

    // 主动 stop 不触发 onClose
    await session.stop()
    expect(onClose).not.toHaveBeenCalled()

    // 被动关闭触发
    const session2 = connectScreencast(fakeTarget, { onFrame: vi.fn(), onClose })
    FakeWebSocket.instances[1].onclose?.()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(session2.alive).toBe(false)
  })

  it('closeLoginTarget 调用 /json/close/<id> 且空 id 跳过', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    await closeLoginTarget(9876, 'abc123')
    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/json/close/abc123')
    expect(String(url)).toContain('9876')

    // 空 targetId 直接返回，不触发请求
    await closeLoginTarget(9876, '')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('closeLoginTarget HTTP 非 ok 时抛错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(closeLoginTarget(1, 'x')).rejects.toThrow(/HTTP 404/)
  })
})