import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

function walk(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')))
    .map((entry) => join(entry.parentPath, entry.name))
}

async function main() {
  const skillNotice = readFileSync(resolve(workspaceRoot, 'skills/market-analysis-report/SKILL.md'), 'utf8')
  const skillMarkedReference = skillNotice.includes('迁移参考')

  const backendSources = walk(join(backendRoot, 'src'))
  const desktopSources = walk(join(workspaceRoot, 'apps/desktop/src')).filter((file) => !file.includes('generated'))
  const legacyTokens = ['market-analysis-report', 'apps/legacy/server', 'apps/backend/server.js']
  const legacyRefs = legacyTokens.filter((token) =>
    [...backendSources, ...desktopSources].some((file) => readFileSync(file, 'utf8').includes(token)),
  )

  const rootEnv = readFileSync(resolve(workspaceRoot, '.env.example'), 'utf8')
  const backendEnv = readFileSync(join(backendRoot, '.env.example'), 'utf8')
  const desktopEnv = readFileSync(resolve(workspaceRoot, 'apps/desktop/.env.example'), 'utf8')
  const rootIsPointerOnly = rootEnv.includes('不是配置事实源')
  const rootHasNoDuplicate = !rootEnv.includes('DATABASE_URL=') && !rootEnv.includes('REDIS_URL=')
  const desktopEnvHasSync = desktopEnv.includes('SYNC_ASSET=') && desktopEnv.includes('BACKEND_URL=')

  const storeSource = readFileSync(resolve(workspaceRoot, 'apps/desktop/src/main/store.ts'), 'utf8')
  const syncKeySingleSource = (storeSource.match(/syncCollection/g) ?? []).length === 1 && (storeSource.match(/syncAsset/g) ?? []).length === 1

  const output = {
    skillMarkedReference,
    legacyRefs,
    env: { rootIsPointerOnly, rootHasNoDuplicate, desktopEnvHasSync },
    syncKeySingleSource,
  }
  console.log(JSON.stringify(output))
  process.exit(skillMarkedReference && legacyRefs.length === 0 && rootIsPointerOnly && rootHasNoDuplicate && desktopEnvHasSync && syncKeySingleSource ? 0 : 1)
}

void main()
