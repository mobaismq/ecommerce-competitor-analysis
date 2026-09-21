import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  externalId?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsString()
  authorizedBy?: string

  @IsOptional()
  @IsString()
  authExpiresAt?: string

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean
}
