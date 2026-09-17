import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { DataAgentChatDto } from './dto/chat.dto'
import { DataAgentService } from './data-agent.service'

@Controller('data-agent')
@UseGuards(JwtAuthGuard)
export class DataAgentController {
  constructor(private readonly service: DataAgentService) {}

  @Get('datasets')
  listDatasets(@Req() request: { user: { tenantId: string } }, @Query('keyword') keyword?: string) {
    return this.service.listDatasets(request.user.tenantId, keyword)
  }

  @Post('chat')
  chat(@Req() request: { user: { tenantId: string } }, @Body() body: DataAgentChatDto) {
    return this.service.chat({
      tenantId: request.user.tenantId,
      question: body.question,
      jobId: body.jobId,
      datasetId: body.datasetId,
    })
  }
}

