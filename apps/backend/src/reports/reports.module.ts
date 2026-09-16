import { Module } from '@nestjs/common'
import { AiModule } from '../ai/ai.module'
import { PrismaModule } from '../prisma.module'
import { ReportService } from './report.service'

@Module({
  imports: [PrismaModule, AiModule],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportsModule {}
