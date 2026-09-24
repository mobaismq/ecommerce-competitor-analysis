import { randomUUID } from 'node:crypto'
import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { extname } from 'node:path'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { StorageDriverService } from '../storage/storage.service'
import { PublishListingDto } from './dto/publish-listing.dto'
import { PlatformAdapterService } from './platform.service'

const MEDIA_KINDS = ['main', 'video', 'white', 'detail'] as const

@Controller('platform-adapters')
@UseGuards(JwtAuthGuard)
export class PlatformAdapterController {
  constructor(
    private readonly platformAdapterService: PlatformAdapterService,
    private readonly storageService: StorageDriverService,
  ) {}

  /** 富媒体去内嵌化：主图/白底图/详情图/主视频字节落盘，返回可供 contentJson 引用与预览的引用。 */
  @Post('media')
  async uploadListingMedia(
    @Req() request: { user: { tenantId: string }; body?: unknown },
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const buffer = request.body as Buffer
    if (!Buffer.isBuffer(buffer)) throw new BadRequestException('请求体必须是二进制流')
    const kind = headers['x-media-kind'] ?? ''
    if (!(MEDIA_KINDS as readonly string[]).includes(kind)) throw new BadRequestException('非法媒体类型')
    const contentType = headers['x-content-type'] || 'application/octet-stream'
    const originalName = headers['x-original-name']?.trim() || `media-${kind}`
    const ext = extname(originalName) || (contentType.includes('video') ? '.mp4' : '.png')
    const storageKey = `listings/${request.user.tenantId}/media/${randomUUID()}${ext}`
    const driver = this.storageService.getDriver()
    const meta = await driver.putObject({ storageKey, buffer, contentType })
    return {
      storageKey,
      mimeType: meta.mimeType,
      size: meta.size,
      kind,
      readUrl: `/api/platform-adapters/media/raw?key=${encodeURIComponent(storageKey)}`,
    }
  }

  @Get('media/raw')
  async rawListingMedia(@Query('key') key: string, @Res() response: any) {
    if (!key) throw new BadRequestException('缺少 key')
    const { buffer, mimeType } = await this.storageService.getDriver().readBytes(key)
    response.type(mimeType).send(buffer)
  }

  @Delete('media')
  async removeListingMedia(@Body() body: { keys?: string[] }) {
    const keys = Array.isArray(body?.keys) ? body.keys : []
    return this.platformAdapterService.cleanupListingMedia(keys)
  }

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

  @Get(':code/status')
  status(@Param('code') code: string) {
    return this.platformAdapterService.getStatus(code)
  }

  @Post(':code/draft')
  saveDraft(
    @Req() request: { user: { tenantId: string } },
    @Param('code') code: string,
    @Body() body: PublishListingDto,
  ) {
    return this.platformAdapterService.saveListingDraft(request.user.tenantId, code, body)
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

