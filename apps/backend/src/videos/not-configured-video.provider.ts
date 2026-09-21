import type { VideoProvider, VideoReplicationInput, VideoReplicationResult } from './video.types'

/** 生成「未接入」的错误信息，供 registry.create 与 provider.replicate 复用。 */
export function notConfiguredVideoError(name: string): Error {
  return new Error(`视频生成服务「${name}」未接入，请在 VIDEO_PROVIDER 配置真实服务或使用 mock`)
}

/** 占位 Provider：真实服务未接入时明确报错，绝不返回假 mp4。 */
export class NotConfiguredVideoProvider implements VideoProvider {
  readonly type: string

  constructor(name: string) {
    this.type = name
  }

  async replicate(_input: VideoReplicationInput): Promise<VideoReplicationResult> {
    throw notConfiguredVideoError(this.type)
  }
}