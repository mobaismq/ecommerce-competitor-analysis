import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { DataScopeGuard } from '../auth/data-scope.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { DepartmentService } from './department.service'
import { CreateDepartmentDto } from './dto/create-department.dto'
import { UpdateDepartmentDto } from './dto/update-department.dto'

@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionGuard, DataScopeGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @RequirePermission('system:manage')
  list(@Req() request: { user: { tenantId: string } }) {
    return this.departmentService.list(request.user.tenantId)
  }

  @Post()
  @RequirePermission('system:manage')
  create(@Req() request: { user: { tenantId: string } }, @Body() body: CreateDepartmentDto) {
    return this.departmentService.create(request.user.tenantId, body)
  }

  @Patch(':id')
  @RequirePermission('system:manage')
  update(@Req() request: { user: { tenantId: string } }, @Param('id') id: string, @Body() body: UpdateDepartmentDto) {
    return this.departmentService.update(request.user.tenantId, id, body)
  }

  @Delete(':id')
  @RequirePermission('system:manage')
  remove(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.departmentService.remove(request.user.tenantId, id)
  }
}
