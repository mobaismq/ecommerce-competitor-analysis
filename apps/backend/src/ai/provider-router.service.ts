import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { AiAuditService } from './ai-audit.service'
import { AiCallError, type AiCapability, type AiImageRequest, type AiProvider, type AiResult, type AiTextRequest, type AiVisionRequest, type ProviderConfig } from './ai.types'
import { ProviderRegistry } from './provider-registry'

interface ExecuteOptions {
  tenantId: string
  jobId?: string
  attemptKey?: string
  providerProfileId?: string
}

interface CapabilityProfile {
  id: string
  type: string
  baseUrl: string | null
  apiKeyRef: string
  modelConfigJson: Prisma.JsonValue | null
  timeoutMs: number | null
}

@Injectable()
export class ProviderRouter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly audit: AiAuditService,
  ) {}

  async execute(
    capability: AiCapability,
    request: AiTextRequest | AiVisionRequest | AiImageRequest,
    options: ExecuteOptions,
  ): Promise<AiResult & { cached?: boolean; cacheKey?: string }> {
    const profile = options.providerProfileId
      ? await this.prisma.providerProfile.findFirst({ where: { id: options.providerProfileId, enabled: true } })
      : await this.selectActiveProfile(capability, options.tenantId)
    const providerType = profile?.type ?? this.defaultProviderType()
    const config = profile ? this.resolveConfig(profile) : this.resolveEnvConfig(providerType, capability)
    const provider = this.registry.create(providerType, config)
    const cacheKey = createHash('sha256')
      .update(JSON.stringify({ capability, providerType: provider.type, model: config.model, request }))
      .digest('hex')
    const attemptKey = options.attemptKey ?? `${options.jobId ?? 'manual'}:${capability}:0`

    const completed = await this.audit.findSuccess(attemptKey)
    if (completed?.status === 'success') {
      const cached = await this.prisma.aiCallCache.findUnique({ where: { requestHash: cacheKey } })
      if (cached?.resultJson && cached.status === 'success') {
        return { ...(cached.resultJson as unknown as AiResult), cached: true, cacheKey }
      }
      return { status: 'success', model: completed.model ?? config.model ?? '', durationMs: 0, cached: true, cacheKey }
    }

    const cached = await this.prisma.aiCallCache.findUnique({ where: { requestHash: cacheKey } })
    if (cached?.resultJson && cached.status === 'success') {
      const cachedResult = cached.resultJson as unknown as AiResult
      await this.audit.recordOrReset({
        tenantId: options.tenantId,
        jobId: options.jobId,
        attemptKey,
        providerProfileId: profile?.id,
        providerType: provider.type,
        model: cachedResult.model ?? config.model,
      })
      await this.audit.complete(attemptKey, {
        status: 'success',
        tokenIn: cachedResult.tokenIn,
        tokenOut: cachedResult.tokenOut,
        durationMs: cachedResult.durationMs,
      })
      return { ...cachedResult, cached: true, cacheKey }
    }

    await this.audit.recordOrReset({
      tenantId: options.tenantId,
      jobId: options.jobId,
      attemptKey,
      providerProfileId: profile?.id,
      providerType: provider.type,
      model: config.model,
    })

    const started = Date.now()
    try {
      const result = await this.invoke(provider, capability, request)
      result.durationMs = Math.max(1, Date.now() - started)
      await this.audit.complete(attemptKey, {
        status: 'success',
        tokenIn: result.tokenIn,
        tokenOut: result.tokenOut,
        durationMs: result.durationMs,
      })
      await this.prisma.aiCallCache.upsert({
        where: { requestHash: cacheKey },
        update: {
          resultJson: result as unknown as Prisma.InputJsonValue,
          status: 'success',
          providerType: provider.type,
          model: result.model,
        },
        create: {
          tenantId: options.tenantId,
          requestHash: cacheKey,
          providerType: provider.type,
          model: result.model,
          resultJson: result as unknown as Prisma.InputJsonValue,
          status: 'success',
        },
      })
      return { ...result, cacheKey }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.audit.complete(attemptKey, {
        status: 'failure',
        durationMs: Math.max(1, Date.now() - started),
        error: message.slice(0, 500),
      })
      throw error
    }
  }

  private async selectActiveProfile(capability: AiCapability, tenantId: string): Promise<CapabilityProfile | null> {
    const rows = await this.prisma.providerProfile.findMany({
      where: { enabled: true, OR: [{ tenantId }, { tenantId: null }] },
      orderBy: [{ priority: 'desc' }],
    })
    const matches = rows.filter((row) => {
      const capabilities = (row.capabilitiesJson as { capabilities?: string[] } | null)?.capabilities ?? []
      return capabilities.includes(capability)
    })
    if (matches.length === 0) return null
    return matches[0]
  }

  private resolveConfig(profile: CapabilityProfile | null): ProviderConfig {
    if (!profile) {
      return { model: process.env.AI_MOCK_MODEL ?? 'mock-model' }
    }
    const modelConfig = (profile.modelConfigJson as { model?: string } | null) ?? {}
    return {
      baseUrl: profile.baseUrl ?? undefined,
      apiKey: profile.apiKeyRef ? process.env[profile.apiKeyRef] : undefined,
      model: modelConfig.model,
      timeoutMs: profile.timeoutMs ?? undefined,
    }
  }

  private defaultProviderType(): string {
    const key = (process.env.OPENROUTER_API_KEY ?? '').trim()
    return key && key !== 'YOUR_OPENROUTER_API_KEY_HERE' ? 'openrouter' : 'mock'
  }

  private resolveEnvConfig(type: string, capability: AiCapability): ProviderConfig {
    if (type === 'openrouter') {
      return {
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        model:
          capability === 'image'
            ? process.env.OPENROUTER_IMAGE_MODEL || 'openai/gpt-image-2'
            : process.env.OPENROUTER_VISION_MODEL || 'deepseek/deepseek-v4-flash-vision-exp',
        timeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS ?? 120000),
      }
    }
    return { model: process.env.AI_MOCK_MODEL ?? 'mock-model' }
  }

  private invoke(provider: AiProvider, capability: AiCapability, request: AiTextRequest | AiVisionRequest | AiImageRequest) {
    if (capability === 'text') return provider.generateText(request as AiTextRequest)
    if (capability === 'vision') return provider.analyzeImage(request as AiVisionRequest)
    if (capability === 'image') return provider.generateImage(request as AiImageRequest)
    throw new AiCallError(`unsupported capability: ${capability}`, 'UNSUPPORTED_CAPABILITY', false)
  }
}
