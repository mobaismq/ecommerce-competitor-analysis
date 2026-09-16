import type { VideoProvider, VideoReplicationInput, VideoReplicationResult } from './video.types'

export class MockVideoProvider implements VideoProvider {
  readonly type = 'mock'

  async replicate(input: VideoReplicationInput): Promise<VideoReplicationResult> {
    return {
      status: 'success',
      storageKey: `mock-videos/${input.jobId}.mp4`,
      mimeType: 'video/mp4',
      size: 0,
      rawPayload: { kind: 'mock-video-replication', sourceUrl: input.sourceUrl, sourceStorageKey: input.sourceStorageKey },
    }
  }
}
