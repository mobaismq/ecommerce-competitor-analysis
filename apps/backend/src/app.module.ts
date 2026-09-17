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
import { ProductsApiModule } from './products/products-api.module'
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
    ProductsApiModule,
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'info' : 'info'),
        autoLogging: {
          ignore: (req) => req.method === 'OPTIONS' || (typeof req.url === 'string' && req.url.includes('/health')),
        },
        customLogLevel: (_req, res, err) => {
          if (res.statusCode >= 500 || err) {
            return 'error'
          }
          if (res.statusCode >= 400) {
            return 'warn'
          }
          // 默认静默：仅在错误（>=400）时记录请求日志；若显式配置 LOG_AUTO_REQUESTS=true 则记录正常请求
          return process.env.LOG_AUTO_REQUESTS === 'true' ? 'info' : 'silent'
        },
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
          err: (err) => ({
            type: err?.type,
            message: err?.message,
          }),
        },
        customSuccessMessage: (req, res, responseTime) => {
          return `[${res.statusCode}] ${req.method} ${req.url} (${responseTime}ms)`
        },
        customErrorMessage: (req, res, err) => {
          return `[${res.statusCode}] ${req.method} ${req.url} - ${err?.message || 'Error'}`
        },
        redact: ['req.headers.authorization', 'password', 'apiKey', 'token'],
        stream: buildPinoStream(process.env.NODE_ENV === 'development'),
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
