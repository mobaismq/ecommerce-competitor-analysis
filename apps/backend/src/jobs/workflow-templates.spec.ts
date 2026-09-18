import { canTransition, getFlowTemplate } from './workflow-templates'
import { QUEUE_NAMES } from '../queue/queue-names'

describe('canTransition', () => {
  it('允许相邻正向迁移', () => {
    expect(canTransition('analysis', 'queued', 'collecting')).toBe(true)
    expect(canTransition('analysis', 'collecting', 'uploading')).toBe(true)
  })

  it('禁止跳步与回退', () => {
    expect(canTransition('analysis', 'collecting', 'analyzing')).toBe(false) // 跳过 uploading
    expect(canTransition('analysis', 'analyzing', 'uploading')).toBe(false) // 回退
  })

  it('终态不可再迁移', () => {
    for (const type of ['analysis', 'image_gen', 'listing']) {
      for (const terminal of ['success', 'failure', 'cancelled']) {
        expect(canTransition(type, terminal, 'queued')).toBe(false)
      }
    }
  })

  it('未知类型回退到 analysis 序列', () => {
    expect(canTransition('unknown-type', 'queued', 'collecting')).toBe(true)
  })

  it('非法阶段名返回 false', () => {
    expect(canTransition('analysis', 'not-a-stage', 'collecting')).toBe(false)
    expect(canTransition('analysis', 'queued', 'not-a-stage')).toBe(false)
  })
})

describe('getFlowTemplate', () => {
  it('analysis 流程：包含 report 阶段与 finalizerQueue', () => {
    const t = getFlowTemplate('analysis')
    expect(t.name).toBe('analysis-flow')
    expect(t.steps).toHaveLength(1)
    expect(t.steps[0].name).toBe('report')
    expect(t.steps[0].queueName).toBe(QUEUE_NAMES.serverReport)
    expect(t.finalizerQueue).toBe(QUEUE_NAMES.flowFinalizer)
  })

  it('image-gen 流程：包含 generate 阶段与 serverImageGen 队列', () => {
    const t = getFlowTemplate('image-gen')
    expect(t.name).toBe('image-flow')
    expect(t.steps[0].name).toBe('generate')
    expect(t.steps[0].queueName).toBe(QUEUE_NAMES.serverImageGen)
    expect(t.finalizerQueue).toBe(QUEUE_NAMES.flowFinalizer)
  })

  it('image_gen 别名等价', () => {
    const a = getFlowTemplate('image_gen')
    const b = getFlowTemplate('image-gen')
    expect(a.name).toBe(b.name)
    expect(a.steps[0].name).toBe('generate')
  })

  it('listing 流程：包含 submit 阶段与 serverListing 队列', () => {
    const t = getFlowTemplate('listing')
    expect(t.name).toBe('listing-flow')
    expect(t.steps[0].name).toBe('submit')
    expect(t.steps[0].queueName).toBe(QUEUE_NAMES.serverListing)
    expect(t.finalizerQueue).toBe(QUEUE_NAMES.flowFinalizer)
  })
})