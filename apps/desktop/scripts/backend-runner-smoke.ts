/**
 * Phase 3 实测：BackendRunner 嵌入式拉起编译后的后端（新端口），注入临时两树数据根，
 * 验证 /health 就绪、数据根目录被创建、stop 后端口释放。结果写到 /tmp/eca-backend-runner-result.json 并同步 stderr。
 * 运行：pnpm --filter desktop tsx scripts/backend-runner-smoke.ts
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BackendRunner } from '../src/main/backend-runner'

const RESULT_FILE = '/tmp/eca-backend-runner-result.json'

function loadBackendEnvIntoProcess(): void {
  const envFile = join(process.cwd(), '..', 'backend', '.env')
  if (!existsSync(envFile)) return
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const key = t.slice(0, i).trim()
    if (process.env[key] == null) process.env[key] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
  }
}

async function run(): Promise<number> {
  loadBackendEnvIntoProcess()
  const entry = join(process.cwd(), '..', 'backend', 'dist', 'src', 'main.js')
  if (!existsSync(entry)) throw new Error(`后端入口不存在: ${entry}`)
  const tmp = mkdtempSync(join(tmpdir(), 'eca-backend-'))
  const port = 18999
  const runner = new BackendRunner({
    entry,
    port,
    dataRoot: tmp,
    storageDriver: 'local',
    startupTimeoutMs: 45_000,
    onLog: (line) => process.stderr.write(line + '\n'),
  })

  let output: Record<string, unknown>
  let ok = false
  try {
    const started = await runner.start()
    const res = await fetch(`http://127.0.0.1:${port}/api/health`)
    const body = (await res.json()) as { ok?: boolean }
    const layoutCreated = existsSync(join(tmp, '.ecommerce', 'layout.json'))
    const userRootCreated = existsSync(join(tmp, 'ecommerce', 'users'))
    await runner.stop()
    let released = true
    try {
      await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) })
      released = false
    } catch {
      released = true
    }
    output = {
      mode: started.mode,
      baseUrl: started.baseUrl,
      healthOk: res.ok && body.ok === true,
      dataRootInjected: layoutCreated && userRootCreated,
      releasedAfterStop: released,
    }
    ok = started.mode === 'embedded' && (output.healthOk as boolean) && layoutCreated && userRootCreated && released
    const fileOk = output.healthOk === true && layoutCreated && userRootCreated && released
    writeFileSync(RESULT_FILE, JSON.stringify(output) + '\n', 'utf8')
    // 退出清理：先 stop 后 child 已停，此处 rm tmp
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    return ok ? 0 : 1
  } catch (error) {
    writeFileSync(RESULT_FILE, JSON.stringify({ ok: false, error: String(error) }) + '\n', 'utf8')
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    await runner.stop()
    return 1
  }
}

// 看门狗：60s 超时强制退出，避免挂起无输出
setTimeout(() => {
  writeFileSync(RESULT_FILE, JSON.stringify({ ok: false, error: 'watchdog timeout' }) + '\n', 'utf8')
  process.exit(2)
}, 60_000)

run()
  .then((code) => process.exit(code))
  .catch((error) => {
    writeFileSync(RESULT_FILE, JSON.stringify({ ok: false, error: String(error) }) + '\n', 'utf8')
    process.exit(1)
  })