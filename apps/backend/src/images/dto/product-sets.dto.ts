import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'
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