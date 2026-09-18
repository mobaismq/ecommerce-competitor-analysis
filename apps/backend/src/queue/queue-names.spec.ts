import { QUEUE_NAMES, resolveQueueName } from './queue-names'

describe('resolveQueueName (任务路由单一权威)', () => {
  it('analysis 处于 collecting/queued 阶段返回 null（等待采集上报）', () => {
    expect(resolveQueueName('analysis', 'collecting')).toBeNull()
    expect(resolveQueueName('analysis', 'queued')).toBeNull()
    expect(resolveQueueName('analysis', undefined)).toBeNull()
  })

  it('analysis 处于 analyzing/reporting 阶段派发 server-report', () => {
    expect(resolveQueueName('analysis', 'analyzing')).toBe(QUEUE_NAMES.serverReport)
    expect(resolveQueueName('analysis', 'reporting')).toBe(QUEUE_NAMES.serverReport)
  })

  it('collection / import 派发 server-report', () => {
    expect(resolveQueueName('collection')).toBe(QUEUE_NAMES.serverReport)
    expect(resolveQueueName('import')).toBe(QUEUE_NAMES.serverReport)
  })

  it('image-gen 与 image_gen 派发 server-image-gen', () => {
    expect(resolveQueueName('image-gen')).toBe(QUEUE_NAMES.serverImageGen)
    expect(resolveQueueName('image_gen')).toBe(QUEUE_NAMES.serverImageGen)
  })

  it('listing 派发 server-listing，其余类型默认 server-ai', () => {
    expect(resolveQueueName('listing')).toBe(QUEUE_NAMES.serverListing)
    expect(resolveQueueName('unknown-type')).toBe(QUEUE_NAMES.serverAi)
  })
})
