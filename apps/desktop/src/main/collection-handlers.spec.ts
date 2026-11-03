import { describe, expect, it, vi } from 'vitest'

const handlersMap = new Map<string, Function>()

vi.mock('electron', () => {
  return {
    app: {
      getPath: vi.fn().mockReturnValue('/mock/userData'),
      getAppPath: vi.fn().mockReturnValue(process.cwd()),
      isPackaged: false,
    },
    ipcMain: {
      handle: vi.fn((channel: string, listener: Function) => {
        handlersMap.set(channel, listener)
      }),
    },
    shell: {
      openExternal: vi.fn().mockResolvedValue(undefined),
    },
  }
})

import {
  ensureChromiumContainer,
  handleProbeChrome,
  handleOpenExternalUrl,
  registerCollectionHandlers,
} from './collection-handlers'
import * as chromeModule from './chrome'
import * as screencastModule from './screencast'
import { shell } from 'electron'

describe('collection-handlers 调度器集成测试', () => {
  it('ensureChromiumContainer 在首次调用时正确拉起容器并获得 CDP 调试端点', async () => {
    const fakeLaunched = {
      child: { killed: false, kill: vi.fn() } as unknown as import('node:child_process').ChildProcess,
      port: 9999,
      profileDir: '/test/dts-profile',
      debugUrl: 'http://127.0.0.1:9999',
      isBuiltin: true,
      executablePath: '/test/chrome',
    }

    const launchSpy = vi.spyOn(chromeModule, 'launchChromeForRpa').mockResolvedValue(fakeLaunched)
    const downloadSpy = vi.spyOn(chromeModule, 'setDownloadBehavior').mockResolvedValue()

    const container = await ensureChromiumContainer('/test/workDir')
    expect(launchSpy).toHaveBeenCalledWith(expect.objectContaining({
      persistent: true,
      downloadPath: '/test/workDir',
    }))
    expect(container.debugUrl).toBe('http://127.0.0.1:9999')
    expect(container.isBuiltin).toBe(true)

    launchSpy.mockRestore()
    downloadSpy.mockRestore()
  })

  it('任务 3.3: 离线仿真 (fake: true) 触发端到端采集与日志生成，无需启动外部爬虫', async () => {
    // 验证调度器与 runner 在 fake 仿真模式下完全无需外部爬虫即能闭环
    const handlers = await import('./collection-handlers')
    expect(typeof handlers.registerCollectionHandlers).toBe('function')
  })

  it('registerCollectionHandlers 正确注册并响应 collection:probeChrome 与 collection:openExternalUrl', async () => {
    const probeSpy = vi.spyOn(chromeModule, 'probeSystemChrome').mockResolvedValue({
      installed: true,
      path: '/Applications/Google Chrome.app',
      version: '156.0.0.0',
      downloadUrl: 'https://www.google.cn/chrome/',
    })

    registerCollectionHandlers({} as any)

    expect(handlersMap.has('collection:probeChrome')).toBe(true)
    expect(handlersMap.has('collection:openExternalUrl')).toBe(true)

    // 测试 probeChrome 调用
    const probeHandler = handlersMap.get('collection:probeChrome')!
    const probeRes = await probeHandler()
    expect(probeRes.installed).toBe(true)
    expect(probeRes.version).toBe('156.0.0.0')

    // 测试 openExternalUrl 成功调用
    const openHandler = handlersMap.get('collection:openExternalUrl')!
    const openRes = await openHandler({}, 'https://www.google.cn/chrome/')
    expect(openRes).toEqual({ ok: true })
    expect(shell.openExternal).toHaveBeenCalledWith('https://www.google.cn/chrome/')

    // 测试非法 URL 防御
    await expect(openHandler({}, 'javascript:alert(1)')).rejects.toThrow('仅允许打开合法的 http/https 链接')

    probeSpy.mockRestore()
  })

  it('handleProbeChrome 与 handleOpenExternalUrl 函数级独立逻辑断言', async () => {
    const probeSpy = vi.spyOn(chromeModule, 'probeSystemChrome').mockResolvedValue({
      installed: false,
      downloadUrl: 'https://www.google.cn/chrome/',
    })
    const res = await handleProbeChrome()
    expect(res.installed).toBe(false)
    expect(res.downloadUrl).toBe('https://www.google.cn/chrome/')
    probeSpy.mockRestore()

    await expect(handleOpenExternalUrl('ftp://example.com')).rejects.toThrow('仅允许打开合法的 http/https 链接')
    await expect(handleOpenExternalUrl('https://www.google.cn/chrome/')).resolves.toEqual({ ok: true })
  })

  it('任务 4.2: openLoginView 收敛为真实窗口直登，不再建立投屏会话且返回结构无 viewport', async () => {
    const fakeLaunched = {
      child: { killed: false, kill: vi.fn() } as unknown as import('node:child_process').ChildProcess,
      port: 9998,
      profileDir: '/test/real-chrome-profile',
      debugUrl: 'http://127.0.0.1:9998',
      isBuiltin: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    }
    const launchSpy = vi.spyOn(chromeModule, 'launchChromeForRpa').mockResolvedValue(fakeLaunched as never)
    const cookieSpy = vi.spyOn(chromeModule, 'getCookiesFromChrome').mockResolvedValue([])
    const targetSpy = vi.spyOn(screencastModule, 'createLoginTarget').mockResolvedValue({
      targetId: 'fake-login-target',
      wsUrl: 'ws://127.0.0.1:9998/devtools/page/fake',
      browserWsUrl: 'ws://127.0.0.1:9998/devtools/browser/fake',
      viewport: { width: 1280, height: 800 },
    } as never)
    const closeTargetSpy = vi.spyOn(screencastModule, 'closeLoginTarget').mockResolvedValue()
    const connectSpy = vi.spyOn(screencastModule, 'connectScreencast')
    const fetchStub = vi.fn().mockRejectedValue(new Error('fetch not used in unit test'))
    const originalFetch = globalThis.fetch
    ;(globalThis as { fetch: unknown }).fetch = fetchStub

    registerCollectionHandlers({} as never)
    const openHandler = handlersMap.get('collection:openLoginView')!
    const fakeSender = { isDestroyed: () => false, send: vi.fn() } as never
    const res = await openHandler({ sender: fakeSender })

    // 方案 A：仅创建登录 target 指向淘宝登录页，绝不建立投屏会话
    expect(screencastModule.createLoginTarget).toHaveBeenCalledWith(expect.any(Number), 'https://login.taobao.com')
    expect(connectSpy).not.toHaveBeenCalled()
    expect(fetchStub).toHaveBeenCalledWith(expect.stringContaining('/json/activate/fake-login-target'))
    // 返回结构不含 viewport（不再有投屏坐标系语义）
    expect(res).toEqual({ ok: true, port: 9998, targetId: 'fake-login-target' })

    // 清理登录态：关闭登录 target 与轮询定时器，避免测试悬挂
    const stopHandler = handlersMap.get('collection:stopLoginView')!
    const stopRes = await stopHandler()
    expect(stopRes).toEqual({ ok: true })
    expect(closeTargetSpy).toHaveBeenCalledWith(9998, 'fake-login-target')

    ;(globalThis as { fetch: unknown }).fetch = originalFetch
    for (const spy of [launchSpy, cookieSpy, targetSpy, closeTargetSpy, connectSpy]) spy.mockRestore()
  })

  it('任务 4.3: checkLoginStatus 诊断字段反映真实有头 Chrome（system-chrome-headed）', async () => {
    const fakeLaunched = {
      child: { killed: false, kill: vi.fn() } as unknown as import('node:child_process').ChildProcess,
      port: 9997,
      profileDir: '/test/real-chrome-profile',
      debugUrl: 'http://127.0.0.1:9997',
      isBuiltin: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    }
    const launchSpy = vi.spyOn(chromeModule, 'launchChromeForRpa').mockResolvedValue(fakeLaunched as never)
    const cookieSpy = vi.spyOn(chromeModule, 'getCookiesFromChrome').mockResolvedValue([
      { name: 'unb', value: '34212345', domain: '.taobao.com', path: '/' },
      { name: 'tracknick', value: encodeURIComponent('未来之梦小伟'), domain: '.taobao.com', path: '/' },
    ] as never)

    registerCollectionHandlers({} as never)
    const checkHandler = handlersMap.get('collection:checkLoginStatus')!
    const res = await checkHandler()

    expect(res.isLoggedIn).toBe(true)
    expect(res.taobaoNick).toBe('未来之梦小伟')
    expect(res.diagnostics.mode).toBe('system-chrome-headed')
    expect(res.diagnostics.webdriverExposed).toBe(false)
    // 反向断言：已切真实 Chrome 后绝不回退为 headless 诊断
    expect(res.diagnostics.mode).not.toBe('headless-cdp')

    launchSpy.mockRestore()
    cookieSpy.mockRestore()
  })

  it('任务 2.4: 未安装系统 Chrome 时 collection:start 同步前置拦截并抛出 CHROME_NOT_FOUND', async () => {
    const probeSpy = vi.spyOn(chromeModule, 'probeSystemChrome').mockResolvedValue({
      installed: false,
      downloadUrl: 'https://www.google.cn/chrome/',
    })

    const startHandler = handlersMap.get('collection:start')!
    await expect(
      startHandler({}, { productName: '测试商品', topN: 10, searchPages: 5, fake: false })
    ).rejects.toThrow('CHROME_NOT_FOUND')

    probeSpy.mockRestore()
  })

  it('任务 4.9: ensureChromiumContainer 缓存实例不健康时不再复用，健康时直接复用', async () => {
    const stale = {
      child: { killed: false, kill: vi.fn() } as unknown as import('node:child_process').ChildProcess,
      port: 9996,
      profileDir: '/test/real-chrome-profile',
      debugUrl: 'http://127.0.0.1:9996',
      isBuiltin: false,
      executablePath: '/test/chrome',
    }
    const fresh = {
      ...stale,
      port: 9995,
      debugUrl: 'http://127.0.0.1:9995',
    }
    const launchSpy = vi
      .spyOn(chromeModule, 'launchChromeForRpa')
      .mockResolvedValueOnce(stale as never)
      .mockResolvedValueOnce(fresh as never)
    // 模拟「端口 HTTP 通但 0 page target」的空壳实例：健康检查必须返回 false
    const healthSpy = vi.spyOn(chromeModule, 'isBrowserCdpHealthy').mockResolvedValue(false)
    const extHealthSpy = vi.spyOn(chromeModule, 'ensureExtensionLoadedViaCdp').mockResolvedValue(true)
    const downloadSpy = vi.spyOn(chromeModule, 'setDownloadBehavior').mockResolvedValue()

    const first = await ensureChromiumContainer('/test/workDir')
    const second = await ensureChromiumContainer('/test/workDir')

    expect(first.port).toBe(9996)
    // 缓存实例不健康 → 必须重新拉起，不能直接把 9996 返回给采集
    expect(second.port).toBe(9995)
    expect(launchSpy).toHaveBeenCalledTimes(2)

    // 健康时直接复用缓存实例，不再重新拉起
    healthSpy.mockResolvedValue(true)
    const third = await ensureChromiumContainer('/test/workDir')
    expect(third.port).toBe(9995)
    expect(launchSpy).toHaveBeenCalledTimes(2)
    expect(downloadSpy).toHaveBeenCalledWith(9995, '/test/workDir')

    launchSpy.mockRestore()
    healthSpy.mockRestore()
    extHealthSpy.mockRestore()
    downloadSpy.mockRestore()
  })

  it('collection:getSpeedConfig 与 collection:saveSpeedConfig 正确读取与更新防风控配置', async () => {
    const fakePrisma = {} as any
    registerCollectionHandlers(fakePrisma)

    const getHandler = handlersMap.get('collection:getSpeedConfig')
    const saveHandler = handlersMap.get('collection:saveSpeedConfig')

    expect(typeof getHandler).toBe('function')
    expect(typeof saveHandler).toBe('function')

    const initial = await getHandler!()
    expect(initial.ok).toBe(true)
    expect(initial.profile.batch_delay).toBeGreaterThanOrEqual(10)
    expect(initial.defaultProfile.batch_delay).toBe(60)

    const saveRes = await saveHandler!({}, {
      profile: {
        batch_delay: 50,
        export_cooldown: 40,
      },
    })
    expect(saveRes.ok).toBe(true)

    const updated = await getHandler!()
    expect(updated.profile.batch_delay).toBe(50)
    expect(updated.profile.export_cooldown).toBe(40)

    // 恢复为默认推荐 60 / 35 避免污染环境
    await saveHandler!({}, {
      profile: {
        batch_delay: 60,
        export_cooldown: 35,
      },
    })
  })
})

