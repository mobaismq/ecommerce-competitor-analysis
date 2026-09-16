import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { PrismaService } from '../prisma.service'
import { PermissionGuard } from './permission.guard'

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({} as never),
    getClass: () => ({} as never),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

function makePrismaMock(roles: { roleId: string }[], perms: { permissionId: string }[], codes: { code: string }[]) {
  return {
    userRole: { findMany: jest.fn().mockResolvedValue(roles) },
    rolePermission: { findMany: jest.fn().mockResolvedValue(perms) },
    permission: { findMany: jest.fn().mockResolvedValue(codes) },
  }
}

describe('PermissionGuard', () => {
  const getAllAndOverride = jest.fn()
  const reflector = { getAllAndOverride } as unknown as Reflector

  it('未声明所需权限时放行且不查库', async () => {
    getAllAndOverride.mockReturnValueOnce(undefined)
    const prisma = makePrismaMock([], [], [])
    const guard = new PermissionGuard(reflector, prisma as unknown as PrismaService)
    const request = { user: { sub: 'u1' } }
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true)
    expect(prisma.userRole.findMany).not.toHaveBeenCalled()
  })

  it('用户缺少 sub 时抛 UnauthorizedException', async () => {
    getAllAndOverride.mockReturnValueOnce(['report:view'])
    const guard = new PermissionGuard(reflector, makePrismaMock([], [], []) as unknown as PrismaService)
    await expect(guard.canActivate(makeContext({ user: {} }))).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('用户持有全部所需权限时放行', async () => {
    getAllAndOverride.mockReturnValueOnce(['report:view', 'report:export'])
    const prisma = makePrismaMock(
      [{ roleId: 'r1' }],
      [{ permissionId: 'p1' }, { permissionId: 'p2' }],
      [{ code: 'report:view' }, { code: 'report:export' }],
    )
    const guard = new PermissionGuard(reflector, prisma as unknown as PrismaService)
    await expect(guard.canActivate(makeContext({ user: { sub: 'u1' } }))).resolves.toBe(true)
  })

  it('缺少任一所需权限时抛 ForbiddenException', async () => {
    getAllAndOverride.mockReturnValueOnce(['report:view', 'report:delete'])
    const prisma = makePrismaMock(
      [{ roleId: 'r1' }],
      [{ permissionId: 'p1' }],
      [{ code: 'report:view' }],
    )
    const guard = new PermissionGuard(reflector, prisma as unknown as PrismaService)
    await expect(guard.canActivate(makeContext({ user: { sub: 'u1' } }))).rejects.toBeInstanceOf(ForbiddenException)
  })
})