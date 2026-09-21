import { spawn, type ChildProcess } from 'node:child_process'
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

/** 按任务标识登记正在运行的 Python 子进程，供取消时强制终止（不阻塞）。 */
const activeChildren = new Map<string, ChildProcess>()

export function killPythonProcesses(key: string): boolean {
  const child = activeChildren.get(key)
  if (!child) return false
  activeChildren.delete(key)
  try {
    child.kill('SIGTERM')
  } catch {
    /* 子进程可能已退出 */
  }
  return true
}

export function resolveEmbeddedPython(): string {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  const base = process.env.PYTHON_PATH || (resourcesPath ? join(resourcesPath, 'python') : join(process.cwd(), 'resources', 'python'))
  return process.platform === 'win32' ? join(base, 'python.exe') : join(base, 'bin', 'python3')
}

export function runPython(scriptPath: string, args: string[], options: PythonRunOptions = {}): Promise<PythonRunResult> {
  return runPythonTracked(scriptPath, args, options, '')
}

/** 可取消的 Python 执行：以 key 登记子进程，可通过 killPythonProcesses(key) 终止。 */
export function runPythonTracked(scriptPath: string, args: string[], options: PythonRunOptions = {}, key: string): Promise<PythonRunResult> {
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
    if (key) activeChildren.set(key, child)
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    child.on('error', (error) => {
      if (key) activeChildren.delete(key)
      reject(error)
    })
    child.on('close', (code) => {
      if (key) activeChildren.delete(key)
      resolve({ exitCode: code ?? -1, stdout, stderr })
    })
  })
}
