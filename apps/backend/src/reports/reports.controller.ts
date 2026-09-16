import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { PrismaService } from '../prisma.service'
import { ExportReportDto } from './dto/export-report.dto'
import { ReportExportService } from './report-export.service'

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportExportController {
  constructor(
    private readonly reportExportService: ReportExportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermission('market:report:view')
  list(@Req() request: { user: { tenantId: string } }) {
    return this.prisma.analysisRun.findMany({
      where: { tenantId: request.user.tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
  }

  @Post(':runId/export')
  @RequirePermission('market:report:view')
  export(@Req() request: { user: { tenantId: string } }, @Param('runId') runId: string, @Body() body: ExportReportDto) {
    return this.reportExportService.exportReport({ runId, tenantId: request.user.tenantId, format: body.format })
  }

  @Get(':runId/export/:format')
  @RequirePermission('market:report:view')
  download(@Req() request: { user: { tenantId: string } }, @Param('runId') runId: string, @Param('format') format: ExportReportDto['format']) {
    return this.reportExportService.exportReport({ runId, tenantId: request.user.tenantId, format })
  }
}
