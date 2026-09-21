import { resolveAdapterCode } from './adapter-resolve'
import { buildItemAddParams, isRealTopConfig, TaobaoAdapter } from './providers/taobao.adapter'
import type { PlatformListingInput } from './platform.types'

describe('resolveAdapterCode (getAdapter 平台回落)', () => {
  const registered = ['taobao', 'mock']

  it('已注册码用原码', () => {
    expect(resolveAdapterCode('taobao', registered)).toBe('taobao')
    expect(resolveAdapterCode('mock', registered)).toBe('mock')
    expect(resolveAdapterCode('TAOBAO', registered)).toBe('taobao')
  })

  it('tmall 回落 taobao（同一 TOP 适配器）', () => {
    expect(resolveAdapterCode('tmall', registered)).toBe('taobao')
    expect(resolveAdapterCode('TMALL', registered)).toBe('taobao')
  })

  it('其他未注册平台回落 mock', () => {
    expect(resolveAdapterCode('douyin', registered)).toBe('mock')
    expect(resolveAdapterCode('jd', registered)).toBe('mock')
    expect(resolveAdapterCode('pdd', registered)).toBe('mock')
    expect(resolveAdapterCode('xhs', registered)).toBe('mock')
  })
})

describe('isRealTopConfig (真实 TOP 凭证判断)', () => {
  it('空值 / 占位符判定为未配置', () => {
    expect(isRealTopConfig('', '', '')).toBe(false)
    expect(isRealTopConfig('your_app_key', 'secret', 'token')).toBe(false)
    expect(isRealTopConfig('k', 'changeme', 't')).toBe(false)
    expect(isRealTopConfig('k', 's', '')).toBe(false)
  })

  it('非空非占位判定为已配置', () => {
    expect(isRealTopConfig('appkey123', 'secret456', 'session789')).toBe(true)
  })
})

describe('buildItemAddParams (taobao.item.add 参数映射)', () => {
  it('映射 title/price/cid/num/desc', () => {
    const input: PlatformListingInput = {
      title: '测试商品',
      contentJson: {
        price: '199.00',
        categoryId: '162102',
        detailContent: '商品详情描述',
        skus: [{ stock: 10 }, { stock: 5 }],
      },
    }
    const params = buildItemAddParams(input)
    expect(params).toMatchObject({
      title: '测试商品',
      price: '199.00',
      cid: '162102',
      num: '15',
      desc: '商品详情描述',
    })
  })

  it('无 skus 时 num 不携带，price 为空不携带', () => {
    const params = buildItemAddParams({ title: 'x' })
    expect(params.num).toBeUndefined()
    expect(params.price).toBeUndefined()
  })
})

describe('TaobaoAdapter.submitListing', () => {
  it('无 key 时回落 mock（返回成功而非抛错）', async () => {
    const adapter = new TaobaoAdapter()
    // 强制走非 mock 分支（测试环境 NODE_ENV=test 时构造器会置 mock=true）
    ;(adapter as unknown as { mock: boolean }).mock = false
    ;(adapter as unknown as { appKey: string }).appKey = ''
    ;(adapter as unknown as { appSecret: string }).appSecret = ''
    ;(adapter as unknown as { session: string }).session = ''

    const result = await adapter.submitListing({ title: 'x' })
    expect(result.status).toBe('success')
    expect((result.rawPayload as { kind: string }).kind).toBe('taobao-mock-listing')
  })

  it('有 key 时用 topRequest 调 taobao.item.add（stub fetch 断言请求体）', async () => {
    const adapter = new TaobaoAdapter()
    ;(adapter as unknown as { mock: boolean }).mock = false
    ;(adapter as unknown as { appKey: string }).appKey = 'appkey123'
    ;(adapter as unknown as { appSecret: string }).appSecret = 'secret456'
    ;(adapter as unknown as { session: string }).session = 'session789'

    const originalFetch = global.fetch
    let capturedBody = ''
    global.fetch = (async (_url: string, init?: { body?: string }) => {
      capturedBody = init?.body ?? ''
      return { json: async () => ({ item_add_response: { num_iid: '1001', created: '2026-01-01' } }) }
    }) as unknown as typeof fetch

    try {
      const result = await adapter.submitListing({
        title: 'TOP商品',
        contentJson: { price: '88.00', categoryId: '162102', skus: [{ stock: 20 }] },
      })
      expect(capturedBody).toContain('method=taobao.item.add')
      expect(capturedBody).toContain('title=TOP%E5%95%86%E5%93%81')
      expect(capturedBody).toContain('price=88.00')
      expect(result.status).toBe('success')
      expect((result.rawPayload as { num_iid: string }).num_iid).toBe('1001')
    } finally {
      global.fetch = originalFetch
    }
  })
})
