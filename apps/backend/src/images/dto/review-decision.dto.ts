import { IsIn, IsString } from 'class-validator'
import { IMAGE_REVIEW_DECISIONS } from '../image.service'

export class ReviewDecisionDto {
  @IsString()
  @IsIn(IMAGE_REVIEW_DECISIONS)
  decision!: 'approved' | 'rejected' | 'regenerate'
}
