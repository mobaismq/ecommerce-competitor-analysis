import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { DataScopeGuard } from '../auth/data-scope.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { CreateStoreDto } from './dto/create-store.dto'
import { UpdateStoreDto } from './dto/update-store.dto'
import { StoreService } from './store.service'

@Controller('stores')
@UseGuards(JwtAuthGuard, PermissionGuard, DataScopeGuard)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  @RequirePermission('store:manage')
  list(@Req() request: { user: { tenantId: string } }) {
    return this.storeService.list(request.user.tenantId)
  }

  @Get('check-duplicate')
  @RequirePermission('store:manage')
  checkDuplicate(
    @Req() request: { user: { tenantId: string } },
    @Query('platformId') platformId?: string,
    @Query('externalId') externalId?: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.storeService
      .findDuplicate(request.user.tenantId, { platformId, externalId }, excludeId)
      .then((field) => ({ duplicate: Boolean(field), field }))
  }

  @Post()
  @RequirePermission('store:manage')
  create(@Req() request: { user: { tenantId: string } }, @Body() body: CreateStoreDto) {
    return this.storeService.create(request.user.tenantId, body)
  }

  @Patch(':id')
  @RequirePermission('store:manage')
  update(@Req() request: { user: { tenantId: string } }, @Param('id') id: string, @Body() body: UpdateStoreDto) {
    return this.storeService.update(request.user.tenantId, id, body)
  }

  @Delete(':id')
  @RequirePermission('store:manage')
  remove(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.storeService.remove(request.user.tenantId, id)
  }
}
