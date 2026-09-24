import { describe, expect, it } from 'vitest'
import { WorkerManager, type UtilityChild } from './worker-manager'

class FakeChild implements UtilityChild {
  pid = 7
  listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  sent: unknown[] = []
  killed = false
  postMessage(message: unknown) {
    this.sent.push(message)
  }
  on(event: 'message' | 'exit', listener: (...args: unknown[]) => void) {
    const list = this.listeners.get(event) ?? []
    list.push(listener)
    this.listeners.set(event, list)
  }
  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args)
  }
  kill() {
    this.killed = true
  }
}

describe('WorkerManager', () => {
  it('fork → ready → invoke result', async () => {
    const child = new FakeChild()
    const manager = new WorkerManager({ entry: '/fake.js', restartDelayMs: 10_000, forkImpl: () => child })
    manager.start()
    child.emit('message', { type: 'worker-ready', pid: 7 })
    expect(manager.isReady).toBe(true)
    const pending = manager.invoke('ping')
    const invoke = child.sent[0] as { msgId: string }
    child.emit('message', { type: 'capability-result', msgId: invoke.msgId, capability: 'ping', result: { ok: true } })
    await expect(pending).resolves.toEqual({ ok: true })
  })

  it('stop kills child and rejects in-flight', async () => {
    const child = new FakeChild()
    const manager = new WorkerManager({ entry: '/fake.js', forkImpl: () => child })
    manager.start()
    child.emit('message', { type: 'worker-ready' })
    const pending = manager.invoke('ping')
    manager.stop()
    expect(child.killed).toBe(true)
    await expect(pending).rejects.toThrow('已停止')
  })

  it('forwards capability-stream events to onStream', async () => {
    const child = new FakeChild()
    const manager = new WorkerManager({ entry: '/fake.js', forkImpl: () => child })
    manager.start()
    child.emit('message', { type: 'worker-ready' })
    const streamed: unknown[] = []
    const pending = manager.invoke('ping', {}, { onStream: (event) => streamed.push(event) })
    const invoke = child.sent[0] as { msgId: string }
    child.emit('message', { type: 'capability-stream', msgId: invoke.msgId, capability: 'ping', event: { type: 'content', text: 'hi' } })
    child.emit('message', { type: 'capability-result', msgId: invoke.msgId, capability: 'ping', result: { ok: true } })
    await pending
    expect(streamed).toEqual([{ type: 'content', text: 'hi' }])
  })
})
