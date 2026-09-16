import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

async function main() {
  const workspace = readFileSync(resolve(workspaceRoot, 'pnpm-workspace.yaml'), 'utf8')
  const workspaceExcludesLegacy = workspace.includes('!apps/legacy')
  const cleanupOutput = execFileSync('node', ['scripts/cleanup-legacy.mjs', '--dry-run'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  })
  const plan = JSON.parse(cleanupOutput.trim()) as { mode: string; planned: string[] }
  const plannedLegacyManifest =
    plan.planned.includes('apps/legacy/package.json') && plan.planned.includes('apps/legacy/package-lock.json')
  const appsExist = ['frontend', 'backend', 'desktop'].every(
    (name) => existsSync(resolve(workspaceRoot, 'apps', name, 'package.json')),
  )
  const output = {
    appsExist,
    workspaceExcludesLegacy,
    cleanupPlan: plan.planned,
    plannedLegacyManifest,
  }
  console.log(JSON.stringify(output))
  process.exit(output.appsExist && output.workspaceExcludesLegacy && plannedLegacyManifest ? 0 : 1)
}

void main()
