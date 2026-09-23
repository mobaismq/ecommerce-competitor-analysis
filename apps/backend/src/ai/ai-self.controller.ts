import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AiSelfConfigService } from './ai-self.service'
import { SaveAiSelfConfigDto } from './dto/ai-self-config.dto'

@Controller('ai/self-config')
@UseGuards(JwtAuthGuard)
export class AiSelfConfigController {
  constructor(private readonly service: AiSelfConfigService) {}

  @Get()
  get(@Req() request: { user: { sub?: string } }) {
    return this.service.get(request.user.sub ?? '')
  }

  @Put()
  save(@Req() request: { user: { sub?: string } }, @Body() body: SaveAiSelfConfigDto) {
    return this.service.save(request.user.sub ?? '', body)
  }

  @Post('test')
  test(@Req() request: { user: { sub?: string } }) {
    return this.service.test(request.user.sub ?? '')
  }
}