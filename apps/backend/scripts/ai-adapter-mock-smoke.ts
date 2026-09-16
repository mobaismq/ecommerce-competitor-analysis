import { PrismaService } from '../src/prisma.service'
import { loadBackendEnv } from '../src/env'
import { AiAuditService } from '../src/ai/ai-audit.service'
import { ProviderRegistry } from '../src/ai/provider-registry'
import { ProviderRouter } from '../src/ai/provider-router.service'
import { MockAiProvider } from '../src/ai/providers/mock.provider'
import { ArkProvider } from '../src/ai/providers/ark.provider'
import { OpenRouterProvider } from '../src/ai/providers/openrouter.provider'
import { OpenAICompatibleProvider } from '../src/ai/providers/openai-compatible.provider'

async function main() {
  loadBackendEnv()
  const prisma = new PrismaService()

  const registry = new ProviderRegistry()
  const mock = registry.create('mock', { model: 'mock-smoke' })
  const ark = registry.create('ark', {})
  const openrouter = registry.create('openrouter', {})
  const compatible = registry.create('openai-compatible', {})

  const registryOk =
    mock instanceof MockAiProvider &&
    ark instanceof ArkProvider &&
    openrouter instanceof OpenRouterProvider &&
    compatible instanceof OpenAICompatibleProvider &&
    ['mock', 'ark', 'openrouter', 'openai-compatible'].every((type) => registry.has(type))

  let unknownRejected = false
  try {
    registry.create('unknown-vendor', {})
  } catch {
    unknownRejected = true
  }

  const textResult = await mock.generateText({ prompt: '测试竞品分析' })
  const visionResult = await mock.analyzeImage({ prompt: '分析主图', images: ['mock://a.png', 'mock://b.png'] })
  const imageResult = await mock.generateImage({ prompt: '生成主图', count: 2 })

  const providerOk =
    textResult.status === 'success' &&
    typeof textResult.text === 'string' &&
    textResult.rawPayload != null &&
    visionResult.text?.includes('2 images') === true &&
    imageResult.images?.length === 2 &&
    mock.supports('text') &&
    ark.supports('text') &&
    openrouter.supports('image') &&
    compatible.supports('vision')

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing, run pnpm --filter backend db:seed first')

  const attemptKey = `ai-adapter-smoke-${Date.now()}`
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, registry, audit)

  const first = await router.execute('text', { prompt: '测试竞品分析' }, { tenantId: tenant.id, attemptKey })
  const usageRow = await prisma.aiUsageLog.findUnique({ where: { attemptKey } })
  const cacheRow = first.cacheKey ? await prisma.aiCallCache.findUnique({ where: { requestHash: first.cacheKey } }) : null

  const second = await router.execute('text', { prompt: '测试竞品分析' }, { tenantId: tenant.id, attemptKey })
  const usageCount = await prisma.aiUsageLog.count({ where: { attemptKey } })

  const output = {
    registryOk,
    unknownRejected,
    providerTypes: registry.listTypes(),
    providerOk,
    mockText: { status: textResult.status, text: textResult.text, tokenIn: textResult.tokenIn },
    mockVisionImages: visionResult.text,
    mockGeneratedImages: imageResult.images?.length,
    router: {
      status: first.status,
      model: first.model,
      durationMs: first.durationMs,
      cachedSecond: second.cached ?? false,
      usage: {
        status: usageRow?.status,
        providerType: usageRow?.providerType,
        model: usageRow?.model,
        tokenIn: usageRow?.tokenIn,
        durationMs: usageRow?.durationMs,
        count: usageCount,
      },
      cacheHit: cacheRow?.status,
    },
  }
  console.log(JSON.stringify(output))

  if (first.cacheKey) {
    await prisma.aiCallCache.deleteMany({ where: { requestHash: first.cacheKey } })
  }
  await prisma.aiUsageLog.deleteMany({ where: { attemptKey } })
  await prisma.$disconnect()

  const ok =
    registryOk &&
    unknownRejected &&
    providerOk &&
    textResult.status === 'success' &&
    imageResult.images?.length === 2 &&
    first.status === 'success' &&
    first.model === 'mock-model' &&
    second.cached === true &&
    usageRow?.status === 'success' &&
    usageRow?.providerType === 'mock' &&
    usageRow?.model === 'mock-model' &&
    typeof usageRow?.tokenIn === 'number' &&
    typeof usageRow?.durationMs === 'number' &&
    usageCount === 1 &&
    cacheRow?.status === 'success'
  process.exit(ok ? 0 : 1)
}

void main()
