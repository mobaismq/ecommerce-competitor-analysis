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
  it('analysis 流程：collect 嵌套于 analyze 之下（RPA 在叶子）', () => {
    const t = getFlowTemplate('analysis')
    expect(t.name).toBe('analysis-flow')
    const report = t.children![0]!
    const analyze = report.children![0]!
    const collect = analyze.children![0]!
    expect(collect.name).toBe('collect')
    expect(collect.queueName).toBe(QUEUE_NAMES.desktopRpa)
  })

  it('image-gen 流程：prompt → generate → review 逐层嵌套', () => {
    const t = getFlowTemplate('image-gen')
    const review = t.children![0]!
    const generate = review.children![0]!
    const prompt = generate.children![0]!
    expect(prompt.name).toBe('prompt')
    expect(prompt.queueName).toBe(QUEUE_NAMES.serverAi)
  })

  it('image_gen 别名等价', () => {
    const a = getFlowTemplate('image_gen')
    const b = getFlowTemplate('image-gen')
    expect(a.name).toBe(b.name)
    expect(a.children![0]!.children![0]!.children![0]!.name).toBe('prompt')
  })

  it('listing 流程：upload-assets 嵌套于 submit 之下', () => {
    const t = getFlowTemplate('listing')
    expect(t.name).toBe('listing-flow')
    const submit = t.children![0]!
    expect(submit.children![0]!.name).toBe('upload-assets')
    expect(submit.children![0]!.queueName).toBe(QUEUE_NAMES.serverImageGen)
  })
})