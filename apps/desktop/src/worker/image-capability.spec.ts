import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readLocalAiConfig } from './ai-config'
import { generateImageCapability } from './image-capability'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('local image capability', () => {
  it('missing local key fails honestly', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-config-'))
    dirs.push(root)
    expect(() => readLocalAiConfig('user-1', { ECOMMERCE_DATA_ROOT: root })).toThrow('未配置真实 AI 密钥')
  })

  it('configured key accepts a test provider and persists returned bytes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-image-'))
    dirs.push(root)
    process.env.ECOMMERCE_DATA_ROOT = root
    mkdirSync(join(root, '.ecommerce'), { recursive: true })
    execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
    const configDir = join(root, '.ecommerce', 'users', 'user-1', 'config')
    mkdirSync(configDir, { recursive: true })
    writeFileSync(join(configDir, 'ai-self.json'), JSON.stringify({ selfEnabled: true, providerType: 'openai-compatible', apiKey: 'real-key', baseUrl: 'https://example.invalid', model: 'test-image' }))
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const result = await generateImageCapability({ userId: 'user-1', tenantId: 'tenant-1', prompt: '测试主图' }, { generate: async () => [`data:image/png;base64,${png.toString('base64')}`] }, join(root, 'ecommerce'))
    expect(result.count).toBe(1)
    expect(result.assetIds).toHaveLength(1)
  })
})
