import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.mjs')))
    .map((entry) => join(entry.parentPath, entry.name))
}

async function main() {
  const legacyEntries = ['apps/legacy/server/index.js', 'apps/legacy/server/apiHandler.js', 'apps/backend/server.js']
  const legacyEntriesExist = legacyEntries.every((file) => existsSync(join(workspaceRoot, file)))
  const backendPackage = JSON.parse(readFileSync(join(backendRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  const usesNewMain = backendPackage.scripts.start === 'node dist/src/main.js'
  const usesNewWorker = backendPackage.scripts.worker === 'node dist/src/worker.js'
  const sources = sourceFiles(join(backendRoot, 'src'))
  const legacyRefs = sources.filter((file) => /apps\/backend\/server\.js|apps\/legacy\/server/.test(readFileSync(file, 'utf8')))

  const output = { legacyEntriesExist, usesNewMain, usesNewWorker, legacyRefs: legacyRefs.length, legacyEntries }
  console.log(JSON.stringify(output))
  process.exit(legacyEntriesExist && usesNewMain && usesNewWorker && legacyRefs.length === 0 ? 0 : 1)
}

void main()
