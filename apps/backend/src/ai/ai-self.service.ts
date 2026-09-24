import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { SaveAiSelfConfigDto } from './dto/ai-self-config.dto'
import { ProviderRouter } from './provider-router.service'
import { readUserAiSelfConfig, writeUserAiSelfConfig } from './user-ai-config'

@Injectable()
export class AiSelfConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouter,
  ) {}

  async get(userId: string) {
    // 用户身份仅用于存在性校验；AI 密钥配置从用户本机 ~/.ecommerce/users/<id>/config/ai-self.json 读取。
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('用户不存在')
    const cfg = readUserAiSelfConfig(userId)
    return {
      selfEnabled: cfg.selfEnabled === true,
      providerType: cfg.providerType ?? null,
      baseUrl: cfg.baseUrl ?? null,
      // 不回传明文 Key，仅表示是否已配置
      apiKeyConfigured: !!cfg.apiKey,
      model: cfg.model ?? null,
      timeoutMs: cfg.timeoutMs ?? null,
      hasDefaultProvider: await this.hasDefaultProvider(),
      usingDefault: cfg.selfEnabled !== true,
    }
  }

  async save(userId: string, body: SaveAiSelfConfigDto) {
    const existing = readUserAiSelfConfig(userId)
    // 密钥存用户本机，不落服务器 DB。未回传 apiKey 时保留原密钥。
    writeUserAiSelfConfig(userId, {
      selfEnabled: body.enabled ?? false,
      providerType: body.providerType ?? null,
      baseUrl: body.baseUrl ?? null,
      apiKey: body.apiKey ?? existing.apiKey ?? null,
      model: body.model ?? null,
      timeoutMs: body.timeoutMs ?? null,
    })
    return this.get(userId)
  }

  /**
   * 连通性测试（对照旧版 /report/openai-settings/test 的 testArkResponsesConnection）。
   * 仅当存在真实可用 provider/key 时才真正发请求；无 key 或显式 mock 时诚实返回 ok:false，不伪造成功。
   */
  async test(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('用户不存在')
    const cfg = readUserAiSelfConfig(userId)
    const hasOwnReal = !!cfg.apiKey && cfg.providerType !== 'mock'
    const hasDefault = await this.hasDefaultProvider()
    // 用户显式自配了 mock，或完全没有真实 key/default 时，无真实 provider 可测
    if (cfg.selfEnabled === true && cfg.providerType === 'mock') {
      return { ok: false, reason: '当前配置的是 mock provider，未接入真实模型 Key', model: null, text: null, elapsedMs: 0 }
    }
    if (!hasOwnReal && !hasDefault) {
      return { ok: false, reason: '未配置可用的模型 Key，无法测试连通性', model: null, text: null, elapsedMs: 0 }
    }
    const started = Date.now()
    try {
      const result = await this.router.execute(
        'text',
        { prompt: '这是一次 AI 配置连通性测试，请只回复 "ok"。', maxTokens: 64 },
        { tenantId: user.tenantId, jobId: `ai-self-test-${userId.slice(0, 8)}` },
      )
      const ok = result.status === 'success'
      return {
        ok,
        reason: ok ? undefined : '连通测试失败',
        model: result.model ?? null,
        text: result.text ?? null,
        elapsedMs: Date.now() - started,
      }
    } catch (error: unknown) {
      return { ok: false, reason: (error as Error)?.message ?? '连通测试失败', model: null, text: null, elapsedMs: Date.now() - started }
    }
  }

  /**
   * 项目是否仍有可用默认 provider：
   * 环境已配 OPENROUTER Key，或存在已启用的 ProviderProfile（租户/系统）即视为有默认。
   * 供前端在"用户未自配且无默认"时提示先配置 Key。
   */
  private async hasDefaultProvider(): Promise<boolean> {
    const key = (process.env.OPENROUTER_API_KEY ?? '').trim()
    if (key && key !== 'YOUR_OPENROUTER_API_KEY_HERE') return true
    const count = await this.prisma.providerProfile.count({ where: { enabled: true } })
    return count > 0
  }
}