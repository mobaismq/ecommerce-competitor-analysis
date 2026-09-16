import { ForbiddenException, type ExecutionContext } from '@nestjs/common'
import type { PrismaService } from '../prisma.service'
import { DataScopeGuard } from './data-scope.guard'

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

function makePrismaMock(opts: {
  dbUser?: { dataScope: string; departmentId: string | null }
  roles?: { roleId: string }[]
  roleStores?: { storeId: string }[]
}) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(opts.dbUser ?? null) },
    userRole: { findMany: jest.fn().mockResolvedValue(opts.roles ?? []) },
    roleStore: { findMany: jest.fn().mockResolvedValue(opts.roleStores ?? []) },
  }
  return prisma
}

describe('DataScopeGuard', () => {
  it('无 user.sub 时直接放行', async () => {
    const prisma = makePrismaMock({})
    const guard = new DataScopeGuard(prisma as unknown as PrismaService)
    const request = { user: {} }
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('dataScope 为 all 时不校验店铺范围', async () => {
    const prisma = makePrismaMock({ dbUser: { dataScope: 'all', departmentId: 'd1' } })
    const guard = new DataScopeGuard(prisma as unknown as PrismaService)
    const request = { user: { sub: 'u1' }, params: { storeId: 's1' } }
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)
    expect((request.user as { dataScope?: string }).dataScope).toBe('all')
    expect(prisma.roleStore.findMany).not.toHaveBeenCalled()
  })

  it('指定店铺超出角色范围时抛 ForbiddenException', async () => {
    const prisma = makePrismaMock({
      dbUser: { dataScope: 'department', departmentId: 'd1' },
      roles: [{ roleId: 'r1' }],
      roleStores: [{ storeId: 's1' }],
    })
    const guard = new DataScopeGuard(prisma as unknown as PrismaService)
    const request = { user: { sub: 'u1' }, params: { storeId: 's2' } }
    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('指定店铺在角色范围内时放行', async () => {
    const prisma = makePrismaMock({
      dbUser: { dataScope: 'department', departmentId: 'd1' },
      roles: [{ roleId: 'r1' }],
      roleStores: [{ storeId: 's1' }, { storeId: 's2' }],
    })
    const guard = new DataScopeGuard(prisma as unknown as PrismaService)
    const request = { user: { sub: 'u1' }, params: { storeId: 's2' } }
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)
  })

  it('未指定店铺时不触发范围校验', async () => {
    const prisma = makePrismaMock({
      dbUser: { dataScope: 'department', departmentId: 'd1' },
    })
    const guard = new DataScopeGuard(prisma as unknown as PrismaService)
    const request = { user: { sub: 'u1' } }
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)
    expect(prisma.roleStore.findMany).not.toHaveBeenCalled()
  })
})