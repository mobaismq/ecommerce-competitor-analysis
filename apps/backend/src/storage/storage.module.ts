import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { StorageController } from './storage.controller'
import { StorageCleanupService } from './storage-cleanup.service'
import { LegacyAssetMigrationService } from './legacy-asset-migration.service'
import { AssetWriteService } from './asset-write.service'
import { StorageDriverService } from './storage.service'

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [StorageController],
  providers: [StorageDriverService, StorageCleanupService, LegacyAssetMigrationService, AssetWriteService],
  exports: [StorageDriverService, StorageCleanupService, LegacyAssetMigrationService, AssetWriteService],
})
export class StorageModule {}
