import { IsOptional, IsString } from 'class-validator'

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
}
