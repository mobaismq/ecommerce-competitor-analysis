import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { DataScopeGuard } from '../auth/data-scope.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { CreateProviderProfileDto } from './dto/create-provider-profile.dto'
import { UpdateProviderProfileDto } from './dto/update-provider-profile.dto'
import { ProviderProfileService } from './provider-profile.service'

@Controller('provider-profiles')
@UseGuards(JwtAuthGuard, PermissionGuard, DataScopeGuard)
export class ProviderProfileController {
  constructor(private readonly service: ProviderProfileService) {}

  @Get()
  @RequirePermission('system:manage')
  list(@Req() request: { user: { tenantId: string } }) {
    return this.service.list(request.user.tenantId)
  }

  @Post()
  @RequirePermission('system:manage')
  create(@Req() request: { user: { tenantId: string } }, @Body() body: CreateProviderProfileDto) {
    return this.service.create(request.user.tenantId, body)
  }

  @Patch(':id')
  @RequirePermission('system:manage')
  update(@Req() request: { user: { tenantId: string } }, @Param('id') id: string, @Body() body: UpdateProviderProfileDto) {
    return this.service.update(request.user.tenantId, id, body)
  }

  @Delete(':id')
  @RequirePermission('system:manage')
  remove(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.service.remove(request.user.tenantId, id)
  }

  @Post(':id/test')
  @RequirePermission('system:manage')
  test(@Body() body: { baseUrl?: string }) {
    return this.service.test(body)
  }

  @Post(':id/activate')
  @RequirePermission('system:manage')
  activate(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.service.activate(request.user.tenantId, id)
  }
}
