import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { DataAgentController } from './data-agent.controller'
import { DataAgentService } from './data-agent.service'

@Module({
  imports: [PrismaModule, AiModule, AuthModule],
  controllers: [DataAgentController],
  providers: [DataAgentService],
})
export class DataAgentApiModule {}
