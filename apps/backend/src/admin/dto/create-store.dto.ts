import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  platformId!: string

  @IsString()
  @IsNotEmpty()
  name!: string

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
  authorizedAt?: string

  @IsOptional()
  @IsString()
  authExpiresAt?: string
}
