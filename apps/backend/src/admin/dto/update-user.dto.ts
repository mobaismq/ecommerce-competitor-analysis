import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  displayName?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsString()
  password?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[]
}
