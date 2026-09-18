import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma.module'
import { AiAuditService } from './ai-audit.service'
import { ProviderRegistry } from './provider-registry'
import { ProviderRouter } from './provider-router.service'
import { AiSelfConfigService } from './ai-self.service'
import { AiSelfConfigController } from './ai-self.controller'

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AiSelfConfigController],
  providers: [ProviderRegistry, AiAuditService, ProviderRouter, AiSelfConfigService],
  exports: [ProviderRegistry, AiAuditService, ProviderRouter],
})
export class AiModule {}
