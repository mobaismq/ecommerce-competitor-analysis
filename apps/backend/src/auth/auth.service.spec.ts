import { UnauthorizedException } from '@nestjs/common'
import type { JwtService } from '@nestjs/jwt'
import type { PrismaService } from '../prisma.service'
import { AuthService } from './auth.service'
import { hashPassword } from './password'

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

  it('仅查询 active 且未删除的用户', async () => {
    const prisma = makeMockPrisma(null)
    const svc = new AuthService(jwtService, prisma as unknown as PrismaService)
    await svc.login('admin', 'x').catch(() => undefined)
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { username: 'admin', isActive: true, deletedAt: null },
    })
  })
})