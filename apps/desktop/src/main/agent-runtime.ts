import { spawn, type ChildProcess } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolveEmbeddedPython } from './python-runner'

interface ActiveTask {
  jobId: string
  child: ChildProcess
  tmpDir: string
}

export class AgentRuntime {
  private active: ActiveTask | null = null

  get activeTask() {
    return this.active
  }

  start(jobId: string, scriptPath: string, args: string[], tmpDir: string) {
    if (this.active) {
      throw new Error(`single task mutex: job ${this.active.jobId} still running`)
    }
    const child = spawn(resolveEmbeddedPython(), [scriptPath, ...args], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    })
    this.active = { jobId, child, tmpDir }
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()))

    return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
      child.on('close', (code) => {
        const result = { exitCode: code ?? -1, stdout, stderr }
        this.active = null
        rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
        resolve(result)
      })
    })
  }

  cancel() {
    if (!this.active) return false
    this.active.child.kill('SIGTERM')
    return true
  }
}
