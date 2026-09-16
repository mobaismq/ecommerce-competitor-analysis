import { IsOptional, IsString } from 'class-validator'

export class FailTaskDto {
  @IsOptional()
  @IsString()
  error?: string
}
