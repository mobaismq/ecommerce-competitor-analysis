import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString } from 'class-validator'

export class UpdateProviderProfileDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  baseUrl?: string

  @IsOptional()
  @IsString()
  apiKeyRef?: string

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
