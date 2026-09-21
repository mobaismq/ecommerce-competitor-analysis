import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string

  @IsString()
  @IsNotEmpty()
  password!: string

  @IsOptional()
  @IsString()
  displayName?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  email?: string

  @IsOptional()
  @IsString()
  departmentId?: string

  @IsOptional()
  @IsString()
  dataScope?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[]
}
