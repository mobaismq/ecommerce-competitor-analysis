import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma.module'
import { AiAuditService } from './ai-audit.service'
import { ProviderRegistry } from './provider-registry'
import { ProviderRouter } from './provider-router.service'

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [ProviderRegistry, AiAuditService, ProviderRouter],
  exports: [ProviderRegistry, AiAuditService, ProviderRouter],
})
export class AiModule {}
