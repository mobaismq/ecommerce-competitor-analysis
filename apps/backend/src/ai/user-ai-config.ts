import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { internalDataDir } from '../common/data-root'

/**
 * 用户自配 AI 供应商配置（密钥存在用户本机，不落服务器 DB）。
 * 路径：`~/.ecommerce/users/<userId>/config/ai-self.json`（两树根中的内部根，见 common/data-root）。
 */
export interface UserAiSelfConfig {
  selfEnabled?: boolean | null
  providerType?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  model?: string | null
  timeoutMs?: number | null
}

export function userAiConfigPath(userId: string): string {
  const dir = join(internalDataDir(userId), 'config')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'ai-self.json')
}

export function readUserAiSelfConfig(userId: string): UserAiSelfConfig {
  const path = userAiConfigPath(userId)
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as UserAiSelfConfig
  } catch {
    return {}
  }
}

export function writeUserAiSelfConfig(userId: string, config: UserAiSelfConfig): void {
  writeFileSync(userAiConfigPath(userId), JSON.stringify(config, null, 2), 'utf8')
}
