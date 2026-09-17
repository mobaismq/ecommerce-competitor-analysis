import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { QueueModule } from '../queue/queue.module'
import { ImageFlowService } from './image.service'
import { GuidelinesStartupCheck } from './guidelines-startup-check'
import { ProductSetsController } from './product-sets.controller'
import { ProductSetsService } from './product-sets.service'
import { ReviewController } from './review.controller'

@Module({
  imports: [PrismaModule, AiModule, AuthModule, QueueModule],
  controllers: [ReviewController, ProductSetsController],
  providers: [ImageFlowService, ProductSetsService, GuidelinesStartupCheck],
})
export class ImagesApiModule {}
