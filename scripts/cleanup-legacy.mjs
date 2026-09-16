import { existsSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const apply = process.argv.includes('--apply')

const targets = [
  'apps/legacy/package.json',
  'apps/legacy/package-lock.json',
  'apps/legacy/node_modules',
  'apps/legacy/.env.local',
  'apps/legacy/index.html',
  'apps/legacy/vite.config.js',
  'apps/legacy/vite.config.mjs',
  'apps/legacy/vite.config.ts',
  'apps/legacy/src',
  'apps/legacy/public',
  'apps/backend/server.js',
]

const planned = targets.filter((target) => existsSync(join(root, target)))
const output = { mode: apply ? 'delete' : 'dry-run', planned }
console.log(JSON.stringify(output))

if (apply) {
  for (const target of planned) {
    rmSync(join(root, target), { recursive: true, force: true })
  }
}
