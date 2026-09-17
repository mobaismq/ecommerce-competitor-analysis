import { IsString } from 'class-validator'

export class ChangePhoneDto {
  @IsString()
  newPhone!: string
}
