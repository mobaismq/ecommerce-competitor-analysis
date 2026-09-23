import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { RunMainImageAnalysisDto } from './dto/run-main-image-analysis.dto'
import { ReportProductsService } from './report-products.service'

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportProductsController {
  constructor(private readonly service: ReportProductsService) {}

  @Get(':id/products')
  @RequirePermission('market:report:view')
  products(
    @Req() request: { user: { tenantId: string } },
    @Param('id') id: string,
    @Query('keyword') keyword?: string,
    @Query('productId') productId?: string,
    @Query('shopName') shopName?: string,
    @Query('skuKeyword') skuKeyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.productsView(id, request.user.tenantId, {
      keyword,
      productId,
      shopName,
      skuKeyword,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Post(':id/main-image-analysis')
  @HttpCode(200)
  @RequirePermission('market:report:view')
  runMainImageAnalysis(@Req() request: { user: { tenantId: string; sub?: string } }, @Param('id') id: string, @Body() body: RunMainImageAnalysisDto) {
    return this.service.runMainImageAnalysis({
      tenantId: request.user.tenantId,
      userId: request.user.sub,
      runId: id,
      productId: body.productId,
      productUrl: body.productUrl,
      title: body.title,
      imageUrl: body.imageUrl,
      price: body.price,
      soldCount: body.soldCount,
      skus: body.skus,
    })
  }

  @Get(':id/main-image-analysis/:productId')
  @RequirePermission('market:report:view')
  getMainImageAnalysis(
    @Req() request: { user: { tenantId: string } },
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.service.getMainImageAnalysis(id, productId, request.user.tenantId)
  }

  @Get(':id/price-bands-preview')
  @RequirePermission('market:report:view')
  priceBandsPreview(
    @Req() request: { user: { tenantId: string } },
    @Param('id') id: string,
    @Query('costPrice') costPrice?: string,
    @Query('shippingCost') shippingCost?: string,
    @Query('packagingCost') packagingCost?: string,
    @Query('laborCost') laborCost?: string,
    @Query('platformFeeRate') platformFeeRate?: string,
    @Query('adFeeRate') adFeeRate?: string,
    @Query('targetMargin') targetMargin?: string,
  ) {
    const num = (v?: string) => (v === undefined || v === '' ? undefined : Number(v))
    return this.service.priceBandsPreview({
      tenantId: request.user.tenantId,
      runId: id,
      costPrice: num(costPrice),
      shippingCost: num(shippingCost),
      packagingCost: num(packagingCost),
      laborCost: num(laborCost),
      platformFeeRate: num(platformFeeRate),
      adFeeRate: num(adFeeRate),
      targetMargin: num(targetMargin),
    })
  }

  @Get('market-bands-preview')
  @RequirePermission('market:report:view')
  marketBandsPreview(
    @Req() request: { user: { tenantId: string } },
    @Query('keyword') keyword?: string,
    @Query('costPrice') costPrice?: string,
    @Query('shippingCost') shippingCost?: string,
    @Query('packagingCost') packagingCost?: string,
    @Query('laborCost') laborCost?: string,
    @Query('platformFeeRate') platformFeeRate?: string,
    @Query('adFeeRate') adFeeRate?: string,
    @Query('targetMargin') targetMargin?: string,
  ) {
    const num = (v?: string) => (v === undefined || v === '' ? undefined : Number(v))
    return this.service.priceBandsPreviewByKeyword({
      tenantId: request.user.tenantId,
      keyword,
      costPrice: num(costPrice),
      shippingCost: num(shippingCost),
      packagingCost: num(packagingCost),
      laborCost: num(laborCost),
      platformFeeRate: num(platformFeeRate),
      adFeeRate: num(adFeeRate),
      targetMargin: num(targetMargin),
    })
  }

  @Post('market-bands/:bandName/rerun')
  @HttpCode(200)
  @RequirePermission('market:report:view')
  rerunBandAnalysis(
    @Req() request: { user: { tenantId: string; sub?: string } },
    @Param('bandName') bandName: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.rerunBandAnalysis({
      tenantId: request.user.tenantId,
      keyword,
      bandName,
      userId: request.user.sub,
    })
  }
}