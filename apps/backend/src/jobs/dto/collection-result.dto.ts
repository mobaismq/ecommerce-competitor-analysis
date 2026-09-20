import { Type } from 'class-transformer'
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'

export class SkuResultDto {
  @IsString()
  @IsNotEmpty()
  skuId!: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  price?: string

  @IsOptional()
  @IsString()
  imageUrl?: string
}

export class QaResultDto {
  @IsOptional()
  @IsString()
  question?: string

  @IsOptional()
  @IsString()
  answer?: string
}

export class ReviewResultDto {
  @IsOptional()
  @IsString()
  content?: string

  @IsOptional()
  @IsInt()
  rating?: number
}

export class ProductResultDto {
  @IsString()
  @IsNotEmpty()
  externalProductId!: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  price?: string

  @IsOptional()
  @IsString()
  shopId?: string

  @IsOptional()
  @IsString()
  shopName?: string

  // 采集侧可选回传：月销与商品主图。表无对应标量列，导入时写入 ProductSnapshot.rawJson，供富报告使用。
  @IsOptional()
  @IsInt()
  sold?: number

  @IsOptional()
  @IsString()
  imageUrl?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkuResultDto)
  skus?: SkuResultDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QaResultDto)
  qas?: QaResultDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewResultDto)
  reviews?: ReviewResultDto[]
}

export class FileResultDto {
  @IsString()
  @IsNotEmpty()
  storageKey!: string

  @IsString()
  @IsNotEmpty()
  mimeType!: string

  @IsInt()
  size!: number

  @IsOptional()
  @IsString()
  originalName?: string

  @IsOptional()
  @IsString()
  sha256?: string

  @IsOptional()
  @IsString()
  sourceUrl?: string
}

export class CollectionResultDto {
  @IsString()
  @IsNotEmpty()
  dataSnapshotDate!: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductResultDto)
  products?: ProductResultDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileResultDto)
  files?: FileResultDto[]
}
