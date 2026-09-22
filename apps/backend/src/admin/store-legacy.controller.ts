import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { DataScopeGuard } from '../auth/data-scope.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { StoreService } from './store.service'

/**
 * 旧版兼容路由：legacy 前端 ManualListing 取 `/api/store/list`（分页）。
 * 新前端统一用 `/api/stores`；此处保留别名避免灰度期旧链 404。
 * 复用 StoreService.list（已含分页/筛选兼容信封）。
 */
@Controller('store')
@UseGuards(JwtAuthGuard, PermissionGuard, DataScopeGuard)
export class StoreLegacyController {
  constructor(private readonly storeService: StoreService) {}

  @Get('list')
  @RequirePermission('store:manage')
  list(
    @Req() request: { user: { tenantId: string } },
    @Query('keyword') keyword?: string,
    @Query('platformId') platformId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.storeService.list(request.user.tenantId, {
      keyword,
      platformId,
      status,
      ...(page !== undefined ? { page: Number(page) || 1 } : {}),
      ...(pageSize !== undefined ? { pageSize: Number(pageSize) || 20 } : {}),
    })
  }
}