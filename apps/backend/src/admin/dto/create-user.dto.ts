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
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[]
}
