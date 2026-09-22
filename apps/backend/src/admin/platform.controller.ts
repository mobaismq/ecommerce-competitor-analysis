import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { DataScopeGuard } from '../auth/data-scope.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { CreatePlatformDto } from './dto/create-platform.dto'
import { UpdatePlatformDto } from './dto/update-platform.dto'
import { PlatformService } from './platform.service'

@Controller('platforms')
@UseGuards(JwtAuthGuard, PermissionGuard, DataScopeGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  @RequirePermission('system:manage')
  list(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.platformService.list({
      keyword,
      ...(page !== undefined ? { page: Number(page) || 1 } : {}),
      ...(pageSize !== undefined ? { pageSize: Number(pageSize) || 20 } : {}),
    })
  }

  @Post()
  @RequirePermission('system:manage')
  create(@Body() body: CreatePlatformDto) {
    return this.platformService.create(body)
  }

  @Patch(':id')
  @RequirePermission('system:manage')
  update(@Param('id') id: string, @Body() body: UpdatePlatformDto) {
    return this.platformService.update(id, body)
  }

  @Delete(':id')
  @RequirePermission('system:manage')
  remove(@Param('id') id: string) {
    return this.platformService.remove(id)
  }
}
