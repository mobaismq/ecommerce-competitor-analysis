import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class DataAgentChatDto {
  @IsString()
  @IsNotEmpty()
  question!: string

  @IsOptional()
  @IsString()
  jobId?: string

  @IsOptional()
  @IsString()
  datasetId?: string
}
