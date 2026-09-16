import { IsOptional } from 'class-validator'

export class CompleteTaskDto {
  @IsOptional()
  result?: unknown
}
