import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { PrismaService } from '../prisma.service'

@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PermissionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('system:manage')
  list() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } })
  }
}
