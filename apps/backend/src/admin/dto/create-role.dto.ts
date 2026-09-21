import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  code!: string

  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storeIds?: string[]
}
