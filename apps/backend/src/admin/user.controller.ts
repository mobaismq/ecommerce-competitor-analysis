import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
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
  list(
    @Req() request: { user: { tenantId: string; sub: string; dataScope?: string; departmentId?: string | null } },
    @Query('keyword') keyword?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.userService.list(
      { ...request.user, userId: request.user.sub },
      {
        keyword,
        ...(isActive === 'true' || isActive === 'false' ? { isActive: isActive === 'true' } : {}),
        ...(page !== undefined ? { page: Number(page) || 1 } : {}),
        ...(pageSize !== undefined ? { pageSize: Number(pageSize) || 20 } : {}),
      },
    )
  }

  @Post()
  @RequirePermission('user:manage')
  create(@Req() request: { user: { tenantId: string } }, @Body() body: CreateUserDto) {
    return this.userService.create(request.user.tenantId, body)
  }

  @Patch(':id')
  @RequirePermission('user:manage')
  update(@Req() request: { user: { tenantId: string } }, @Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.userService.update(request.user.tenantId, id, body)
  }

  @Get('check-duplicate')
  @RequirePermission('user:manage')
  checkDuplicate(
    @Req() request: { user: { tenantId: string } },
    @Query('username') username?: string,
    @Query('phone') phone?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.userService.findDuplicate(request.user.tenantId, { username, phone }, excludeId).then((field) => ({ duplicate: Boolean(field), field }))
  }

  @Post(':id/reset-password')
  @RequirePermission('user:manage')
  resetPassword(@Req() request: { user: { tenantId: string } }, @Param('id') id: string, @Body() body: { password?: string }) {
    if (!body?.password || body.password.length < 6) {
      return Promise.reject(new BadRequestException('新密码至少 6 位'))
    }
    return this.userService.resetPassword(request.user.tenantId, id, body.password)
  }

  @Delete(':id')
  @RequirePermission('user:manage')
  remove(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.userService.remove(request.user.tenantId, id)
  }
}
