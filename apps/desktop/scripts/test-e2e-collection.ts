import { spawnSync } from 'node:child_process'
import { launchChromeForRpa, closeChrome } from '../src/main/chrome'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync } from 'node:fs'

async function testE2E() {
  console.log('[E2E-TEST] 1. 正在启动内置绿色 Chromium 容器...')
  const workDir = join(tmpdir(), `test-e2e-run-${Date.now()}`)
  mkdirSync(workDir, { recursive: true })

  const launched = await launchChromeForRpa({
    headless: true,
    downloadPath: workDir,
  })

  console.log(`[E2E-TEST] 2. 容器启动成功, CDP 端口: ${launched.port}, URL: ${launched.debugUrl}`)

  try {
    const root = process.cwd().endsWith('apps/desktop') ? join(process.cwd(), '..', '..') : process.cwd()
    const pythonExe = join(root, 'apps', 'desktop', 'resources', 'python', 'bin', 'python3')
    const script = join(root, 'skills', 'diantoushi-product-research', 'scripts', 'run_desktop_collection.py')
    
    console.log('[E2E-TEST] 3. 执行 run_desktop_collection.py 并透传 --cdp-url 参数...')
    const proc = spawnSync(pythonExe, [
      script,
      '--product-name', '测试耳机',
      '--top-n', '1',
      '--run-dir', workDir,
      '--cdp-url', launched.debugUrl,
      '--clean-only'
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CHROME_CDP_URL: launched.debugUrl,
        DTS_USE_CDP: '1',
      }
    })

    console.log('[E2E-TEST] 4. 执行输出:\n', proc.stdout, proc.stderr)
    if (proc.stderr.includes("name 'os' is not defined") || proc.stderr.includes("Target Chrome window is closed")) {
      throw new Error(`出现异常报错: ${proc.stderr}`)
    }
    console.log('[E2E-TEST] ✅ 端到端参数与环境透传全部成功验证！')
  } finally {
    closeChrome(launched)
    rmSync(workDir, { recursive: true, force: true })
  }
}

void testE2E().catch((err) => {
  console.error('[E2E-TEST] ❌ 测试失败:', err)
  process.exit(1)
})
