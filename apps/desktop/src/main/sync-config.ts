export type SyncCategory = 'collection' | 'report' | 'asset'

const SYNC_ENV: Record<SyncCategory, string> = {
  collection: 'SYNC_COLLECTION',
  report: 'SYNC_REPORT',
  asset: 'SYNC_ASSET',
}

export const SYNC_CATEGORIES: readonly SyncCategory[] = ['collection', 'report', 'asset']

export function isSyncEnabled(category: SyncCategory, enabled?: boolean): boolean {
  if (enabled !== undefined) return enabled
  const value = process.env[SYNC_ENV[category]]
  return value === 'true' || value === '1'
}
