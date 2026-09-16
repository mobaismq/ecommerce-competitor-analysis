import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { loadBackendEnv } from './env'
import { WorkerModule } from './queue/worker.module'

async function bootstrapWorker() {
  loadBackendEnv()
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true })
  process.stdout.write(JSON.stringify({ level: 30, msg: 'worker ready', service: 'ecommerce-worker' }) + '\n')
  const shutdown = async () => {
    await app.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrapWorker()
