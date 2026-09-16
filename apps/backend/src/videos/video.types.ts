export interface VideoReplicationInput {
  jobId: string
  sourceUrl?: string
  sourceStorageKey?: string
  title?: string
}

export interface VideoReplicationResult {
  status: 'success' | 'failure'
  storageKey?: string
  mimeType?: string
  size?: number
  rawPayload?: unknown
  error?: string
}

export interface VideoProvider {
  readonly type: string
  replicate(input: VideoReplicationInput): Promise<VideoReplicationResult>
}
