import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDataRoots } from '../main/data-root'
import { encryptSecret, decryptSecret } from './ai-secret'

// ===== 个人/默认 AI 供应商配置（本地闭环，密钥只落本机） =====
// 解析优先级：个人自配（ai-self.json，users/<id>/config/）→ 系统默认（桌面 env 的 OpenRouter 默认供应商，先体验用）。

export type AiKind = 'openrouter' | 'openai-compatible'
/** 接口协议：OpenAI 兼容（/chat/completions）或 Anthropic 兼容（/messages） */
export type AiProtocol = 'openai' | 'anthropic'

export interface LocalAiConfig {
  /** 供应商类别：openrouter 支持参考图生成，openai-compatible 走 size */
  kind: AiKind
  /** 接口协议：决定文本/视觉请求走 chat/completions 还是 Anthropic /messages */
  protocol: AiProtocol
  baseUrl: string
  apiKey: string
  /** 文本/对话模型（chat completions 或 /messages） */
  textModel: string
  /** 生图模型（images/generations） */
  imageModel: string
  timeoutMs?: number
}

/** 用户自配 AI 的原始落盘结构（明文密钥仅写本机，不回传明文）。 */
export interface AiSelfConfigFile {
  selfEnabled?: boolean | null
  providerType?: string | null
  /** 接口协议：openai | anthropic */
  protocol?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  /** 兼容旧字段：单模型时 text 与 image 共用 */
  model?: string | null
  textModel?: string | null
  imageModel?: string | null
  timeoutMs?: number | null
}

export interface SelfConfigView {
  selfEnabled: boolean
  /** 接口协议：openai | anthropic */
  protocol: 'openai' | 'anthropic'
  baseUrl: string | null
  apiKeyConfigured: boolean
  textModel: string | null
  imageModel: string | null
  timeoutMs: number | null
  /** 是否存在可用默认供应商（桌面 env 已配 OpenRouter Key） */
  hasDefaultProvider: boolean
  /** 当前是否实际在使用默认供应商（未开自配但有默认） */
  usingDefault: boolean
  defaultBaseUrl: string | null
  defaultTextModel: string | null
  defaultImageModel: string | null
}

export interface SaveSelfConfigInput {
  protocol?: 'openai' | 'anthropic'
  baseUrl?: string
  apiKey?: string
  textModel?: string
  imageModel?: string
  timeoutMs?: number
  /** 清除个人配置（重置为不使用个人自配、回落默认） */
  clear?: boolean
}

function aiSelfConfigPath(userId: string, env: Record<string, string | undefined>): string {
  return join(resolveDataRoots(env).internalRoot, 'users', userId, 'config', 'ai-self.json')
}

function aiDefaultPath(userId: string, env: Record<string, string | undefined>): string {
  return join(resolveDataRoots(env).internalRoot, 'users', userId, 'config', 'ai-default.json')
}

/** 读取服务端下发的默认供应商（apiKey 落盘加密）；无文件/无 Key 返回 null。 */
export function readServerDefault(userId: string, env: Record<string, string | undefined> = process.env): LocalAiConfig | null {
  const file = aiDefaultPath(userId, env)
  if (!existsSync(file)) return null
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { baseUrl?: string; apiKey?: string; textModel?: string; imageModel?: string; protocol?: string }
    if (!raw || !raw.apiKey) return null
    return {
      kind: 'openrouter',
      protocol: raw.protocol === 'anthropic' ? 'anthropic' : 'openai',
      baseUrl: raw.baseUrl || 'https://openrouter.ai/api/v1',
      apiKey: decryptSecret(String(raw.apiKey)),
      textModel: raw.textModel || 'deepseek/deepseek-chat',
      imageModel: raw.imageModel || 'openai/gpt-image-2',
    }
  } catch {
    return null
  }
}

/** 写入/清除服务端默认供应商：传 null（或无 Key）即删除文件 = 去掉默认。 */
export function setServerDefault(
  userId: string,
  config: { baseUrl?: string; apiKey?: string; textModel?: string; imageModel?: string; protocol?: string } | null,
  env: Record<string, string | undefined> = process.env,
): void {
  const file = aiDefaultPath(userId, env)
  if (!config || !config.apiKey) {
    if (existsSync(file)) unlinkSync(file)
    return
  }
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(
    file,
    JSON.stringify(
      {
        baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
        apiKey: encryptSecret(config.apiKey),
        textModel: config.textModel || 'deepseek/deepseek-chat',
        imageModel: config.imageModel || 'openai/gpt-image-2',
        protocol: config.protocol === 'anthropic' ? 'anthropic' : 'openai',
      },
      null,
      2,
    ),
    'utf8',
  )
}

/** 读取原始自配结构；文件不存在/无法解析时返回空对象，不抛错。 */
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

function kindFrom(providerType: string | undefined, baseUrl: string): AiKind {
  return String(providerType ?? '').includes('openrouter') || baseUrl.includes('openrouter') ? 'openrouter' : 'openai-compatible'
}

/** 读取个人自配；未配置或不生效时诚实抛 CapabilityNotConfiguredError（纯 self-config，不含默认回落）。 */
export function readLocalAiConfig(userId: string, env: Record<string, string | undefined> = process.env): LocalAiConfig {
  const file = join(resolveDataRoots(env).internalRoot, 'users', userId, 'config', 'ai-self.json')
  if (!existsSync(file)) throw new CapabilityNotConfiguredError()
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    throw new CapabilityNotConfiguredError('本机 AI 配置文件无法解析')
  }
  const apiKey = decryptSecret(String(parsed.apiKey ?? '').trim())
  const selfEnabled = parsed.selfEnabled === true
  if (!selfEnabled || !apiKey) throw new CapabilityNotConfiguredError()
  const baseUrl = String(parsed.baseUrl ?? '').trim() || 'https://openrouter.ai/api/v1'
  const kind = kindFrom(String(parsed.providerType ?? '').trim(), baseUrl)
  const protocol: AiProtocol = String(parsed.protocol ?? '').trim() === 'anthropic' ? 'anthropic' : 'openai'
  return {
    kind,
    protocol,
    baseUrl,
    apiKey,
    textModel: String(parsed.textModel ?? parsed.model ?? '').trim() || (protocol === 'anthropic' ? 'claude-sonnet-4-5' : kind === 'openrouter' ? 'deepseek/deepseek-chat' : 'gpt-4o-mini'),
    imageModel: String(parsed.imageModel ?? parsed.model ?? '').trim() || 'openai/gpt-image-2',
    timeoutMs: typeof parsed.timeoutMs === 'number' ? parsed.timeoutMs : undefined,
  }
}

/** 系统默认供应商：仅取服务端下发的默认（users/<id>/config/ai-default.json）；无下发文件即无默认（个人自配仍优先）。 */
export function resolveDefaultProvider(userId: string, env: Record<string, string | undefined> = process.env): LocalAiConfig | null {
  return readServerDefault(userId, env)
}

/** 解析实际生效的 AI 配置：个人自配优先，未配置则回落系统默认；两者皆无返回 null。 */
export function resolveEffectiveConfig(userId: string, env: Record<string, string | undefined> = process.env): LocalAiConfig | null {
  try {
    return readLocalAiConfig(userId, env)
  } catch {
    return resolveDefaultProvider(userId, env)
  }
}

/** 读取自配 + 默认供应商状态（给配置页展示；不回传明文密钥）。 */
export async function getSelfConfig(userId: string, env: Record<string, string | undefined> = process.env): Promise<SelfConfigView> {
  const cfg = readAiSelfConfigFile(userId, env)
  const def = resolveDefaultProvider(userId, env)
  const selfEnabled = cfg.selfEnabled === true
  return {
    selfEnabled,
    protocol: cfg.protocol === 'anthropic' ? 'anthropic' : 'openai',
    baseUrl: cfg.baseUrl ?? null,
    apiKeyConfigured: !!cfg.apiKey,
    textModel: cfg.textModel ?? cfg.model ?? null,
    imageModel: cfg.imageModel ?? cfg.model ?? null,
    timeoutMs: typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : null,
    hasDefaultProvider: !!def,
    usingDefault: !selfEnabled && !!def,
    defaultBaseUrl: def?.baseUrl ?? null,
    defaultTextModel: def?.textModel ?? null,
    defaultImageModel: def?.imageModel ?? null,
  }
}

/** 保存个人自配：配置了 Key 即生效（无需显式开关）；clear=true 则清除个人配置回落默认。 */
export async function saveSelfConfig(userId: string, body: SaveSelfConfigInput, env: Record<string, string | undefined> = process.env): Promise<SelfConfigView> {
  const existing = readAiSelfConfigFile(userId, env)
  const clear = body.clear === true
  const willHaveKey = !clear && (!!body.apiKey || !!existing.apiKey)
  writeAiSelfConfigFile(
    userId,
    {
      selfEnabled: willHaveKey,
      providerType: 'openai-compatible',
      protocol: body.protocol ?? 'openai',
      baseUrl: clear ? null : body.baseUrl ?? null,
      apiKey: clear ? null : body.apiKey ? encryptSecret(body.apiKey) : existing.apiKey ?? null,
      textModel: clear ? null : body.textModel ?? null,
      imageModel: clear ? null : body.imageModel ?? null,
      timeoutMs: clear ? null : body.timeoutMs ?? null,
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