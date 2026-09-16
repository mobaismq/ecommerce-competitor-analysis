export const COLLECTION_MODES = ['download-only', 'download-and-import', 'import-only'] as const
export type CollectionMode = (typeof COLLECTION_MODES)[number]

export interface CollectionStage {
  name: string
  status: 'pending' | 'running' | 'done' | 'skipped'
  detail?: string
}

export interface CollectionPlan {
  mode: CollectionMode
  stages: CollectionStage[]
}

export function isValidCollectionMode(value: unknown): value is CollectionMode {
  return typeof value === 'string' && (COLLECTION_MODES as readonly string[]).includes(value)
}

export function assertCollectionMode(value: unknown): CollectionMode {
  if (!isValidCollectionMode(value)) {
    throw new Error(`invalid collection mode: ${String(value)}; expected one of ${COLLECTION_MODES.join(', ')}`)
  }
  return value
}

export function buildCollectionPlan(mode: CollectionMode): CollectionPlan {
  const stages: CollectionStage[] = []
  if (mode === 'download-only' || mode === 'download-and-import') {
    stages.push({ name: 'download', status: 'pending' })
  }
  stages.push({ name: 'collect-files', status: 'pending', detail: mode === 'import-only' ? 'existing export files' : 'downloaded files' })
  if (mode === 'download-and-import' || mode === 'import-only') {
    stages.push({ name: 'import', status: 'pending' })
  }
  stages.push({ name: 'sync', status: 'pending' })
  return { mode, stages }
}
