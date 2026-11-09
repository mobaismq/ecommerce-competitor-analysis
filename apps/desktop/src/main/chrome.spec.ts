import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  resolveChromiumPath,
  getDefaultDtsProfileDir,
  closeChrome,
  probeSystemChrome,
  findSystemChromePath,
  getSystemChromeCandidates,
  GOOGLE_CHROME_DOWNLOAD_URL,
  type LaunchedChrome,
} from './chrome'

describe('chrome 容器生命周期单元测试', () => {
  const testRoot = join(tmpdir(), `eca-chrome-test-${Date.now()}`)

  beforeEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
  })

  it('resolveChromiumPath 严格锁定系统真实 Chrome，不解析任何内置便携浏览器', () => {
    const resolved = resolveChromiumPath()
    expect(typeof resolved).toBe('string')
    expect(resolved).toContain('Google Chrome')
    expect(existsSync(resolved)).toBe(true)
  })

  it('getDefaultDtsProfileDir 正确解析包含 real-chrome-profile 的持久化路径', () => {
    const profile = getDefaultDtsProfileDir()
    expect(profile).toContain('real-chrome-profile')
    expect(typeof profile).toBe('string')
  })

  it('closeChrome 严格守护持久化 real-chrome-profile 不被误删', () => {
    const fakeProfile = join(testRoot, 'userData', 'real-chrome-profile')
    mkdirSync(fakeProfile, { recursive: true })
    writeFileSync(join(fakeProfile, 'Cookies'), 'dummy-cookie-data')

    const fakeLaunched: LaunchedChrome = {
      child: { killed: true, kill: vi.fn(), pid: 12345 } as unknown as LaunchedChrome['child'],
      port: 9222,
      profileDir: fakeProfile,
      debugUrl: 'http://127.0.0.1:9222',
      executablePath: '/dummy/chrome',
    }

    // 默认关闭不应删除任何 profile
    closeChrome(fakeLaunched, false)
    expect(existsSync(join(fakeProfile, 'Cookies'))).toBe(true)

    // 即便传 cleanTemporary=true，因为含有 real-chrome-profile 关键字，也坚决不删除！
    closeChrome(fakeLaunched, true)
    expect(existsSync(join(fakeProfile, 'Cookies'))).toBe(true)
  })

  it('closeChrome 允许清理显式指定的非持久临时 profile', () => {
    const tempProfile = join(testRoot, 'temporary-run-123')
    mkdirSync(tempProfile, { recursive: true })
    writeFileSync(join(tempProfile, 'temp.txt'), 'temp')

    const tempLaunched: LaunchedChrome = {
      child: { killed: true, kill: vi.fn(), pid: 67890 } as unknown as LaunchedChrome['child'],
      port: 9222,
      profileDir: tempProfile,
      debugUrl: 'http://127.0.0.1:9222',
      executablePath: '/dummy/chrome',
    }

    closeChrome(tempLaunched, true)
    expect(existsSync(tempProfile)).toBe(false)
  })

  it('getSystemChromeCandidates 返回非空的候选路径列表并包含官方下载链接', () => {
    const candidates = getSystemChromeCandidates()
    expect(Array.isArray(candidates)).toBe(true)
    expect(candidates.length).toBeGreaterThan(0)
    expect(GOOGLE_CHROME_DOWNLOAD_URL).toBe('https://www.google.cn/chrome/')
  })

  it('probeSystemChrome 能够安全返回结构化探测结果而不抛异常', async () => {
    const result = await probeSystemChrome()
    expect(result).toHaveProperty('installed')
    expect(typeof result.installed).toBe('boolean')
    expect(result.downloadUrl).toBe(GOOGLE_CHROME_DOWNLOAD_URL)
    if (result.installed) {
      expect(typeof result.path).toBe('string')
      expect(existsSync(result.path!)).toBe(true)
    }
  })
})
