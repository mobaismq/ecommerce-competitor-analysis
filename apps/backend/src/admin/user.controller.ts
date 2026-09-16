import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { DataScopeGuard } from '../auth/data-scope.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserService } from './user.service'

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard, DataScopeGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermission('user:manage')
  list(@Req() request: { user: { tenantId: string; sub: string; dataScope?: string; departmentId?: string | null } }) {
    return this.userService.list({ ...request.user, userId: request.user.sub })
  }

  @Post()
  @RequirePermission('user:manage')
  create(@Req() request: { user: { tenantId: string } }, @Body() body: CreateUserDto) {
    return this.userService.create(request.user.tenantId, body)
  }

  @Patch(':id')
  @RequirePermission('user:manage')
  update(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.userService.update(id, body)
  }

  @Delete(':id')
  @RequirePermission('user:manage')
  remove(@Param('id') id: string) {
    return this.userService.remove(id)
  }
}
