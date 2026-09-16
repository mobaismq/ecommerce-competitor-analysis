import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue, JobsOptions } from 'bullmq'
import { QUEUE_NAMES } from './queue-names'

@Injectable()
export class QueueService {
  private readonly queues: Record<string, Queue>

  constructor(
    @InjectQueue(QUEUE_NAMES.desktopRpa) desktopRpa: Queue,
    @InjectQueue(QUEUE_NAMES.serverAi) serverAi: Queue,
    @InjectQueue(QUEUE_NAMES.serverReport) serverReport: Queue,
    @InjectQueue(QUEUE_NAMES.serverImageGen) serverImageGen: Queue,
    @InjectQueue(QUEUE_NAMES.serverListing) serverListing: Queue,
    @InjectQueue(QUEUE_NAMES.flowFinalizer) flowFinalizer: Queue,
  ) {
    this.queues = {
      [QUEUE_NAMES.desktopRpa]: desktopRpa,
      [QUEUE_NAMES.serverAi]: serverAi,
      [QUEUE_NAMES.serverReport]: serverReport,
      [QUEUE_NAMES.serverImageGen]: serverImageGen,
      [QUEUE_NAMES.serverListing]: serverListing,
      [QUEUE_NAMES.flowFinalizer]: flowFinalizer,
    }
  }

  getQueue(name: string): Queue {
    const queue = this.queues[name]
    if (!queue) throw new Error(`unknown queue: ${name}`)
    return queue
  }

  addJob(name: string, data: unknown, options?: JobsOptions) {
    return this.getQueue(name).add(name, data, options)
  }

  getQueueNames() {
    return QUEUE_NAMES
  }
}
