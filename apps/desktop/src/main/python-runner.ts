import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface PythonRunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  onStdout?: (text: string) => void
  onStderr?: (text: string) => void
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
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM')
    else child.kill('SIGTERM')
  } catch {
    /* 子进程可能已退出 */
  }
  return true
}

export function resolveEmbeddedPython(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH

  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  const getExe = (base: string) => process.platform === 'win32' ? join(base, 'python.exe') : join(base, 'bin', 'python3')

  // 1. 打包生产模式：优先检查 resourcesPath/python
  if (resourcesPath) {
    const packagedExe = getExe(join(resourcesPath, 'python'))
    if (existsSync(packagedExe)) return packagedExe
  }

  // 2. 本地开发模式：遍历源码工程下的候选路径
  const devCandidates = [
    join(process.cwd(), 'apps', 'desktop', 'resources', 'python'),
    join(process.cwd(), 'resources', 'python'),
    resolve(__dirname, '..', '..', 'resources', 'python'),
    resolve(__dirname, '..', 'resources', 'python'),
  ]

  for (const candidate of devCandidates) {
    const exe = getExe(candidate)
    if (existsSync(exe)) return exe
  }

  // 3. 兜底回退：系统全局 Python
  return process.platform === 'win32' ? 'python' : 'python3'
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
      detached: process.platform !== 'win32',
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
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => { stdout += chunk; options.onStdout?.(chunk) })
    child.stderr?.on('data', (chunk: string) => { stderr += chunk; options.onStderr?.(chunk) })
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
