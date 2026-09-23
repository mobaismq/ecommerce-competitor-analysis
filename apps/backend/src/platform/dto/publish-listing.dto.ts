import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class PublishListingDto {
  @IsString()
  @IsNotEmpty()
  title!: string

  @IsOptional()
  @IsString()
  storeId?: string

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  price?: number | string

  @IsOptional()
  skus?: Array<Record<string, unknown>>

  @IsOptional()
  contentJson?: Record<string, unknown>

  @IsOptional()
  @IsString()
  subTitle?: string

  @IsOptional()
  @IsString()
  categoryPath?: string

  @IsOptional()
  @IsString()
  brand?: string

  @IsOptional()
  @IsString()
  origin?: string

  @IsOptional()
  @IsString()
  freightTemplate?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mainImages?: string[]

  @IsOptional()
  @IsString()
  video?: string

  @IsOptional()
  @IsString()
  whiteImage?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  detailImages?: string[]

  @IsOptional()
  productAttrs?: Record<string, string>

  @IsOptional()
  @IsString()
  detailContent?: string

  @IsOptional()
  @IsString()
  originPlace?: string

  @IsOptional()
  @IsString()
  warranty?: string

  @IsOptional()
  @IsString()
  shippingTime?: string

  @IsOptional()
  @IsString()
  serviceGuarantees?: string
}
