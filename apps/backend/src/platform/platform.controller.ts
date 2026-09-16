import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PlatformAdapterService } from './platform.service'

@Controller('platform-adapters')
@UseGuards(JwtAuthGuard)
export class PlatformAdapterController {
  constructor(private readonly platformAdapterService: PlatformAdapterService) {}

  @Get()
  listPlatforms() {
    return this.platformAdapterService.listPlatforms()
  }

  @Get(':code/categories')
  categories(@Param('code') code: string, @Query('parentId') parentId?: string) {
    return this.platformAdapterService.getCategories(code, parentId)
  }

  @Get(':code/shops')
  shops(@Param('code') code: string) {
    return this.platformAdapterService.getShops(code)
  }
}
