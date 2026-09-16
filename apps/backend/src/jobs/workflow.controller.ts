import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionGuard } from '../auth/permission.guard'
import { ProgressDto } from './dto/progress.dto'
import { WorkflowService } from './workflow.service'

@Controller('jobs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post(':id/flow')
  createFlow(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.workflowService.createFlowForJob(id, request.user.tenantId)
  }

  @Post(':id/progress')
  progress(@Req() request: { user: { tenantId: string } }, @Param('id') id: string, @Body() body: ProgressDto) {
    return this.workflowService.reportProgress(id, request.user.tenantId, body.stage)
  }
}
