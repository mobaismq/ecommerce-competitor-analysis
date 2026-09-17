import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtService: JwtService

  constructor(jwtService?: JwtService) {
    this.jwtService =
      jwtService ??
      new JwtService({
        secret: process.env.JWT_SECRET || 'replace-with-at-least-32-random-characters',
      })
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>()
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录')
    }
    try {
      request.user = await this.jwtService.verifyAsync(header.slice(7))
    } catch {
      throw new UnauthorizedException('登录已失效')
    }
    return true
  }
}
