import { HealthController } from './health.controller'

describe('HealthController', () => {
  let controller: HealthController
  let fakePrisma: any

  beforeEach(() => {
    controller = new HealthController()
    fakePrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ 1: 1 }]),
    }
    ;(controller as any).prisma = fakePrisma
  })

  it('getHealth 返回基础存活状态', () => {
    expect(controller.getHealth()).toEqual({
      ok: true,
      status: 'up',
      service: 'ecommerce-backend',
    })
  })

  it('getLive 返回 liveness 状态', () => {
    expect(controller.getLive()).toEqual({
      ok: true,
      status: 'up',
      service: 'ecommerce-backend',
    })
  })

  it('getReady 仅检查 MySQL 状态并返回 ready，不依赖 Redis', async () => {
    const result = await controller.getReady()
    expect(fakePrisma.$queryRawUnsafe).toHaveBeenCalledWith('SELECT 1')
    expect(result).toEqual({
      ok: true,
      status: 'ready',
      mysql: 'up',
    })
    expect((result as any).redis).toBeUndefined()
  })

  it('MySQL 查询失败时抛出 ServiceUnavailableException', async () => {
    fakePrisma.$queryRawUnsafe.mockRejectedValue(new Error('DB connection refused'))
    await expect(controller.getReady()).rejects.toThrow()
  })
})
