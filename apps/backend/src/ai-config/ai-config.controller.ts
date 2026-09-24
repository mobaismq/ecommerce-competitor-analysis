import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

/**
 * 服务端默认 AI 供应商下发（先体验默认，后续可去掉）。
 * 有配置返回 { baseUrl, apiKey, textModel, imageModel, protocol }；未配置返回空对象（= 无默认）。
 * 桌面侧解析优先级：个人自配 > 服务端默认 > 本地 env（开发兜底）。
 */
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiConfigController {
  @Get('default-config')
  defaultConfig() {
    const key = (process.env.OPENROUTER_API_KEY ?? '').trim()
    if (!key || key === 'YOUR_OPENROUTER_API_KEY_HERE') return {}
    return {
      baseUrl: (process.env.OPENROUTER_BASE_URL ?? '').trim() || 'https://openrouter.ai/api/v1',
      apiKey: key,
      textModel: (process.env.OPENROUTER_TEXT_MODEL ?? process.env.OPENROUTER_VISION_MODEL ?? '').trim() || 'deepseek/deepseek-chat',
      imageModel: (process.env.OPENROUTER_IMAGE_MODEL ?? '').trim() || 'openai/gpt-image-2',
      protocol: 'openai',
    }
  }
}
