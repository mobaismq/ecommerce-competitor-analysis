import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'
import { Type } from 'class-transformer'

export class GeneratePromptsDto {
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>

  @IsOptional()
  @IsString()
  baseText?: string

  @IsOptional()
  @IsString()
  reportText?: string

  @IsOptional()
  @IsString()
  information?: string

  @IsOptional()
  promptSlots?: unknown[]

  @IsOptional()
  selectedSlots?: unknown[]
}

export class GenerateImageDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string

  @IsOptional()
  @IsString()
  size?: string

  @IsOptional()
  @IsInt()
  count?: number

  @IsOptional()
  @IsString()
  jobId?: string

  // 图生图参考图契约（对齐旧版 generateProductSetImage）：参考图做 input_references，最多 4 张
  @IsOptional()
  @IsString()
  image?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[]

  @IsOptional()
  @IsString()
  ratio?: string

  @IsOptional()
  @IsBoolean()
  watermark?: boolean
}

export class GenerateDetailWorkflowDto {
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>

  @IsOptional()
  @IsString()
  baseText?: string

  @IsOptional()
  @IsString()
  reportText?: string

  @IsOptional()
  promptSlots?: unknown[]
}

export class GenerateRetouchPromptDto {
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  slot?: Record<string, unknown>

  @IsOptional()
  @IsString()
  originalPrompt?: string

  @IsOptional()
  @IsString()
  userDirection?: string
}

export class ExtractImageTextDto {
  @IsString()
  @IsNotEmpty()
  imageUrl!: string
}