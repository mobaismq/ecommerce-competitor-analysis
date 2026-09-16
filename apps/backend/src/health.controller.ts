import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Redis } from 'ioredis'

@Controller('health')
export class HealthController {
  private readonly prisma = new PrismaClient()

  @Get()
  getHealth() {
    return { ok: true, status: 'up', service: 'ecommerce-backend' }
  }

  @Get('live')
  getLive() {
    return { ok: true, status: 'up', service: 'ecommerce-backend' }
  }

  @Get('ready')
  async getReady() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1')
      const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6380', {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      })
      await redis.connect()
      const pong = await redis.ping()
      redis.disconnect()
      if (pong !== 'PONG') throw new Error('redis ping failed')
      return { ok: true, status: 'ready', mysql: 'up', redis: 'up' }
    } catch (error) {
      throw new ServiceUnavailableException({
        ok: false,
        status: 'not_ready',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
