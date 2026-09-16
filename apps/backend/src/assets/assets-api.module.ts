import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { StorageModule } from '../storage/storage.module'
import { AssetController } from './assets.controller'
import { AssetService } from './assets.service'

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [AssetController],
  providers: [AssetService],
})
export class AssetsApiModule {}
