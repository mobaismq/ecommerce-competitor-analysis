import { AiAuditService } from '../src/ai/ai-audit.service'
import { ProviderRegistry } from '../src/ai/provider-registry'
import { ProviderRouter } from '../src/ai/provider-router.service'
import { DataAgentService } from '../src/data-agent/data-agent.service'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'

async function main() {
  loadBackendEnv()
  process.env.DATA_AGENT_RATE_LIMIT_PER_MINUTE = '2'
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)
  const startedAt = new Date()

  const job = await prisma.job.create({
    data: { tenantId: tenant.id, type: 'analysis', businessKey: `data-agent-${suffix}`, status: 'success', stage: 'success' },
  })
  const collection = await prisma.collectionJob.create({
    data: { tenantId: tenant.id, jobId: job.id, type: 'analysis', status: 'success' },
  })
  const product = await prisma.productSnapshot.create({
    data: {
      tenantId: tenant.id,
      collectionJobId: collection.id,
      externalProductId: `da-${suffix}`,
      title: '测试商品 A',
      price: 199,
      snapshotTime: new Date(),
      dataSnapshotDate: new Date().toISOString().slice(0, 10),
    },
  })
  await prisma.analysisRun.create({
    data: {
      tenantId: tenant.id,
      jobId: job.id,
      analysisType: 'market',
      status: 'success',
      reportNo: `R${suffix}`,
      competitorCount: 1,
      reportJson: { summary: '测试报告', priceBands: [] },
    },
  })

  const registry = new ProviderRegistry()
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, registry, audit)
  const service = new DataAgentService(prisma, router)

  const first = await service.chat({ tenantId: tenant.id, question: '概括报告结论', jobId: job.id })
  const second = await service.chat({ tenantId: tenant.id, question: '介绍一下商品' })
  let limited = false
  try {
    await service.chat({ tenantId: tenant.id, question: '触发限流' })
  } catch (error) {
    limited = error instanceof Error && error.message.includes('过于频繁')
  }

  const output = {
    answer: { text: first.answer?.slice(0, 40) ?? '', sourceCount: first.sources.length, hasReport: first.sources.some((item) => item.type === 'report'), hasProduct: first.sources.some((item) => item.type === 'product') },
    fallbackContext: { answerText: second.answer?.slice(0, 40) ?? '', sourceCount: second.sources.length },
    rateLimited: limited,
  }
  console.log(JSON.stringify(output))

  await prisma.aiUsageLog.deleteMany({ where: { tenantId: tenant.id, attemptKey: { startsWith: 'data-agent:' }, createdAt: { gte: startedAt } } })
  await prisma.aiCallCache.deleteMany({ where: { tenantId: tenant.id, providerType: 'mock', createdAt: { gte: startedAt } } })
  await prisma.analysisRun.deleteMany({ where: { jobId: job.id } })
  await prisma.productSnapshot.deleteMany({ where: { id: product.id } })
  await prisma.collectionJob.deleteMany({ where: { id: collection.id } })
  await prisma.job.deleteMany({ where: { id: job.id } })
  await prisma.$disconnect()

  const ok =
    typeof first.answer === 'string' &&
    first.answer.length > 0 &&
    output.answer.sourceCount >= 2 &&
    output.answer.hasReport &&
    output.answer.hasProduct &&
    typeof second.answer === 'string' &&
    second.answer.length > 0 &&
    output.rateLimited
  process.exit(ok ? 0 : 1)
}

void main()
