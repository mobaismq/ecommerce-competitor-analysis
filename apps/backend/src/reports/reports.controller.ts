import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../auth/permission.decorator'
import { PermissionGuard } from '../auth/permission.guard'
import { PrismaService } from '../prisma.service'
import { ExportReportDto } from './dto/export-report.dto'
import { ReportExportService } from './report-export.service'

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportExportController {
  private readonly reportExportService: ReportExportService
  private readonly prisma: PrismaService

  constructor(
    reportExportService?: ReportExportService,
    prisma?: PrismaService,
  ) {
    this.prisma = prisma ?? new PrismaService()
    this.reportExportService = reportExportService ?? new ReportExportService(this.prisma)
  }

  @Get()
  @RequirePermission('market:report:view')
  list(@Req() request: { user: { tenantId: string } }) {
    return this.prisma.analysisRun.findMany({
      where: { tenantId: request.user.tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
  }

  @Get(':id')
  @RequirePermission('market:report:view')
  async getById(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    const report = await this.prisma.analysisRun.findFirst({
      where: {
        OR: [{ id }, { jobId: id }, { reportNo: id }],
        tenantId: request.user.tenantId,
      },
    })
    if (!report) throw new NotFoundException('报告不存在')
    const priceBands = await this.prisma.analysisPriceBand.findMany({
      where: { analysisRunId: report.id },
      orderBy: { priceMin: 'asc' },
    })
    return { ...report, priceBands }
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
