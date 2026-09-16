import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { PrismaService } from '../prisma.service'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { TenantService } from './tenant.service'

@Controller('tenants')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
  ) {}

  @Get()
  @RequirePermission('system:tenant:manage')
  list() {
    return this.tenantService.list()
  }

  @Post()
  @RequirePermission('system:tenant:manage')
  create(@Body() body: CreateTenantDto) {
    return this.tenantService.create(body)
  }
}
