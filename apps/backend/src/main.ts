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
  const fastify = app.getHttpAdapter().getInstance()
  fastify.addContentTypeParser('application/octet-stream', (_request, payload, done) => {
    const chunks: Buffer[] = []
    payload.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    payload.on('end', () => done(null, Buffer.concat(chunks)))
    payload.on('error', (error: Error) => done(error, undefined))
  })
  const allowedOrigins = new Set([
    'app://',
    process.env.ADMIN_ORIGIN || 'https://admin.example.com',
    'http://127.0.0.1:5173',
    'file://',
  ])
  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || origin.startsWith('app://') || origin === 'null') {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'), false)
      }
    },
  })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  await app.listen(Number(process.env.PORT || 8787), process.env.HOST || '127.0.0.1')
}

bootstrap()
