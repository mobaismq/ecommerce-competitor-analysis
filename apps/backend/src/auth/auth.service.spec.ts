import { UnauthorizedException } from '@nestjs/common'
import type { JwtService } from '@nestjs/jwt'
import type { PrismaService } from '../prisma.service'
import { AuthService } from './auth.service'
import { hashPassword, verifyPassword } from './password'

function makeMockPrisma(user: unknown) {
  return {
    user: { findFirst: jest.fn().mockResolvedValue(user) },
  }
}

describe('AuthService', () => {
  const signAsync = jest.fn()
  const jwtService = { signAsync } as unknown as JwtService

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('用户不存在时抛 UnauthorizedException', async () => {
    const prisma = makeMockPrisma(null)
    const svc = new AuthService(jwtService, prisma as unknown as PrismaService)
    await expect(svc.login('nobody', 'x')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('密码错误时抛 UnauthorizedException', async () => {
    const user = {
      id: 'u1',
      tenantId: 't1',
      username: 'admin',
      displayName: '管理员',
      passwordHash: hashPassword('right-pass'),
    }
    const prisma = makeMockPrisma(user)
    const svc = new AuthService(jwtService, prisma as unknown as PrismaService)
    await expect(svc.login('admin', 'wrong-pass')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('密码正确时签发 token 并返回用户信息', async () => {
    const user = {
      id: 'u1',
      tenantId: 't1',
      username: 'admin',
      displayName: '管理员',
      passwordHash: hashPassword('right-pass'),
    }
    const prisma = makeMockPrisma(user)
    signAsync.mockResolvedValueOnce('jwt-token')
    const svc = new AuthService(jwtService, prisma as unknown as PrismaService)
    const result = await svc.login('admin', 'right-pass')
    expect(result.accessToken).toBe('jwt-token')
    expect(result.tokenType).toBe('Bearer')
    expect(result.expiresIn).toBe('7d')
    expect(result.user).toEqual({ id: 'u1', tenantId: 't1', username: 'admin', displayName: '管理员' })
    expect(signAsync).toHaveBeenCalledWith({
      sub: 'u1',
      tenantId: 't1',
      username: 'admin',
    })
  })

  it('仅查询 active 且未删除的用户（支持手机号登录）', async () => {
    const prisma = makeMockPrisma(null)
    const svc = new AuthService(jwtService, prisma as unknown as PrismaService)
    await svc.login('admin', 'x').catch(() => undefined)
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { isActive: true, deletedAt: null, OR: [{ username: 'admin' }, { phone: 'admin' }] },
    })
  })
})

describe('AuthService 个人中心接口 (changePassword / changePhone)', () => {
  const jwtService = { signAsync: jest.fn() } as unknown as JwtService

  it('changePassword：原密码正确时更新为新哈希（旧密码失效）', async () => {
    const old = 'old-pass-123456'
    const user = { id: 'u1', tenantId: 't1', username: 'alice', displayName: null, passwordHash: hashPassword(old) }
    const update = jest.fn(async ({ data }) => ({ ...user, passwordHash: String(data.passwordHash) }))
    const prisma = {
      user: { findUnique: jest.fn(async () => user), update },
    } as unknown as PrismaService
    const svc = new AuthService(jwtService, prisma)
    const res = await svc.changePassword('u1', old, 'new-pass-654321')
    expect(res.ok).toBe(true)
    const newHash = update.mock.calls[0][0].data.passwordHash as string
    expect(verifyPassword('new-pass-654321', newHash)).toBe(true)
    expect(verifyPassword(old, newHash)).toBe(false)
  })

  it('changePassword：原密码错误时抛 UnauthorizedException', async () => {
    const user = { id: 'u1', tenantId: 't1', username: 'alice', displayName: null, passwordHash: hashPassword('correct-123456') }
    const prisma = { user: { findUnique: jest.fn(async () => user), update: jest.fn() } } as unknown as PrismaService
    const svc = new AuthService(jwtService, prisma)
    await expect(svc.changePassword('u1', 'wrong-password', 'new-123456')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('changePhone：更新用户手机号', async () => {
    const user = { id: 'u1', tenantId: 't1', username: 'alice', displayName: null, passwordHash: 'hash' }
    const update = jest.fn(async ({ data }) => ({ ...user, ...data }))
    const prisma = { user: { findUnique: jest.fn(async () => user), update } } as unknown as PrismaService
    const svc = new AuthService(jwtService, prisma)
    const res = await svc.changePhone('u1', '13800000001')
    expect(res.ok).toBe(true)
    expect(update.mock.calls[0][0].data.phone).toBe('13800000001')
  })
})