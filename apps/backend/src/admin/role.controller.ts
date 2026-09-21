import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
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

  @Get('check-duplicate')
  @RequirePermission('role:manage')
  checkDuplicate(@Req() request: { user: { tenantId: string } }, @Query('code') code?: string) {
    return this.roleService.findDuplicate(request.user.tenantId, code).then((field) => ({ duplicate: Boolean(field), field }))
  }

  @Post()
  @RequirePermission('role:manage')
  create(@Req() request: { user: { tenantId: string } }, @Body() body: CreateRoleDto) {
    return this.roleService.create(request.user.tenantId, body)
  }

  @Patch(':id')
  @RequirePermission('role:manage')
  update(@Req() request: { user: { tenantId: string } }, @Param('id') id: string, @Body() body: UpdateRoleDto) {
    return this.roleService.update(request.user.tenantId, id, body)
  }

  @Delete(':id')
  @RequirePermission('role:manage')
  remove(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.roleService.remove(request.user.tenantId, id)
  }
}
