import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { AuthModule } from './auth/auth.module'
import { AdminModule } from './admin/admin.module'
import { AgentModule } from './agent/agent.module'
import { PrismaModule } from './prisma.module'
import { QueueModule } from './queue/queue.module'
import { JobsModule } from './jobs/jobs.module'
import { AiModule } from './ai/ai.module'
import { ReportsModule } from './reports/reports.module'
import { PlatformsApiModule } from './platform/platforms-api.module'
import { ImagesApiModule } from './images/images-api.module'
import { DataAgentApiModule } from './data-agent/data-agent-api.module'
import { ReportsApiModule } from './reports/reports-api.module'
import { VideosApiModule } from './videos/videos-api.module'
import { StorageModule } from './storage/storage.module'
import { AssetsApiModule } from './assets/assets-api.module'
import { HealthController } from './health.controller'
import { buildPinoStream } from './log-streams'

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    AuthModule,
    AdminModule,
    AgentModule,
    JobsModule,
    AiModule,
    ReportsModule,
    PlatformsApiModule,
    ImagesApiModule,
    DataAgentApiModule,
    ReportsApiModule,
    VideosApiModule,
    StorageModule,
    AssetsApiModule,
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
        autoLogging: true,
        redact: ['req.headers.authorization', 'password', 'apiKey', 'token'],
        stream: buildPinoStream(process.env.NODE_ENV === 'development'),
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
