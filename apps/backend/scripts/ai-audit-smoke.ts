import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AiAuditService } from '../src/ai/ai-audit.service'
import { FailingProvider } from '../src/ai/providers/failing.provider'
import { ProviderRegistry } from '../src/ai/provider-registry'
import { ProviderRouter } from '../src/ai/provider-router.service'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'

async function main() {
  loadBackendEnv()
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')

  const suffix = Date.now().toString(36)
  const successKey = `ai-audit-success-${suffix}`
  const failureKey = `ai-audit-failure-${suffix}`
  const registry = new ProviderRegistry()
  registry.register('failing', () => new FailingProvider())
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, registry, audit)

  const success = await router.execute('text', { prompt: '审计成功用例' }, { tenantId: tenant.id, attemptKey: successKey })
  const successRow = await prisma.aiUsageLog.findUnique({ where: { attemptKey: successKey } })

  const profile = await prisma.providerProfile.create({
    data: {
      tenantId: tenant.id,
      name: `failing-${suffix}`,
      type: 'failing',
      apiKeyRef: 'TAOBAO_APP_SECRET',
      capabilitiesJson: { capabilities: ['text'] },
      enabled: true,
    },
  })
  let failureMessage = ''
  try {
    await router.execute('text', { prompt: '审计失败用例' }, { tenantId: tenant.id, attemptKey: failureKey, providerProfileId: profile.id })
  } catch (error) {
    failureMessage = error instanceof Error ? error.message : String(error)
  }
  const failureRow = await prisma.aiUsageLog.findUnique({ where: { attemptKey: failureKey } })
  await router.execute('text', { prompt: '审计失败用例' }, { tenantId: tenant.id, attemptKey: failureKey, providerProfileId: profile.id }).catch(() => undefined)
  const failureCount = await prisma.aiUsageLog.count({ where: { attemptKey: failureKey } })

  const appModule = readFileSync(resolve(__dirname, '../src/app.module.ts'), 'utf8')
  const redactConfig = appModule.match(/redact:\s*\[([^\]]+)\]/)?.[1] ?? ''
  const aiSources = ['../src/ai/provider-router.service.ts', '../src/ai/providers/openai-compatible.provider.ts', '../src/ai/ai.worker.ts']
  const keyLogFree = aiSources.every((file) => {
    const source = readFileSync(join(__dirname, file), 'utf8')
    const logLines = source
      .split(/\r?\n/)
      .filter((line) => line.includes('console.') || line.includes('process.stdout.write'))
    return logLines.every((line) => !line.includes('apiKey') && !line.includes('authorization') && !line.includes('Bearer'))
  })

  const output = {
    success: { status: success.status, row: successRow?.status, tokenIn: successRow?.tokenIn, durationMs: successRow?.durationMs },
    failure: { message: failureMessage, rowStatus: failureRow?.status, rowError: failureRow?.error, count: failureCount },
    log: { redactApiKey: redactConfig.includes('apiKey'), redactToken: redactConfig.includes('token'), keyLogFree },
  }
  console.log(JSON.stringify(output))

  await prisma.providerProfile.deleteMany({ where: { id: profile.id } })
  await prisma.aiUsageLog.deleteMany({ where: { attemptKey: { in: [successKey, failureKey] } } })
  await prisma.$disconnect()

  const ok =
    success.status === 'success' &&
    successRow?.status === 'success' &&
    typeof successRow?.tokenIn === 'number' &&
    typeof successRow?.durationMs === 'number' &&
    failureMessage.includes('simulated provider failure') &&
    failureRow?.status === 'failure' &&
    (failureRow?.error ?? '').includes('simulated provider failure') &&
    failureCount === 1 &&
    output.log.redactApiKey &&
    output.log.redactToken &&
    output.log.keyLogFree
  process.exit(ok ? 0 : 1)
}

void main()
