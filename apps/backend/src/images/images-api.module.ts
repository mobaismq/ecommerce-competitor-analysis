import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { QueueModule } from '../queue/queue.module'
import { ImageFlowService } from './image.service'
import { ReviewController } from './review.controller'

@Module({
  imports: [PrismaModule, AiModule, AuthModule, QueueModule],
  controllers: [ReviewController],
  providers: [ImageFlowService],
})
export class ImagesApiModule {}
