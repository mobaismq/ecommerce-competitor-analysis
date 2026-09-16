import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { PlatformAdapterController } from './platform.controller'
import { PlatformRegistry } from './platform-registry'
import { PlatformAdapterService } from './platform.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PlatformAdapterController],
  providers: [PlatformRegistry, PlatformAdapterService],
})
export class PlatformsApiModule {}
