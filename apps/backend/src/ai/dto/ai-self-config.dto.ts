import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator'

export class SaveAiSelfConfigDto {
  /** 是否启用个人自配；false 时回落租户/默认 */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  /** provider 类型：mock | ark | openrouter | openai-compatible */
  @IsOptional()
  @IsString()
  providerType?: string

  @IsOptional()
  @IsString()
  baseUrl?: string

  /** 个人自配的 Key；仅当非空时更新，避免误清 */
  @IsOptional()
  @IsString()
  apiKey?: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsInt()
  timeoutMs?: number
}