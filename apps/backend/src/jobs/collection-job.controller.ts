import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionGuard } from '../auth/permission.guard'
import { CollectionJobService } from './collection-job.service'
import { CollectionResultDto } from './dto/collection-result.dto'

@Controller('collection-jobs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CollectionJobController {
  constructor(private readonly collectionJobService: CollectionJobService) {}

  @Post(':jobId/results')
  importResults(@Req() request: { user: { tenantId: string } }, @Param('jobId') jobId: string, @Body() body: CollectionResultDto) {
    return this.collectionJobService.importResults(jobId, request.user.tenantId, body)
  }
}
