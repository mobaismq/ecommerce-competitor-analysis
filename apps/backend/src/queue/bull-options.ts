import { ConfigService } from '@nestjs/config'

export function buildBullRootOptions(config: ConfigService) {
  return {
    connection: {
      url: config.get('REDIS_URL') || 'redis://127.0.0.1:6380',
    },
  }
}
