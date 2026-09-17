import { IsString, MaxLength, MinLength } from 'class-validator'

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  newPassword!: string
}
