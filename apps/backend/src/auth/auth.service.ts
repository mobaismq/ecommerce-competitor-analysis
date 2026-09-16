import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma.service'
import { verifyPassword } from './password'

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

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
}
