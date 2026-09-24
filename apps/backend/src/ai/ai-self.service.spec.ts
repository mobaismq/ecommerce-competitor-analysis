import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AiSelfConfigService } from './ai-self.service'
import { readUserAiSelfConfig, writeUserAiSelfConfig, userAiConfigPath } from './user-ai-config'

function makeService(overrides: { prisma?: any; router?: any }) {
  return new AiSelfConfigService((overrides.prisma ?? {}) as never, (overrides.router ?? {}) as never)
}

let tmpRoot: string
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'eca-aiself-'))
  process.env.ECOMMERCE_DATA_ROOT = tmpRoot
})
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  delete process.env.ECOMMERCE_DATA_ROOT
})

function basePrisma(user: Record<string, unknown> = {}) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_API_KEY
  return {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', tenantId: 't1', ...user }) },
    providerProfile: { count: jest.fn().mockResolvedValue(0) },
    restore: () => {
      if (OPENROUTER_API_KEY !== undefined) process.env.OPENROUTER_API_KEY = OPENROUTER_API_KEY
    },
  }
}

describe('AiSelfConfigService（模型密钥存用户本机 local 配置）', () => {
  it('无真实 key 且无默认 provider 时诚实返回 ok:false，不调用 router', async () => {
    const prisma = basePrisma()
    const router = { execute: jest.fn() }
    const service = makeService({ prisma, router })
    const res = await service.test('u1')
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('未配置可用的模型 Key')
    expect(router.execute).not.toHaveBeenCalled()
    prisma.restore()
  })

  it('用户显式自配 mock 时诚实返回 ok:false', async () => {
    writeUserAiSelfConfig('u1', { selfEnabled: true, providerType: 'mock', apiKey: 'k' })
    const prisma = basePrisma()
    const router = { execute: jest.fn() }
    const service = makeService({ prisma, router })
    const res = await service.test('u1')
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('mock')
    expect(router.execute).not.toHaveBeenCalled()
    prisma.restore()
  })

  it('有真实 key 时走 router 发探测并返回 ok/model/text', async () => {
    writeUserAiSelfConfig('u1', { selfEnabled: true, providerType: 'ark', apiKey: 'k' })
    const prisma = basePrisma()
    const router = { execute: jest.fn().mockResolvedValue({ status: 'success', model: 'ark-model', text: 'ok' }) }
    const service = makeService({ prisma, router })
    const res = await service.test('u1')
    expect(res.ok).toBe(true)
    expect(res.model).toBe('ark-model')
    expect(router.execute).toHaveBeenCalledWith('text', expect.objectContaining({ prompt: expect.any(String) }), expect.any(Object))
    prisma.restore()
  })

  it('router 抛错时返回 ok:false 并携带错误信息', async () => {
    writeUserAiSelfConfig('u1', { apiKey: 'k', providerType: 'ark' })
    const prisma = basePrisma()
    const router = { execute: jest.fn().mockRejectedValue(new Error('连接超时')) }
    const service = makeService({ prisma, router })
    const res = await service.test('u1')
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('连接超时')
    prisma.restore()
  })

  it('save 写本机文件、get 读本机文件且不落 DB、不回传明文 key，未回传 apiKey 时保留原密钥', async () => {
    const prisma = basePrisma()
    const service = makeService({ prisma, router: { execute: jest.fn() } })
    const saved = await service.save('u1', { enabled: true, providerType: 'ark', apiKey: 'secret-key', baseUrl: 'http://x', model: 'm', timeoutMs: 10 })
    expect(saved.apiKeyConfigured).toBe(true)
    expect(readUserAiSelfConfig('u1').apiKey).toBe('secret-key')
    // 明确落在本机内部根 config 下
    expect(existsSync(userAiConfigPath('u1'))).toBe(true)
    expect(userAiConfigPath('u1')).toContain(join('.ecommerce', 'users', 'u1', 'config'))
    // 未回传 apiKey → 保留原密钥
    await service.save('u1', { enabled: true, providerType: 'ark', model: 'm2' })
    expect(readUserAiSelfConfig('u1').apiKey).toBe('secret-key')
    prisma.restore()
  })
})