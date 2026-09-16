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
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[]
}
