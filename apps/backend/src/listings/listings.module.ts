import { Module } from '@nestjs/common'
import { PlatformsModule } from '../platform/platforms.module'
import { PrismaModule } from '../prisma.module'
import { ListingFlowService } from './listing.service'

@Module({
  imports: [PrismaModule, PlatformsModule],
  providers: [ListingFlowService],
  exports: [ListingFlowService],
})
export class ListingsModule {}
