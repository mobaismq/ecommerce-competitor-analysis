import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schema = resolve(root, 'prisma/schema.prisma')
// 与 main/local-db.ts 的 getLocalDbUrl() 保持一致：本地状态库归内部根 ~/.ecommerce/desktop.db
const base = (process.env.ECOMMERCE_DATA_ROOT || homedir()).replace(/\/+$/, '')
const dbPath = process.env.DESKTOP_DB_URL || 'file:' + join(base, '.ecommerce', 'desktop.db')

mkdirSync(dirname(dbPath.replace(/^file:/, '')), { recursive: true })

const runExecute = (sqlFile) => {
  execFileSync(
    'pnpm',
    ['--filter', 'desktop', 'exec', 'prisma', 'db', 'execute', '--file', sqlFile, '--schema', schema],
    { cwd: root, stdio: 'pipe', env: { ...process.env, DESKTOP_DB_URL: dbPath } },
  )
}

// 目标本地 SQLite 由两段迁移构成，按目标库现状选择，避免 from-empty 整表撞已存在表：
//   - 空库（无 LocalJob）→ 全量 init（采集三表 + 能力表全量）
//   - 已有采集三表但缺能力表（GeneratedAsset）→ 增量 capability_tables（只建能力表）
//   - 能力表已存在 → 已全量迁移，幂等跳过
let state = 'empty'
try {
  const dbFile = dbPath.replace(/^file:/, '')
  if (existsSync(dbFile)) {
    const out = execFileSync(
      'sqlite3',
      [
        dbFile,
        `SELECT CASE WHEN (SELECT count(*) FROM sqlite_master WHERE type='table' AND name='LocalJob')>0 THEN 'has_collection' ELSE 'empty' END || '|' || CASE WHEN (SELECT count(*) FROM sqlite_master WHERE type='table' AND name='GeneratedAsset')>0 THEN 'has_cap' ELSE 'no_cap' END || '|' || CASE WHEN (SELECT count(*) FROM sqlite_master WHERE type='table' AND name='LangGraphCheckpoint')>0 THEN 'has_cp' ELSE 'no_cp' END`,
      ],
      { stdio: 'pipe' },
    )
      .toString()
      .trim()
    state = out
  }
} catch {
  // sqlite3 不可用则回退：直接执行增量（表已存在时走 already-exists 幂等忽略）
  state = 'has_collection|no_cap|no_cp'
}

try {
  const hasCollection = state.includes('has_collection')
  const hasCap = state.includes('has_cap')
  if (!hasCollection) {
    runExecute(resolve(root, 'prisma/migrations/20260912120000_init/migration.sql'))
  } else if (!hasCap) {
    runExecute(resolve(root, 'prisma/migrations/20260924_capability_tables/migration.sql'))
  }
  // 否则已全量迁移，无需再执行
  // 增量能力迁移已就绪后，单独补 checkpoint 表（LangGraph 断点续跑），幂等跳过已存在
  if (!state.includes('has_cp')) {
    runExecute(resolve(root, 'prisma/migrations/20260925_langgraph_checkpoint/migration.sql'))
  }
} catch (e) {
  const msg = String(e?.stderr || e?.stdout || e?.message || '')
  if (msg.includes('already exists')) {
    // 表已存在，幂等忽略
  } else {
    throw e
  }
}