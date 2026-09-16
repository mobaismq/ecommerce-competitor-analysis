import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runPython } from '../src/main/python-runner'
import { saveLocalResult } from '../src/main/result-store'

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), 'eca-python-smoke-'))
  const script = join(tmp, 'probe.py')
  writeFileSync(
    script,
    `import json, os, sys
print(json.dumps({"utf8": os.environ.get("PYTHONIOENCODING"), "value": 7, "msg": "中文采集结果"}))`,
    'utf8',
  )

  const result = await runPython(script, [], { cwd: tmp })
  const parsed = JSON.parse(result.stdout.trim().split(/\r?\n/).pop() ?? '{}')
  const resultDir = join(tmp, 'results')
  const savedFile = saveLocalResult(resultDir, 'smoke-job', { parsed, exitCode: result.exitCode })
  const output = { exitCode: result.exitCode, utf8: parsed.utf8, value: parsed.value, savedFile }
  console.log(JSON.stringify(output))
  rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const ok = result.exitCode === 0 && parsed.utf8 === 'utf-8' && parsed.value === 7
  process.exit(ok ? 0 : 1)
}

void main()
