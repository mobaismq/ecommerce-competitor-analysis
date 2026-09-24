import { randomUUID } from 'node:crypto'
import { Prisma } from '../generated/prisma'
import { getWorkerPrisma } from './worker-db'

/**
 * 分析/采集 Job 的本地能力（route：analysis.jobs.create / get / cancel）。
 * 语义对齐后端 apps/backend/src/jobs/job.service.ts：
 *  - create：落本地 Job(type='analysis', status='queued', stage='collecting') 并把采集参数写入 paramsJson；
 *    仅登记记录，不执行真实爬虫（防封号红线），进度由后续报告编排读取本机采集数据推进。
 *  - get：按 id 取本地 Job，返回 status / errorMessage 供采集页轮询。
 *  - cancel：仅可取消状态（queued/running/collecting 等）落库终态 cancelled。
 * 不伪造成功：真实爬虫未执行，故任务默认停留在 queued，由页面诚实话术呈现。
 */

export interface CreateAnalysisJobInput {
  type?: string
  keyword?: string
  analysisType?: string
  minPrice?: number
  maxPrice?: number
  topN?: number
  limit?: number
  searchPages?: number
  autoParse?: boolean
}

export interface AnalysisJobView {
  id: string
  tenantId: string
  type: string
  status: string
  stage: string | null
  errorMessage: string | null
  keyword: unknown
  createdAt: string
  updatedAt: string
}

function toView(row: {
  id: string
  tenantId: string
  type: string
  status: string
  stage: string | null
  errorMessage: string | null
  paramsJson: unknown
  createdAt: Date
  updatedAt: Date
}): AnalysisJobView {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    status: row.status,
    stage: row.stage,
    errorMessage: row.errorMessage,
    keyword: (row.paramsJson as Record<string, unknown> | null)?.keyword ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** 创建任务：登记本地 Job 记录。不跑真实采集；无任何凭证要求，故不存在被配置错误所阻断的情形。 */
export async function createAnalysisJob(input: CreateAnalysisJobInput & { tenantId?: string; userId?: string }): Promise<AnalysisJobView> {
  const tenantId = input.tenantId || 'local'
  const keyword = String(input.keyword ?? '').trim()
  if (!keyword) throw new Error('keyword 不能为空')
  const params = {
    ...(input.minPrice !== undefined ? { minPrice: input.minPrice } : {}),
    ...(input.maxPrice !== undefined ? { maxPrice: input.maxPrice } : {}),
    ...(input.topN !== undefined ? { topN: input.topN } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.searchPages !== undefined ? { searchPages: input.searchPages } : {}),
    ...(input.autoParse !== undefined ? { autoParse: input.autoParse } : {}),
  }
  const db = getWorkerPrisma()
  const job = await db.job.create({
    data: {
      tenantId,
      type: input.type || 'analysis',
      businessKey: `analysis-${input.analysisType ?? 'market'}-${keyword}-${randomUUID().slice(0, 8)}`,
      status: 'queued',
      stage: 'collecting',
      userId: input.userId,
      paramsJson: { ...params, keyword, analysisType: input.analysisType ?? 'market' } as Prisma.InputJsonValue,
    },
  })
  return toView(job)
}

/** 按 id 取本地 Job（status / errorMessage 供采集页轮询）。 */
export async function getAnalysisJob(id: string, tenantId = 'local'): Promise<AnalysisJobView | null> {
  if (!id) return null
  const db = getWorkerPrisma()
  const job = await db.job.findFirst({ where: { id, tenantId } })
  return job ? toView(job) : null
}

/** 取消任务：仅在可取消状态生效并落库终态 cancelled；不可取消时诚实抛错。 */
export async function cancelAnalysisJob(id: string, tenantId = 'local'): Promise<AnalysisJobView> {
  if (!id) throw new Error('任务不存在')
  const db = getWorkerPrisma()
  const job = await db.job.findFirst({ where: { id, tenantId } })
  if (!job) throw new Error('任务不存在')
  const cancellable = ['queued', 'running', 'collecting', 'analyzing', 'reporting']
  if (!cancellable.includes(job.status)) throw new Error('仅进行中或排队任务可取消')
  const updated = await db.job.update({
    where: { id },
    data: { status: 'cancelled', stage: job.stage, finishedAt: new Date() },
  })
  return toView(updated)
}