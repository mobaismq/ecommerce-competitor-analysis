import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { join, resolve } from 'node:path'
import { userDataDir } from '../common/data-root'
import { PrismaService } from '../prisma.service'

export const EXPORT_FORMATS = ['json', 'markdown', 'html'] as const
export type ReportExportFormat = (typeof EXPORT_FORMATS)[number]

interface AnalysisRunRow {
  id: string
  reportNo: string | null
  reportJson: unknown
  competitorCount: number | null
}

const MIME: Record<ReportExportFormat, string> = {
  json: 'application/json',
  markdown: 'text/markdown',
  html: 'text/html',
}

function renderReport(run: AnalysisRunRow, format: ReportExportFormat) {
  const report = (run.reportJson ?? {}) as { summary?: string; priceBands?: Array<{ bandName: string; productCount: number }>; insights?: Array<{ type: string; title?: string; content?: string }> }
  if (format === 'json') return JSON.stringify(report, null, 2)
  const summary = report.summary ?? ''
  const priceBands = (report.priceBands ?? []).map((band) => `- ${band.bandName}：${band.productCount} 个商品`).join('\n')
  const insights = (report.insights ?? []).map((insight) => `- ${insight.title ?? insight.type}：${insight.content ?? ''}`).join('\n')
  if (format === 'markdown') {
    return [`# 竞品分析报告 ${run.reportNo ?? ''}`, '', '## 总结', summary, '', '## 价格带', priceBands || '- 无', '', '## 洞察', insights || '- 无', ''].join('\n')
  }
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>竞品分析报告 ${run.reportNo ?? ''}</title></head><body><h1>竞品分析报告 ${run.reportNo ?? ''}</h1><h2>总结</h2><p>${summary}</p><h2>价格带</h2><pre>${priceBands}</pre><h2>洞察</h2><pre>${insights}</pre></body></html>`
}

@Injectable()
export class ReportExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportReport(input: { runId: string; tenantId: string; format: ReportExportFormat }) {
    if (!EXPORT_FORMATS.includes(input.format)) throw new BadRequestException(`不支持的导出格式: ${String(input.format)}`)
    const run = await this.prisma.analysisRun.findFirst({ where: { id: input.runId, tenantId: input.tenantId } })
    if (!run) throw new NotFoundException('报告不存在')
    const storageKey = `report-exports/${run.id}/${input.format}`
    const relPath = storageKey.replace('report-exports/', '')
    const existing = await this.prisma.generatedAsset.findUnique({ where: { storageKey } })
    if (existing) {
      return { storageKey, mimeType: existing.mimeType, size: existing.size, reused: true, content: readFileSync(this.resolvePath(relPath, run.tenantId), 'utf8') }
    }
    const content = renderReport(run, input.format)
    const absolutePath = this.resolvePath(relPath, run.tenantId)
    mkdirSync(resolve(absolutePath, '..'), { recursive: true })
    writeFileSync(absolutePath, content, 'utf8')
    const asset = await this.prisma.generatedAsset.create({
      data: {
        tenantId: input.tenantId,
        analysisRunId: run.id,
        runId: run.id,
        storageKey,
        mimeType: MIME[input.format],
        size: Buffer.byteLength(content, 'utf8'),
        originalName: `${run.reportNo ?? run.id}.${input.format === 'markdown' ? 'md' : input.format}`,
      },
    })
    return { storageKey, mimeType: asset.mimeType, size: asset.size, reused: false, content }
  }

  /** 报告导出落到用户根 `~/ecommerce/users/<accountId>/reports/<relPath>`；`REPORT_EXPORT_DIR` 仅作显式覆盖兜底。 */
  private resolvePath(relPath: string, accountId: string) {
    if (process.env.REPORT_EXPORT_DIR) {
      return join(resolve(process.env.REPORT_EXPORT_DIR), relPath)
    }
    return join(userDataDir(accountId), 'reports', relPath)
  }
}
