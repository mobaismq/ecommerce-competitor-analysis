import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { StorageModule } from '../storage/storage.module'
import { PlatformAdapterController } from './platform.controller'
import { PlatformRegistry } from './platform-registry'
import { PlatformAdapterService } from './platform.service'

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [PlatformAdapterController],
  providers: [PlatformRegistry, PlatformAdapterService],
})
export class PlatformsApiModule {}
