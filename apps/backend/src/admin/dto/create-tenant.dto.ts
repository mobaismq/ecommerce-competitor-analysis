import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  adminUsername!: string

  @IsString()
  @IsNotEmpty()
  adminPassword!: string

  @IsOptional()
  @IsString()
  adminDisplayName?: string
}
