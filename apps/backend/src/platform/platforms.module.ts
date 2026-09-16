import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma.module'
import { PlatformRegistry } from './platform-registry'
import { PlatformAdapterService } from './platform.service'

@Module({
  imports: [PrismaModule],
  providers: [PlatformRegistry, PlatformAdapterService],
  exports: [PlatformRegistry, PlatformAdapterService],
})
export class PlatformsModule {}
