import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * 本地数据根（两树分工，只属于用户电脑，不属于服务器）。
 * - internalRoot `~/.ecommerce`：系统内部数据（config/logs/cache/state.db 等）。
 * - userRoot     `~/ecommerce`：用户可见的工作区产出（生成的图/采集下载/报告等）。
 * 以 `ECOMMERCE_DATA_ROOT` 为基目录（可覆盖），未配置时回落到用户主目录（os.homedir()）。
 */
export interface DataRoots {
  base: string
  internalRoot: string
  userRoot: string
}

export function resolveDataRoots(env: Record<string, string | undefined> = process.env): DataRoots {
  const base = (env.ECOMMERCE_DATA_ROOT?.trim() || homedir()).replace(/\/+$/, '')
  return {
    base,
    internalRoot: join(base, '.ecommerce'),
    userRoot: join(base, 'ecommerce'),
  }
}

/** 内部根下按账号隔离，如 `~/.ecommerce/users/<accountId>`。 */
export function internalDataDir(accountId: string, env?: Record<string, string | undefined>): string {
  return join(resolveDataRoots(env).internalRoot, 'users', accountId)
}

/** 用户工作区根下按账号隔离，如 `~/ecommerce/users/<accountId>`。 */
export function userDataDir(accountId: string, env?: Record<string, string | undefined>): string {
  return join(resolveDataRoots(env).userRoot, 'users', accountId)
}

/** 创建两树目录骨架与 layout.json（幂等），返回解析结果。 */
export function ensureDataRoots(env?: Record<string, string | undefined>): DataRoots {
  const roots = resolveDataRoots(env)
  for (const sub of ['', 'config', 'logs', 'cache', 'tmp', 'users']) {
    mkdirSync(join(roots.internalRoot, sub), { recursive: true })
  }
  mkdirSync(join(roots.userRoot, 'users'), { recursive: true })
  const layoutFile = join(roots.internalRoot, 'layout.json')
  if (!existsSync(layoutFile)) {
    writeFileSync(layoutFile, JSON.stringify({ version: 1, created: new Date().toISOString() }, null, 2), 'utf8')
  }
  return roots
}
