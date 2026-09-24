import { describe, expect, it } from 'vitest'
import { startWorkerRuntime, type WorkerHost } from './index'
import type { WorkerOutbound } from './protocol'

class FakeHost implements WorkerHost {
  outbound: WorkerOutbound[] = []
  private handler: ((msg: unknown) => void) | null = null
  pid = 42
  postMessage(message: WorkerOutbound) {
    this.outbound.push(message)
  }
  onMessage(handler: (msg: unknown) => void) {
    this.handler = handler
  }
  async push(msg: unknown) {
    await this.handler?.(msg)
  }
}

describe('worker runtime', () => {
  it('sends ready then ack+result for ping', async () => {
    const host = new FakeHost()
    startWorkerRuntime(host, { ping: async () => ({ ok: true }) })
    expect(host.outbound[0]).toMatchObject({ type: 'worker-ready', pid: 42 })
    await host.push({ type: 'capability-invoke', msgId: 'm1', capability: 'ping', payload: {} })
    expect(host.outbound.map((m) => m.type)).toEqual(['worker-ready', 'capability-ack', 'capability-result'])
  })

  it('unknown capability returns honest error', async () => {
    const host = new FakeHost()
    startWorkerRuntime(host, {})
    await host.push({ type: 'capability-invoke', msgId: 'm2', capability: 'image.generate' })
    const last = host.outbound.at(-1)
    expect(last?.type).toBe('capability-error')
    if (last?.type === 'capability-error') expect(last.error.code).toBe('CAPABILITY_NOT_CONFIGURED')
  })
})
