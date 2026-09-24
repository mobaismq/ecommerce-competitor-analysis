import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDataRoots } from '../main/data-root'
import { getWorkerPrisma } from './worker-db'

export interface LocalAiConfig {
  providerType: 'openrouter' | 'openai-compatible' | 'ark'
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs?: number
  imageEndpoint?: string
}

/** 用户自配 AI 供应商的原始落盘结构（明文密钥仅写本机，不回传）。路径与后端 user-ai-config 一致。 */
export interface AiSelfConfigFile {
  selfEnabled?: boolean | null
  providerType?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  model?: string | null
  timeoutMs?: number | null
}

export interface SelfConfigView {
  selfEnabled: boolean
  providerType: string | null
  baseUrl: string | null
  apiKeyConfigured: boolean
  model: string | null
  timeoutMs: number | null
  hasDefaultProvider: boolean
  usingDefault: boolean
}

export interface SaveSelfConfigInput {
  enabled?: boolean
  providerType?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  timeoutMs?: number
}

function aiSelfConfigPath(userId: string, env: Record<string, string | undefined>): string {
  return join(resolveDataRoots(env).internalRoot, 'users', userId, 'config', 'ai-self.json')
}

/** 读取原始自配结构；文件不存在/无法解析时返回空对象，不抛错（与后端 readUserAiSelfConfig 语义一致）。 */
export function readAiSelfConfigFile(userId: string, env: Record<string, string | undefined> = process.env): AiSelfConfigFile {
  const file = aiSelfConfigPath(userId, env)
  if (!existsSync(file)) return {}
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as AiSelfConfigFile
  } catch {
    return {}
  }
}

function writeAiSelfConfigFile(userId: string, config: AiSelfConfigFile, env: Record<string, string | undefined>): void {
  const file = aiSelfConfigPath(userId, env)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, JSON.stringify(config, null, 2), 'utf8')
}

/** 本机是否有可用默认 provider：环境已配真实 OPENROUTER Key，或存在已启用的本地 ProviderProfile。 */
async function hasDefaultProvider(env: Record<string, string | undefined>): Promise<boolean> {
  const key = (env.OPENROUTER_API_KEY ?? '').trim()
  if (key && key !== 'YOUR_OPENROUTER_API_KEY_HERE') return true
  const db = getWorkerPrisma()
  const count = await db.providerProfile.count({ where: { enabled: true } })
  return count > 0
}

/** 读取自配（可回传明文字段之外仅返回是否已配置 Key，不回传明文密钥）。 */
export async function getSelfConfig(userId: string, env: Record<string, string | undefined> = process.env): Promise<SelfConfigView> {
  const cfg = readAiSelfConfigFile(userId, env)
  const hasDefault = await hasDefaultProvider(env)
  return {
    selfEnabled: cfg.selfEnabled === true,
    providerType: cfg.providerType ?? null,
    baseUrl: cfg.baseUrl ?? null,
    apiKeyConfigured: !!cfg.apiKey,
    model: cfg.model ?? null,
    timeoutMs: typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : null,
    hasDefaultProvider: hasDefault,
    usingDefault: cfg.selfEnabled !== true,
  }
}

/** 保存自配（密钥明文写本机，不回传）：未回传 apiKey 时保留原密钥，语义对齐后端 save。 */
export async function saveSelfConfig(userId: string, body: SaveSelfConfigInput, env: Record<string, string | undefined> = process.env): Promise<SelfConfigView> {
  const existing = readAiSelfConfigFile(userId, env)
  writeAiSelfConfigFile(
    userId,
    {
      selfEnabled: body.enabled ?? false,
      providerType: body.providerType ?? null,
      baseUrl: body.baseUrl ?? null,
      apiKey: body.apiKey ?? existing.apiKey ?? null,
      model: body.model ?? null,
      timeoutMs: body.timeoutMs ?? null,
    },
    env,
  )
  return getSelfConfig(userId, env)
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
