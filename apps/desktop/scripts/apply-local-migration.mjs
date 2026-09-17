import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schema = resolve(root, 'prisma/schema.prisma')
const sql = resolve(root, 'prisma/migrations/20260912120000_init/migration.sql')
const dbPath = process.env.DESKTOP_DB_URL || 'file:' + resolve(root, 'data/desktop.db')

mkdirSync(dirname(dbPath.replace(/^file:/, '')), { recursive: true })
try {
  execFileSync('pnpm', ['--filter', 'desktop', 'exec', 'prisma', 'db', 'execute', '--file', sql, '--schema', schema], {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, DESKTOP_DB_URL: dbPath },
  })
} catch (e) {
  const msg = String(e?.stderr || e?.stdout || e?.message || '')
  if (msg.includes('already exists')) {
    // 表已存在，幂等忽略
  } else {
    throw e
  }
}

