import { createHash, randomBytes } from 'node:crypto'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { buildAttemptKey } from '../ai/ai.types'
import { ProviderRouter } from '../ai/provider-router.service'
import { PrismaService } from '../prisma.service'

export interface RunReportInput {
  jobId: string
  tenantId: string
  attempt?: number
}

export interface RunReportResult {
  reused: boolean
  reportNo?: string
  reportHash?: string
  competitorCount?: number
  status: string
}

interface PriceBand {
  bandName: string
  priceMin: number
  priceMax: number
  productCount: number
}

function buildReportNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `R${date}${randomBytes(4).toString('hex').toUpperCase()}`
}

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouter,
  ) {}

  async runReport(input: RunReportInput): Promise<RunReportResult> {
    const job = await this.prisma.job.findUnique({ where: { id: input.jobId } })
    if (!job || job.tenantId !== input.tenantId) throw new NotFoundException('任务不存在')

    const existing = await this.prisma.analysisRun.findUnique({ where: { jobId: job.id } })
    if (existing?.status === 'success') {
      return {
        reused: true,
        reportNo: existing.reportNo ?? undefined,
        reportHash: existing.reportHash ?? undefined,
        competitorCount: existing.competitorCount ?? undefined,
        status: existing.status,
      }
    }

    const attemptKey = buildAttemptKey({
      jobId: job.id,
      capability: 'text',
      attempt: input.attempt ?? job.attempt,
      suffix: 'report',
    })
    const aiResult = await this.router.execute(
      'text',
      {
        prompt: `基于已采集数据生成竞品分析报告（jobId=${job.id}）`,
        system: '你是电商竞品分析报告助手，请输出结构化结论。',
        maxTokens: Number(process.env.ARK_OVERALL_REPORT_MAX_OUTPUT_TOKENS ?? 10000),
      },
      { tenantId: input.tenantId, jobId: job.id, attemptKey },
    )

    const collectionJob = await this.prisma.collectionJob.findUnique({ where: { jobId: job.id } })
    const competitorCount = collectionJob
      ? await this.prisma.productSnapshot.count({ where: { collectionJobId: collectionJob.id } })
      : 0
    const priceBands = collectionJob ? await this.computePriceBands(collectionJob.id) : []
    const insights = this.buildInsights(aiResult.text)
    const reportJson = { summary: aiResult.text ?? '', priceBands, insights }
    const reportHash = createHash('sha256').update(JSON.stringify(reportJson)).digest('hex')
    const reportNo = buildReportNo()

    const run = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.analysisRun.upsert({
        where: { jobId: job.id },
        update: {
          status: 'success',
          reportNo,
          reportHash,
          competitorCount,
          costModelJson: { attemptKey, model: aiResult.model, tokenIn: aiResult.tokenIn, tokenOut: aiResult.tokenOut } as Prisma.InputJsonValue,
          reportJson: reportJson as unknown as Prisma.InputJsonValue,
        },
        create: {
          tenantId: input.tenantId,
          jobId: job.id,
          analysisType: job.type === 'analysis' ? 'market' : 'report',
          status: 'success',
          reportNo,
          reportHash,
          competitorCount,
          costModelJson: { attemptKey, model: aiResult.model, tokenIn: aiResult.tokenIn, tokenOut: aiResult.tokenOut } as Prisma.InputJsonValue,
          reportJson: reportJson as unknown as Prisma.InputJsonValue,
        },
      })

      await tx.analysisPriceBand.deleteMany({ where: { analysisRunId: saved.id } })
      if (priceBands.length > 0) {
        await tx.analysisPriceBand.createMany({
          data: priceBands.map((band) => ({
            analysisRunId: saved.id,
            bandName: band.bandName,
            priceMin: band.priceMin,
            priceMax: band.priceMax,
            productCount: band.productCount,
          })),
        })
      }
      await tx.analysisInsight.deleteMany({ where: { analysisRunId: saved.id } })
      if (insights.length > 0) {
        await tx.analysisInsight.createMany({
          data: insights.map((insight) => ({
            analysisRunId: saved.id,
            type: insight.type,
            title: insight.title,
            content: insight.content,
          })),
        })
      }
      return saved
    })

    await this.prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'success',
        stage: 'success',
        checkpointStage: 'reporting',
        finishedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    })

    return {
      reused: false,
      reportNo: run.reportNo ?? undefined,
      reportHash: run.reportHash ?? undefined,
      competitorCount: run.competitorCount ?? undefined,
      status: run.status,
    }
  }

  private async computePriceBands(collectionJobId: string): Promise<PriceBand[]> {
    const rows = await this.prisma.productSnapshot.findMany({
      where: { collectionJobId },
      select: { price: true },
      orderBy: { price: 'asc' },
    })
    const prices = rows.map((row) => Number(row.price)).filter((value) => Number.isFinite(value))
    if (prices.length === 0) return []
    const min = prices[0]
    const max = prices[prices.length - 1]
    if (min === max) return [{ bandName: '统一价', priceMin: min, priceMax: max, productCount: prices.length }]
    const width = (max - min) / 3
    return Array.from({ length: 3 }, (_, index) => {
      const lower = min + index * width
      const upper = index === 2 ? max : min + (index + 1) * width
      const count = prices.filter((price) => (index === 2 ? price >= lower && price <= upper : price >= lower && price < upper)).length
      return { bandName: `价格带${index + 1}`, priceMin: lower, priceMax: upper, productCount: count }
    })
  }

  private buildInsights(text?: string) {
    return [
      {
        type: 'summary',
        title: 'AI 总结',
        content: text ? text.slice(0, 500) : '未生成总结',
      },
    ]
  }
}
