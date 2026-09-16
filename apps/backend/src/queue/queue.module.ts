import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { buildBullRootOptions } from './bull-options'
import { FlowProducerService, FLOW_PRODUCER_NAME } from './flow-producer.service'
import { QUEUE_NAMES } from './queue-names'
import { QueueService } from './queue.service'

@Module({
  imports: [
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
    BullModule.registerFlowProducer({ name: FLOW_PRODUCER_NAME }),
  ],
  providers: [QueueService, FlowProducerService],
  exports: [QueueService, FlowProducerService],
})
export class QueueModule {}
