import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ReviewDecisionDto } from './dto/review-decision.dto'
import { ImageFlowService } from './image.service'

@Controller('review-records')
export class ReviewController {
  constructor(private readonly imageFlowService: ImageFlowService) {}

  @Post(':id/decision')
  @UseGuards(JwtAuthGuard)
  decide(@Req() request: { user: { sub: string } }, @Param('id') id: string, @Body() body: ReviewDecisionDto) {
    return this.imageFlowService.decideReview({ reviewId: id, decision: body.decision, reviewerId: request.user.sub })
  }
}
