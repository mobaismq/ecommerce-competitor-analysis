import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PublishListingDto } from './dto/publish-listing.dto'
import { PlatformAdapterService } from './platform.service'

@Controller('platform-adapters')
@UseGuards(JwtAuthGuard)
export class PlatformAdapterController {
  constructor(private readonly platformAdapterService: PlatformAdapterService) {}

  @Get()
  listPlatforms() {
    return this.platformAdapterService.listPlatforms()
  }

  @Get('products')
  listProducts(
    @Req() request: { user: { tenantId: string } },
    @Query('platform') platform?: string,
    @Query('storeId') storeId?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.platformAdapterService.listProducts(request.user.tenantId, {
      platform,
      storeId,
      keyword,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Get(':code/categories')
  categories(
    @Param('code') code: string,
    @Query('parentId') parentId?: string,
    @Query('parent_cid') parentCid?: string,
  ) {
    return this.platformAdapterService.getCategories(code, parentId ?? parentCid)
  }

  @Get(':code/shops')
  shops(@Param('code') code: string) {
    return this.platformAdapterService.getShops(code)
  }

  @Post(':code/publish')
  publish(
    @Req() request: { user: { tenantId: string } },
    @Param('code') code: string,
    @Body() body: PublishListingDto,
  ) {
    return this.platformAdapterService.publishListing(request.user.tenantId, code, body)
  }
}

