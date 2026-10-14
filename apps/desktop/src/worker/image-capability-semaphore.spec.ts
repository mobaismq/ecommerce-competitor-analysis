import { describe, expect, it } from 'vitest'
import { Semaphore, MAX_CONCURRENT_IMAGE_GENERATIONS } from './image-capability'

describe('Semaphore（生图并发闸，纯并发控制逻辑）', () => {
  it('限制并发数不超过 limit', async () => {
    const semaphore = new Semaphore(3)
    let running = 0
    let peak = 0
    const tasks = Array.from({ length: 10 }, () =>
      semaphore.run(async () => {
        running += 1
        peak = Math.max(peak, running)
        // 模拟真实生图耗时（不触碰外部服务）
        await new Promise((resolve) => setTimeout(resolve, 20))
        running -= 1
      }),
    )
    await Promise.all(tasks)
    expect(peak).toBeLessThanOrEqual(3)
    expect(running).toBe(0)
  })

  it('并发闸默认上限为 5（用户确认 4-5）', () => {
    expect(MAX_CONCURRENT_IMAGE_GENERATIONS).toBe(5)
  })

  it('任务异常后仍释放信号量，后续任务可继续', async () => {
    const semaphore = new Semaphore(1)
    const results: string[] = []
    const first = semaphore.run(async () => {
      throw new Error('模拟单图失败')
    }).catch((err: unknown) => String((err as Error).message))
    const second = semaphore.run(async () => 'ok')
    results.push(await first, await second)
    expect(results).toEqual(['模拟单图失败', 'ok'])
  })
})