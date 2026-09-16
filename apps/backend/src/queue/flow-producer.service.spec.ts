import type { FlowProducer } from 'bullmq'
import { FlowProducerService } from './flow-producer.service'

describe('FlowProducerService', () => {
  it('add 透传给底层 FlowProducer', async () => {
    const flowProducer = { add: jest.fn().mockResolvedValue({ id: 'f1' }) } as unknown as FlowProducer
    const svc = new FlowProducerService(flowProducer)
    const flow = { name: 'analysis-flow' } as never
    await expect(svc.add(flow)).resolves.toEqual({ id: 'f1' })
    expect(flowProducer.add).toHaveBeenCalledWith(flow)
  })

  it('getFlowProducer 返回底层实例', () => {
    const flowProducer = {} as FlowProducer
    const svc = new FlowProducerService(flowProducer)
    expect(svc.getFlowProducer()).toBe(flowProducer)
  })
})