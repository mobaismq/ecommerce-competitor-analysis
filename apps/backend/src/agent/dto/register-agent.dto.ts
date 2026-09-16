import { IsArray, IsOptional, IsString } from 'class-validator'

export class RegisterAgentDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  platform?: string

  @IsOptional()
  @IsString()
  version?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[]
}
