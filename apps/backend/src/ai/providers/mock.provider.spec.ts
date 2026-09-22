import { MockAiProvider } from './mock.provider'

describe('MockAiProvider · 图像诚实空态', () => {
  it('不伪造 mock:// 图片 URL，返回空 images', async () => {
    const result = await new MockAiProvider().generateImage({ prompt: 'p', count: 2 })
    expect(result.images).toEqual([])
    expect(result.rawPayload).toEqual(expect.objectContaining({ kind: 'mock-image', fake: true }))
  })
})
