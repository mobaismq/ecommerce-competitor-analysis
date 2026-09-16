import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { VideoReplicationService } from './video.service'

class ReplicateVideoDto {
  @IsOptional()
  @IsString()
  sourceUrl?: string

  @IsOptional()
  @IsString()
  sourceStorageKey?: string

  @IsOptional()
  @IsString()
  title?: string
}

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideoController {
  constructor(private readonly service: VideoReplicationService) {}

  @Get()
  list(@Req() request: { user: { tenantId: string } }) {
    return this.service.list(request.user.tenantId)
  }

  @Post('replicate')
  replicate(@Req() request: { user: { tenantId: string } }, @Body() body: ReplicateVideoDto) {
    return this.service.replicate({ tenantId: request.user.tenantId, ...body })
  }

  @Get(':jobId')
  find(@Req() request: { user: { tenantId: string } }, @Param('jobId') jobId: string) {
    return this.service.find(jobId, request.user.tenantId)
  }
}
