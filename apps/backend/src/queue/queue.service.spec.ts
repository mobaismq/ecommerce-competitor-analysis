import type { Queue } from 'bullmq'
import { QUEUE_NAMES } from './queue-names'
import { QueueService } from './queue.service'

const fakeQueue = (name: string) => ({ name, add: jest.fn() })

describe('QueueService', () => {
  const qRpa = fakeQueue(QUEUE_NAMES.desktopRpa)
  const qAi = fakeQueue(QUEUE_NAMES.serverAi)
  const qReport = fakeQueue(QUEUE_NAMES.serverReport)
  const qImage = fakeQueue(QUEUE_NAMES.serverImageGen)
  const qListing = fakeQueue(QUEUE_NAMES.serverListing)
  const qFinal = fakeQueue(QUEUE_NAMES.flowFinalizer)

  const svc = new QueueService(
    qRpa as unknown as Queue,
    qAi as unknown as Queue,
    qReport as unknown as Queue,
    qImage as unknown as Queue,
    qListing as unknown as Queue,
    qFinal as unknown as Queue,
  )

  it('按队列名取到对应注入的 Queue 实例', () => {
    expect(svc.getQueue(QUEUE_NAMES.desktopRpa)).toBe(qRpa)
    expect(svc.getQueue(QUEUE_NAMES.serverAi)).toBe(qAi)
    expect(svc.getQueue(QUEUE_NAMES.serverReport)).toBe(qReport)
    expect(svc.getQueue(QUEUE_NAMES.serverImageGen)).toBe(qImage)
    expect(svc.getQueue(QUEUE_NAMES.serverListing)).toBe(qListing)
    expect(svc.getQueue(QUEUE_NAMES.flowFinalizer)).toBe(qFinal)
  })

  it('未知队列名抛错', () => {
    expect(() => svc.getQueue('no-such-queue')).toThrow('unknown queue')
  })

  it('addJob 把任务投递到对应队列', () => {
    svc.addJob(QUEUE_NAMES.serverAi, { prompt: 'hi' }, { jobId: 'abc' })
    expect(qAi.add).toHaveBeenCalledWith(QUEUE_NAMES.serverAi, { prompt: 'hi' }, { jobId: 'abc' })
  })

  it('addJob 不带 options 也正常', () => {
    svc.addJob(QUEUE_NAMES.desktopRpa, { url: 'https://x' })
    expect(qRpa.add).toHaveBeenCalledWith(QUEUE_NAMES.desktopRpa, { url: 'https://x' }, undefined)
  })
})