import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

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
      return { ok: true, status: 'ready', mysql: 'up' }
    } catch (error) {
      throw new ServiceUnavailableException({
        ok: false,
        status: 'not_ready',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

