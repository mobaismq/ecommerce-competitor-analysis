import { resolvePermissionContext } from './permission.resolver'

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    userRole: { findMany: jest.fn().mockResolvedValue([{ roleId: 'r1' }]) },
    rolePermission: { findMany: jest.fn().mockResolvedValue([{ permissionId: 'p1' }, { permissionId: 'p2' }]) },
    roleStore: { findMany: jest.fn().mockResolvedValue([{ storeId: 's1' }]) },
    user: { findUnique: jest.fn().mockResolvedValue({ dataScope: 'self' }) },
    permission: {
      findMany: jest.fn().mockResolvedValue([
        { code: 'analysis:view', type: 'menu' },
        { code: 'market:report:generate', type: 'button' },
      ]),
    },
    ...overrides,
  }
}

describe('resolvePermissionContext（2.2/5.11 结构化权限）', () => {
  it('按 type 分 menuCodes/buttonCodes，聚合店铺，推导 dataScope', async () => {
    const prisma = makePrisma()
    const ctx = await resolvePermissionContext(prisma as never, 'u1')
    expect(ctx.menuCodes).toEqual(['analysis:view'])
    expect(ctx.buttonCodes).toEqual(['market:report:generate'])
    expect(ctx.storeIds).toEqual(['s1'])
    expect(ctx.storeScopeAll).toBe(false)
    expect(ctx.dataScope).toBe('self')
  })

  it('未配置任何店铺时 storeScopeAll=true（先不加权限的宽松默认）', async () => {
    const prisma = makePrisma({ roleStore: { findMany: jest.fn().mockResolvedValue([]) } })
    const ctx = await resolvePermissionContext(prisma as never, 'u1')
    expect(ctx.storeScopeAll).toBe(true)
    expect(ctx.storeIds).toEqual([])
  })

  it('无角色时返回空权限 + storeScopeAll=true + dataScope=all', async () => {
    const prisma = makePrisma({ userRole: { findMany: jest.fn().mockResolvedValue([]) } })
    const ctx = await resolvePermissionContext(prisma as never, 'u1')
    expect(ctx.menuCodes).toEqual([])
    expect(ctx.buttonCodes).toEqual([])
    expect(ctx.storeScopeAll).toBe(true)
    expect(ctx.dataScope).toBe('all')
  })

  it('角色带 * 哨兵时展开为全部权限', async () => {
    const prisma = makePrisma({
      rolePermission: { findMany: jest.fn().mockResolvedValue([{ permissionId: '*' }]) },
    })
    await resolvePermissionContext(prisma as never, 'u1')
    // hasAll 时不带 where 取全部权限
    expect(prisma.permission.findMany).toHaveBeenCalledWith({ select: { code: true, type: true } })
  })
})
