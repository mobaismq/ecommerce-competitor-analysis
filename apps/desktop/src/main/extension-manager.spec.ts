import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  validateExtensionDir,
  atomicReplaceExtension,
  resolveActiveExtensionPath,
} from './extension-manager'

describe('extension-manager 单元测试', () => {
  const testRoot = join(tmpdir(), `eca-ext-test-${Date.now()}`)

  beforeEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
    mkdirSync(testRoot, { recursive: true })
  })

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
  })

  it('validateExtensionDir 能精准识别目录缺失与文件损坏', () => {
    expect(validateExtensionDir(join(testRoot, 'not-exist')).valid).toBe(false)

    const emptyDir = join(testRoot, 'empty')
    mkdirSync(emptyDir)
    expect(validateExtensionDir(emptyDir).error).toContain('缺少 manifest.json')

    writeFileSync(join(emptyDir, 'manifest.json'), '{ broken json')
    expect(validateExtensionDir(emptyDir).error).toContain('解析 manifest.json 失败')

    writeFileSync(join(emptyDir, 'manifest.json'), JSON.stringify({ name: '其他扩展', version: '1.0.0' }))
    expect(validateExtensionDir(emptyDir).error).toContain('扩展名称不匹配')
  })

  it('validateExtensionDir 验证合法店透视扩展', () => {
    const validDir = join(testRoot, 'valid-dts')
    mkdirSync(validDir)
    writeFileSync(
      join(validDir, 'manifest.json'),
      JSON.stringify({ name: '店透视(卖家版)', version: '5.0.6', manifest_version: 3 }),
    )

    const res = validateExtensionDir(validDir)
    expect(res.valid).toBe(true)
    expect(res.version).toBe('5.0.6')
    expect(res.manifestVersion).toBe(3)
  })

  it('atomicReplaceExtension 支持原子替换并阻断非法扩展', () => {
    const targetDir = join(testRoot, 'target')
    const oldDir = join(testRoot, 'old')
    mkdirSync(oldDir)
    writeFileSync(join(oldDir, 'manifest.json'), JSON.stringify({ name: '店透视旧版', version: '5.0.5' }))
    atomicReplaceExtension(oldDir, targetDir)
    expect(existsSync(join(targetDir, 'manifest.json'))).toBe(true)
    expect(JSON.parse(readFileSync(join(targetDir, 'manifest.json'), 'utf8')).version).toBe('5.0.5')

    // 非法新扩展应被拦截且原目标目录无损
    const invalidDir = join(testRoot, 'invalid')
    mkdirSync(invalidDir)
    expect(() => atomicReplaceExtension(invalidDir, targetDir)).toThrow('待替换扩展不合法')
    expect(JSON.parse(readFileSync(join(targetDir, 'manifest.json'), 'utf8')).version).toBe('5.0.5')

    // 成功替换为新扩展
    const newDir = join(testRoot, 'new')
    mkdirSync(newDir)
    writeFileSync(join(newDir, 'manifest.json'), JSON.stringify({ name: '店透视新版', version: '5.0.6' }))
    atomicReplaceExtension(newDir, targetDir)
    expect(JSON.parse(readFileSync(join(targetDir, 'manifest.json'), 'utf8')).version).toBe('5.0.6')
  })

  it('resolveActiveExtensionPath 能正向探测已就绪的出厂或本地扩展', () => {
    const active = resolveActiveExtensionPath()
    expect(typeof active).toBe('string')
    expect(existsSync(join(active, 'manifest.json'))).toBe(true)
    const validation = validateExtensionDir(active)
    expect(validation.valid).toBe(true)
    expect(validation.version).toBe('5.0.6')
  })
})
