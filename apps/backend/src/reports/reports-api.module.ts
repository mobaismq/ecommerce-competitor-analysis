import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { ReportExportService } from './report-export.service'
import { ReportExportController } from './reports.controller'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReportExportController],
  providers: [ReportExportService],
})
export class ReportsApiModule {}
