import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma.module'
import { LeaseSweeper } from './lease-sweeper'
import { FlowFinalizerWorker } from './queue.workers'
import { AiModule } from '../ai/ai.module'
import { AiWorker } from '../ai/ai.worker'
import { ReportsModule } from '../reports/reports.module'
import { ReportWorker } from '../reports/report.worker'
import { ImagesModule } from '../images/images.module'
import { ImageGenWorker } from '../images/image.worker'
import { ListingsModule } from '../listings/listings.module'
import { ListingWorker } from '../listings/listing.worker'
import { QueueModule } from './queue.module'

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    AiModule,
    ReportsModule,
    ImagesModule,
    ListingsModule,
    ConfigModule,
  ],
  providers: [
    AiWorker,
    ReportWorker,
    ImageGenWorker,
    ListingWorker,
    FlowFinalizerWorker,
    LeaseSweeper,
  ],
  exports: [
    AiWorker,
    ReportWorker,
    ImageGenWorker,
    ListingWorker,
    FlowFinalizerWorker,
    LeaseSweeper,
  ],
})
export class WorkerModule {}

