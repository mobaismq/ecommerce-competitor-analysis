import fs from 'fs'
import http from 'http'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../app')
const REPORT_STATE_FILE = path.resolve(APP_DIR, '.analysis-report-state.json')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    if (process.env[key] != null) continue
    process.env[key] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
  }
}

loadEnvFile(path.resolve(__dirname, '.env.local'))

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173'
const NODE_ENV = process.env.NODE_ENV || 'development'
const IS_PRODUCTION = NODE_ENV === 'production'
const SESSION_COOKIE = 'eca_session'
const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 8 * 60 * 60)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''
const SESSION_SECRET = process.env.SESSION_SECRET || ''

if (IS_PRODUCTION) {
  const missing = []
  if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD')
  if (!SESSION_SECRET || SESSION_SECRET.length < 32) missing.push('SESSION_SECRET(至少32位)')
  if (missing.length) {
    throw new Error(`生产环境缺少安全配置：${missing.join(', ')}`)
  }
}

process.chdir(APP_DIR)

const {
  analyzeProductMainImageAndSave,
  deleteGeneratedMainImages,
  generateAiMarketReport,
  generateOverallReportFromProductMainImageReports,
  getAnalysisProductsView,
  getAnalysisReportView,
  getMainImageAiReport,
  getOpenAiSettings,
  getProductMainImageAnalysis,
  getSuiteMainImageDescriptions,
  listAnalysisReportRows,
  listGeneratedMainImages,
  listProductOptions,
  listSuitePriceBands,
  listSuiteProducts,
  previewMarketPriceBands,
  readLatestMarketReport,
  saveGeneratedMainImages,
  saveOpenAiSettings,
  testArkResponsesConnection,
} = await import('../app/src/server/aiMarketAnalysis.js')
const { generateProductSetImage } = await import('../app/src/server/arkImageGeneration.js')
const {
  expandProductSetPrompts,
  extractProductSetImageText,
  generateDetailWorkflowPrompts,
  generateProductSetImagePrompts,
  generateProductSetRetouchPrompt,
  streamProductSetInformation,
} = await import('../app/src/server/mainImagePromptExpansion.js')
const {
  fetchTaobaoCategories,
  fetchTaobaoShops,
  getTaobaoConfigStatus,
} = await import('../app/src/server/taobaoTopClient.js')

let currentReport = readReportState()
let currentReportJob = null

function readReportState() {
  try {
    return JSON.parse(fs.readFileSync(REPORT_STATE_FILE, 'utf8'))
  } catch {
    return null
  }
}

function writeReportState(report) {
  currentReport = report
  fs.writeFileSync(REPORT_STATE_FILE, JSON.stringify(report, null, 2))
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload, null, 2))
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cache-Control', 'no-store')
  if (IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 25 * 1024 * 1024) reject(new Error('Request body too large'))
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function parseRequestUrl(req) {
  return new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
}

function parseCookies(req) {
  const header = req.headers.cookie || ''
  const cookies = {}
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) cookies[key] = decodeURIComponent(value)
  }
  return cookies
}

function sign(value) {
  const secret = SESSION_SECRET || 'development-only-session-secret-change-me'
  return crypto.createHmac('sha256', secret).update(value).digest('base64url')
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function createSessionToken(username) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: username,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: crypto.randomBytes(16).toString('hex'),
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

function verifySessionToken(token) {
  const [body, signature] = String(token || '').split('.')
  if (!body || !signature || !constantTimeEqual(signature, sign(body))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.sub || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function sessionCookie(token) {
  const secure = IS_PRODUCTION ? '; Secure' : ''
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`
}

function clearSessionCookie() {
  const secure = IS_PRODUCTION ? '; Secure' : ''
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
}

function authUser(req) {
  return verifySessionToken(parseCookies(req)[SESSION_COOKIE])
}

function trustedOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  return origin === FRONTEND_ORIGIN
}

const loginAttempts = new Map()

function clientKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()
}

function loginAllowed(req) {
  const key = clientKey(req)
  const now = Date.now()
  const bucket = loginAttempts.get(key) || []
  const recent = bucket.filter((time) => now - time < 15 * 60 * 1000)
  loginAttempts.set(key, recent)
  return recent.length < 10
}

function recordLoginFailure(req) {
  const key = clientKey(req)
  const bucket = loginAttempts.get(key) || []
  bucket.push(Date.now())
  loginAttempts.set(key, bucket)
}

function clearLoginFailures(req) {
  loginAttempts.delete(clientKey(req))
}

async function handleAuth(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/auth/session') {
    const user = authUser(req)
    return sendJson(res, 200, {
      ok: true,
      authenticated: Boolean(user),
      user: user ? { username: user.sub } : null,
    })
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    if (!trustedOrigin(req)) return sendJson(res, 403, { ok: false, error: '请求来源不可信' })
    if (!loginAllowed(req)) return sendJson(res, 429, { ok: false, error: '登录尝试过多，请稍后再试' })
    const body = await readBody(req)
    const username = String(body.username || '').trim()
    const password = String(body.password || '')
    const expectedPassword = ADMIN_PASSWORD || 'admin123'
    if (username !== ADMIN_USERNAME || !constantTimeEqual(password, expectedPassword)) {
      recordLoginFailure(req)
      return sendJson(res, 401, { ok: false, error: '账号或密码不正确' })
    }
    clearLoginFailures(req)
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken(username)))
    return sendJson(res, 200, { ok: true, user: { username } })
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    res.setHeader('Set-Cookie', clearSessionCookie())
    return sendJson(res, 200, { ok: true })
  }

  return null
}

function reportJobPayload() {
  if (!currentReportJob) return { ok: true, hasJob: false }
  return { ok: true, hasJob: true, job: currentReportJob }
}

function overallReportSteps(importStep = {}, reportStep = {}, groupingStep = null) {
  const steps = [
    {
      key: 'product_main_image_import',
      label: '单品主图分析入库',
      status: 'pending',
      current: 0,
      total: 0,
      ...importStep,
    },
  ]
  if (groupingStep) {
    steps.push({
      key: 'price_grouping',
      label: '价格区间划分',
      status: 'pending',
      current: 0,
      total: 1,
      ...groupingStep,
    })
  }
  steps.push({
    key: 'overall_image_report',
    label: '整体图片报告生成',
    status: 'pending',
    current: 0,
    total: 1,
    ...reportStep,
  })
  return steps
}

function updateReportJobProgress(progress) {
  currentReportJob = {
    ...currentReportJob,
    updatedAt: new Date().toISOString(),
    progress: {
      ...currentReportJob.progress,
      ...progress,
    },
  }
}

function reportRequestFromBody(body) {
  const keyword = String(body.keyword || '').trim()
  if (!keyword) throw new Error('请输入商品关键词')
  return {
    keyword,
    limit: Number(body.limit || 120),
    costPrice: body.costPrice === '' || body.costPrice == null ? null : Number(body.costPrice),
    shippingCost: Number(body.shippingCost || 0),
    packagingCost: Number(body.packagingCost || 0),
    laborCost: Number(body.laborCost || 0),
    platformFeeRate: Number(body.platformFeeRate || 0),
    adFeeRate: Number(body.adFeeRate || 0),
    targetMargin: Number(body.targetMargin || 0.3),
    saveToDb: body.saveToDb !== false,
    targetPriceBand: String(body.targetPriceBand || '').trim(),
    collectionId: String(body.collectionId || body.id || '').trim(),
    generationMode: String(body.generationMode || body.mode || '').trim(),
    priceGroupingMode: String(body.priceGroupingMode || '').trim() === 'ai' ? 'ai' : 'manual',
    manualPriceBands: Array.isArray(body.manualPriceBands) ? body.manualPriceBands : [],
    aiPriceBandCount: Math.max(1, Math.min(6, Number(body.aiPriceBandCount || 3))),
  }
}

function startReportJob(request) {
  if (currentReportJob?.status === 'running') {
    const error = new Error('已有报告生成任务正在运行')
    error.current = currentReportJob
    throw error
  }

  const jobId = `report-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  currentReportJob = {
    id: jobId,
    status: 'running',
    keyword: request.keyword,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: {
      stage: 'queued',
      message: '任务已创建，准备读取数据库',
      current: 0,
      total: 1,
    },
    result: null,
    error: null,
  }

  Promise.resolve().then(async () => {
    try {
      let payload
      if (request.generationMode === 'product_main_image_summary') {
        updateReportJobProgress({
          stage: 'preflight',
          message: '正在读取集合商品和单品主图分析入库状态',
          current: 0,
          total: 2,
          steps: overallReportSteps(
            { status: 'running', message: '正在检查缺失的单品报告' },
            { status: 'pending', message: '等待单品报告入库完成' },
            {
              status: 'pending',
              message: request.priceGroupingMode === 'ai'
                ? `等待入库后 AI 划分约 ${request.aiPriceBandCount} 个价格区间`
                : request.manualPriceBands?.length
                  ? `等待按 ${request.manualPriceBands.length} 个手动价格区间汇总`
                  : '等待按全量竞品集合汇总',
            },
          ),
        })

        const view = await getAnalysisProductsView({ id: request.collectionId, keyword: request.keyword })
        const safeLimit = Math.max(1, Math.min(200, Number(request.limit || view.products?.length || 120)))
        const selectedProducts = (view.products || []).slice(0, safeLimit)
        const pendingProducts = selectedProducts.filter((product) => !product.mainImageAnalysisId)
        let importedCount = selectedProducts.length - pendingProducts.length
        const importFailures = []

        updateReportJobProgress({
          stage: 'product_main_image_import',
          message: pendingProducts.length
            ? `需要先补齐 ${pendingProducts.length} 个商品的主图分析入库`
            : '该集合商品已全部完成单品主图分析入库',
          current: 0,
          total: Math.max(1, pendingProducts.length + 1),
          steps: overallReportSteps(
            {
              status: pendingProducts.length ? 'running' : 'completed',
              current: importedCount,
              total: selectedProducts.length,
              message: pendingProducts.length ? '正在自动补齐未入库商品' : '无需补齐',
            },
            { status: 'pending', message: '等待单品报告入库完成' },
            {
              status: 'pending',
              message: request.priceGroupingMode === 'ai'
                ? '等待 AI 划分价格区间'
                : request.manualPriceBands?.length
                  ? `已设置 ${request.manualPriceBands.length} 个手动价格区间`
                  : '未设置手动价格区间，将按全量集合汇总',
            },
          ),
        })

        for (let index = 0; index < pendingProducts.length; index += 1) {
          const product = pendingProducts[index]
          const productTitle = product.title || product.productId || '未知商品'
          updateReportJobProgress({
            stage: 'product_main_image_import',
            message: `正在主图分析入库 ${index + 1}/${pendingProducts.length}：${productTitle}`,
            current: index,
            total: pendingProducts.length + 1,
            steps: overallReportSteps(
              {
                status: 'running',
                current: importedCount,
                total: selectedProducts.length,
                message: `正在处理 ${productTitle}`,
              },
              { status: 'pending', message: '等待单品报告入库完成' },
              {
                status: 'pending',
                message: request.priceGroupingMode === 'ai'
                  ? '等待 AI 划分价格区间'
                  : request.manualPriceBands?.length
                    ? `已设置 ${request.manualPriceBands.length} 个手动价格区间`
                    : '未设置手动价格区间，将按全量集合汇总',
              },
            ),
          })
          try {
            await analyzeProductMainImageAndSave({
              productId: product.productId,
              keyword: request.keyword,
              fallback: {
                title: product.title,
                productUrl: product.productUrl,
                imageUrl: product.imageUrl,
                price: product.price || product.priceRange,
                soldCount: product.soldCount,
                skus: product.skus,
              },
            })
            importedCount += 1
          } catch (error) {
            importFailures.push({
              productId: String(product.productId || ''),
              title: String(product.title || ''),
              error: error instanceof Error ? error.message : String(error || '主图分析失败'),
            })
          }
        }

        if (importedCount <= 0) {
          const reasonCounts = new Map()
          for (const item of importFailures) {
            const reasonText = String(item.error || '未知原因').replace(/[。.\s]+$/g, '')
            reasonCounts.set(reasonText, (reasonCounts.get(reasonText) || 0) + 1)
          }
          const reason = reasonCounts.size
            ? Array.from(reasonCounts.entries()).map(([text, count]) => `${count} 个：${text}`).join('；')
            : '单品主图分析报告不可用'

          updateReportJobProgress({
            stage: 'overall_image_report',
            message: `单品主图分析全部不可用，正在使用已有商品数据生成兜底整体报告：${reason}`,
            current: pendingProducts.length,
            total: pendingProducts.length + 1,
            warnings: importFailures,
            steps: overallReportSteps(
              {
                status: 'failed',
                current: 0,
                total: selectedProducts.length,
                message: `单品主图分析未生成：${reason}`,
              },
              { status: 'skipped', current: 0, total: 1, message: '跳过基于单品主图报告的价格区间划分' },
              { status: 'running', current: 0, total: 1, message: '改用商品快照、SKU、销量和评论数据生成兜底报告' },
            ),
          })

          payload = await generateAiMarketReport({
            ...request,
            generationMode: 'market_report_fallback',
            targetPriceBand: '',
            onProgress(progress) {
              updateReportJobProgress({
                ...progress,
                stage: 'overall_image_report',
                message: progress.message || '正在生成兜底整体报告',
                warnings: importFailures,
                steps: overallReportSteps(
                  {
                    status: 'failed',
                    current: 0,
                    total: selectedProducts.length,
                    message: `单品主图分析未生成：${reason}`,
                  },
                  { status: 'skipped', current: 0, total: 1, message: '跳过基于单品主图报告的价格区间划分' },
                  {
                    status: progress.stage === 'persist' ? 'completed' : 'running',
                    current: progress.current || 0,
                    total: Math.max(1, progress.total || 1),
                    message: progress.message || '正在生成兜底整体报告',
                  },
                ),
              })
            },
          })
          if (Array.isArray(payload.reportJson?.data_gaps)) {
            payload.reportJson.data_gaps.unshift(`单品主图分析报告全部不可用，已自动降级为商品快照/SKU/销量/评论数据兜底报告：${reason}`)
          }
          payload.report = {
            ...payload.report,
            generationFallback: 'market_report_without_product_main_image_analysis',
            autoImportedProductReports: 0,
            skippedProductReports: importFailures,
            fallbackReason: reason,
          }
        } else {
          updateReportJobProgress({
            stage: 'price_grouping',
            message: request.priceGroupingMode === 'ai' ? '单品主图分析入库完成，正在 AI 划分价格区间' : '单品主图分析入库完成，正在应用价格区间',
            current: pendingProducts.length,
            total: pendingProducts.length + 1,
            warnings: importFailures,
          })

          payload = await generateOverallReportFromProductMainImageReports({
            ...request,
            skippedProducts: importFailures,
            onProgress(progress) {
              updateReportJobProgress({
                ...progress,
                stage: progress.stage === 'price_grouping' ? 'price_grouping' : 'overall_image_report',
                message: progress.message || '正在生成整体图片报告',
                current: pendingProducts.length + (progress.current || 0),
                total: pendingProducts.length + Math.max(1, progress.total || 1),
                warnings: importFailures,
              })
            },
          })
          payload.report = {
            ...payload.report,
            autoImportedProductReports: pendingProducts.length - importFailures.length,
            skippedProductReports: importFailures,
          }
        }
      } else {
        payload = await generateAiMarketReport({
          ...request,
          onProgress(progress) {
            updateReportJobProgress(progress)
          },
        })
      }

      writeReportState({ ...payload.report, reportJson: payload.reportJson, markdown: payload.markdown })
      const newRunId = payload?.report?.persistStats?.run_id
      if (newRunId) {
        getMainImageAiReport({ id: String(newRunId) }).catch((err) => {
          console.error('[main-image-ai-report] 自动生成失败：', err instanceof Error ? err.message : err)
        })
      }
      currentReportJob = {
        ...currentReportJob,
        status: 'completed',
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        progress: {
          stage: 'done',
          message: '报告已生成并保存',
          current: 1,
          total: 1,
          steps: request.generationMode === 'product_main_image_summary'
            ? overallReportSteps(
              {
                status: 'completed',
                current: payload.report?.sourceProductCount || payload.report?.sourceProductReportCount || 0,
                total: payload.report?.sourceProductCount || payload.report?.sourceProductReportCount || 0,
                message: `已完成 ${payload.report?.sourceProductReportCount || 0} 个单品报告入库检查`,
              },
              { status: 'completed', current: 1, total: 1, message: '整体图片报告已生成并保存' },
              { status: 'completed', current: 1, total: 1, message: `已生成 ${payload.report?.priceBandCount || 1} 个价格区间` },
            )
            : currentReportJob.progress?.steps,
        },
        result: payload,
        error: null,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const failedSteps = (currentReportJob.progress?.steps || []).map((step) => (
        step.status === 'running'
          ? { ...step, status: 'failed', message: errorMessage }
          : step
      ))
      currentReportJob = {
        ...currentReportJob,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        progress: {
          ...currentReportJob.progress,
          stage: 'failed',
          message: errorMessage,
          steps: failedSteps.length ? failedSteps : currentReportJob.progress?.steps,
        },
        error: errorMessage,
      }
      console.error(error)
    }
  })

  return currentReportJob
}

async function handleApi(req, res) {
  const requestUrl = parseRequestUrl(req)
  const pathname = requestUrl.pathname

  if (req.method === 'GET' && pathname === '/api/taobao/status') {
    return sendJson(res, 200, { ok: true, ...getTaobaoConfigStatus() })
  }

  if (req.method === 'GET' && pathname === '/api/taobao/shops') {
    try {
      const shops = await fetchTaobaoShops()
      return sendJson(res, 200, { ok: true, shops })
    } catch (error) {
      return sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (req.method === 'GET' && pathname === '/api/taobao/categories') {
    const parentCid = Number(requestUrl.searchParams.get('parent_cid') || 0)
    try {
      const categories = await fetchTaobaoCategories(parentCid)
      return sendJson(res, 200, { ok: true, categories })
    } catch (error) {
      return sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (req.method === 'GET' && pathname === '/api/product-sets/products') {
    const payload = await listSuiteProducts((requestUrl.searchParams.get('q') || '').trim())
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/product-sets/price-bands') {
    const payload = await listSuitePriceBands((requestUrl.searchParams.get('keyword') || '').trim())
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/product-sets/main-image-descriptions') {
    const payload = await getSuiteMainImageDescriptions({
      keyword: (requestUrl.searchParams.get('keyword') || '').trim(),
      priceBand: (requestUrl.searchParams.get('priceBand') || '').trim(),
      runId: (requestUrl.searchParams.get('runId') || '').trim(),
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/product-sets/generate-image') {
    const body = await readBody(req)
    const payload = await generateProductSetImage({
      prompt: body.prompt,
      image: body.image,
      images: body.images,
      size: body.size || '2K',
      ratio: body.ratio || '',
      watermark: body.watermark === true,
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/product-sets/generate-retouch-prompt') {
    const body = await readBody(req)
    const payload = await generateProductSetRetouchPrompt({
      settings: body.settings,
      slot: body.slot,
      originalPrompt: body.originalPrompt,
      userDirection: body.userDirection,
      originalImage: body.originalImage,
      currentImage: body.currentImage,
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/product-sets/extract-image-text') {
    const body = await readBody(req)
    const payload = await extractProductSetImageText({
      image: body.image,
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/product-sets/generated-images/delete') {
    const body = await readBody(req)
    const payload = await deleteGeneratedMainImages({ ids: Array.isArray(body?.ids) ? body.ids : [] })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/product-sets/generated-images') {
    const body = await readBody(req)
    const payload = await saveGeneratedMainImages(body || {})
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/product-sets/generated-images') {
    const payload = await listGeneratedMainImages({
      productName: (requestUrl.searchParams.get('productName') || '').trim(),
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/product-sets/expand-prompts') {
    const body = await readBody(req)
    const payload = await expandProductSetPrompts({
      product: body.product,
      priceBand: body.priceBand,
      settings: body.settings,
      baseText: body.baseText,
      image: body.image,
      selectedSlots: body.selectedSlots,
      informationOnly: body.informationOnly === true,
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/product-sets/expand-prompts-stream') {
    const body = await readBody(req)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    const writeEvent = (event) => {
      res.write(`${JSON.stringify(event)}\n`)
    }
    try {
      await streamProductSetInformation({
        settings: body.settings,
        baseText: body.baseText,
        image: Array.isArray(body.images) && body.images.length ? body.images : body.image,
        emit: writeEvent,
      })
    } catch (error) {
      writeEvent({ type: 'error', error: error instanceof Error ? error.message : String(error) })
    } finally {
      res.end()
    }
    return
  }

  if (req.method === 'POST' && pathname === '/api/product-sets/generate-prompts') {
    const body = await readBody(req)
    const payload = await generateProductSetImagePrompts({
      settings: body.settings,
      baseText: body.baseText,
      reportText: body.reportText,
      information: body.information,
      image: body.image,
      promptSlots: body.promptSlots,
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/product-sets/generate-detail-workflow') {
    const body = await readBody(req)
    const payload = await generateDetailWorkflowPrompts({
      settings: body.settings,
      baseText: body.baseText,
      reportText: body.reportText,
      image: body.image,
      images: body.images,
      promptSlots: body.promptSlots,
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/report/openai-settings') {
    return sendJson(res, 200, getOpenAiSettings())
  }

  if (req.method === 'POST' && pathname === '/api/report/openai-settings/test') {
    const body = await readBody(req)
    const payload = await testArkResponsesConnection({
      imageUrl: body.imageUrl,
      text: body.text,
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/report/openai-settings') {
    const body = await readBody(req)
    const payload = saveOpenAiSettings({
      apiKey: body.apiKey,
      model: body.model,
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/report/analysis-list') {
    const payload = await listAnalysisReportRows({
      keyword: (requestUrl.searchParams.get('keyword') || '').trim(),
      startTime: (requestUrl.searchParams.get('startTime') || '').trim(),
      endTime: (requestUrl.searchParams.get('endTime') || '').trim(),
      status: (requestUrl.searchParams.get('status') || '').trim(),
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/report/analysis-view') {
    const payload = await getAnalysisReportView({
      id: (requestUrl.searchParams.get('id') || '').trim(),
      keyword: (requestUrl.searchParams.get('keyword') || '').trim(),
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/report/main-image-ai-report') {
    try {
      const payload = await getMainImageAiReport({
        id: (requestUrl.searchParams.get('id') || '').trim(),
      })
      return sendJson(res, 200, payload)
    } catch (error) {
      return sendJson(res, 200, {
        ok: false,
        source: 'fallback',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (req.method === 'GET' && pathname === '/api/report/products-view') {
    const payload = await getAnalysisProductsView({
      id: (requestUrl.searchParams.get('id') || '').trim(),
      keyword: (requestUrl.searchParams.get('keyword') || '').trim(),
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'POST' && pathname === '/api/report/product-main-image-analysis') {
    const body = await readBody(req)
    const payload = await analyzeProductMainImageAndSave({
      productId: body.productId,
      keyword: body.keyword,
      fallback: {
        title: body.title,
        productUrl: body.productUrl,
        imageUrl: body.imageUrl,
        price: body.price,
        soldCount: body.soldCount,
        skus: body.skus,
      },
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/report/product-main-image-analysis') {
    const payload = await getProductMainImageAnalysis({
      id: (requestUrl.searchParams.get('id') || '').trim(),
      productId: (requestUrl.searchParams.get('productId') || '').trim(),
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/report/products') {
    const payload = await listProductOptions((requestUrl.searchParams.get('q') || '').trim())
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/report/price-bands-preview') {
    const payload = await previewMarketPriceBands({
      keyword: (requestUrl.searchParams.get('keyword') || '').trim(),
      limit: Number(requestUrl.searchParams.get('limit') || 120),
      costPrice: requestUrl.searchParams.get('costPrice'),
      shippingCost: Number(requestUrl.searchParams.get('shippingCost') || 0),
      packagingCost: Number(requestUrl.searchParams.get('packagingCost') || 0),
      laborCost: Number(requestUrl.searchParams.get('laborCost') || 0),
      platformFeeRate: Number(requestUrl.searchParams.get('platformFeeRate') || 0),
      adFeeRate: Number(requestUrl.searchParams.get('adFeeRate') || 0),
      targetMargin: Number(requestUrl.searchParams.get('targetMargin') || 0.3),
    })
    return sendJson(res, 200, payload)
  }

  if (req.method === 'GET' && pathname === '/api/report/latest') {
    const keyword = (requestUrl.searchParams.get('keyword') || '').trim()
    if (!currentReport) currentReport = readReportState()
    const latestReport = keyword
      ? await readLatestMarketReport(keyword)
      : (currentReport?.reportJson ? currentReport : await readLatestMarketReport())
    return sendJson(res, 200, {
      ok: true,
      hasReport: Boolean(latestReport?.reportJson),
      report: latestReport,
      reportJson: latestReport?.reportJson || null,
      markdown: latestReport?.markdown || '',
      jsonFile: null,
      markdownFile: null,
    })
  }

  if (req.method === 'GET' && pathname === '/api/report/generate-status') {
    return sendJson(res, 200, reportJobPayload())
  }

  if (req.method === 'POST' && pathname === '/api/report/generate') {
    const body = await readBody(req)
    const request = reportRequestFromBody(body)
    let job
    try {
      job = startReportJob(request)
    } catch (error) {
      if (error?.current) {
        return sendJson(res, 409, { ok: false, error: error.message, current: error.current })
      }
      throw error
    }
    return sendJson(res, 202, { ok: true, queued: true, jobId: job.id, job })
  }

  return sendJson(res, 404, { ok: false, error: 'API 不存在' })
}

const server = http.createServer(async (req, res) => {
  setCors(res)
  setSecurityHeaders(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const pathname = parseRequestUrl(req).pathname
  if (!pathname.startsWith('/api/auth/') && !pathname.startsWith('/api/report/') && !pathname.startsWith('/api/product-sets/') && !pathname.startsWith('/api/taobao/')) {
    return sendJson(res, 404, { ok: false, error: 'API 不存在' })
  }

  try {
    const authResult = await handleAuth(req, res, pathname)
    if (authResult !== null) return authResult

    // 本地前端开发先绕过登录校验，避免接口因缺少 session 被 401 拦截。
    // if (!authUser(req)) {
    //   return sendJson(res, 401, { ok: false, error: '请先登录', authenticated: false })
    // }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '') && !trustedOrigin(req)) {
      return sendJson(res, 403, { ok: false, error: '请求来源不可信' })
    }
    return await handleApi(req, res)
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[backend] listening on http://${HOST}:${PORT}`)
})
