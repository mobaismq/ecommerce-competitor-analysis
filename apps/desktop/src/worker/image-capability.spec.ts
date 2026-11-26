import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readLocalAiConfig, resolveEffectiveConfig, saveOpenRouterImageConfig, setServerDefault } from './ai-config'
import { createRealImageProvider, generateImageCapability } from './image-capability'

const dirs: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.ECOMMERCE_DATA_ROOT
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('local image capability', () => {
  it('missing local key fails honestly', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-config-'))
    dirs.push(root)
    expect(() => readLocalAiConfig('user-1', { ECOMMERCE_DATA_ROOT: root })).toThrow('未配置真实 AI 密钥')
  })

  it('rejects the official DeepSeek API as an image generator before any request', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-image-provider-'))
    dirs.push(root)
    process.env.ECOMMERCE_DATA_ROOT = root
    const configDir = join(root, '.ecommerce', 'users', 'user-1', 'config')
    mkdirSync(configDir, { recursive: true })
    writeFileSync(join(configDir, 'ai-default.json'), JSON.stringify({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'mock-only',
      imageModel: 'openai/gpt-image-2',
    }))
    expect(() => createRealImageProvider('user-1')).toThrow('当前 DeepSeek 接口只输出文字')
  })

  it('uses OpenRouter for images only, sends references, and saves URL and base64 results', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-image-'))
    dirs.push(root)
    process.env.ECOMMERCE_DATA_ROOT = root
    mkdirSync(join(root, '.ecommerce'), { recursive: true })
    execFileSync('node', ['scripts/apply-local-migration.mjs'], { cwd: process.cwd(), env: { ...process.env, ECOMMERCE_DATA_ROOT: root }, stdio: 'pipe' })

    const apiKey = 'sk-or-fake-test-key'
    const config = await saveOpenRouterImageConfig('user-1', { apiKey })
    expect(config.openRouterImage).toEqual({ model: 'openai/gpt-image-2', apiKeyConfigured: true })
    expect(JSON.stringify(config)).not.toContain(apiKey)
    const storedConfig = readFileSync(join(root, '.ecommerce', 'users', 'user-1', 'config', 'ai-openrouter-image.json'), 'utf8')
    expect(JSON.parse(storedConfig).apiKey).toMatch(/^enc:v1:/)
    expect(storedConfig).not.toContain(apiKey)

    // 登录重新下发的通用配置不能覆盖独立生图配置。
    setServerDefault('user-1', { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'deepseek-test-key' })
    expect(resolveEffectiveConfig('user-1')).toMatchObject({ baseUrl: 'https://api.deepseek.com/v1', apiKey: 'deepseek-test-key' })

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const imageUrl = 'https://assets.example.test/image.png'
    const reference = `data:image/png;base64,${png.toString('base64')}`
    const request = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ data: [{ url: imageUrl }, { b64_json: png.toString('base64') }] }))
      .mockResolvedValueOnce(new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } }))

    const result = await generateImageCapability({
      userId: 'user-1',
      tenantId: 'tenant-1',
      prompt: '测试主图',
      count: 2,
      size: '2K',
      ratio: '1:1',
      image: reference,
    }, undefined, join(root, 'ecommerce'))
    expect(request).toHaveBeenNthCalledWith(1, 'https://openrouter.ai/api/v1/images', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: `Bearer ${apiKey}` }),
    }))
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
      model: 'openai/gpt-image-2',
      prompt: '测试主图',
      n: 2,
      response_format: 'url',
      aspect_ratio: '1:1',
      input_references: [{ type: 'image_url', image_url: { url: reference } }],
    })
    expect(request).toHaveBeenNthCalledWith(2, imageUrl)
    expect(result.count).toBe(2)
    expect(result.images.map((image) => image.dataUrl)).toEqual([reference, reference])

    const cleared = await saveOpenRouterImageConfig('user-1', { clear: true })
    expect(cleared.openRouterImage.apiKeyConfigured).toBe(false)
    expect(() => createRealImageProvider('user-1')).toThrow('当前 DeepSeek 接口只输出文字')
  })

  it('stops instead of silently ignoring a product reference on unsupported providers', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-reference-'))
    dirs.push(root)
    process.env.ECOMMERCE_DATA_ROOT = root
    const configDir = join(root, '.ecommerce', 'users', 'user-1', 'config')
    mkdirSync(configDir, { recursive: true })
    writeFileSync(join(configDir, 'ai-self.json'), JSON.stringify({ selfEnabled: true, providerType: 'openai-compatible', apiKey: 'real-key', baseUrl: 'https://example.invalid', model: 'test-image' }))

    await expect(generateImageCapability({
      userId: 'user-1',
      tenantId: 'tenant-1',
      prompt: '测试主图',
      image: 'data:image/png;base64,AA==',
    })).rejects.toThrow('不支持参考商品图')
  })
})
