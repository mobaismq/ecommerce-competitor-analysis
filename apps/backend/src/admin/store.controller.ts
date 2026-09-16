import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
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
}
