import { randomUUID } from 'node:crypto'
import { HttpException, Injectable } from '@nestjs/common'
import { ProviderRouter } from '../ai/provider-router.service'
import { PrismaService } from '../prisma.service'

interface ChatInput {
  tenantId: string
  question: string
  jobId?: string
  datasetId?: string
  userId?: string
}

interface RateWindow {
  startedAt: number
  count: number
}

@Injectable()
export class DataAgentService {
  private readonly windows = new Map<string, RateWindow>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouter,
  ) {}

  async listDatasets(tenantId: string, keyword?: string) {
    const where: { tenantId: string; OR?: Array<{ keyword?: { contains: string }; reportNo?: { contains: string } }> } = { tenantId }
    if (keyword?.trim()) {
      where.OR = [
        { keyword: { contains: keyword.trim() } },
        { reportNo: { contains: keyword.trim() } },
      ]
    }
    const runs = await this.prisma.analysisRun.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return {
      datasets: runs.map((run) => ({
        id: run.id,
        jobId: run.jobId,
        keyword: run.keyword ?? '',
        title: run.reportNo ? `报告 ${run.reportNo}` : (run.keyword ? `竞品分析 - ${run.keyword}` : `分析任务 ${run.jobId}`),
        status: run.status,
        competitorCount: run.competitorCount ?? 0,
        updatedAt: run.updatedAt,
        description: `状态: ${run.status}，竞品数: ${run.competitorCount ?? 0}`,
      })),
    }
  }

  async chat(input: ChatInput) {
    const limit = Number(process.env.DATA_AGENT_RATE_LIMIT_PER_MINUTE ?? 10)
    const now = Date.now()
    const current = this.windows.get(input.tenantId)
    if (!current || now - current.startedAt >= 60_000) {
      this.windows.set(input.tenantId, { startedAt: now, count: 1 })
    } else {
      current.count += 1
      if (current.count > limit) throw new HttpException('Data Agent 请求过于频繁', 429)
    }

    const targetId = input.datasetId || input.jobId
    const report = targetId
      ? await this.prisma.analysisRun.findFirst({
          where: {
            OR: [{ id: targetId }, { jobId: targetId }],
            tenantId: input.tenantId,
          },
        })
      : await this.prisma.analysisRun.findFirst({ where: { tenantId: input.tenantId }, orderBy: { updatedAt: 'desc' } })
    const matchedJobId = report?.jobId || input.jobId
    const collection = matchedJobId ? await this.prisma.collectionJob.findUnique({ where: { jobId: matchedJobId } }) : null
    const products = collection
      ? await this.prisma.productSnapshot.findMany({ where: { collectionJobId: collection.id }, take: 10, orderBy: { createdAt: 'desc' } })
      : []
    const sources = [
      ...(report ? [{ type: 'report', id: report.id, title: report.reportNo ?? '分析报告' }] : []),
      ...products.map((product) => ({ type: 'product', id: product.id, title: product.title ?? product.externalProductId })),
    ]
    const context = JSON.stringify({ report: report?.reportJson ?? null, products: products.map((product) => ({ title: product.title, price: product.price?.toString() })) }).slice(0, 8000)
    const attemptKey = `data-agent:${input.tenantId}:${randomUUID()}`
    const result = await this.router.execute(
      'text',
      { system: '你是电商数据 Agent。回答必须基于给定上下文，不能编造不存在的数据。', prompt: `上下文：${context}\n问题：${input.question}`, maxTokens: Number(process.env.ARK_DATA_AGENT_MAX_OUTPUT_TOKENS ?? 3000) },
      { tenantId: input.tenantId, jobId: matchedJobId, attemptKey, userId: input.userId },
    )
    return { answer: result.text ?? '', sources, model: result.model, attemptKey }
  }
}

