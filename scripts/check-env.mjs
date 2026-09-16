import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { arch, platform } from 'node:process'

const root = resolve(new URL('..', import.meta.url).pathname)
const results = []

function pnpmBin() {
  return platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

function run(command, args, options = {}) {
  const env = { ...process.env, ...options.env }
  delete env.ELECTRON_RUN_AS_NODE
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
    env,
  }).trim()
}

function record(name, ok, detail) {
  results.push({ name, ok, detail })
}

record('Node.js', Boolean(process.version), process.version)

try {
  record('pnpm', true, run(pnpmBin(), ['--version']))
} catch {
  record('pnpm', false, 'not found')
}

const workspace = execFileSync('cat', [join(root, 'pnpm-workspace.yaml')], { encoding: 'utf8' })
record('workspace apps glob', workspace.includes('apps/*'), 'pnpm-workspace.yaml')

try {
  record('Electron', true, run(pnpmBin(), ['--filter', 'desktop', 'exec', 'electron', '--version']))
} catch {
  record('Electron', false, 'electron binary not available')
}

const pythonPath = platform === 'win32'
  ? join(root, 'apps/desktop/resources/python/python.exe')
  : join(root, 'apps/desktop/resources/python/bin/python3')
if (existsSync(pythonPath)) {
  try {
    const version = run(pythonPath, ['--version'], { env: { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } })
    const utf8 = run(pythonPath, ['-c', 'print("中文路径: ok")'], { env: { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } })
    record('embedded Python', true, `${version} / ${utf8}`)
  } catch (error) {
    record('embedded Python', false, String(error))
  }
} else {
  record('embedded Python', false, pythonPath)
}

record('skills dir', existsSync(join(root, 'skills')), join(root, 'skills'))

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]
const chrome = chromeCandidates.find(existsSync)
record('system Chrome', Boolean(chrome), chrome ?? 'not found')

try {
  run(pnpmBin(), ['exec', 'prisma', 'validate', '--schema', join(root, 'apps/desktop/prisma/schema.prisma')], {
    cwd: join(root, 'apps/desktop'),
    env: { DESKTOP_DB_URL: `file:${join(root, 'apps/desktop/data/desktop.db')}` },
  })
  record('Prisma schema', true, 'desktop schema valid')
} catch {
  record('Prisma schema', false, 'validate failed')
}

try {
  const docker = run('docker', ['compose', 'ps'], { cwd: root })
  const healthy = /Up|healthy/.test(docker)
  record('Docker MySQL/Redis', healthy, healthy ? 'compose services up' : 'compose services not ready')
} catch {
  record('Docker MySQL/Redis', false, 'docker compose unavailable')
}

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}: ${result.detail}`)
}

if (results.some((result) => !result.ok)) process.exit(1)
console.log(`check-env done: ${results.filter((r) => r.ok).length}/${results.length}`)
