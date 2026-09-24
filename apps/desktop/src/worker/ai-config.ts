import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDataRoots } from '../main/data-root'

export interface LocalAiConfig {
  providerType: 'openrouter' | 'openai-compatible' | 'ark'
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs?: number
  imageEndpoint?: string
}

export class CapabilityNotConfiguredError extends Error {
  readonly code = 'AI_NOT_CONFIGURED'
  constructor(message = '未配置真实 AI 密钥，无法执行生图') {
    super(message)
    this.name = 'CapabilityNotConfiguredError'
  }
}

export function readLocalAiConfig(userId: string, env: Record<string, string | undefined> = process.env): LocalAiConfig {
  const file = join(resolveDataRoots(env).internalRoot, 'users', userId, 'config', 'ai-self.json')
  if (!existsSync(file)) throw new CapabilityNotConfiguredError()
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    throw new CapabilityNotConfiguredError('本机 AI 配置文件无法解析')
  }
  const apiKey = String(parsed.apiKey ?? '').trim()
  const providerType = String(parsed.providerType ?? '').trim()
  if (parsed.selfEnabled !== true || !apiKey || !['openrouter', 'openai-compatible', 'ark'].includes(providerType)) {
    throw new CapabilityNotConfiguredError()
  }
  const baseUrl = String(parsed.baseUrl ?? '').trim() || (providerType === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1')
  const model = String(parsed.model ?? '').trim() || (providerType === 'openrouter' ? 'openai/gpt-image-2' : 'gpt-image-1')
  return {
    providerType: providerType as LocalAiConfig['providerType'],
    baseUrl,
    apiKey,
    model,
    timeoutMs: typeof parsed.timeoutMs === 'number' ? parsed.timeoutMs : undefined,
    imageEndpoint: providerType === 'openrouter' ? 'images' : undefined,
  }
}
