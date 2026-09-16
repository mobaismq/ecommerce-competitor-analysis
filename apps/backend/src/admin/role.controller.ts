import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { DataScopeGuard } from '../auth/data-scope.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { RoleService } from './role.service'

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionGuard, DataScopeGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermission('role:manage')
  list(@Req() request: { user: { tenantId: string } }) {
    return this.roleService.list(request.user.tenantId)
  }

  @Post()
  @RequirePermission('role:manage')
  create(@Req() request: { user: { tenantId: string } }, @Body() body: CreateRoleDto) {
    return this.roleService.create(request.user.tenantId, body)
  }

  @Patch(':id')
  @RequirePermission('role:manage')
  update(@Param('id') id: string, @Body() body: UpdateRoleDto) {
    return this.roleService.update(id, body)
  }
}
