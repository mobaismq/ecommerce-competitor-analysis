import { AiAuditService } from '../src/ai/ai-audit.service'
import { ProviderRegistry } from '../src/ai/provider-registry'
import { ProviderRouter } from '../src/ai/provider-router.service'
import { assertSafeBaseUrl } from '../src/admin/ssrf'
import { ProviderProfileService } from '../src/admin/provider-profile.service'
import { loadBackendEnv } from '../src/env'
import { PrismaService } from '../src/prisma.service'

async function main() {
  loadBackendEnv()
  const prisma = new PrismaService()
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) throw new Error('seed tenant missing')
  const suffix = Date.now().toString(36)

  const badUrls = [
    'http://api.openai.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://192.168.1.1',
    'https://10.0.0.1',
    'https://172.16.0.1',
    'https://metadata.google.internal',
    'https://api.openai.com:8443',
    'ftp://api.openai.com',
  ]
  const ssrfRejected = badUrls.filter((url) => {
    try {
      assertSafeBaseUrl(url)
      return false
    } catch {
      return true
    }
  }).length
  let httpsAccepted = true
  try {
    assertSafeBaseUrl('https://api.openai.com')
  } catch {
    httpsAccepted = false
  }

  const profileA = await prisma.providerProfile.create({
    data: {
      tenantId: tenant.id,
      name: `a-${suffix}`,
      type: 'mock',
      apiKeyRef: 'ARK_API_KEY',
      capabilitiesJson: { capabilities: ['text'] },
      modelConfigJson: { model: 'profile-a' },
      enabled: true,
      priority: 2,
    },
  })
  const profileB = await prisma.providerProfile.create({
    data: {
      tenantId: tenant.id,
      name: `b-${suffix}`,
      type: 'mock',
      apiKeyRef: 'ARK_API_KEY',
      capabilitiesJson: { capabilities: ['image'] },
      modelConfigJson: { model: 'profile-b' },
      enabled: true,
      priority: 1,
    },
  })
  const profileC = await prisma.providerProfile.create({
    data: {
      tenantId: tenant.id,
      name: `c-${suffix}`,
      type: 'mock',
      apiKeyRef: 'ARK_API_KEY',
      capabilitiesJson: { capabilities: ['text'] },
      modelConfigJson: { model: 'profile-c' },
      enabled: true,
      priority: 3,
    },
  })

  const registry = new ProviderRegistry()
  const audit = new AiAuditService(prisma)
  const router = new ProviderRouter(prisma, registry, audit)
  const service = new ProviderProfileService(prisma)
  const key1 = `router-smoke-${suffix}-1`
  const key2 = `router-smoke-${suffix}-2`
  const key3 = `router-smoke-${suffix}-3`

  const textByPriority = await router.execute('text', { prompt: '选择 text profile' }, { tenantId: tenant.id, attemptKey: key1 })
  const imageByPriority = await router.execute('image', { prompt: '选择 image profile' }, { tenantId: tenant.id, attemptKey: key2 })
  const usage1 = await prisma.aiUsageLog.findUnique({ where: { attemptKey: key1 } })
  const usage2 = await prisma.aiUsageLog.findUnique({ where: { attemptKey: key2 } })

  const activated = await service.activate(tenant.id, profileA.id)
  const profileCAfter = await prisma.providerProfile.findUnique({ where: { id: profileC.id } })
  const afterSwitch = await router.execute('text', { prompt: '切换后选择' }, { tenantId: tenant.id, attemptKey: key3 })
  const usage3 = await prisma.aiUsageLog.findUnique({ where: { attemptKey: key3 } })

  const job = await prisma.job.create({
    data: { tenantId: tenant.id, type: 'ai', businessKey: `router-job-${suffix}`, status: 'queued', stage: 'queued', providerProfileId: profileA.id },
  })
  const jobKey = `${job.id}:text:0`
  const fixedCall = await router.execute('text', { prompt: '固定 Profile 调用' }, { tenantId: tenant.id, jobId: job.id, attemptKey: jobKey, providerProfileId: profileA.id })
  const fixedUsage = await prisma.aiUsageLog.findUnique({ where: { attemptKey: jobKey } })

  const list = await service.list(tenant.id)
  const masked = list.find((row) => row.id === profileA.id)?.apiKeyRef ?? ''

  const output = {
    ssrf: { badUrls: ssrfRejected, badTotal: badUrls.length, httpsAccepted },
    selection: {
      textByPriorityProfile: usage1?.providerProfileId === profileC.id,
      textModel: textByPriority.model,
      imageByPriorityProfile: usage2?.providerProfileId === profileB.id,
      imageModel: imageByPriority.model,
    },
    switch: { activated: activated.ok, previousDisabled: profileCAfter?.enabled === false, afterSwitchProfile: usage3?.providerProfileId === profileA.id, model: afterSwitch.model },
    fixedJob: { jobProfile: job.providerProfileId === profileA.id, usageJobId: fixedUsage?.jobId === job.id, usageProfile: fixedUsage?.providerProfileId === profileA.id, model: fixedCall.model },
    keyMasked: { masked, notPlain: masked !== 'ARK_API_KEY' },
  }
  console.log(JSON.stringify(output))

  await prisma.aiUsageLog.deleteMany({ where: { attemptKey: { in: [key1, key2, key3, jobKey] } } })
  for (const cacheKey of [textByPriority.cacheKey, imageByPriority.cacheKey, afterSwitch.cacheKey, fixedCall.cacheKey].filter(Boolean)) {
    await prisma.aiCallCache.deleteMany({ where: { requestHash: cacheKey } })
  }
  await prisma.job.deleteMany({ where: { id: job.id } })
  await prisma.providerProfile.deleteMany({ where: { id: { in: [profileA.id, profileB.id, profileC.id] } } })
  await prisma.$disconnect()

  const ok =
    ssrfRejected === badUrls.length &&
    httpsAccepted &&
    output.selection.textByPriorityProfile &&
    output.selection.imageByPriorityProfile &&
    output.selection.textModel === 'profile-c' &&
    output.selection.imageModel === 'profile-b' &&
    output.switch.activated &&
    output.switch.previousDisabled &&
    output.switch.afterSwitchProfile &&
    output.switch.model === 'profile-a' &&
    output.fixedJob.jobProfile &&
    output.fixedJob.usageJobId &&
    output.fixedJob.usageProfile &&
    output.fixedJob.model === 'profile-a' &&
    output.keyMasked.notPlain
  process.exit(ok ? 0 : 1)
}

void main()
