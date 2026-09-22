import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma.service'
import { hashPassword, verifyPassword } from './password'
import { resolveUserPermissionCodes } from './permission.resolver'

@Injectable()
export class AuthService {
  private readonly jwtService: JwtService
  private readonly prisma: PrismaService

  constructor(
    jwtService?: JwtService,
    prisma?: PrismaService,
  ) {
    this.jwtService = jwtService ?? new JwtService({
      secret: process.env.JWT_SECRET || 'replace-with-at-least-32-random-characters',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any },
    })
    this.prisma = prisma ?? new PrismaService()
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, isActive: true, deletedAt: null },
    })

      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw new UnauthorizedException('用户名或密码错误')
      }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      username: user.username,
    })

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '7d',
      user: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        displayName: user.displayName,
      },
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !verifyPassword(oldPassword, user.passwordHash)) {
      throw new UnauthorizedException('原密码错误')
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(newPassword) } })
    return { ok: true }
  }

  async changePhone(userId: string, newPhone: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException('用户不存在')
    await this.prisma.user.update({ where: { id: userId }, data: { phone: newPhone } })
    return { ok: true }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        username: true,
        displayName: true,
        phone: true,
        email: true,
        avatarUrl: true,
        departmentId: true,
      },
    })
    if (!user) throw new UnauthorizedException('用户不存在')
    const isSuper = user.username === 'super_admin' || user.tenantId === 'system'
    const [permissions, roles] = await Promise.all([
      resolveUserPermissionCodes(this.prisma, userId),
      resolveUserRoleNames(this.prisma, userId),
    ])
    return {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      displayName: user.displayName,
      phone: user.phone,
      email: user.email,
      avatarUrl: user.avatarUrl,
      departmentId: user.departmentId,
      isSuper,
      roles,
      permissions,
    }
  }
}

async function resolveUserRoleNames(prisma: PrismaService, userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true } })
  if (userRoles.length === 0) return []
  const roles = await prisma.role.findMany({
    where: { id: { in: userRoles.map((item) => item.roleId) } },
    select: { name: true },
  })
  return roles.map((role) => role.name).filter(Boolean)
}
