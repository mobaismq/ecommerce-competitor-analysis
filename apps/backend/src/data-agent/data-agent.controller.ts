import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { DataAgentChatDto } from './dto/chat.dto'
import { DataAgentService } from './data-agent.service'

@Controller('data-agent')
@UseGuards(JwtAuthGuard)
export class DataAgentController {
  constructor(private readonly service: DataAgentService) {}

  @Post('chat')
  chat(@Req() request: { user: { tenantId: string } }, @Body() body: DataAgentChatDto) {
    return this.service.chat({ tenantId: request.user.tenantId, question: body.question, jobId: body.jobId })
  }
}
