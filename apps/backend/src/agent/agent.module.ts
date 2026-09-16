import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { QueueModule } from '../queue/queue.module'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'

@Module({
  imports: [AuthModule, PrismaModule, QueueModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
