import { spawn } from 'node:child_process'
import { join } from 'node:path'

export interface PythonRunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export interface PythonRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

export function resolveEmbeddedPython(): string {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  const base = process.env.PYTHON_PATH || (resourcesPath ? join(resourcesPath, 'python') : join(process.cwd(), 'resources', 'python'))
  return process.platform === 'win32' ? join(base, 'python.exe') : join(base, 'bin', 'python3')
}

export function runPython(scriptPath: string, args: string[], options: PythonRunOptions = {}): Promise<PythonRunResult> {
  const pythonPath = resolveEmbeddedPython()
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [scriptPath, ...args], {
      cwd: options.cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
        ...options.env,
      },
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }))
  })
}
