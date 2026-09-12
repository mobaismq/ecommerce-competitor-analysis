import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { bufferLogs: true })
  app.useLogger(app.get(Logger))
  app.setGlobalPrefix('api')
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173' })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  await app.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1')
}

bootstrap()
