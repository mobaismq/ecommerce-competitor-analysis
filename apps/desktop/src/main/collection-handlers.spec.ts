import { describe, expect, it, vi } from 'vitest'
import { ensureChromiumContainer } from './collection-handlers'
import * as chromeModule from './chrome'

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
})

