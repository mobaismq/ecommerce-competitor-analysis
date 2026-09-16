import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentRuntime } from '../src/main/agent-runtime'

async function main() {
  const runtime = new AgentRuntime()
  const tmp = mkdtempSync(join(tmpdir(), 'eca-agent-runtime-'))
  const script = join(tmp, 'sleep.py')
  writeFileSync(script, 'import time\ntime.sleep(30)\nprint("done")', 'utf8')

  let mutexRejected = false
  const running = runtime.start('job-a', script, [], join(tmp, 'work'))
  try {
    runtime.start('job-b', script, [], join(tmp, 'work-b'))
  } catch {
    mutexRejected = true
  }

  await new Promise((r) => setTimeout(r, 500))
  const cancelled = runtime.cancel()
  const result = await running

  console.log(JSON.stringify({ mutexRejected, cancelled, exitCode: result.exitCode }))
  rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  const ok = mutexRejected && cancelled && result.exitCode !== 0
  process.exit(ok ? 0 : 1)
}

void main()
