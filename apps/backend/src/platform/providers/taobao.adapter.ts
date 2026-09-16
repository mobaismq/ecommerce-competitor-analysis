import { createHash } from 'node:crypto'
import {
  PlatformAdapterError,
  type PlatformAdapter,
  type PlatformCategory,
  type PlatformListingInput,
  type PlatformListingResult,
  type PlatformMethod,
  type PlatformShop,
} from '../platform.types'

function topTimestamp(date = new Date()) {
  const shifted = new Date(date.getTime() + (8 * 60 + date.getTimezoneOffset()) * 60000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())} ${pad(shifted.getHours())}:${pad(shifted.getMinutes())}:${pad(shifted.getSeconds())}`
}

function signTopParams(params: Record<string, string>, secret: string) {
  const joined = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('')
  return createHash('md5').update(secret + joined + secret, 'utf8').digest('hex').toUpperCase()
}

function mockCategories(): PlatformCategory[] {
  return [
    { externalId: '50008163', parentExternalId: '0', name: '女装', isParent: true, rawPayload: { kind: 'mock', cid: 50008163 } },
    { externalId: '162102', parentExternalId: '50008163', name: '连衣裙', isParent: false, rawPayload: { kind: 'mock', cid: 162102 } },
    { externalId: '50008907', parentExternalId: '0', name: '男装', isParent: true, rawPayload: { kind: 'mock', cid: 50008907 } },
  ]
}

function mockShops(): PlatformShop[] {
  return [
    {
      externalId: 'mock-shop-1',
      name: '测试店铺',
      nick: 'mock_shop',
      approveStatus: 'ok',
      rawPayload: { kind: 'mock', sid: 'mock-shop-1' },
    },
  ]
}

export class TaobaoAdapter implements PlatformAdapter {
  readonly code = 'taobao'
  private readonly gateway: string
  private readonly appKey: string
  private readonly appSecret: string
  private readonly session: string
  private readonly mock: boolean

  constructor() {
    this.gateway = process.env.TAOBAO_GATEWAY || 'https://eco.taobao.com/router/rest'
    this.appKey = (process.env.TAOBAO_APP_KEY || '').trim()
    this.appSecret = (process.env.TAOBAO_APP_SECRET || '').trim()
    this.session = (process.env.TAOBAO_SESSION || '').trim()
    this.mock = process.env.PLATFORM_MOCK === 'true' || process.env.NODE_ENV !== 'production'
  }

  configStatus() {
    return { configured: Boolean(this.appKey && this.appSecret), hasSession: Boolean(this.session), mock: this.mock }
  }

  supports(method: PlatformMethod) {
    return method === 'categories' || method === 'shops'
  }

  async fetchCategories(parentExternalId = '0'): Promise<PlatformCategory[]> {
    if (this.mock) {
      return parentExternalId === '0' ? mockCategories() : mockCategories().filter((item) => item.parentExternalId === parentExternalId)
    }
    const payload = await this.topRequest('taobao.itemcats.get', {
      fields: 'cid,parent_cid,name,is_parent',
      parent_cid: String(parentExternalId),
    })
    const cats = payload?.itemcats_get_response?.item_cats?.item_cat || []
    return (Array.isArray(cats) ? cats : []).map((cat: Record<string, unknown>) => ({
      externalId: String(cat.cid),
      parentExternalId: String(cat.parent_cid ?? '0'),
      name: String(cat.name ?? ''),
      isParent: cat.is_parent === true || cat.is_parent === 'true',
      rawPayload: cat,
    }))
  }

  async fetchShops(): Promise<PlatformShop[]> {
    if (this.mock) return mockShops()
    const payload = await this.topRequest('taobao.shops.get', { fields: 'sid,title,nick,approve_status' })
    const shops = payload?.shops_get_response?.shops?.shop || []
    return (Array.isArray(shops) ? shops : []).map((shop: Record<string, unknown>) => ({
      externalId: String(shop.sid),
      name: String(shop.title ?? ''),
      nick: shop.nick ? String(shop.nick) : undefined,
      approveStatus: shop.approve_status ? String(shop.approve_status) : undefined,
      rawPayload: shop,
    }))
  }

  async submitListing(input: PlatformListingInput): Promise<PlatformListingResult> {
    if (this.mock) return { status: 'success', rawPayload: { kind: 'taobao-mock-listing', jobId: input.jobId } }
    throw new PlatformAdapterError('淘宝 TOP 上架接口暂未接入，当前仅支持 Mock/手动发布', 'TAOBAO_LISTING_NOT_READY')
  }

  private async topRequest(method: string, bizParams: Record<string, string> = {}): Promise<Record<string, any>> {
    if (!this.appKey || !this.appSecret) {
      throw new PlatformAdapterError('未配置淘宝开放平台 AppKey/AppSecret', 'TAOBAO_NOT_CONFIGURED')
    }
    const params: Record<string, string> = {
      app_key: this.appKey,
      method,
      timestamp: topTimestamp(),
      v: '2.0',
      sign_method: 'md5',
      format: 'json',
      ...bizParams,
    }
    if (this.session) params.session = this.session
    params.sign = signTopParams(params, this.appSecret)

    const response = await fetch(this.gateway, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString(),
    })
    const payload = (await response.json().catch(() => null)) as Record<string, any> | null
    if (!payload) throw new PlatformAdapterError(`淘宝网关 ${method} 返回了无法解析的响应`, 'TAOBAO_BAD_RESPONSE')
    if (payload.error_response) {
      const err = payload.error_response
      const detail = err.sub_code ? `（${err.sub_code}: ${err.sub_msg}）` : ''
      throw new PlatformAdapterError(`淘宝 API ${method} 调用失败: [${err.code}] ${err.msg}${detail}`, 'TAOBAO_API_ERROR')
    }
    return payload
  }
}
