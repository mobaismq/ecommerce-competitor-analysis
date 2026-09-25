import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { generateImageCapability } from './image-capability'
import { listAssets } from './asset-capability'

// 独立 spec：jobId 透传回归。prisma 是模块级单例，须与其它 DB 写入测试隔离进程，避免共享 DB 被清理成只读。
const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('local image capability · jobId passthrough', () => {
  it('honors an incoming jobId so the frontend can back-query the batch via asset.list', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-image-jobid-'))
    dirs.push(root)
    process.env.ECOMMERCE_DATA_ROOT = root
    mkdirSync(join(root, '.ecommerce'), { recursive: true })
    execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })
    const configDir = join(root, '.ecommerce', 'users', 'user-1', 'config')
    mkdirSync(configDir, { recursive: true })
    writeFileSync(join(configDir, 'ai-self.json'), JSON.stringify({ selfEnabled: true, providerType: 'openai-compatible', apiKey: 'real-key', baseUrl: 'https://example.invalid', model: 'test-image' }))
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const jobId = 'product-sets-frontend-abc123'
    const result = await generateImageCapability({ userId: 'user-1', tenantId: 'tenant-1', prompt: '测试主图', jobId }, { generate: async () => [`data:image/png;base64,${png.toString('base64')}`] }, join(root, 'ecommerce'))
    expect(result.jobId).toBe(jobId)
    const found = await listAssets(undefined, jobId)
    expect(found.map((row) => row.jobId)).toEqual([jobId])
  })
})
