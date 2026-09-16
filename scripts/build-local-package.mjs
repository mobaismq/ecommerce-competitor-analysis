import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = join(root, 'dist', 'local-package')

function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

run('pnpm', ['--filter', 'backend', 'build'])
run('pnpm', ['--filter', 'frontend', 'build'])
run('pnpm', ['--filter', 'desktop', 'build'])
run('pnpm', ['--filter', 'desktop', 'build:package'])

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

if (existsSync(join(root, 'apps/frontend', 'dist'))) {
  cpSync(join(root, 'apps/frontend', 'dist'), join(out, 'web'), { recursive: true })
}
if (existsSync(join(root, 'apps/backend', 'dist'))) {
  cpSync(join(root, 'apps/backend', 'dist'), join(out, 'server'), { recursive: true })
}
if (existsSync(join(root, 'apps/desktop', 'dist'))) {
  cpSync(join(root, 'apps/desktop', 'dist'), join(out, 'installer'), { recursive: true })
}

const summary = {
  output: out,
  web: existsSync(join(out, 'web', 'index.html')),
  server: existsSync(join(out, 'server', 'src', 'main.js')),
  installers: existsSync(join(out, 'installer')) ? readdirSync(join(out, 'installer')).filter((name) => name.endsWith('.dmg') || name.endsWith('.exe')) : [],
}
console.log(JSON.stringify(summary))
if (!summary.web || !summary.server || summary.installers.length === 0) process.exit(1)
