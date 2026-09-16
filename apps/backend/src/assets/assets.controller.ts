import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { AssetService } from './assets.service'

@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  @RequirePermission('asset:view')
  list(@Req() request: { user: { tenantId: string } }) {
    return this.assetService.list(request.user.tenantId)
  }

  @Get(':assetId')
  @RequirePermission('asset:view')
  find(@Req() request: { user: { tenantId: string } }, @Param('assetId') assetId: string) {
    return this.assetService.find(assetId, request.user.tenantId)
  }

  @Get(':assetId/raw')
  @RequirePermission('asset:view')
  async raw(@Req() request: { user: { tenantId: string } }, @Param('assetId') assetId: string, @Res() response: any) {
    const { buffer, mimeType } = await this.assetService.raw(assetId, request.user.tenantId)
    response.type(mimeType).send(buffer)
  }
}
