import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma.service'
import { hashPassword, verifyPassword } from './password'

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
}
