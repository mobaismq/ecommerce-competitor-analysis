import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { AuthModule } from './auth/auth.module'
import { AdminModule } from './admin/admin.module'
import { AiConfigModule } from './ai-config/ai-config.module'
import { PrismaModule } from './prisma.module'
import { HealthController } from './health.controller'
import { buildPinoStream } from './log-streams'

// Phase-5：能力已迁桌面 worker 子进程，本服务端仅保留账号/权限/健康子集（auth/admin/health）。
// 资产/商品/报告/平台/生图/视频/数据代理等能力控制器已在桌面侧走 worker IPC，不再由服务端暴露。

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AdminModule,
    AiConfigModule,
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
