import { IsNotEmpty, IsString } from 'class-validator'

export class ProgressDto {
  @IsString()
  @IsNotEmpty()
  stage!: string
}
