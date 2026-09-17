import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { ReportExportService } from './report-export.service'
import { ReportProductsController } from './report-products.controller'
import { ReportProductsService } from './report-products.service'
import { ReportExportController } from './reports.controller'

@Module({
  imports: [PrismaModule, AuthModule, AiModule],
  controllers: [ReportExportController, ReportProductsController],
  providers: [ReportExportService, ReportProductsService],
})
export class ReportsApiModule {}
