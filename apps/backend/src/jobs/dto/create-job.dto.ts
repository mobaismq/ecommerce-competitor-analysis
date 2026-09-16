import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

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
}
