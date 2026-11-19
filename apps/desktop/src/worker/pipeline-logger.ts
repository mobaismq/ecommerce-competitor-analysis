import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { workerDataRoots } from './worker-db'

const MAX_LOG_BYTES = 5 * 1024 * 1024

/** Returns the log file path under the app internal data directory (safe to share for diagnosis). */
export function getPipelineLogPath(): string {
  return join(workerDataRoots().internalRoot, 'logs', 'report-image-pipeline.log')
}

/** Only emit and persist pipeline trace logs in local dev/test environments, never in packaged production builds. */
export function isPipelineLoggingEnabled(): boolean {
  if (process.env.ECOMMERCE_IS_DEV === '0') return false
  if (process.env.ECOMMERCE_IS_DEV === '1') return true
  if (__dirname.includes('app.asar')) return false
  return Boolean(process.env.VITEST || process.env.ELECTRON_RENDERER_URL || process.env.NODE_ENV !== 'production')
}

/**
 * Append a structured trace line for the image-parsing & report pipeline.
 * Writes both to stdout/stderr (for dev) and a rotating local file (only when local dev/test logging is enabled).
 * Never log raw base64 image payloads here.
 */
export function logPipeline(stage: string, message: string, meta?: Record<string, unknown>, level: 'info' | 'warn' | 'error' = 'info'): void {
  if (!isPipelineLoggingEnabled()) return
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] [${stage}] ${message}${meta ? ` ${JSON.stringify(meta)}` : ''}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
  try {
    const file = getPipelineLogPath()
    mkdirSync(join(file, '..'), { recursive: true })
    if (existsSync(file) && statSync(file).size > MAX_LOG_BYTES) {
      renameSync(file, `${file}.1`)
    }
    appendFileSync(file, `${line}\n`, 'utf8')
  } catch {
    // Logging must never break report generation.
  }
}

