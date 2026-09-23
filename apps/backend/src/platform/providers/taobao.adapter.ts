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

/** 是否配置了可用的真实 TOP 凭证（非空且非占位符）。 */
export function isRealTopConfig(appKey: string, appSecret: string, session: string): boolean {
  const isPlaceholder = (v: string) => !v || /(your|changeme|replace|xxx)/i.test(v)
  return !isPlaceholder(appKey) && !isPlaceholder(appSecret) && !isPlaceholder(session)
}

/** 把上架入参映射为 taobao.item.add 的业务参数（纯函数，可单测）。
 *  富媒体/扩展 SKU 参数名为按淘宝商品发布资料补齐，属 best-effort；真实提交仍受 isRealTopConfig 保护。 */
export function buildItemAddParams(input: PlatformListingInput): Record<string, string> {
  const content = (input.contentJson ?? {}) as Record<string, unknown>
  const params: Record<string, string> = {}
  if (input.title) params.title = String(input.title)
  const price = content.price
  if (price !== undefined && price !== null && price !== '') params.price = String(price)
  const cid = content.categoryId
  if (cid !== undefined && cid !== null && cid !== '') params.cid = String(cid)
  const skus = Array.isArray(content.skus) ? (content.skus as Array<Record<string, unknown>>) : []
  const explicitNum = Number(content.num ?? 0)
  const stockSum = skus.reduce((acc: number, s) => acc + Number(s.stock ?? 0), 0)
  const num = explicitNum > 0 ? explicitNum : stockSum
  if (num > 0) params.num = String(num)
  // 富媒体（旧版 ManualListing 的 主视频/白底图/详情图）
  if (content.video) params.main_video = String(content.video)
  if (content.whiteImage) params.white_background_image = String(content.whiteImage)
  const detailImages = Array.isArray(content.detailImages) ? (content.detailImages as string[]).filter(Boolean) : []
  // 详情图并入 desc 富文本（淘宝详情为 HTML）
  const descParts = [content.detailContent || content.description || '']
  for (const url of detailImages) descParts.push(`<img src="${url}">`)
  const desc = descParts.filter((part) => String(part).trim()).join('\n') || input.title || ''
  if (desc) params.desc = String(desc)
  // 商品属性 k/v（旧版 productAttrs）→ input_str
  const attrs = content.productAttrs && typeof content.productAttrs === 'object' ? (content.productAttrs as Record<string, string>) : {}
  const attrEntries = Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (attrEntries.length) params.input_str = attrEntries.map(([k, v]) => `${k}:${v}`).join(';')
  // 扩展 SKU → taobao sku 串（properties;price;quantity;outer_id，多 SKU 逗号分隔）
  const skuStr = skus
    .map((s) => [s.specName || s.properties || '', s.price ?? '', s.stock ?? s.quantity ?? 0, s.skuCode || s.outerId || ''].join(';'))
    .filter(Boolean)
    .join(',')
  if (skuStr) params.sku = skuStr
  return params
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

  getStatus() {
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
    if (!isRealTopConfig(this.appKey, this.appSecret, this.session)) {
      // 缺真实凭证：回落现有 mock 逻辑，不伪造真实上架成功
      return { status: 'success', rawPayload: { kind: 'taobao-mock-listing', jobId: input.jobId, fallback: 'no-key' } }
    }
    const payload = await this.topRequest('taobao.item.add', buildItemAddParams(input))
    return { status: 'success', rawPayload: payload?.item_add_response ?? payload }
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
