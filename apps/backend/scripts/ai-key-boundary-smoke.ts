import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AiAuditService } from '../src/ai/ai-audit.service'
import { ProviderRegistry } from '../src/ai/provider-registry'
import { ProviderRouter } from '../src/ai/provider-router.service'
import { ProviderProfileService } from '../src/admin/provider-profile.service'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'

const backendRoot = resolve(__dirname, '..')

async function main() {
  loadBackendEnv()
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)
  const attemptKey = `ai-key-boundary-${suffix}`

  const profile = await prisma.providerProfile.create({
    data: {
      tenantId: tenant.id,
      name: `boundary-${suffix}`,
      type: 'mock',
      apiKeyRef: 'OPENROUTER_API_KEY',
      capabilitiesJson: { capabilities: ['text'] },
      modelConfigJson: { model: 'boundary-model' },
      enabled: true,
    },
  })

  const registry = new ProviderRegistry()
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, registry, audit)
  const result = await router.execute('text', { prompt: 'Key 边界验证' }, { tenantId: tenant.id, attemptKey, providerProfileId: profile.id })
  const usage = await prisma.aiUsageLog.findUnique({ where: { attemptKey } })
  const cache = result.cacheKey ? await prisma.aiCallCache.findUnique({ where: { requestHash: result.cacheKey } }) : null
  const service = new ProviderProfileService(prisma)
  const listed = (await service.list(tenant.id)).find((row) => row.id === profile.id)

  const backendEnv = readFileSync(join(backendRoot, '.env.example'), 'utf8')
  const desktopStore = readFileSync(resolve(backendRoot, '..', 'desktop', 'src', 'main', 'store.ts'), 'utf8')
  const usageText = JSON.stringify({ usage, cache })
  const keyLeak = usageText.includes('OPENROUTER_API_KEY') || usageText.includes('Bearer') || usageText.includes('authorization')

  const output = {
    modePlaceholder: backendEnv.includes('AI_KEY_MODE=platform'),
    desktopHasNoKeyStore: !desktopStore.includes('aiKey') && !desktopStore.includes('apiKey'),
    keyNotInAudit: !keyLeak,
    maskedApiKeyRef: listed?.apiKeyRef,
    model: result.model,
  }
  console.log(JSON.stringify(output))

  await prisma.aiUsageLog.deleteMany({ where: { attemptKey } })
  if (result.cacheKey) await prisma.aiCallCache.deleteMany({ where: { requestHash: result.cacheKey } })
  await prisma.providerProfile.deleteMany({ where: { id: profile.id } })
  await prisma.$disconnect()

  const ok =
    output.modePlaceholder &&
    output.desktopHasNoKeyStore &&
    output.keyNotInAudit &&
    output.maskedApiKeyRef !== 'OPENROUTER_API_KEY' &&
    output.model === 'boundary-model'
  process.exit(ok ? 0 : 1)
}

void main()
