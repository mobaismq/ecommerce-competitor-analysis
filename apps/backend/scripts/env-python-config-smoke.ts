import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const backendRoot = resolve(__dirname, '..')
const workspaceRoot = resolve(backendRoot, '..', '..')

const REQUIRED_ENV_KEYS = [
  'PORT',
  'HOST',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'OPENROUTER_API_KEY',
  'TAOBAO_APP_KEY',
  'TAOBAO_APP_SECRET',
  'STORAGE_DRIVER',
  'SYNC_ASSET',
]

async function main() {
  const envExample = readFileSync(join(backendRoot, '.env.example'), 'utf8')
  const envExampleKeys = new Set(
    [...envExample.matchAll(/^#?\s*([A-Z0-9_]+)=/gm)].map((match) => match[1]),
  )
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !envExampleKeys.has(key))

  const requirements = join(workspaceRoot, 'apps/desktop/requirements.txt')
  const requirementsText = existsSync(requirements) ? readFileSync(requirements, 'utf8') : ''
  const hasPlaywrightPinned = /^playwright==[\d.]+/m.test(requirementsText)
  const hasNoPymysql = !requirementsText.includes('pymysql')
  const hasPreparePython = existsSync(join(workspaceRoot, 'apps/desktop/scripts/prepare-python.mjs'))
  const pythonResourcesExist = existsSync(join(workspaceRoot, 'apps/desktop/resources/python'))
  const hasSkillEntry = existsSync(join(workspaceRoot, 'skills/diantoushi-product-research/scripts/run_diantoushi_rpa_cdp.py'))

  const output = {
    env: { required: REQUIRED_ENV_KEYS.length, missingKeys, placeholderKeys: ['OPENROUTER_API_KEY', 'TAOBAO_APP_KEY', 'TAOBAO_APP_SECRET'] },
    python: { hasPlaywrightPinned, hasNoPymysql, hasPreparePython, pythonResourcesExist, hasSkillEntry },
  }
  console.log(JSON.stringify(output))
  const ok =
    missingKeys.length === 0 &&
    hasPlaywrightPinned &&
    hasNoPymysql &&
    hasPreparePython &&
    pythonResourcesExist &&
    hasSkillEntry
  process.exit(ok ? 0 : 1)
}

void main()
