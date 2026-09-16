import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSyncEnabled, type SyncCategory } from './sync-config'

export function saveLocalResult(resultDir: string, jobId: string, result: unknown) {
  mkdirSync(resultDir, { recursive: true })
  const filePath = join(resultDir, `${jobId}.json`)
  writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8')
  return filePath
}

export interface SubmitSyncOptions {
  category: SyncCategory
  enabled?: boolean
  baseUrl?: string
}

export async function submitResultIfSyncEnabled(jobId: string, result: unknown, options: SubmitSyncOptions) {
  const enabled = isSyncEnabled(options.category, options.enabled)
  const baseUrl = options.baseUrl ?? process.env.SYNC_BASE_URL
  if (!enabled || !baseUrl) return { submitted: false, location: 'local-only' }
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/collection-jobs/${jobId}/results`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(result),
  })
  return { submitted: response.ok, location: 'server', status: response.status }
}
