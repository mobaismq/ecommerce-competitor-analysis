import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { PrismaModule } from '../prisma.module'
import { QueueModule } from '../queue/queue.module'
import { StorageModule } from '../storage/storage.module'
import { ImageFlowService } from './image.service'

@Module({
  imports: [PrismaModule, AiModule, QueueModule, StorageModule],
  providers: [ImageFlowService],
  exports: [ImageFlowService],
})
export class ImagesModule {}
