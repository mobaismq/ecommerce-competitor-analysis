import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma.module'
import { StorageModule } from '../storage/storage.module'
import { PlatformRegistry } from './platform-registry'
import { PlatformAdapterService } from './platform.service'

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [PlatformRegistry, PlatformAdapterService],
  exports: [PlatformRegistry, PlatformAdapterService],
})
export class PlatformsModule {}
