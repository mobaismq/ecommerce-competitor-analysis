import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  type!: string

  @IsOptional()
  @IsString()
  storeId?: string

  @IsOptional()
  @IsString()
  keyword?: string

  @IsOptional()
  @IsString()
  analysisType?: string

  @IsOptional()
  @IsString()
  businessKey?: string

  @IsOptional()
  @IsString()
  providerProfileId?: string

  @IsOptional()
  @IsNumber()
  minPrice?: number

  @IsOptional()
  @IsNumber()
  maxPrice?: number

  @IsOptional()
  @IsNumber()
  topN?: number

  @IsOptional()
  @IsNumber()
  limit?: number

  @IsOptional()
  @IsNumber()
  searchPages?: number

  @IsOptional()
  autoParse?: boolean
}
