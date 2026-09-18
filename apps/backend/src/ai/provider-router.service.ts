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
  /** 发起用户 id：命中个人自配的 AI 供应商（优先级 用户自配 > 租户/系统 ProviderProfile > 环境默认） */
  userId?: string
}

interface UserSelfConfig {
  aiSelfEnabled: boolean | null
  aiProviderType: string | null
  aiBaseUrl: string | null
  aiApiKey: string | null
  aiModel: string | null
  aiTimeoutMs: number | null
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
    const resolved = await this.resolveProvider(capability, options)
    const providerType = resolved.type
    const config = resolved.config
    const provider = this.registry.create(providerType, config)
    const profileId = resolved.profileId
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
        providerProfileId: profileId,
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
      providerProfileId: profileId,
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

  private async resolveProvider(
    capability: AiCapability,
    options: ExecuteOptions,
  ): Promise<{ type: string; config: ProviderConfig; profileId?: string }> {
    // 1) 个人自配优先：用户主动开启且配置了 Key
    if (options.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: options.userId },
        select: {
          aiSelfEnabled: true,
          aiProviderType: true,
          aiBaseUrl: true,
          aiApiKey: true,
          aiModel: true,
          aiTimeoutMs: true,
        },
      })
      const userConfig = this.resolveUserConfig(user)
      if (userConfig) {
        return { type: user?.aiProviderType ?? this.defaultProviderType(), config: userConfig }
      }
    }

    // 2) 租户/系统 ProviderProfile（组织集中配置）
    const profile = options.providerProfileId
      ? await this.prisma.providerProfile.findFirst({ where: { id: options.providerProfileId, enabled: true } })
      : await this.selectActiveProfile(capability, options.tenantId)
    if (profile) return { type: profile.type, config: this.resolveConfig(profile), profileId: profile.id }

    // 3) 环境默认兜底（项目初期默认 provider）
    const fallbackType = this.defaultProviderType()
    return { type: fallbackType, config: this.resolveEnvConfig(fallbackType, capability) }
  }

  /**
   * 将用户的个人自配字段解析为可用的 ProviderConfig；未开启 / 缺 Key 时返回 null，回落下一优先级。
   */
  private resolveUserConfig(user: UserSelfConfig | null): ProviderConfig | null {
    if (!user || user.aiSelfEnabled !== true || !user.aiApiKey) return null
    return {
      baseUrl: user.aiBaseUrl ?? undefined,
      apiKey: user.aiApiKey,
      model: user.aiModel ?? undefined,
      timeoutMs: user.aiTimeoutMs ?? undefined,
    }
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
