import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { SaveAiSelfConfigDto } from './dto/ai-self-config.dto'

@Injectable()
export class AiSelfConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('用户不存在')
    return {
      selfEnabled: user.aiSelfEnabled === true,
      providerType: user.aiProviderType ?? null,
      baseUrl: user.aiBaseUrl ?? null,
      // 不回传明文 Key，仅表示是否已配置
      apiKeyConfigured: !!user.aiApiKey,
      model: user.aiModel ?? null,
      timeoutMs: user.aiTimeoutMs ?? null,
      hasDefaultProvider: await this.hasDefaultProvider(),
      usingDefault: user.aiSelfEnabled !== true,
    }
  }

  async save(userId: string, body: SaveAiSelfConfigDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        aiSelfEnabled: body.enabled ?? false,
        aiProviderType: body.providerType ?? null,
        aiBaseUrl: body.baseUrl ?? null,
        ...(body.apiKey ? { aiApiKey: body.apiKey } : {}),
        aiModel: body.model ?? null,
        aiTimeoutMs: body.timeoutMs ?? null,
      },
    })
    return this.get(userId)
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