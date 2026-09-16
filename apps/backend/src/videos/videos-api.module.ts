import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { VideoController } from './video.controller'
import { VideoProviderRegistry } from './video-registry'
import { VideoReplicationService } from './video.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [VideoController],
  providers: [VideoProviderRegistry, VideoReplicationService],
})
export class VideosApiModule {}
