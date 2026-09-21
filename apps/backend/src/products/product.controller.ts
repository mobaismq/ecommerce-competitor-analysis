import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { ProductService, type ListProductsOptions } from './product.service'

function listOptions(q: Record<string, string | undefined>): ListProductsOptions {
  return {
    keyword: q.keyword,
    status: q.status,
    storeId: q.storeId,
    createTimeFrom: q.createTimeFrom,
    createTimeTo: q.createTimeTo,
    page: q.page != null ? Number(q.page) || undefined : undefined,
    pageSize: q.pageSize != null ? Number(q.pageSize) || undefined : undefined,
  }
}

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  listRoot(@Req() request: { user: { tenantId: string } }, @Query() q: Record<string, string | undefined>) {
    return this.productService.list(request.user.tenantId, listOptions(q))
  }

  @Get('master')
  list(@Req() request: { user: { tenantId: string } }, @Query() q: Record<string, string | undefined>) {
    return this.productService.list(request.user.tenantId, listOptions(q))
  }

  @Post('master')
  create(@Req() request: { user: { tenantId: string } }, @Body() body: CreateProductDto) {
    return this.productService.create(request.user.tenantId, body)
  }

  @Patch('master/:id')
  update(@Req() request: { user: { tenantId: string } }, @Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.productService.update(request.user.tenantId, id, body)
  }

  @Delete('master/:id')
  remove(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.productService.remove(request.user.tenantId, id)
  }
}