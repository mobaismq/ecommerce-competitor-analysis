import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { PrismaModule } from '../prisma.module'
import { buildBullRootOptions } from './bull-options'
import { LeaseSweeper } from './lease-sweeper'
import { QUEUE_NAMES } from './queue-names'
import {
  DesktopRpaWorker,
  FlowFinalizerWorker,
} from './queue.workers'
import { AiModule } from '../ai/ai.module'
import { AiWorker } from '../ai/ai.worker'
import { ReportsModule } from '../reports/reports.module'
import { ReportWorker } from '../reports/report.worker'
import { ImagesModule } from '../images/images.module'
import { ImageGenWorker } from '../images/image.worker'
import { ListingsModule } from '../listings/listings.module'
import { ListingWorker } from '../listings/listing.worker'

@Module({
  imports: [
    PrismaModule,
    AiModule,
    ReportsModule,
    ImagesModule,
    ListingsModule,
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildBullRootOptions(config),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.desktopRpa },
      { name: QUEUE_NAMES.serverAi },
      { name: QUEUE_NAMES.serverReport },
      { name: QUEUE_NAMES.serverImageGen },
      { name: QUEUE_NAMES.serverListing },
      { name: QUEUE_NAMES.flowFinalizer },
    ),
  ],
  providers: [
    DesktopRpaWorker,
    AiWorker,
    ReportWorker,
    ImageGenWorker,
    ListingWorker,
    FlowFinalizerWorker,
    LeaseSweeper,
  ],
})
export class WorkerModule {}
