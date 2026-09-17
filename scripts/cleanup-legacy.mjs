import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const apply = process.argv.includes('--apply')

// 删除目标：整个 apps/legacy（全部旧代码已迁移），以及旧单体 mock/托管入口 server.js
const targets = ['apps/legacy', 'apps/backend/server.js', 'apps/backend/server.js.map']

// 删除前保护：若新代码/配置里仍引用了 apps/legacy 路径，拒绝执行，避免误删后断链
function hasLegacyReferences() {
  try {
    const out = execSync(
      `grep -rIlE "apps/legacy|legacy/src|legacy/server" package.json scripts apps/backend/src apps/desktop/src apps/desktop/scripts apps/desktop/electron.vite.config.ts 2>/dev/null`,
      { cwd: root, encoding: 'utf8' },
    )
    // 过滤掉 cleanup 脚本自身与注释性引用
    return out.split('\n').filter((f) => f && !f.includes('cleanup-legacy')).length > 0
  } catch {
    return false
  }
}

const planned = targets.filter((target) => existsSync(join(root, target)))
const output = { mode: apply ? 'delete' : 'dry-run', planned }
console.log(JSON.stringify(output))

if (apply) {
  if (hasLegacyReferences()) {
    throw new Error('检测到新代码仍引用 apps/legacy 路径，已中止删除。请先完成迁移收口。')
  }
  // 逐文件删除整个 apps/legacy（避免残留旧代码）
  const legacyDir = join(root, 'apps/legacy')
  const leftovers = readdirSync(legacyDir)
  for (const name of leftovers) {
    rmSync(join(legacyDir, name), { recursive: true, force: true })
  }
  rmSync(legacyDir, { recursive: true, force: true })
  for (const target of planned.filter((t) => t !== 'apps/legacy')) {
    rmSync(join(root, target), { recursive: true, force: true })
  }
}