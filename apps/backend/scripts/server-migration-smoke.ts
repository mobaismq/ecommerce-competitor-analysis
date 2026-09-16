import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

const MAPPING: Array<[string, string]> = [
  ['apps/legacy/src/server/taobaoTopClient.js', 'apps/backend/src/platform/providers/taobao.adapter.ts'],
  ['apps/legacy/src/server/aiMarketAnalysis.js', 'apps/backend/src/reports/report.service.ts'],
  ['apps/legacy/src/server/mainImagePromptExpansion.js', 'apps/backend/src/images/image.service.ts'],
  ['apps/legacy/src/server/arkImageGeneration.js', 'apps/backend/src/images/image.service.ts'],
  ['apps/legacy/src/server/accountManagement.js', 'apps/backend/src/admin/user.service.ts'],
  ['apps/legacy/src/server/roleManagement.js', 'apps/backend/src/admin/role.service.ts'],
  ['apps/legacy/src/server/storeManagement.js', 'apps/backend/src/admin/store.service.ts'],
  ['apps/legacy/src/server/platformManagement.js', 'apps/backend/src/admin/platform.service.ts'],
  ['apps/legacy/src/server/deptManagement.js', 'apps/backend/src/admin/department.service.ts'],
  ['apps/legacy/src/server/menuManagement.js', 'apps/backend/src/admin/permission.controller.ts'],
  ['apps/legacy/src/server/deepseekVisionBridge.py', 'apps/backend/src/ai/providers/openai-compatible.provider.ts'],
]

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js')))
    .map((entry) => join(entry.parentPath, entry.name))
}

async function main() {
  const oldFiles = MAPPING.map(([old]) => old)
  const missingOld = oldFiles.filter((file) => !existsSync(join(workspaceRoot, file)))
  const missingNew = MAPPING.filter(([, migrated]) => !existsSync(join(workspaceRoot, migrated))).map(([old]) => old)

  const backendSources = walk(join(backendRoot, 'src'))
  const legacyImports = backendSources
    .map((file) => readFileSync(file, 'utf8'))
    .filter((source) => source.includes('apps/legacy/src/server') || source.includes("../legacy/"))
  const backendRefsLegacy = legacyImports.length > 0

  const output = {
    mappings: MAPPING.length,
    missingOld,
    missingNew,
    backendRefsLegacy,
    backendSourceCount: backendSources.length,
  }
  console.log(JSON.stringify(output))
  const ok = missingOld.length === 0 && missingNew.length === 0 && !backendRefsLegacy
  process.exit(ok ? 0 : 1)
}

void main()
