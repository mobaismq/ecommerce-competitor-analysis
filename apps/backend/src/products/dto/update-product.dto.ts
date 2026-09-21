import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

export class UpdateProductSkuDto {
  @IsString()
  skuCode!: string

  @IsOptional()
  @IsString()
  specName?: string

  @IsOptional()
  @IsString()
  specImage?: string

  @IsOptional()
  @IsNumber()
  costPrice?: number

  @IsOptional()
  @IsNumber()
  standardPrice?: number
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  productCode?: string

  @IsOptional()
  @IsString()
  productName?: string

  @IsOptional()
  @IsString()
  brand?: string

  @IsOptional()
  @IsString()
  productImage?: string

  @IsOptional()
  @IsString()
  storeId?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductSkuDto)
  skus?: UpdateProductSkuDto[]
}