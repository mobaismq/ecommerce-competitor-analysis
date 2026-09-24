import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** 与后端 common/data-root 同构：本地数据根两树（只属于用户电脑）。 */
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

/** 创建两树目录骨架与 layout.json（幂等）。 */
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
