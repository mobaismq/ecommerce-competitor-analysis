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

  /** 新架构内部字段：生成结果落库时的原图位名称，便于结果回显分组 */
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  slotType?: string

  /** 关联商品名/商品ID（图库真源，随生图落库，缺失留空不伪造） */
  @IsOptional()
  @IsString()
  productName?: string

  @IsOptional()
  @IsString()
  productId?: string
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
  // 新架构字段；同时兼容旧版 { image } 契约
  @IsOptional()
  @IsString()
  imageUrl?: string

  @IsOptional()
  @IsString()
  image?: string
}