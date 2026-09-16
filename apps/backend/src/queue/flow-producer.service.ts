import { Injectable } from '@nestjs/common'
import { InjectFlowProducer } from '@nestjs/bullmq'
import type { FlowProducer, FlowJob } from 'bullmq'

export const FLOW_PRODUCER_NAME = 'flow-producer'

@Injectable()
export class FlowProducerService {
  constructor(@InjectFlowProducer(FLOW_PRODUCER_NAME) private readonly flowProducer: FlowProducer) {}

  add(flow: FlowJob) {
    return this.flowProducer.add(flow)
  }

  getFlowProducer() {
    return this.flowProducer
  }
}
