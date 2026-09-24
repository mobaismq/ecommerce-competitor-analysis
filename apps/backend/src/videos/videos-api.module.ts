import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { StorageModule } from '../storage/storage.module'
import { VideoController } from './video.controller'
import { VideoProviderRegistry } from './video-registry'
import { VideoReplicationService } from './video.service'

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [VideoController],
  providers: [VideoProviderRegistry, VideoReplicationService],
})
export class VideosApiModule {}
