import { IsArray, IsOptional, IsString } from 'class-validator'

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string

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
