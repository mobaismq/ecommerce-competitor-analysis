import { createServer, type ServerResponse, type IncomingMessage } from 'node:http'
import { AiAuditService } from '../src/ai/ai-audit.service'
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
  const key1 = `openrouter-fallback-${suffix}-1`
  const key2 = `openrouter-fallback-${suffix}-2`

  let requests = 0
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()))
    req.on('end', () => {
      requests += 1
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { content: 'openrouter-ok' } }], usage: { prompt_tokens: 2, completion_tokens: 3 } }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const baseUrl = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : ''

  process.env.OPENROUTER_API_KEY = 'sk-test'
  process.env.OPENROUTER_BASE_URL = baseUrl
  process.env.OPENROUTER_VISION_MODEL = 'mock-vision-model'
  const registry = new ProviderRegistry()
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, registry, audit)

  const withKey = await router.execute('text', { prompt: 'hi' }, { tenantId: tenant.id, attemptKey: key1 })
  const usageWithKey = await prisma.aiUsageLog.findUnique({ where: { attemptKey: key1 } })
  const requestsWithKey = requests

  process.env.OPENROUTER_API_KEY = 'YOUR_OPENROUTER_API_KEY_HERE'
  const placeholder = await router.execute('text', { prompt: 'hi' }, { tenantId: tenant.id, attemptKey: key2 })
  const usagePlaceholder = await prisma.aiUsageLog.findUnique({ where: { attemptKey: key2 } })
  const requestsAfterPlaceholder = requests

  const output = {
    withKey: { text: withKey.text, model: withKey.model, providerType: usageWithKey?.providerType, requests: requestsWithKey },
    placeholder: { model: placeholder.model, providerType: usagePlaceholder?.providerType, extraRequests: requestsAfterPlaceholder - requestsWithKey },
  }
  console.log(JSON.stringify(output))

  await new Promise<void>((resolve) => server.close(() => resolve()))
  await prisma.aiUsageLog.deleteMany({ where: { attemptKey: { in: [key1, key2] } } })
  for (const cacheKey of [withKey.cacheKey, placeholder.cacheKey].filter(Boolean)) {
    await prisma.aiCallCache.deleteMany({ where: { requestHash: cacheKey } })
  }
  await prisma.$disconnect()

  const ok =
    withKey.text === 'openrouter-ok' &&
    withKey.model === 'mock-vision-model' &&
    usageWithKey?.providerType === 'openrouter' &&
    requestsWithKey === 1 &&
    placeholder.model === 'mock-model' &&
    usagePlaceholder?.providerType === 'mock' &&
    requestsAfterPlaceholder === requestsWithKey
  process.exit(ok ? 0 : 1)
}

void main()
