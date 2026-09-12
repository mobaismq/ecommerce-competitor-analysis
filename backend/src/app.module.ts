import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { HealthController } from './health.controller'
import { buildPinoStream } from './log-streams'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
