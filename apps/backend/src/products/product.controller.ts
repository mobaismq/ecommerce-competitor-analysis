import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { ProductService } from './product.service'

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('master')
  list(@Req() request: { user: { tenantId: string } }, @Query('keyword') keyword?: string) {
    return this.productService.list(request.user.tenantId, keyword)
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