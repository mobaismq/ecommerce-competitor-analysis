import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

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
}
