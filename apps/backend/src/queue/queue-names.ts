export const QUEUE_NAMES = {
  serverAi: 'server-ai',
  serverReport: 'server-report',
  serverImageGen: 'server-image-gen',
  serverListing: 'server-listing',
  flowFinalizer: 'flow-finalizer',
} as const

export const ALL_QUEUE_NAMES = Object.values(QUEUE_NAMES)

/**
 * 任务路由单一权威判定：由 Job.type(+checkpointStage) 解析目标调度队列。
 * 唯一实现点，供 job.service、LocalJobQueueService 恢复/归一化、workflow 共同复用，
 * 杜绝多处分叉导致的路由不一致。
 * - analysis 仅在已进入 analyzing/reporting 阶段才派发 server-report；collecting/queued
 *   阶段返回 null，等待桌面端采集结果经 collection-job.service 推进后再派发。
 */
export function resolveQueueName(type: string, stage?: string | null): string | null {
  if (type === 'analysis') {
    if (stage === 'analyzing' || stage === 'reporting') return QUEUE_NAMES.serverReport
    return null
  }
  if (type === 'collection' || type === 'import') return QUEUE_NAMES.serverReport
  if (type === 'image-gen' || type === 'image_gen') return QUEUE_NAMES.serverImageGen
  if (type === 'listing') return QUEUE_NAMES.serverListing
  return QUEUE_NAMES.serverAi
}
