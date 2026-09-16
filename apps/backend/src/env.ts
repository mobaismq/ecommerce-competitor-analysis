import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    if (process.env[key] == null) {
      process.env[key] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  }
}

export function loadBackendEnv() {
  loadEnvFile(join(process.cwd(), '.env'))
}
