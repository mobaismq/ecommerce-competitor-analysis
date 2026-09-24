import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PrismaService } from '../prisma.service'
import { ProviderRegistry } from './provider-registry'
import { ProviderRouter } from './provider-router.service'
import type { AiAuditService } from './ai-audit.service'
import type { AiProvider, AiResult } from './ai.types'
import { writeUserAiSelfConfig } from './user-ai-config'

function fakeProvider(registry: ProviderRegistry) {
  const provider: AiProvider = {
    type: 'mock',
    supports: () => true,
    generateText: async () => ({ status: 'success', text: 'ok', model: 'fake-model', durationMs: 0 }),
    analyzeImage: async () => ({ status: 'success', text: 'ok', model: 'fake-model', durationMs: 0 }),
    generateImage: async () => ({ status: 'success', images: [], model: 'fake-model', durationMs: 0 }),
  }
  ;(registry.create as jest.Mock) = jest.fn(() => provider)
  return registry
}

describe('ProviderRouter · 个人自配优先级（密钥存本机 local 配置）', () => {
  let tmpRoot: string
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'eca-router-'))
    process.env.ECOMMERCE_DATA_ROOT = tmpRoot
  })
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    delete process.env.ECOMMERCE_DATA_ROOT
  })

  function build() {
    const prisma = {
      user: { findUnique: jest.fn() },
      providerProfile: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      aiCallCache: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    } as any
    const registry = fakeProvider(new ProviderRegistry())
    const audit = {
      findSuccess: jest.fn().mockResolvedValue(null),
      recordOrReset: jest.fn(),
      complete: jest.fn(),
    } as unknown as AiAuditService
    const router = new ProviderRouter(
      prisma as PrismaService,
      registry,
      audit,
    )
    return { router, registry, prisma }
  }

  it('用户自配存在且启用 + 有 Key → 命中用户配置（优先于租户）', async () => {
    writeUserAiSelfConfig('user-self', {
      selfEnabled: true,
      providerType: 'openai-compatible',
      baseUrl: 'https://my.ai',
      apiKey: 'user-secret',
      model: 'gpt-x',
      timeoutMs: 5000,
    })
    const { router, registry, prisma } = build()
    await router.execute('text', { prompt: 'hi' }, { tenantId: 't1', userId: 'user-self' })

    expect(registry.create).toHaveBeenCalledWith(
      'openai-compatible',
      expect.objectContaining({ apiKey: 'user-secret', baseUrl: 'https://my.ai', model: 'gpt-x', timeoutMs: 5000 }),
    )
    expect(prisma.providerProfile.findMany).not.toHaveBeenCalled()
  })

  it('用户未配置时回落租户 ProviderProfile', async () => {
    const { router, registry, prisma } = build()
    prisma.providerProfile.findMany.mockResolvedValue([
      { id: 'p1', type: 'ark', baseUrl: null, apiKeyRef: 'ARK_API_KEY', modelConfigJson: { model: 'ark-model' }, timeoutMs: 1000, capabilitiesJson: { capabilities: ['text'] }, priority: 10, enabled: true },
    ])
    process.env.ARK_API_KEY = 'ark-secret'
    await router.execute('text', { prompt: 'hi' }, { tenantId: 't1', userId: 'user-noconfig' })

    expect(registry.create).toHaveBeenCalledWith('ark', expect.objectContaining({ apiKey: 'ark-secret', model: 'ark-model' }))
    delete process.env.ARK_API_KEY
  })

  it('未自配也未配租户/系统时回落环境默认', async () => {
    const { router, registry, prisma } = build()
    prisma.providerProfile.findMany.mockResolvedValue([])
    const before = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = 'YOUR_OPENROUTER_API_KEY_HERE' // 视为未配置 → mock 兜底
    await router.execute('text', { prompt: 'hi' }, { tenantId: 't1' })
    expect(registry.create).toHaveBeenCalledWith('mock', expect.anything())
    if (before === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = before
  })
})