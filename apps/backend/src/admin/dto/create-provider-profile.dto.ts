import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateProviderProfileDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  type!: string

  @IsOptional()
  @IsString()
  baseUrl?: string

  @IsString()
  @IsNotEmpty()
  apiKeyRef!: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[]

  @IsOptional()
  @IsObject()
  modelConfig?: Record<string, unknown>

  @IsOptional()
  @IsInt()
  timeoutMs?: number

  @IsOptional()
  @IsObject()
  retryPolicy?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsInt()
  priority?: number
}
