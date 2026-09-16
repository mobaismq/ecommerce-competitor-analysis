import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreatePlatformDto {
  @IsString()
  @IsNotEmpty()
  code!: string

  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}
