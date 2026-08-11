import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.resolve(process.cwd(), fileName)
    if (!fs.existsSync(filePath)) continue
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index <= 0) continue
      const key = trimmed.slice(0, index).trim()
      const rawValue = trimmed.slice(index + 1).trim()
      if (process.env[key] != null) continue
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  }
}

loadLocalEnv()

const TOP_GATEWAY = process.env.TAOBAO_GATEWAY || 'https://eco.taobao.com/router/rest'

export function getTaobaoConfigStatus() {
  const appKey = (process.env.TAOBAO_APP_KEY || '').trim()
  const appSecret = (process.env.TAOBAO_APP_SECRET || '').trim()
  const session = (process.env.TAOBAO_SESSION || '').trim()
  return {
    configured: Boolean(appKey && appSecret),
    hasSession: Boolean(session),
  }
}

// TOP 协议要求 GMT+8 的 YYYY-MM-DD HH:mm:ss
function formatTopTimestamp(date = new Date()) {
  const shifted = new Date(date.getTime() + (8 * 60 + date.getTimezoneOffset()) * 60000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())} ${pad(shifted.getHours())}:${pad(shifted.getMinutes())}:${pad(shifted.getSeconds())}`
}

// MD5 签名：secret + 按 key 字典序拼接的 k+v + secret，转大写
function signTopParams(params, secret) {
  const joined = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('')
  return crypto.createHash('md5').update(secret + joined + secret, 'utf8').digest('hex').toUpperCase()
}

export async function topRequest(method, bizParams = {}) {
  const appKey = (process.env.TAOBAO_APP_KEY || '').trim()
  const appSecret = (process.env.TAOBAO_APP_SECRET || '').trim()
  if (!appKey || !appSecret) {
    throw new Error('未配置淘宝开放平台 AppKey/AppSecret，请在 .env.local 中填写 TAOBAO_APP_KEY / TAOBAO_APP_SECRET')
  }

  const params = {
    app_key: appKey,
    method,
    timestamp: formatTopTimestamp(),
    v: '2.0',
    sign_method: 'md5',
    format: 'json',
    ...bizParams,
  }
  const session = (process.env.TAOBAO_SESSION || '').trim()
  if (session) params.session = session
  params.sign = signTopParams(params, appSecret)

  const response = await fetch(TOP_GATEWAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(params).toString(),
  })
  const payload = await response.json().catch(() => null)
  if (!payload) throw new Error(`淘宝网关 ${method} 返回了无法解析的响应`)
  if (payload.error_response) {
    const err = payload.error_response
    const detail = err.sub_code ? `（${err.sub_code}: ${err.sub_msg}）` : ''
    throw new Error(`淘宝 API ${method} 调用失败: [${err.code}] ${err.msg}${detail}`)
  }
  return payload
}

// 商家店铺下拉：taobao.shops.get
export async function fetchTaobaoShops() {
  const payload = await topRequest('taobao.shops.get', { fields: 'sid,title,nick,approve_status' })
  const shops = payload?.shops_get_response?.shops?.shop || []
  return (Array.isArray(shops) ? shops : []).map((shop) => ({
    sid: shop.sid,
    title: shop.title,
    nick: shop.nick,
    approveStatus: shop.approve_status,
  }))
}

// 商品类目级联：taobao.itemcats.get（按 parent_cid 逐级拉取）
export async function fetchTaobaoCategories(parentCid = 0) {
  const payload = await topRequest('taobao.itemcats.get', {
    fields: 'cid,parent_cid,name,is_parent',
    parent_cid: String(parentCid),
  })
  const cats = payload?.itemcats_get_response?.item_cats?.item_cat || []
  return (Array.isArray(cats) ? cats : []).map((cat) => ({
    cid: cat.cid,
    parentCid: cat.parent_cid,
    name: cat.name,
    isParent: cat.is_parent === true || cat.is_parent === 'true',
  }))
}
