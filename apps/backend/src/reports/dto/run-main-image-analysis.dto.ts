import { IsNumber, IsOptional, IsString } from 'class-validator'

export class RunMainImageAnalysisDto {
  @IsOptional()
  @IsString()
  productId?: string

  @IsOptional()
  @IsString()
  productUrl?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  imageUrl?: string

  @IsOptional()
  @IsNumber()
  price?: number

  @IsOptional()
  @IsNumber()
  soldCount?: number

  @IsOptional()
  skus?: unknown[]
}