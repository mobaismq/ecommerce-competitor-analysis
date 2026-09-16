import { Body, Controller, Headers, Param, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AgentService } from './agent.service'
import { CompleteTaskDto } from './dto/complete-task.dto'
import { FailTaskDto } from './dto/fail-task.dto'
import { RegisterAgentDto } from './dto/register-agent.dto'

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  register(@Req() request: { user: { tenantId: string } }, @Body() body: RegisterAgentDto) {
    return this.agentService.register(request.user.tenantId, body)
  }

  @Post('tasks/claim')
  claim(@Headers('x-agent-id') agentId: string, @Headers('x-agent-secret') secret: string) {
    return this.agentService.claim(agentId, secret)
  }

  @Post('tasks/:jobId/accept')
  accept(@Headers('x-agent-id') agentId: string, @Headers('x-agent-secret') secret: string, @Param('jobId') jobId: string) {
    return this.agentService.accept(jobId, agentId, secret)
  }

  @Post('tasks/:jobId/heartbeat')
  heartbeat(@Headers('x-agent-id') agentId: string, @Headers('x-agent-secret') secret: string, @Param('jobId') jobId: string) {
    return this.agentService.heartbeat(jobId, agentId, secret)
  }

  @Post('tasks/:jobId/complete')
  complete(@Headers('x-agent-id') agentId: string, @Headers('x-agent-secret') secret: string, @Param('jobId') jobId: string, @Body() body: CompleteTaskDto) {
    return this.agentService.complete(jobId, agentId, secret, body)
  }

  @Post('tasks/:jobId/fail')
  fail(@Headers('x-agent-id') agentId: string, @Headers('x-agent-secret') secret: string, @Param('jobId') jobId: string, @Body() body: FailTaskDto) {
    return this.agentService.fail(jobId, agentId, secret, body)
  }
}
