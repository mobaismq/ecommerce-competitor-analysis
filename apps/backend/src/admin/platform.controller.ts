import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
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
  list() {
    return this.platformService.list()
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
}
