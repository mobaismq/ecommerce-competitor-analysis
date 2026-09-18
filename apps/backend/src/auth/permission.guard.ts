import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PrismaService } from '../prisma.service'
import { PERMISSIONS_KEY } from './permission.decorator'
import { resolveUserPermissionCodes } from './permission.resolver'

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly reflector: Reflector
  private readonly prisma: PrismaService

  constructor(
    reflector?: Reflector,
    prisma?: PrismaService,
  ) {
    this.reflector = reflector ?? new Reflector()
    this.prisma = prisma ?? new PrismaService()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required?.length) return true

    const request = context.switchToHttp().getRequest<{ user?: { sub?: string } }>()
    const userId = request.user?.sub
    if (!userId) throw new UnauthorizedException()

    const codes = new Set(await resolveUserPermissionCodes(this.prisma, userId))
    if (!required.every((code) => codes.has(code))) {
      throw new ForbiddenException('无权限')
    }
    return true
  }
}
