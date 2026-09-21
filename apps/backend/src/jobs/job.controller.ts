import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionGuard } from '../auth/permission.guard'
import { CreateJobDto } from './dto/create-job.dto'
import { JobService } from './job.service'

@Controller('jobs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  create(@Req() request: { user: { tenantId: string; sub?: string } }, @Body() body: CreateJobDto) {
    return this.jobService.create(body, request.user.tenantId, request.user.sub)
  }

  @Get()
  list(
    @Req() request: { user: { tenantId: string } },
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.jobService.list(request.user.tenantId, {
      type,
      status,
      keyword,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Get(':id')
  find(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.jobService.find(id, request.user.tenantId)
  }

  @Post(':id/cancel')
  cancel(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.jobService.cancel(id, request.user.tenantId)
  }

  @Post(':id/retry')
  retry(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.jobService.retry(id, request.user.tenantId)
  }
}
