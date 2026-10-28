import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  resolveChromiumPath,
  resolveBuiltinChromiumPath,
  getDefaultDtsProfileDir,
  closeChrome,
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

  it('resolveChromiumPath 优先解析到工程内置的便携版 Chromium', () => {
    const builtin = resolveBuiltinChromiumPath()
    expect(builtin).not.toBeNull()
    expect(typeof builtin).toBe('string')
    expect(existsSync(builtin!)).toBe(true)

    const resolved = resolveChromiumPath()
    expect(resolved.isBuiltin).toBe(true)
    expect(resolved.path).toBe(builtin)
  })

  it('getDefaultDtsProfileDir 正确解析包含 dts-profile 的持久化路径', () => {
    const profile = getDefaultDtsProfileDir()
    expect(profile).toContain('dts-profile')
    expect(typeof profile).toBe('string')
  })

  it('closeChrome 严格守护持久化 profile 不被误删 (任务 2.4 登录态持久化)', () => {
    const fakeProfile = join(testRoot, 'userData', 'dts-profile')
    mkdirSync(fakeProfile, { recursive: true })
    writeFileSync(join(fakeProfile, 'Cookies'), 'dummy-cookie-data')

    const fakeLaunched: LaunchedChrome = {
      child: { killed: true, kill: vi.fn(), pid: 12345 } as unknown as LaunchedChrome['child'],
      port: 9222,
      profileDir: fakeProfile,
      debugUrl: 'http://127.0.0.1:9222',
      isBuiltin: true,
      executablePath: '/dummy/chrome',
    }

    // 默认关闭不应删除任何 profile
    closeChrome(fakeLaunched, false)
    expect(existsSync(join(fakeProfile, 'Cookies'))).toBe(true)

    // 即便传 cleanTemporary=true，因为含有 dts-profile 关键字，也坚决不删除！
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
      isBuiltin: true,
      executablePath: '/dummy/chrome',
    }

    closeChrome(tempLaunched, true)
    expect(existsSync(tempProfile)).toBe(false)
  })
})
