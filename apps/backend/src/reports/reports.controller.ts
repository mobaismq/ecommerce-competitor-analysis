import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
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
  list(
    @Req() request: { user: { tenantId: string } },
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const where = {
      tenantId: request.user.tenantId,
      ...(status?.trim() ? { status: status.trim() } : {}),
      ...(keyword?.trim() ? { keyword: { contains: keyword.trim() } } : {}),
      ...((startTime || endTime)
        ? { updatedAt: { ...(startTime ? { gte: new Date(startTime) } : {}), ...(endTime ? { lte: new Date(`${endTime}T23:59:59.999Z`) } : {}) } }
        : {}),
    }
    const parsedPage = page ? Number(page) : undefined
    const parsedPageSize = pageSize ? Math.min(Number(pageSize), 100) : undefined
    if (!parsedPage || !parsedPageSize) {
      return this.prisma.analysisRun.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 })
    }
    return Promise.all([
      this.prisma.analysisRun.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (parsedPage - 1) * parsedPageSize, take: parsedPageSize }),
      this.prisma.analysisRun.count({ where }),
    ]).then(([rows, total]) => ({ rows, total, page: parsedPage, pageSize: parsedPageSize }))
  }

  @Get('latest')
  @RequirePermission('market:report:view')
  latest(@Req() request: { user: { tenantId: string } }, @Query('keyword') keyword?: string) {
    return this.prisma.analysisRun.findFirst({
      where: {
        tenantId: request.user.tenantId,
        status: { in: ['success', 'completed'] },
        ...(keyword?.trim() ? { keyword: { contains: keyword.trim() } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  @Get(':id/analysis-view')
  @RequirePermission('market:report:view')
  analysisView(@Req() request: { user: { tenantId: string } }, @Param('id') id: string) {
    return this.getById(request, id)
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
    const bandIds = priceBands.map((band) => band.id)
    const [insights, bandProducts] = await Promise.all([
      this.prisma.analysisInsight.findMany({ where: { analysisRunId: report.id }, orderBy: { createdAt: 'asc' } }),
      bandIds.length ? this.prisma.analysisBandProduct.findMany({ where: { priceBandId: { in: bandIds } } }) : Promise.resolve([]),
    ])
    return {
      ...report,
      priceBands: priceBands.map((band) => ({
        ...band,
        representativeProducts: bandProducts.filter((product) => product.priceBandId === band.id),
      })),
      insights,
    }
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
