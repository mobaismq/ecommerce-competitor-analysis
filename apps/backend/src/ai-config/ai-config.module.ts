import { Module } from '@nestjs/common'
import { AiConfigController } from './ai-config.controller'

@Module({
  controllers: [AiConfigController],
})
export class AiConfigModule {}
