import { AiSelfConfigService } from './ai-self.service'

function makeService(overrides: { prisma?: any; router?: any }) {
  return new AiSelfConfigService((overrides.prisma ?? {}) as never, (overrides.router ?? {}) as never)
}

function basePrisma(user: Record<string, unknown> = {}) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_API_KEY
  return {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', tenantId: 't1', aiApiKey: null, aiProviderType: null, aiSelfEnabled: false, ...user }) },
    providerProfile: { count: jest.fn().mockResolvedValue(0) },
    restore: () => {
      if (OPENROUTER_API_KEY !== undefined) process.env.OPENROUTER_API_KEY = OPENROUTER_API_KEY
    },
  }
}

describe('AiSelfConfigService.test（5.12 连通性测试）', () => {
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
    const prisma = basePrisma({ aiSelfEnabled: true, aiProviderType: 'mock', aiApiKey: 'k' })
    const router = { execute: jest.fn() }
    const service = makeService({ prisma, router })
    const res = await service.test('u1')
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('mock')
    expect(router.execute).not.toHaveBeenCalled()
    prisma.restore()
  })

  it('有真实 key 时走 router 发探测并返回 ok/model/text', async () => {
    const prisma = basePrisma({ aiSelfEnabled: true, aiProviderType: 'ark', aiApiKey: 'k' })
    const router = { execute: jest.fn().mockResolvedValue({ status: 'success', model: 'ark-model', text: 'ok' }) }
    const service = makeService({ prisma, router })
    const res = await service.test('u1')
    expect(res.ok).toBe(true)
    expect(res.model).toBe('ark-model')
    expect(router.execute).toHaveBeenCalledWith('text', expect.objectContaining({ prompt: expect.any(String) }), expect.any(Object))
    prisma.restore()
  })

  it('router 抛错时返回 ok:false 并携带错误信息', async () => {
    const prisma = basePrisma({ aiApiKey: 'k', aiProviderType: 'ark' })
    const router = { execute: jest.fn().mockRejectedValue(new Error('连接超时')) }
    const service = makeService({ prisma, router })
    const res = await service.test('u1')
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('连接超时')
    prisma.restore()
  })
})
