import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma.module'
import { LocalJobQueueService } from './local-job-queue.service'

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [LocalJobQueueService],
  exports: [LocalJobQueueService],
})
export class QueueModule {}

