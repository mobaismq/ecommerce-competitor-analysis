import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import mysql from 'mysql2/promise'

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
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  }
}

loadLocalEnv()

const DEFAULT_ARK_ANALYSIS_MODEL = 'doubao-seed-2-1-pro-260628'

function currentModel() {
  return process.env.ARK_ANALYSIS_MODEL || process.env.OPENAI_ANALYSIS_MODEL || DEFAULT_ARK_ANALYSIS_MODEL
}

function maskKey(key) {
  const text = String(key || '').trim()
  if (!text) return ''
  if (text.length <= 12) return `${text.slice(0, 4)}...`
  return `${text.slice(0, 7)}...${text.slice(-4)}`
}

function upsertEnvValue(text, key, value) {
  const lines = text ? text.split(/\r?\n/) : []
  const next = []
  let written = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.startsWith(`${key}=`)) {
      next.push(line)
      continue
    }
    next.push(`${key}=${value}`)
    written = true
  }
  if (!written) next.push(`${key}=${value}`)
  return next.filter((line, index, array) => line !== '' || index < array.length - 1).join('\n') + '\n'
}

export function getOpenAiSettings() {
  loadLocalEnv()
  const apiKey = process.env.ARK_API_KEY || process.env.OPENAI_API_KEY || ''
  return {
    ok: true,
    configured: Boolean(apiKey),
    maskedKey: maskKey(apiKey),
    model: currentModel(),
    provider: 'ark',
  }
}

export function saveOpenAiSettings({ apiKey, model }) {
  const cleanKey = String(apiKey || '').trim()
  const cleanModel = String(model || '').trim() || DEFAULT_ARK_ANALYSIS_MODEL
  if (!cleanKey && !process.env.ARK_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('请先填写 ARK_API_KEY')
  }

  const envPath = path.resolve(process.cwd(), '.env.local')
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
  if (cleanKey) {
    text = upsertEnvValue(text, 'ARK_API_KEY', cleanKey)
    process.env.ARK_API_KEY = cleanKey
  }
  text = upsertEnvValue(text, 'ARK_ANALYSIS_MODEL', cleanModel)
  process.env.ARK_ANALYSIS_MODEL = cleanModel
  fs.writeFileSync(envPath, text, 'utf8')
  return getOpenAiSettings()
}

const MAX_VISION_IMAGES = Number(process.env.ARK_ANALYSIS_MAX_IMAGES || process.env.OPENAI_ANALYSIS_MAX_IMAGES || 100)
const VISION_BATCH_SIZE = Math.max(1, Math.min(8, Number(process.env.ARK_ANALYSIS_BATCH_IMAGES || 4)))
const ARK_ANALYSIS_TIMEOUT_MS = Number(process.env.ARK_ANALYSIS_TIMEOUT_MS || 240000)
const ARK_RESPONSES_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/responses'

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sys',
    charset: 'utf8mb4',
    decimalNumbers: true,
    dateStrings: true,
  }
}

async function withConnection(fn) {
  const connection = await mysql.createConnection(mysqlConfig())
  try {
    return await fn(connection)
  } finally {
    await connection.end()
  }
}

function toNumber(value, fallback = null) {
  if (value == null || value === '') return fallback
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function toInt(value, fallback = 0) {
  const numeric = toNumber(value, null)
  return numeric == null ? fallback : Math.round(numeric)
}

function normalizePriceBandKey(value) {
  return String(value || '')
    .trim()
    .replace(/[–—－−]/g, '-')
    .replace(/\s+/g, '')
}

function money(value) {
  const numeric = toNumber(value, null)
  return numeric == null ? null : Math.round(numeric * 100) / 100
}

function jsonText(value) {
  return JSON.stringify(value ?? null, null, 0)
}

function firstNumber(...values) {
  for (const value of values) {
    const numeric = toNumber(value, null)
    if (numeric != null && numeric > 0) return numeric
  }
  return null
}

function normalizeUrl(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  if (text.startsWith('//')) return `https:${text}`
  if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:image/')) return text
  return ''
}

function resolveLocalPath(raw, roots = []) {
  const filePath = String(raw || '').trim()
  if (!filePath || normalizeUrl(filePath)) return ''
  if (path.isAbsolute(filePath)) return fs.existsSync(filePath) ? filePath : ''

  const candidates = [
    ...roots.map((root) => path.resolve(root, filePath)),
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), '..', filePath),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || ''
}

function maybeLocalImageAsDataUrl(raw, roots = []) {
  const filePath = resolveLocalPath(raw, roots)
  if (!filePath) return ''
  const stat = fs.statSync(filePath)
  if (stat.size > 4 * 1024 * 1024) return ''
  const ext = path.extname(filePath).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`
}

function imageUrlFrom(row, roots = []) {
  return maybeLocalImageAsDataUrl(row?.storage_path, roots)
    || maybeLocalImageAsDataUrl(row?.sku_image_path, roots)
    || normalizeUrl(row?.source_url)
    || normalizeUrl(row?.sku_image_url)
    || normalizeUrl(row?.asset_url)
    || ''
}

function localImagePathFrom(row, roots = []) {
  return resolveLocalPath(row?.storage_path, roots)
    || resolveLocalPath(row?.sku_image_path, roots)
    || ''
}

function sourceRootsFromRows(rows = []) {
  const roots = new Set()
  for (const row of rows) {
    const localPath = String(row?.local_path || '').trim()
    if (!localPath || !path.isAbsolute(localPath)) continue
    const dir = path.dirname(localPath)
    roots.add(dir)
    if (path.basename(dir) === 'cleaned_output') {
      roots.add(path.dirname(dir))
    } else {
      roots.add(path.join(dir, 'cleaned_output'))
    }
  }
  return Array.from(roots)
}

function leafName(categoryPath) {
  const text = String(categoryPath || '').trim()
  if (!text) return ''
  return text.split('>').pop().trim()
}

export async function listProductOptions(query = '') {
  const search = String(query || '').trim()
  const params = []
  let where = ''
  if (search) {
    where = 'WHERE product_title LIKE ? OR category_name LIKE ?'
    params.push(`%${search}%`, `%${search}%`)
  }

  const rows = await withConnection(async (connection) => {
    const [result] = await connection.query(`
      SELECT COALESCE(category_name, '') AS category_name, COUNT(*) AS product_count, MAX(id) AS latest_id
      FROM product_snapshot
      ${where}
      GROUP BY category_name
      ORDER BY latest_id DESC
      LIMIT 500
    `, params)
    return result
  })

  const bucket = new Map()
  for (const row of rows) {
    const label = leafName(row.category_name)
    if (!label) continue
    const key = label.toLowerCase()
    const current = bucket.get(key) || { value: label, label, count: 0, paths: [], latest_id: 0 }
    current.count += toInt(row.product_count)
    current.latest_id = Math.max(current.latest_id, toInt(row.latest_id))
    if (row.category_name && !current.paths.includes(row.category_name)) current.paths.push(row.category_name)
    bucket.set(key, current)
  }

  const products = Array.from(bucket.values())
    .sort((a, b) => b.count - a.count || b.latest_id - a.latest_id || a.label.localeCompare(b.label, 'zh-CN'))
    .slice(0, 100)
  return { ok: true, products }
}

function compactDateTime(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.replace(/[-:T ]/g, '').slice(0, 14)
}

function priceRangeText(min, max) {
  const low = money(min)
  const high = money(max)
  if (low == null && high == null) return '-'
  if (low != null && high != null && low !== high) return `${low}-${high}`
  return String(low ?? high)
}

function collectionNameFromPath(localPath, fallback = '') {
  const text = String(localPath || '')
  const parts = text.split(/[\\/]+/).filter(Boolean)
  for (const part of parts) {
    let match = part.match(/^店透视批量导出-(.+?)(?:-min[^-]+)?(?:-max[^-]+)?-Top\d+-\d{8}-\d{6}$/)
    if (match?.[1]) return match[1].trim()
    match = part.match(/^店透视导出-(.+?)-\d{6,}-\d{8,}(?:-\d{6})?$/)
    if (match?.[1]) return match[1].trim()
  }
  return String(fallback || '').trim()
}

function collectionKeyFromPath(localPath, fallback) {
  const text = String(localPath || '')
  const parts = text.split(/[\\/]+/).filter(Boolean)
  const folder = parts.find((part) => /^店透视批量导出-|^店透视导出-/.test(part))
  if (folder) return folder
  return String(fallback || '')
}

export async function listAnalysisReportRows({ keyword = '', startTime = '', endTime = '', status = '' } = {}) {
  const search = String(keyword || '').trim()
  const cleanStatus = String(status || '').trim()
  const cleanStart = String(startTime || '').trim()
  const cleanEnd = String(endTime || '').trim()

  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)

    const runWhere = []
    const runParams = []
    if (search) {
      runWhere.push('r.keyword LIKE ?')
      runParams.push(`%${search}%`)
    }
    if (cleanStart) {
      runWhere.push('r.created_at >= ?')
      runParams.push(`${cleanStart} 00:00:00`)
    }
    if (cleanEnd) {
      runWhere.push('r.created_at <= ?')
      runParams.push(`${cleanEnd} 23:59:59`)
    }

    const [runRows] = await connection.query(`
      SELECT
        r.id,
        r.keyword,
        r.competitor_count,
        r.created_at,
        MIN(b.price_min) AS price_min,
        MAX(b.price_max) AS price_max
      FROM market_analysis_run r
      LEFT JOIN market_price_band_analysis b
        ON b.run_id = r.id
      ${runWhere.length ? `WHERE ${runWhere.join(' AND ')}` : ''}
      GROUP BY r.id, r.keyword, r.competitor_count, r.created_at
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 500
    `, runParams)

    const generatedKeywordCounts = new Map()
    const generatedBuckets = new Map()
    for (const row of runRows) {
      const label = String(row.keyword || '').trim()
      if (!label) continue
      const key = label.toLowerCase()
      const current = generatedBuckets.get(key) || {
        id: `run-group-${Buffer.from(key).toString('base64url')}`,
        source: 'market_analysis_group',
        runId: toInt(row.id),
        keyword: label,
        priceMin: null,
        priceMax: null,
        competitorCount: 0,
        collectTime: row.created_at,
        status: 'generated',
        reportTitle: '',
        runIds: [],
      }
      current.runIds.push(toInt(row.id))
      if (!generatedKeywordCounts.has(key)) generatedKeywordCounts.set(key, toInt(row.competitor_count))
      if (!current.competitorCount) current.competitorCount = toInt(row.competitor_count)
      const low = money(row.price_min)
      const high = money(row.price_max)
      current.priceMin = current.priceMin == null ? low : Math.min(current.priceMin, low ?? current.priceMin)
      current.priceMax = current.priceMax == null ? high : Math.max(current.priceMax, high ?? current.priceMax)
      if (String(row.created_at || '') > String(current.collectTime || '')) {
        current.collectTime = row.created_at
        current.runId = toInt(row.id)
      }
      generatedBuckets.set(key, current)
    }

    const generatedRows = Array.from(generatedBuckets.values()).map((row) => ({
      id: row.id,
      source: row.source,
      runId: row.runId,
      runIds: row.runIds,
      keyword: row.keyword,
      priceRange: priceRangeText(row.priceMin, row.priceMax),
      competitorCount: row.competitorCount,
      collectTime: row.collectTime,
      status: row.status,
      reportTitle: `${row.keyword || '报告'}${compactDateTime(row.collectTime)}`,
    }))

    const rawWhere = []
    const rawParams = []
    if (search) {
      rawWhere.push('(p.product_title LIKE ? OR p.category_name LIKE ? OR sf.local_path LIKE ?)')
      rawParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (cleanStart) {
      rawWhere.push('p.created_at >= ?')
      rawParams.push(`${cleanStart} 00:00:00`)
    }
    if (cleanEnd) {
      rawWhere.push('p.created_at <= ?')
      rawParams.push(`${cleanEnd} 23:59:59`)
    }

    const [snapshotRows] = await connection.query(`
      SELECT
        p.id,
        p.job_id,
        p.product_id,
        p.product_title,
        p.category_name,
        p.created_at,
        COALESCE(p.effective_min_price, p.min_coupon_price, p.min_price, p.effective_max_price, p.max_coupon_price, p.max_price) AS price_min,
        COALESCE(p.effective_max_price, p.max_coupon_price, p.max_price, p.effective_min_price, p.min_coupon_price, p.min_price) AS price_max,
        sf.local_path
      FROM product_snapshot p
      LEFT JOIN (
        SELECT job_id, MIN(local_path) AS local_path
        FROM source_file_record
        WHERE local_path IS NOT NULL AND local_path <> ''
        GROUP BY job_id
      ) sf ON sf.job_id = p.job_id
      ${rawWhere.length ? `WHERE ${rawWhere.join(' AND ')}` : ''}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 500
    `, rawParams)

    const rawBuckets = new Map()
    for (const row of snapshotRows) {
      const fallbackLabel = search || leafName(row.category_name)
      const label = collectionNameFromPath(row.local_path, fallbackLabel)
      if (!label) continue
      const key = label.toLowerCase()
      const collectionKey = collectionKeyFromPath(row.local_path, `${key}-${row.job_id || row.id}`)
      const current = rawBuckets.get(collectionKey) || {
        id: `raw-${Buffer.from(collectionKey).toString('base64url')}`,
        source: 'product_snapshot',
        keywordKey: key,
        keyword: label,
        priceMin: null,
        priceMax: null,
        productIds: new Set(),
        competitorCount: 0,
        collectTime: row.created_at,
        status: 'not_generated',
        reportTitle: '',
      }
      const productKey = String(row.product_id || row.id)
      if (!current.productIds.has(productKey)) {
        current.productIds.add(productKey)
        current.competitorCount += 1
      }
      const low = money(row.price_min)
      const high = money(row.price_max)
      current.priceMin = current.priceMin == null ? low : Math.min(current.priceMin, low ?? current.priceMin)
      current.priceMax = current.priceMax == null ? high : Math.max(current.priceMax, high ?? current.priceMax)
      if (String(row.created_at || '') > String(current.collectTime || '')) current.collectTime = row.created_at
      rawBuckets.set(collectionKey, current)
    }

    const rawRows = Array.from(rawBuckets.values())
      .filter((row) => {
        const generatedCount = generatedKeywordCounts.get(row.keywordKey) || 0
        return row.competitorCount > generatedCount
      })
      .map((row) => ({
        id: row.id,
        source: row.source,
        keyword: row.keyword,
        competitorCount: row.competitorCount,
        collectTime: row.collectTime,
        status: row.status,
        reportTitle: row.reportTitle,
        priceRange: priceRangeText(row.priceMin, row.priceMax),
      }))

    let rows = [...generatedRows, ...rawRows].sort((a, b) => String(b.collectTime || '').localeCompare(String(a.collectTime || '')))
    if (cleanStatus) rows = rows.filter((row) => row.status === cleanStatus)
    return { ok: true, rows }
  })
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export async function listSuiteProducts(query = '') {
  const search = String(query || '').trim()
  const params = []
  let where = `
    WHERE keyword IS NOT NULL
      AND keyword <> ""
      AND report_json IS NOT NULL
      AND report_json <> ""
  `
  if (search) {
    where += ' AND (keyword LIKE ? OR report_no LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const rows = await withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    const [result] = await connection.query(`
      SELECT id, keyword, report_no, competitor_count, created_at, report_json
      FROM market_analysis_run
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT 500
    `, params)
    return result
  })

  const latestByKeyword = []
  const seenKeywords = new Set()
  for (const row of rows) {
    const key = String(row.keyword || '').trim()
    if (!key || seenKeywords.has(key)) continue
    const reportJson = parseJson(row.report_json, {}) || {}
    if (!safeArray(reportJson.price_band_report).length) continue
    seenKeywords.add(key)
    latestByKeyword.push(row)
    if (latestByKeyword.length >= 100) break
  }

  return {
    ok: true,
    products: latestByKeyword.map((row) => {
      const reportJson = parseJson(row.report_json, {}) || {}
      const bands = collapseManualOverallBands(reportJson.price_band_report || [])
      const prices = bands.flatMap((band) => [band.price_min, band.price_max]).map((value) => money(value)).filter((value) => value != null)
      const priceRange = prices.length ? priceRangeText(Math.min(...prices), Math.max(...prices)) : '-'
      const title = `${row.keyword || '商品'}${compactDateTime(row.created_at)}`
      return {
        value: `run-${row.id}`,
        label: title,
        keyword: row.keyword,
        reportId: toInt(row.id),
        count: toInt(row.competitor_count ?? reportJson.summary?.competitor_count),
        priceRange,
        latestRunId: toInt(row.id),
        latestAt: row.created_at,
        status: 'completed',
      }
    }),
  }
}

async function findLatestAnalysisRun(connection, keyword, runId = null) {
  const cleanRunId = toInt(runId, null)
  if (cleanRunId != null && cleanRunId > 0) {
    const [rows] = await connection.query(`
      SELECT *
      FROM market_analysis_run
      WHERE id = ?
      LIMIT 1
    `, [cleanRunId])
    return rows[0] || null
  }
  const [rows] = await connection.query(`
    SELECT *
    FROM market_analysis_run
    WHERE keyword = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `, [keyword])
  return rows[0] || null
}

export async function listSuitePriceBands(keyword) {
  const cleanKeyword = String(keyword || '').trim()
  if (!cleanKeyword) return { ok: true, bands: [] }
  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    const run = await findLatestAnalysisRun(connection, cleanKeyword)
    if (!run) return { ok: true, bands: [], run: null }
    const [bands] = await connection.query(`
      SELECT id, price_band, competitor_count, price_min, price_max, price_avg, sold_count_total, sales_amount_total
      FROM market_price_band_analysis
      WHERE run_id = ?
      ORDER BY COALESCE(price_min, 0), id
    `, [run.id])

    return {
      ok: true,
      run: {
        id: run.id,
        keyword: run.keyword,
        createdAt: run.created_at,
      },
      bands: bands.map((band) => ({
        id: band.id,
        price_band: band.price_band,
        competitor_count: toInt(band.competitor_count),
        price_min: money(band.price_min),
        price_max: money(band.price_max),
        price_avg: money(band.price_avg),
        sold_count_total: toInt(band.sold_count_total),
        sales_amount_total: money(band.sales_amount_total),
      })),
    }
  })
}

function normalizeSuiteRunId(value) {
  const text = String(value || '').trim()
  const numeric = text.startsWith('run-') ? Number(text.replace(/^run-/, '')) : Number(text)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

export async function getSuiteMainImageDescriptions({ keyword, priceBand, runId }) {
  const cleanKeyword = String(keyword || '').trim()
  const cleanBand = String(priceBand || '').trim()
  const cleanRunId = normalizeSuiteRunId(runId)
  if (!cleanKeyword && !cleanRunId) throw new Error('请选择已完成的整体报告')

  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    const run = await findLatestAnalysisRun(connection, cleanKeyword, cleanRunId)
    if (!run) throw new Error(`没有找到对应的整体报告，请先在竞品报告页生成并入库。`)
    const reportJson = parseJson(run.report_json, {}) || {}
    if (!safeArray(reportJson.price_band_report).length) throw new Error('该记录没有完整的竞品价格段报告，请先点击“AI生成整体报告”。')
    const reportView = transformReportForAnalysisView(run)
    const runIds = [toInt(run.id)].filter((id) => id > 0)
    const keywordMatrix = reportView ? await buildKeywordMatrixForReport(connection, { runIds, keyword: reportView.keyword, report: reportView }) : null
    const recommendationActions = reportView ? await buildRecommendationActionsForReport(connection, { runIds, keyword: reportView.keyword, report: reportView, keywordMatrix }) : null
    const mainImagePointsByProduct = reportView
      ? await loadMainImageSellingPointsByProduct(connection, safeArray(reportView.priceBandProducts).flatMap((band) => safeArray(band.products).map((p) => p.id)))
      : null
    const listingSellingPoints = reportView ? buildListingSellingPointsForReport({ keyword: reportView.keyword, report: reportView, keywordMatrix, recommendationActions, mainImagePointsByProduct }) : null

    const [bandRows] = await connection.query(`
      SELECT *
      FROM market_price_band_analysis
      WHERE run_id = ?
    `, [run.id])
    let band = null
    if (cleanBand) {
      const cleanBandKey = normalizePriceBandKey(cleanBand)
      band = bandRows.find((item) => normalizePriceBandKey(item.price_band) === cleanBandKey)
      if (!band) throw new Error(`没有找到价格段“${cleanBand}”`)
    } else {
      band = collapseManualOverallBands(reportJson.price_band_report || [])[0] || null
    }
    if (!band) throw new Error('该整体报告没有可用于生成套图的主图文本。')

    let productRows = []
    if (cleanBand) {
      ;[productRows] = await connection.query(`
      SELECT
        p.*,
        lg.title_text AS listing_title_text,
        lg.main_image_prompt AS listing_main_image_prompt,
        lg.detail_image_prompt AS listing_detail_image_prompt,
        lg.buyer_show_prompt AS listing_buyer_show_prompt,
        (
          SELECT asset_url
          FROM market_product_asset a
          WHERE a.product_analysis_id = p.id
          ORDER BY a.sort_no ASC, a.id ASC
          LIMIT 1
        ) AS first_image_url
      FROM market_price_band_product_analysis p
      LEFT JOIN market_listing_generation lg
        ON lg.product_analysis_id = p.id
      WHERE p.run_id = ? AND p.price_band_id = ?
      ORDER BY COALESCE(p.sold_count, 0) DESC, p.id ASC
      `, [run.id, band.id])
    } else {
      productRows = (band.product_analysis || []).map((product) => ({
        id: product.product_analysis_id || product.id || product.product_id,
        product_id: product.product_id,
        product_title: product.product_title || product.title,
        price: product.price || product.price_avg,
        sold_count: product.sold_count,
        sales_amount: product.sales_amount,
        product_link: product.product_link || product.product_url,
        shop_name: product.shop_name,
        sku_count: product.sku_count,
        image_prompts_json: JSON.stringify(product.image_prompts || {}),
        selling_points_json: JSON.stringify(product.selling_points || []),
        demands_json: JSON.stringify(product.demands || []),
        image_json: JSON.stringify(product.images || []),
        first_image_url: product.image_url || product.main_image_url || product.images?.[0]?.url || product.images?.[0]?.image_url || '',
      }))
    }

    const bandPrompts = parseJson(band.image_prompts_json, null) || band.image_prompts || {}
    const descriptions = productRows.map((row) => {
      const prompts = parseJson(row.image_prompts_json, {}) || {}
      const sellingPoints = parseJson(row.selling_points_json, []) || []
      const demands = parseJson(row.demands_json, []) || []
      const images = parseJson(row.image_json, []) || []
      const imageUrl = normalizeUrl(row.first_image_url) || normalizeUrl(images[0]?.url || images[0]?.image_url || images[0]?.sku_image_url)
      return {
        product_analysis_id: row.id,
        product_id: row.product_id,
        title: row.product_title,
        price: money(row.price),
        sold_count: toInt(row.sold_count, 0),
        sales_amount: money(row.sales_amount),
        product_link: row.product_link,
        image_url: imageUrl,
        title_direction: prompts.title_direction || row.listing_title_text || bandPrompts.title_direction || '',
        main_image_prompt: prompts.main_image_prompt || row.listing_main_image_prompt || bandPrompts.main_image_prompt || '',
        detail_image_prompt: prompts.detail_image_prompt || row.listing_detail_image_prompt || bandPrompts.detail_image_prompt || '',
        buyer_show_prompt: prompts.buyer_show_prompt || row.listing_buyer_show_prompt || bandPrompts.buyer_show_prompt || '',
        selling_points: sellingPoints,
        demands,
      }
    })
    const suitePriceRange = priceRangeText(band.price_min, band.price_max)

    return {
      ok: true,
      run: {
        id: run.id,
        keyword: run.keyword,
        createdAt: run.created_at,
      },
      report: reportView ? {
        id: run.id,
        keyword: reportView.keyword,
        title: reportView.title,
        priceRange: suitePriceRange || reportView.priceRange,
        competitorCount: reportView.competitorCount,
        source: reportView.source,
      } : null,
      band: {
        id: band.id || run.id,
        price_band: cleanBand ? band.price_band : '全量竞品集合',
        competitor_count: toInt(band.competitor_count),
        price_min: money(band.price_min),
        price_max: money(band.price_max),
        price_avg: money(band.price_avg),
        sold_count_total: toInt(band.sold_count_total),
        sales_amount_total: money(band.sales_amount_total),
        image_prompts: bandPrompts,
        selling_points: parseJson(band.selling_points_json, []) || [],
        demands: parseJson(band.demands_json, []) || [],
      },
      descriptions,
      keywordMatrix,
      recommendationActions,
      listingSellingPoints,
      mainImagePromptSeed: buildMainImagePromptSeed({
        keyword: reportView?.keyword || run.keyword,
        report: reportView,
        band: {
          price_band: cleanBand ? band.price_band : '全量竞品集合',
          price_min: money(band.price_min),
          price_max: money(band.price_max),
          competitor_count: toInt(band.competitor_count),
          priceRange: suitePriceRange,
        },
        listingSellingPoints,
      }),
    }
  })
}

async function fetchCompetitorDataset(keyword, limit) {
  const safeLimit = Math.max(1, Math.min(200, toInt(limit, 120)))
  const like = `%${keyword}%`
  return withConnection(async (connection) => {
    const [products] = await connection.query(`
      SELECT p.*
      FROM product_snapshot p
      JOIN (
        SELECT MAX(id) AS id
        FROM product_snapshot
        WHERE product_title LIKE ? OR category_name LIKE ?
        GROUP BY COALESCE(NULLIF(product_id, ''), CAST(id AS CHAR))
      ) latest ON latest.id = p.id
      ORDER BY COALESCE(p.sold_count, p.monthly_received, p.payer_count, 0) DESC, p.id DESC
      LIMIT ${safeLimit}
    `, [like, like])

    const productIds = products.map((item) => item.product_id).filter(Boolean)
    if (!productIds.length) return []

    const [skus] = await connection.query(`
      SELECT *
      FROM product_sku_snapshot
      WHERE product_id IN (?)
      ORDER BY id DESC
    `, [productIds])

    const [qaRows] = await connection.query(`
      SELECT *
      FROM product_qa_snapshot
      WHERE product_id IN (?)
      ORDER BY id DESC
    `, [productIds])

    const [mediaRows] = await connection.query(`
      SELECT *
      FROM media_asset
      WHERE product_id IN (?)
      ORDER BY sort_no ASC, id DESC
    `, [productIds])

    const skuByProduct = new Map()
    for (const row of skus) {
      const bucket = skuByProduct.get(row.product_id) || []
      if (bucket.length < 16) bucket.push(row)
      skuByProduct.set(row.product_id, bucket)
    }

    const qaByProduct = new Map()
    for (const row of qaRows) {
      const bucket = qaByProduct.get(row.product_id) || []
      if (bucket.length < 12) bucket.push(row)
      qaByProduct.set(row.product_id, bucket)
    }

    const mediaByProduct = new Map()
    for (const row of mediaRows) {
      const bucket = mediaByProduct.get(row.product_id) || []
      if (bucket.length < 16) bucket.push(row)
      mediaByProduct.set(row.product_id, bucket)
    }

    return products.map((product) => {
      const productSkus = skuByProduct.get(product.product_id) || []
      const productMedia = mediaByProduct.get(product.product_id) || []
      const skuImages = productSkus
        .map((sku) => ({
          image_type: 'sku',
          product_id: product.product_id,
          sku_id: sku.sku_id,
          url: imageUrlFrom(sku),
          sku_title: sku.sku_title,
          sku_info: sku.sku_info,
          price: money(firstNumber(sku.coupon_price, sku.price)),
        }))
        .filter((image) => image.url)
      const mediaImages = productMedia
        .map((asset) => ({
          image_type: asset.image_type || 'media',
          product_id: product.product_id,
          sku_id: asset.sku_id,
          url: imageUrlFrom(asset),
          path: asset.storage_path,
          file_name: asset.file_name,
        }))
        .filter((image) => image.url)
      const images = [...mediaImages, ...skuImages]
      const seen = new Set()
      const uniqueImages = images.filter((image) => {
        const key = `${image.url}|${image.sku_id || ''}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      const price = firstNumber(
        product.effective_min_price,
        product.min_coupon_price,
        product.min_price,
        product.effective_max_price,
        product.max_coupon_price,
        product.max_price,
      )
      const sold = toInt(product.sold_count ?? product.monthly_received ?? product.payer_count, 0)
      const salesAmount = money(firstNumber(product.sales_amount, price != null ? price * sold : null))

      return {
        job_id: product.job_id,
        product_id: product.product_id,
        product_title: product.product_title,
        category_name: product.category_name,
        product_link: product.product_url || (product.product_id ? `https://item.taobao.com/item.htm?id=${product.product_id}` : ''),
        price,
        price_min: money(firstNumber(product.effective_min_price, product.min_coupon_price, product.min_price)),
        price_max: money(firstNumber(product.effective_max_price, product.max_coupon_price, product.max_price)),
        sold_count: sold,
        sales_amount: salesAmount,
        review_count: toInt(product.review_count, 0),
        favorite_count: toInt(product.favorite_count, 0),
        question_count: toInt(product.question_count, 0),
        skus: productSkus.map((sku) => ({
          sku_id: sku.sku_id,
          sku_title: sku.sku_title,
          sku_info: sku.sku_info,
          price: money(sku.price),
          coupon_price: money(sku.coupon_price),
          stock_qty: toInt(sku.stock_qty, null),
          sku_image_url: normalizeUrl(sku.sku_image_url),
        })),
        images: uniqueImages.slice(0, 12),
        qa_examples: (qaByProduct.get(product.product_id) || []).map((qa) => ({
          question: qa.question,
          answer: qa.answer,
        })),
      }
    })
  })
}

function buildPriceBands(products) {
  const priced = products.filter((product) => product.price != null).sort((a, b) => a.price - b.price)
  if (!priced.length) return []
  const bandCount = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(priced.length))))
  const bands = []
  for (let index = 0; index < bandCount; index += 1) {
    const start = Math.floor((index * priced.length) / bandCount)
    const end = Math.floor(((index + 1) * priced.length) / bandCount)
    const items = priced.slice(start, end)
    if (!items.length) continue
    const min = money(Math.min(...items.map((item) => item.price)))
    const max = money(Math.max(...items.map((item) => item.price)))
    const label = min === max ? `${min}元` : `${min}-${max}元`
    bands.push({ price_band: label, products: items })
  }

  const merged = new Map()
  for (const band of bands) {
    const current = merged.get(band.price_band) || []
    current.push(...band.products)
    merged.set(band.price_band, current)
  }
  return Array.from(merged.entries()).map(([price_band, items]) => ({ price_band, products: items }))
}

function calculateProfit(targetPrice, costModel) {
  const price = toNumber(targetPrice, null)
  const costPrice = toNumber(costModel.costPrice, null)
  if (price == null || costPrice == null) return null
  const variableCost = toNumber(costModel.shippingCost, 0) + toNumber(costModel.packagingCost, 0) + toNumber(costModel.laborCost, 0)
  const rateCost = price * (toNumber(costModel.platformFeeRate, 0) + toNumber(costModel.adFeeRate, 0))
  const totalCost = money(costPrice + variableCost + rateCost)
  const grossProfit = money(price - totalCost)
  const grossMargin = price > 0 ? money(grossProfit / price) : null
  const targetMargin = toNumber(costModel.targetMargin, 0.3)
  const breakEvenPrice = money((costPrice + variableCost) / Math.max(0.01, 1 - toNumber(costModel.platformFeeRate, 0) - toNumber(costModel.adFeeRate, 0)))
  const targetMarginPrice = money((costPrice + variableCost) / Math.max(0.01, 1 - toNumber(costModel.platformFeeRate, 0) - toNumber(costModel.adFeeRate, 0) - targetMargin))
  return {
    target_price: money(price),
    total_cost: totalCost,
    gross_profit: grossProfit,
    gross_margin: grossMargin,
    break_even_price: breakEvenPrice,
    target_margin_price: targetMarginPrice,
  }
}

function buildNumericReport(keyword, products, costModel) {
  const bands = buildPriceBands(products)
  const priceBandReport = bands.map((band) => {
    const items = band.products
    const prices = items.map((item) => item.price).filter((price) => price != null)
    const soldTotal = items.reduce((sum, item) => sum + toInt(item.sold_count, 0), 0)
    const salesTotal = items.reduce((sum, item) => sum + toNumber(item.sales_amount, 0), 0)
    const images = items.flatMap((item) => item.images.map((image) => ({ ...image, product_id: item.product_id }))).slice(0, 24)
    const qaExamples = items.flatMap((item) => item.qa_examples || []).slice(0, 8)
    const avg = prices.length ? money(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null
    return {
      price_band: band.price_band,
      competitor_count: items.length,
      price_min: prices.length ? money(Math.min(...prices)) : null,
      price_max: prices.length ? money(Math.max(...prices)) : null,
      price_avg: avg,
      sold_count_total: soldTotal,
      sales_amount_total: money(salesTotal),
      competitor_links: items.map((item) => ({
        product_id: item.product_id,
        title: item.product_title,
        price: item.price,
        sold_count: item.sold_count,
        sales_amount: item.sales_amount,
        link: item.product_link,
      })),
      display_images: {
        available_images: images,
        note: images.length ? 'AI 已读取该价格段代表商品图片，并结合标题、SKU、问大家提炼卖点。' : '该价格段暂无可读取图片链接。',
      },
      extracted_selling_points: [],
      qa_and_review: {
        review_count_total: items.reduce((sum, item) => sum + toInt(item.review_count, 0), 0),
        qa_count_total: items.reduce((sum, item) => sum + (item.qa_examples || []).length, 0),
        qa_examples: qaExamples,
      },
      extracted_demands: [],
      profit_simulation: calculateProfit(avg, costModel),
      image_prompts: {},
      product_analysis: items.map((item) => ({
        ...item,
        sku_count: item.skus.length,
        qa_count: item.qa_examples.length,
        image_count: item.images.length,
        selling_points: [],
        demands: [],
        profit_simulation: calculateProfit(item.price, costModel),
        image_prompts: {},
      })),
    }
  })

  return {
    summary: {
      keyword,
      source: 'mysql_ark_vision',
      analysis_engine: 'ark_vision',
      analysis_model: currentModel(),
      competitor_count: products.length,
      price_band_count: priceBandReport.length,
      cost_price: costModel.costPrice,
      cost_model: costModel,
    },
    price_band_report: priceBandReport,
    data_gaps: [],
  }
}

function filterReportToPriceBand(report, targetPriceBand) {
  const cleanBand = String(targetPriceBand || '').trim()
  if (!cleanBand) return report
  const cleanBandKey = normalizePriceBandKey(cleanBand)
  const selectedBands = report.price_band_report.filter((band) => normalizePriceBandKey(band.price_band) === cleanBandKey)
  if (!selectedBands.length) {
    throw new Error(`没有找到价格段“${cleanBand}”，请先刷新价格段后再生成报告。`)
  }
  const selectedBandLabel = selectedBands[0]?.price_band || cleanBand
  const competitorCount = selectedBands.reduce((sum, band) => sum + toInt(band.competitor_count, 0), 0)
  return {
    ...report,
    summary: {
      ...report.summary,
      competitor_count: competitorCount,
      price_band_count: selectedBands.length,
      target_price_band: selectedBandLabel,
    },
    price_band_report: selectedBands,
    data_gaps: [
      ...(report.data_gaps || []),
      `本次仅分析价格段：${selectedBandLabel}。其他价格段仅用于前置分类，不进入本次 AI 视觉分析。`,
    ],
  }
}

export async function previewMarketPriceBands({
  keyword,
  limit,
  costPrice,
  shippingCost = 0,
  packagingCost = 0,
  laborCost = 0,
  platformFeeRate = 0,
  adFeeRate = 0,
  targetMargin = 0.3,
}) {
  const cleanKeyword = String(keyword || '').trim()
  if (!cleanKeyword) return { ok: true, bands: [] }
  const products = await fetchCompetitorDataset(cleanKeyword, limit)
  if (!products.length) return { ok: true, bands: [] }
  const report = buildNumericReport(cleanKeyword, products, {
    costPrice: costPrice == null || costPrice === '' ? null : toNumber(costPrice, null),
    shippingCost: toNumber(shippingCost, 0),
    packagingCost: toNumber(packagingCost, 0),
    laborCost: toNumber(laborCost, 0),
    platformFeeRate: toNumber(platformFeeRate, 0),
    adFeeRate: toNumber(adFeeRate, 0),
    targetMargin: toNumber(targetMargin, 0.3),
  })
  return {
    ok: true,
    keyword: cleanKeyword,
    competitor_count: products.length,
    bands: report.price_band_report.map((band) => ({
      price_band: band.price_band,
      competitor_count: band.competitor_count,
      price_min: band.price_min,
      price_max: band.price_max,
      price_avg: band.price_avg,
      sold_count_total: band.sold_count_total,
      sales_amount_total: band.sales_amount_total,
      competitor_links: band.competitor_links,
      display_images: band.display_images,
      qa_and_review: band.qa_and_review,
      profit_simulation: band.profit_simulation,
      image_count: (band.display_images?.available_images || []).length,
      qa_count_total: band.qa_and_review?.qa_count_total || 0,
      gross_margin: band.profit_simulation?.gross_margin ?? null,
    })),
  }
}

function compactForPrompt(report) {
  return {
    summary: report.summary,
    price_band_report: report.price_band_report.map((band) => ({
      price_band: band.price_band,
      competitor_count: band.competitor_count,
      price_min: band.price_min,
      price_max: band.price_max,
      price_avg: band.price_avg,
      sold_count_total: band.sold_count_total,
      sales_amount_total: band.sales_amount_total,
      review_count_total: band.qa_and_review.review_count_total,
      qa_count_total: band.qa_and_review.qa_count_total,
      qa_examples: (band.qa_and_review.qa_examples || []).slice(0, 80),
      products: band.product_analysis
        .slice()
        .sort((a, b) => toInt(b.sold_count, 0) - toInt(a.sold_count, 0))
        .slice(0, 20)
        .map((product) => ({
          product_id: product.product_id,
          title: product.product_title,
          price: product.price,
          sold_count: product.sold_count,
          sales_amount: product.sales_amount,
          skus: product.skus.slice(0, 8).map((sku) => ({
            sku_title: sku.sku_title,
            sku_info: sku.sku_info,
            price: sku.price,
            coupon_price: sku.coupon_price,
          })),
          qa_examples: product.qa_examples.slice(0, 12),
          image_count: product.images.length,
        })),
    })),
  }
}

function reportOutputSchema() {
  return {
    report_title: '{{产品名称}}竞品市场分析与 Listing 图片生成策略报告',
    analysis_scope: {
      product_name: '产品名称',
      site: '平台/站点',
      category: '类目',
      data_time: '数据时间',
      sample_product_count: 0,
      valid_product_count: 0,
      review_sample_count: 0,
      keyword_count: 0,
      data_sources: ['商品数据', '销量数据', '评论/问大家', 'SKU', '主图/详情图/单品图片分析报告'],
      data_note: '数据说明',
    },
    market_core_conclusions: {
      one_sentence_judgement: '一句话判断市场竞争状态和主要机会',
      core_metrics: {
        total_sales_amount: 0,
        total_sold_count: 0,
        top_10_sales_share: '百分比或暂无',
        top_3_brand_sales_share: '百分比或暂无',
        mainstream_price_band: '主流价格带',
        high_sales_avg_rating: '暂无或数值',
        high_sales_avg_review_count: '暂无或数值',
      },
      top_conclusions: [{
        title: '结论标题',
        data_basis: '销量/销售额/商品数量依据',
        market_meaning: '市场含义',
        image_impact: '对 Listing 图片的影响',
      }],
      differentiation_directions: [{
        direction_title: '方向标题，必须体现同类竞品商品之间的差异化机会',
        compared_products: ['高销量/高销额代表商品及其卖点', '普通或低表现代表商品及其不足'],
        sales_evidence: '引用销量/销额/价格/评价数等证据',
        review_qa_evidence: '引用评价或问大家反馈；没有则明确样本不足',
        opportunity_score: {
          sales_validation_score: 5,
          demand_strength_score: 5,
          competitor_gap_score: 4,
          visual_expression_score: 5,
          overall_score: 19,
          score_reason: '为什么值得作为差异化方向',
        },
        market_meaning: '这个差异化为什么能影响转化',
        image_strategy: 'Listing 图片应该如何表达',
      }],
    },
    sales_structure: {
      representative_products: [{
        rank: 1,
        brand_or_model: '品牌/型号或标题',
        price: 0,
        monthly_sold: 0,
        monthly_sales_amount: 0,
        rating: '暂无',
        core_selling_points: ['核心卖点'],
        representative_reason: '销售额最高/销量最高/高客单代表/差异化代表/新品增长代表',
      }],
      price_band_analysis: [{
        price_band: '必须与输入 price_band_report 完全一致',
        product_count_share: '商品数量占比',
        sold_share: '销量占比',
        sales_share: '销售额占比',
        avg_rating: '暂无或数值',
        main_selling_points: ['主要卖点'],
        market_judgement: '市场判断',
      }],
      brand_concentration: [{
        brand: '品牌或店铺',
        product_count: 0,
        sold_share: '销量占比',
        sales_share: '销售额占比',
        avg_price: 0,
        main_positioning: '主要定位',
      }],
      conclusions: ['销售结构结论'],
    },
    high_sales_selling_point_analysis: {
      selling_point_performance: [{
        selling_point: '卖点',
        product_coverage_rate: '覆盖率',
        covered_product_sales_share: '销售额占比',
        high_sales_product_coverage_rate: '高销量覆盖率',
        user_attention: '高/中/低',
        market_attribute: '基础卖点/核心卖点/差异化卖点/弱卖点',
      }],
      categories: {
        market_basic_selling_points: ['基础卖点'],
        validated_conversion_selling_points: ['高转化卖点'],
        homogenized_selling_points: ['同质化卖点'],
        opportunity_selling_points: ['机会卖点'],
      },
      image_strategy_notes: {
        market_basic_selling_points: '必须展示，但不建议占据最重要图片',
        validated_conversion_selling_points: '进入前 2-4 张副图并通过场景、对比或细节证明',
        homogenized_selling_points: '保留但降低视觉优先级',
        opportunity_selling_points: '优先作为差异化图片内容',
      },
    },
    consumer_demand_analysis: {
      top_purchase_needs: [{
        rank: 1,
        user_need: '用户需求',
        review_mention_rate: '评论/问大家提及率',
        keyword_demand: '关键词需求',
        high_sales_product_satisfaction: '高/中/低',
        market_gap: '高/中/低',
        reason: '用户为什么需要',
        scenario: '使用场景',
        current_satisfaction: '现有产品是否满足',
        image_expression: '图片如何表现',
      }],
      positive_review_needs: [{
        theme: '好评主题',
        mention_count: 0,
        related_products: ['商品ID或标题'],
        user_benefit: '用户收益',
        image_selling_point: '可转化图片卖点',
        representative_comment_summary: '代表评论概括',
        analysis_conclusion: '分析结论',
      }],
      negative_pain_points: [{
        pain_point: '差评痛点',
        mention_count: 0,
        related_product_count: 0,
        conversion_impact: '高/中/低',
        reverse_selling_point: '可反推卖点',
      }],
      usage_scenarios: [{
        scenario: '使用场景',
        demand_strength: '高/中/低',
        related_need: '对应需求',
        competitor_coverage: '竞品覆盖度',
        image_opportunity: '图片机会',
      }],
    },
    selling_point_opportunity_matrix: [{
      selling_point: '卖点',
      demand_strength_score: 5,
      sales_validation_score: 5,
      competition_gap_score: 3,
      visual_expression_score: 5,
      overall_suggestion: '必须展示/核心差异化/文案辅助/不建议重点展示',
      priority: 'P0/P1/P2',
    }],
    product_positioning_visual_strategy: {
      target_audience: '目标人群',
      core_usage_scenarios: ['核心使用场景'],
      suggested_price_band: '建议价格带',
      one_sentence_positioning: '产品是什么 + 为谁解决什么问题 + 与竞品有什么不同',
      core_selling_point_levels: [{
        level: '第一核心卖点',
        selling_point: '卖点',
        user_benefit: '用户收益',
        data_basis: '数据依据',
        visual_expression: '建议视觉表现',
        suggested_copy: '建议短文案',
      }],
      visual_differentiation: [{
        dimension: '背景风格/产品颜色/场景选择/人物使用/文案结构/功能表现/视觉气质',
        competitor_common_practice: '竞品普遍做法',
        our_product_suggestion: '本产品建议',
      }],
    },
    listing_image_overall_plan: [{
      image_no: 1,
      image_module: '白底主图/核心定位图/痛点解决图/核心功能图/使用场景图/细节品质图/参数对比图/多场景包装图',
      main_task: '这张图承担的转化任务',
      core_selling_point: '核心卖点',
      user_need: '用户需求',
      data_basis: '销售/评论/图片依据',
    }],
    single_image_generation_plan: [{
      image_no: 1,
      image_name: '图片名称',
      image_goal: '解决什么转化问题',
      market_basis: {
        sales_data_basis: '销售数据依据',
        user_need_basis: '用户需求依据',
        competitor_gap: '竞品缺口',
      },
      core_selling_point: '只保留一个主卖点，最多两个辅助信息',
      user_benefit: '消费者最终得到什么',
      visual_content: {
        product_position: '产品位置',
        product_ratio: '产品占比',
        usage_scene: '使用场景',
        person_state: '人物状态',
        function_visualization: '功能可视化方式',
        detail_zoom: '细节放大内容',
        auxiliary_elements: '辅助元素',
        background: '背景环境',
      },
      copy_hierarchy: {
        main_title: '短结果型卖点，字数尽量少',
        subtitle: '参数、证明或场景补充',
        badges: ['短标签1', '短标签2', '短标签3'],
      },
      layout_suggestion: {
        composition: '构图',
        visual_focus: '视觉焦点',
        text_position: '文字位置',
        reading_order: '信息阅读顺序',
        whitespace: '留白位置',
        comparison_or_arrow: '对比或箭头方式',
      },
      generation_focus: {
        must_show: ['必须展示'],
        can_show: ['可以展示'],
        avoid: ['不要出现'],
        consistent_product_features: ['需要保持一致的产品特征'],
      },
      full_prompt: '完整生图提示词',
    }],
    final_image_decision_card: {
      market_judgement: {
        mainstream_price_band: '主流价格带',
        max_sold_band: '最大销量区间',
        max_sales_amount_band: '最大销售额区间',
        head_brands: ['头部品牌'],
        market_maturity: '市场成熟度',
      },
      consumer_needs: {
        first_need: '第一需求',
        second_need: '第二需求',
        third_need: '第三需求',
        biggest_pain_point: '最大痛点',
        main_usage_scenario: '主要使用场景',
      },
      product_positioning: {
        target_audience: '目标人群',
        suggested_price: '建议价格',
        one_sentence_positioning: '一句话定位',
        first_core_selling_point: '第一核心卖点',
        second_core_selling_point: '第二核心卖点',
        third_core_selling_point: '第三核心卖点',
      },
      image_strategy: {
        first_sub_image: '第一张副图展示',
        second_sub_image: '第二张副图展示',
        third_sub_image: '第三张副图展示',
        must_have_scenes: ['必须出现的场景'],
        must_show_details: ['必须展示的产品细节'],
        not_recommended_focus: ['不建议重点展示的卖点'],
        suggested_visual_style: '建议整体视觉风格',
      },
      final_image_order: ['白底主图', '第一核心卖点', '高频痛点解决', '核心性能证明', '重点使用场景', '品质与细节', '参数/尺寸/对比', '多场景/包装/售后'],
    },
    price_band_report: [{
      price_band: '必须与输入完全一致',
      extracted_selling_points: [{ term: '卖点词', count: 1, evidence: '来自标题/图片/SKU的证据' }],
      extracted_demands: [{ term: '需求或痛点', count: 1, evidence: '来自问大家/评价/图片/标题的证据' }],
      image_prompts: {
        title_direction: '标题方向',
        main_image_prompt: '第一张主图提示词',
        detail_image_prompt: '详情图提示词',
        buyer_show_prompt: '买家秀提示词',
      },
      visual_summary: '这个价格段图片共性和爆品图特性',
      product_analysis: [{
        product_id: '商品ID',
        selling_points: [{ term: '卖点', count: 1 }],
        demands: [{ term: '需求', count: 1 }],
        image_prompts: {
          main_image_prompt: '单商品主图提示词',
          detail_image_prompt: '单商品详情图提示词',
          buyer_show_prompt: '单商品买家秀提示词',
        },
        visual_observation: '该商品图片表达特点',
      }],
    }],
  }
}

function collectFinalReportContent(report, visualBatchSummaries = []) {
  const content = [{
    type: 'input_text',
    text: [
      '你是资深电商选品和视觉分析顾问。请基于下面的竞品数据、问大家文本、SKU文本和图片批次摘要，生成中文结构化 JSON 报告。',
      '报告名称必须是“{{产品名称}}竞品市场分析与 Listing 图片生成策略报告”。报告目标不是写完整运营方案，而是从几十到上百个竞品中找出哪些产品卖得好、为什么卖得好、消费者真正需要什么，并转化成可直接生成 Listing 图片的视觉方案。',
      '核心分析链路必须是：销售数据 → 市场需求 → 有效卖点 → 差异化定位 → 图片内容规划 → 生图提示词。',
      '正文重点围绕：1）哪类商品贡献主要销售额；2）消费者为什么购买、为什么给差评；3）本产品优先突出哪三个卖点；4）每张 Listing 图片具体生成什么内容。',
      '不要把报告写成完整 Listing 文案、后台关键词、认证说明或长篇竞品逐个拆解。认证、尺寸、参数只有在影响图片 Claim 时才需要出现。',
      '全量商品用于统计，正文只展示 5-10 个代表商品：销售额最高、销量最高、高客单代表、差异化代表、新品增长代表、与目标产品最接近商品。',
      '必须输出三个评分体系：市场需求分、卖点机会分、图片优先级分；只有图片优先级 4-5 分的卖点进入前四张图片。',
      '图片策略要可落地：每张图只保留一个主卖点，最多两个辅助信息；图片文字必须短、准、少，避免大段文字导致生图乱码。',
      '数字类字段不要改写；如果需要引用销量、价格、销额，使用输入中的数据。',
      '兼容要求：price_band_report 只能使用输入中已有 price_band，不要新增、删除或重命名价格区间。',
      '只输出 JSON，不要 Markdown，不要解释。内容要有信息量，但不要写空泛套话。',
      '',
      '返回 JSON 结构：',
      JSON.stringify(reportOutputSchema(), null, 2),
      '',
      '输入数据：',
      JSON.stringify(compactForPrompt(report), null, 2),
      '',
      '图片批次摘要：',
      JSON.stringify(compactVisualSummaries(visualBatchSummaries), null, 2),
    ].join('\n'),
  }]
  return { content, imageCount: 0 }
}

function collectVisualCandidates(report, maxImages = MAX_VISION_IMAGES) {
  const candidates = []
  for (const band of report.price_band_report) {
    const products = band.product_analysis
      .slice()
      .sort((a, b) => toInt(b.sold_count, 0) - toInt(a.sold_count, 0))
    for (const product of products) {
      for (const image of product.images || []) {
        const url = image.url
        if (!url || candidates.length >= maxImages) continue
        // 只分析主图，跳过 SKU 图
        const imageType = String(image.image_type || '').toLowerCase()
        if (imageType.includes('sku')) continue
        candidates.push({
          image_index: candidates.length + 1,
          price_band: band.price_band,
          product_id: product.product_id,
          product_title: product.product_title,
          price: product.price,
          sold_count: product.sold_count,
          sales_amount: product.sales_amount,
          image_type: image.image_type || 'unknown',
          sku_id: image.sku_id || '',
          sku_title: image.sku_title || '',
          url,
        })
      }
    }
  }
  return candidates
}

function compactVisualSummaries(summaries, limit = 80) {
  return (summaries || []).slice(0, limit).map((summary) => ({
    batch_index: summary.batch_index,
    image_count: summary.image_count,
    image_observations: (summary.image_observations || []).slice(0, 4).map((item) => ({
      image_index: item.image_index,
      price_band: item.price_band,
      product_id: item.product_id,
      visual_keywords: item.visual_keywords,
      selling_points: item.selling_points,
      audience: item.audience,
      scene: item.scene,
      observation: item.observation,
    })),
    batch_selling_points: metricList(summary.batch_selling_points).slice(0, 8),
    batch_demands: metricList(summary.batch_demands).slice(0, 8),
    visual_summary: summary.visual_summary || '',
  }))
}

function collectVisualBatchContent(batch, batchIndex) {
  const content = [{
    type: 'input_text',
    text: [
      '你是电商图片分析助手。请只观察本批商品图片，输出精简 JSON。',
      '重点看：画面主体、构图、文字卖点、颜色、场景、人群、爆品图特征。',
      '不要做最终策略报告，只输出本批图片观察摘要。',
      '',
      '【卖点提取规则】卖点必须是用户利益或差异化价值，禁止填入：',
      '纯数量规格（如"40包""5斤装"）、包装描述（如"整箱装""家庭装"）、SKU变体名、品类通用词、价格促销词、泛场景词（如"家庭分享"）。',
      '合格卖点示例："0添加"、"柔软亲肤"、"一口就停不下来"、"进口原料"、"销量100万+"、"外皮暄软蓬松"、"现做现发锁鲜"。',
      '',
      '返回 JSON 结构：',
      JSON.stringify({
        batch_index: batchIndex,
        image_observations: [{
          image_index: 1,
          price_band: '价格带',
          product_id: '商品ID',
          visual_keywords: ['视觉关键词'],
          selling_points: ['图片中传达的用户利益点（禁止填入规格/数量/包装词）'],
          audience: '目标人群',
          scene: '使用场景',
          observation: '图片表达特点',
        }],
        batch_selling_points: [{ term: '用户利益卖点词', count: 1, evidence: '图片证据' }],
        batch_demands: [{ term: '需求痛点', count: 1, evidence: '图片证据' }],
        visual_summary: '本批图片共性',
      }, null, 2),
      '',
      '图片元数据：',
      JSON.stringify(batch.map(({ url, ...meta }) => meta), null, 2),
    ].join('\n'),
  }]
  for (const item of batch) {
    content.push({
      type: 'input_text',
      text: `图片${item.image_index}：价格段=${item.price_band}，商品ID=${item.product_id}，标题=${item.product_title}，销量=${item.sold_count}，图片类型=${item.image_type}，SKU=${item.sku_title || item.sku_id}`,
    })
    content.push({ type: 'input_image', image_url: item.url })
  }
  return content
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text
  const parts = []
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text)
    }
  }
  return parts.join('\n')
}

function extractBalancedJsonObject(text) {
  const source = String(text || '')
  for (let start = source.indexOf('{'); start >= 0; start = source.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < source.length; index += 1) {
      const char = source[index]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (char === '\\') {
          escaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }
      if (char === '"') {
        inString = true
      } else if (char === '{') {
        depth += 1
      } else if (char === '}') {
        depth -= 1
        if (depth === 0) return source.slice(start, index + 1)
      }
    }
  }
  return ''
}

function parseJsonFromText(text) {
  const cleaned = String(text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  const candidate = extractBalancedJsonObject(cleaned)
  if (!candidate) throw new Error(`AI 没有返回可解析 JSON：${cleaned.slice(0, 300)}`)
  try {
    return JSON.parse(candidate)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`AI 返回的 JSON 不合法：${message}`)
  }
}

function emptyUsage() {
  return { input_tokens: 0, output_tokens: 0, total_tokens: 0, request_count: 0 }
}

function addUsage(total, usage) {
  if (!usage) return total
  total.input_tokens += toInt(usage.input_tokens, 0)
  total.output_tokens += toInt(usage.output_tokens, 0)
  total.total_tokens += toInt(usage.total_tokens, 0)
  total.request_count += toInt(usage.request_count, 0) || 1
  return total
}

function fallbackAiJsonFromReport(report, visualBatchSummaries = []) {
  const bandVisuals = new Map()
  for (const summary of visualBatchSummaries || []) {
    for (const item of summary.image_observations || []) {
      const key = item.price_band || ''
      const bucket = bandVisuals.get(key) || []
      bucket.push(item)
      bandVisuals.set(key, bucket)
    }
  }

  const keyword = report.summary?.keyword || '产品'
  const fallback = buildStrategyReportFallback(report)
  return {
    ...fallback,
    price_band_report: (report.price_band_report || []).map((band) => {
      const visuals = bandVisuals.get(band.price_band) || []
      const skuText = (band.product_analysis || [])
        .flatMap((product) => product.skus || [])
        .map((sku) => [sku.sku_title, sku.sku_info].filter(Boolean).join(' '))
        .join(' ')
      const qaText = (band.qa_and_review?.qa_examples || [])
        .map((qa) => [qa.question, qa.answer].filter(Boolean).join(' '))
        .join(' ')
      const titleText = (band.product_analysis || []).map((product) => product.product_title).join(' ')
      const text = `${titleText} ${skuText} ${qaText}`
      const visualTerms = visuals
        .flatMap((item) => item.visual_keywords || [])
        .map((term) => String(term || '').trim())
        .filter(Boolean)
      const productTerms = metricTerms([
        ...visualTerms.map((term) => ({ term, count: 1 })),
        ...String(text)
          .split(/[，,、\s｜|/【】\[\]（）()；;：:]+/)
          .map((term) => term.trim())
          .filter((term) => term.length >= 2 && term.length <= 12 && !/^\d+(\.\d+)?$/.test(term))
          .slice(0, 60)
          .map((term) => ({ term, count: 1 })),
      ], 8)
      const needTerms = metricTerms([
        ...(band.qa_and_review?.qa_examples || [])
          .flatMap((qa) => [qa.question, qa.answer])
          .filter(Boolean)
          .slice(0, 30)
          .map((term) => ({ term, count: 1 })),
        ...productTerms.slice(0, 5),
      ], 6)
      const sellingTerms = productTerms.length
        ? productTerms.map((item) => ({ term: item.term, count: item.count || 1, evidence: '来自标题、SKU、问大家、评价和图片批次摘要的本地兜底提取' }))
        : [{ term: keyword, count: 1, evidence: '本地兜底：来自商品关键词' }]
      const demandTerms = needTerms.length
        ? needTerms.map((item) => ({ term: item.term, count: item.count || 1, evidence: '来自问大家、评价、标题和图片批次摘要的本地兜底提取' }))
        : [{ term: '品质可靠', count: 1, evidence: '本地兜底：常见购买顾虑' }]
      const visualWords = visuals.flatMap((item) => item.visual_keywords || []).slice(0, 10)
      const corePoint = sellingTerms[0]?.term || keyword
      return {
        price_band: band.price_band,
        extracted_selling_points: sellingTerms.length ? sellingTerms : [{ term: corePoint, count: 1, evidence: '本地兜底提取' }],
        extracted_demands: demandTerms.length ? demandTerms : [{ term: '品质可靠', count: 1, evidence: '本地兜底提取' }],
        image_prompts: {
          title_direction: `突出${corePoint}，围绕${demandTerms.slice(0, 3).map((item) => item.term).join('、')}建立购买理由`,
          main_image_prompt: `电商主图，${keyword}作为画面主体，突出${corePoint}，产品清晰完整，画面干净专业，短文案表达核心用户收益，适合上架转化`,
          detail_image_prompt: `详情页分屏图，依次展示${keyword}的核心卖点、使用场景、细节证明、参数信息和购买保障，文案围绕${corePoint}和用户需求展开`,
          buyer_show_prompt: `真实买家秀风格，用户在实际场景中使用${keyword}，画面自然可信，突出${corePoint}带来的实际收益`,
        },
        visual_summary: visuals.length
          ? `已读取${visuals.length}张图片摘要，常见视觉关键词：${visualWords.join('、') || '产品、场景、卖点'}`
          : '图片摘要不足，主要根据标题、SKU、问大家做兜底分析。',
        product_analysis: (band.product_analysis || []).slice(0, 20).map((product) => ({
          product_id: product.product_id,
          selling_points: sellingTerms.slice(0, 4),
          demands: demandTerms.slice(0, 4),
          image_prompts: {
            main_image_prompt: `主图突出${product.product_title || corePoint}，展示产品外观、核心卖点和短结果型文案，干净电商背景`,
            detail_image_prompt: `详情图展示规格、功能/成分/材质、使用场景、细节和用户收益`,
            buyer_show_prompt: `买家秀展示真实使用场景和用户获得的结果，画面自然可信`,
          },
          visual_observation: visuals.find((item) => String(item.product_id) === String(product.product_id))?.observation || '本地兜底：根据标题、SKU、问大家和图片数量判断，主要强调产品主体、核心卖点和使用场景。',
        })),
      }
    }),
  }
}

async function callArkResponsesRaw(content, { maxOutputTokens = 5000, timeoutMs = ARK_ANALYSIS_TIMEOUT_MS } = {}) {
  const apiKey = process.env.ARK_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('缺少 ARK_API_KEY。请先在报告页的豆包 Ark 配置中填写并保存 API Key。')
  }

  const response = await fetch(ARK_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: currentModel(),
      input: [{ role: 'user', content }],
      max_output_tokens: maxOutputTokens,
    }),
  })

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`豆包 Ark 视觉分析失败（HTTP ${response.status}）：${raw}`)
  }
  const data = JSON.parse(raw)
  const text = extractResponseText(data)
  return {
    data,
    text,
    responseId: data.id,
    model: data.model || currentModel(),
    usage: data.usage || null,
  }
}

async function callArkResponses(content, { maxOutputTokens = 5000, timeoutMs = ARK_ANALYSIS_TIMEOUT_MS } = {}) {
  const result = await callArkResponsesRaw(content, { maxOutputTokens, timeoutMs })
  return {
    ...result,
    json: parseJsonFromText(result.text),
  }
}

export async function testArkResponsesConnection({ imageUrl = '', text = '' } = {}) {
  loadLocalEnv()
  const result = await callArkResponsesRaw([
    {
      type: 'input_image',
      image_url: String(imageUrl || '').trim() || 'https://ark-project.tos-cn-beijing.volces.com/doc_image/ark_demo_img_1.png',
    },
    {
      type: 'input_text',
      text: String(text || '').trim() || '你看见了什么？',
    },
  ], {
    maxOutputTokens: 800,
    timeoutMs: 30000,
  })

  return {
    ok: true,
    configured: true,
    provider: 'ark',
    endpoint: ARK_RESPONSES_ENDPOINT,
    model: result.model,
    responseId: result.responseId,
    text: result.text,
    usage: result.usage,
  }
}

async function analyzeVisualBatch(batch, batchIndex) {
  try {
    const result = await callArkResponses(collectVisualBatchContent(batch, batchIndex), {
      maxOutputTokens: 8000,
      timeoutMs: ARK_ANALYSIS_TIMEOUT_MS,
    })
    return {
      summaries: [{
        batch_index: batchIndex,
        image_count: batch.length,
        response_id: result.responseId,
        ...result.json,
      }],
      errors: [],
      usage: addUsage(emptyUsage(), result.usage),
    }
  } catch (error) {
    if (batch.length <= 1) {
      const cause = error?.cause
      const causeText = cause ? `；cause=${cause.code || cause.name || ''} ${cause.message || ''}` : ''
      return {
        summaries: [],
        errors: [{
          batch_index: batchIndex,
          image_count: batch.length,
          error: `第 ${batchIndex} 批图片分析失败：${error.message || String(error)}${causeText}`,
        }],
        usage: emptyUsage(),
      }
    }

    const summaries = []
    const errors = []
    const usage = emptyUsage()
    for (let index = 0; index < batch.length; index += 1) {
      const singleBatchIndex = Number(`${batchIndex}.${index + 1}`)
      const result = await analyzeVisualBatch([batch[index]], singleBatchIndex)
      summaries.push(...result.summaries)
      errors.push(...result.errors)
      addUsage(usage, result.usage)
    }
    return { summaries, errors, usage }
  }
}

async function callArkVision(report, onProgress) {
  const candidates = collectVisualCandidates(report, MAX_VISION_IMAGES)
  const visualBatchSummaries = []
  const visualErrors = []
  const usage = emptyUsage()
  const totalBatches = Math.ceil(candidates.length / VISION_BATCH_SIZE)
  onProgress?.({
    stage: 'vision',
    message: `准备分批分析 ${candidates.length} 张图片`,
    current: 0,
    total: totalBatches,
    imageCount: candidates.length,
  })
  for (let index = 0; index < candidates.length; index += VISION_BATCH_SIZE) {
    const batch = candidates.slice(index, index + VISION_BATCH_SIZE)
    const batchIndex = Math.floor(index / VISION_BATCH_SIZE) + 1
    onProgress?.({
      stage: 'vision',
      message: `正在分析图片批次 ${batchIndex}/${totalBatches}`,
      current: batchIndex,
      total: totalBatches,
      imageCount: candidates.length,
    })
    const result = await analyzeVisualBatch(batch, batchIndex)
    visualBatchSummaries.push(...result.summaries)
    visualErrors.push(...result.errors)
    addUsage(usage, result.usage)
    for (const error of result.errors) console.error(new Error(error.error))
  }

  let finalResult
  let finalJson
  try {
    onProgress?.({
      stage: 'compose',
      message: '正在合成价格段完整报告',
      current: totalBatches,
      total: totalBatches + 1,
      imageCount: candidates.length,
    })
    finalResult = await callArkResponses(collectFinalReportContent(report, visualBatchSummaries).content, {
      maxOutputTokens: 16000,
      timeoutMs: ARK_ANALYSIS_TIMEOUT_MS * 2,
    })
    finalJson = finalResult.json
    addUsage(usage, finalResult.usage)
  } catch (error) {
    const message = `最终报告合成首次失败，已降级重试：${error.message || String(error)}`
    visualErrors.push({ batch_index: null, image_count: 0, error: message })
    console.error(new Error(message))
    onProgress?.({
      stage: 'compose',
      message: '完整摘要过大，正在压缩图片摘要后重试',
      current: totalBatches,
      total: totalBatches + 1,
      imageCount: candidates.length,
    })
    try {
      finalResult = await callArkResponses(collectFinalReportContent(report, compactVisualSummaries(visualBatchSummaries, 30)).content, {
        maxOutputTokens: 12000,
        timeoutMs: ARK_ANALYSIS_TIMEOUT_MS * 2,
      })
      finalJson = finalResult.json
      addUsage(usage, finalResult.usage)
    } catch (retryError) {
      const retryMessage = `最终报告合成降级重试失败，已使用本地兜底报告：${retryError.message || String(retryError)}`
      visualErrors.push({ batch_index: null, image_count: 0, error: retryMessage })
      console.error(new Error(retryMessage))
      finalJson = fallbackAiJsonFromReport(report, visualBatchSummaries)
      finalResult = { responseId: '', model: currentModel() }
    }
  }
  return {
    aiJson: finalJson,
    imageCount: candidates.length,
    responseId: finalResult.responseId,
    model: finalResult.model,
    visualBatchCount: visualBatchSummaries.length,
    visualErrors,
    usage,
  }
}

function metricList(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      term: String(item.term || item.keyword || '').trim(),
      count: toInt(item.count, 1),
      evidence: item.evidence || '',
    }))
    .filter((item) => item.term)
    .slice(0, 12)
}

const STRATEGY_REPORT_KEYS = [
  'report_title',
  'analysis_scope',
  'market_core_conclusions',
  'sales_structure',
  'high_sales_selling_point_analysis',
  'consumer_demand_analysis',
  'selling_point_opportunity_matrix',
  'product_positioning_visual_strategy',
  'listing_image_overall_plan',
  'single_image_generation_plan',
  'final_image_decision_card',
]

function percentText(part, total) {
  const p = toNumber(part, 0)
  const t = toNumber(total, 0)
  if (!t) return '0%'
  return `${Math.round((p / t) * 1000) / 10}%`
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }
  return ''
}

function allReportProducts(report) {
  const seen = new Set()
  const products = []
  for (const band of safeArray(report.price_band_report)) {
    for (const product of safeArray(band.product_analysis)) {
      const key = String(product.product_id || `${band.price_band}-${product.product_title || products.length}`)
      if (seen.has(key)) continue
      seen.add(key)
      products.push({ ...product, price_band: band.price_band })
    }
  }
  return products
}

function aggregateReportTerms(report, field, limit = 8) {
  const counts = new Map()
  const productField = field === 'extracted_selling_points'
    ? 'selling_points'
    : field === 'extracted_demands'
      ? 'demands'
      : field
  for (const band of safeArray(report.price_band_report)) {
    const sources = [
      ...safeArray(band[field]),
      ...safeArray(band.product_analysis).flatMap((product) => [
        ...safeArray(product[field]),
        ...safeArray(product[productField]),
      ]),
    ]
    for (const item of sources) {
      const term = String(item?.term || item?.keyword || item || '').trim()
      if (!term) continue
      const current = counts.get(term) || { term, count: 0, evidence: item?.evidence || '来自竞品标题、问大家、评价或图片分析' }
      current.count += toInt(item?.count, 1)
      counts.set(term, current)
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, limit)
}

function differentiationScore({ salesScore = 0, demandScore = 0, gapScore = 0, visualScore = 0, reason = '' } = {}) {
  const clamp = (value) => Math.max(0, Math.min(5, toInt(value, 0)))
  const sales = clamp(salesScore)
  const demand = clamp(demandScore)
  const gap = clamp(gapScore)
  const visual = clamp(visualScore)
  return {
    sales_validation_score: sales,
    demand_strength_score: demand,
    competitor_gap_score: gap,
    visual_expression_score: visual,
    overall_score: sales + demand + gap + visual,
    score_reason: reason,
  }
}

function bestBandBy(report, field) {
  return safeArray(report.price_band_report)
    .slice()
    .sort((a, b) => toNumber(b[field], 0) - toNumber(a[field], 0))[0] || null
}

function representativeProducts(report, limit = 6) {
  const products = allReportProducts(report)
    .slice()
    .sort((a, b) => toNumber(b.sales_amount, 0) - toNumber(a.sales_amount, 0) || toInt(b.sold_count, 0) - toInt(a.sold_count, 0))
  return products.slice(0, limit).map((product, index) => ({
    rank: index + 1,
    brand_or_model: firstNonEmpty(product.shop_name, product.product_title, product.product_id),
    price: money(product.price),
    monthly_sold: toInt(product.sold_count, 0),
    monthly_sales_amount: money(product.sales_amount),
    rating: product.rating || '暂无',
    core_selling_points: metricTerms(product.selling_points || [], 4).map((item) => item.term),
    representative_reason: index === 0 ? '销售额最高代表' : index === 1 ? '销量或高销售额代表' : '代表商品',
  }))
}

function buildListingImagePlans(keyword, sellingTerms, demandTerms, mainstreamBand) {
  const points = sellingTerms.map((item) => item.term).filter(Boolean)
  const needs = demandTerms.map((item) => item.term).filter(Boolean)
  const p1 = points[0] || '核心功能'
  const p2 = points[1] || '品质细节'
  const p3 = points[2] || '场景适配'
  const n1 = needs[0] || '看清产品'
  const n2 = needs[1] || '减少购买疑虑'
  const n3 = needs[2] || '确认使用效果'
  const bandText = mainstreamBand?.price_band || '目标价格带'
  const modules = [
    ['白底主图', '清楚展示商品', keyword, n1],
    ['核心定位图', '建立第一购买理由', p1, n1],
    ['痛点解决图', '回应高频痛点', p2, n2],
    ['核心功能图', '证明关键性能', p3, n3],
    ['使用场景图', '让用户代入真实使用', p1, n3],
    ['细节品质图', '建立品质感', p2, '品质确认'],
    ['参数对比图', '降低决策难度', p3, '信息确认'],
    ['多场景/包装图', '完成购买决策', p1, '下单确认'],
  ]
  return modules.map(([imageModule, mainTask, coreSellingPoint, userNeed], index) => ({
    image_no: index + 1,
    image_module: imageModule,
    main_task: mainTask,
    core_selling_point: coreSellingPoint,
    user_need: userNeed,
    data_basis: `来自${bandText}及高销量竞品的销售、图片和需求共性`,
  }))
}

function buildSingleImagePlans(keyword, imagePlans, sellingTerms, demandTerms) {
  return imagePlans.map((plan) => {
    const mainTitle = String(plan.core_selling_point || keyword).slice(0, 10)
    const subtitle = String(plan.user_need || '').slice(0, 14)
    return {
      image_no: plan.image_no,
      image_name: plan.image_module,
      image_goal: plan.main_task,
      market_basis: {
        sales_data_basis: plan.data_basis,
        user_need_basis: plan.user_need,
        competitor_gap: '用更清晰的场景、对比和细节表达降低理解成本',
      },
      core_selling_point: plan.core_selling_point,
      user_benefit: plan.user_need,
      visual_content: {
        product_position: '产品居中或黄金分割位置',
        product_ratio: plan.image_no === 1 ? '主体占画面 70%-85%' : '主体占画面 45%-65%',
        usage_scene: plan.image_module.includes('场景') ? '真实使用场景' : '浅色电商背景',
        person_state: plan.image_module.includes('场景') ? '自然使用，不夸张摆拍' : '无人物或少量辅助人物',
        function_visualization: `围绕${plan.core_selling_point}做局部放大、对比或效果示意`,
        detail_zoom: '展示影响购买决策的结构、材质或关键部件',
        auxiliary_elements: '少量标签、图标和短文案',
        background: '干净、专业、与类目匹配',
      },
      copy_hierarchy: {
        main_title: mainTitle,
        subtitle,
        badges: [plan.core_selling_point, ...sellingTerms.slice(0, 2).map((item) => item.term)].filter(Boolean).slice(0, 3),
      },
      layout_suggestion: {
        composition: '主体明确，信息分层，避免文字堆叠',
        visual_focus: plan.core_selling_point,
        text_position: '不遮挡产品关键部件',
        reading_order: '主标题 → 产品主体 → 证明信息',
        whitespace: '保留足够留白，便于平台缩略图识别',
        comparison_or_arrow: '仅在功能证明图中使用简洁箭头或对比',
      },
      generation_focus: {
        must_show: [keyword, plan.core_selling_point].filter(Boolean),
        can_show: demandTerms.slice(0, 3).map((item) => item.term),
        avoid: ['竞品品牌', '错误文字', '虚假参数', '过多中文长句', '遮挡产品主体'],
        consistent_product_features: ['产品外观结构', '颜色材质', '核心配件或包装特征'],
      },
      full_prompt: [
        `[图片类型] ${plan.image_module}`,
        `[核心目标] ${plan.main_task}`,
        `[画面内容] 展示${keyword}，突出${plan.core_selling_point}，回应${plan.user_need}`,
        '[产品要求] 产品结构、颜色、比例和关键部件保持一致，不增加不存在的功能',
        `[卖点可视化] 用场景、细节放大或对比证明${plan.core_selling_point}`,
        '[构图版式] 1:1电商图，主体清晰，文字少而准，信息分层',
        `[文字内容] 主标题：${mainTitle}；副标题：${subtitle}`,
        '[禁止内容] 不出现竞品品牌，不写无法证明的数据，不出现乱码文字，不遮挡产品核心部件。',
      ].join('\n'),
    }
  })
}

function buildStrategyReportFallback(report) {
  const keyword = report.summary?.keyword || '产品'
  const products = allReportProducts(report)
  const totalSold = safeArray(report.price_band_report).reduce((sum, band) => sum + toInt(band.sold_count_total, 0), 0)
  const totalSales = money(safeArray(report.price_band_report).reduce((sum, band) => sum + toNumber(band.sales_amount_total, 0), 0))
  const salesBand = bestBandBy(report, 'sales_amount_total')
  const soldBand = bestBandBy(report, 'sold_count_total')
  const mainstreamBand = salesBand || soldBand || safeArray(report.price_band_report)[0] || {}
  const sellingTerms = aggregateReportTerms(report, 'extracted_selling_points', 8)
  const demandTerms = aggregateReportTerms(report, 'extracted_demands', 8)
  if (!sellingTerms.length) sellingTerms.push({ term: keyword, count: 1, evidence: '本地兜底：来自商品关键词' })
  if (!demandTerms.length) demandTerms.push({ term: '品质可靠', count: 1, evidence: '本地兜底：常见购买顾虑' })
  const imagePlans = buildListingImagePlans(keyword, sellingTerms, demandTerms, mainstreamBand)
  const totalProducts = products.length || toInt(report.summary?.competitor_count, 0)
  const brandBuckets = new Map()
  for (const product of products) {
    const brand = firstNonEmpty(product.shop_name, '未知品牌')
    const current = brandBuckets.get(brand) || { brand, product_count: 0, sold: 0, sales: 0, priceTotal: 0, priceCount: 0 }
    current.product_count += 1
    current.sold += toInt(product.sold_count, 0)
    current.sales += toNumber(product.sales_amount, 0)
    const price = money(product.price)
    if (price != null) {
      current.priceTotal += price
      current.priceCount += 1
    }
    brandBuckets.set(brand, current)
  }
  const sortedProducts = products.slice().sort((a, b) => (
    toNumber(b.sales_amount, 0) - toNumber(a.sales_amount, 0)
    || toInt(b.sold_count, 0) - toInt(a.sold_count, 0)
    || toNumber(b.price, 0) - toNumber(a.price, 0)
  ))
  const highPerformanceProducts = sortedProducts.slice(0, 3)
  const highProductIds = new Set(highPerformanceProducts.map((product) => String(product.product_id || product.product_title || product.title || '')))
  const ordinaryProducts = sortedProducts
    .slice(-3)
    .filter((product) => !highProductIds.has(String(product.product_id || product.product_title || product.title || '')))
  const formatProductEvidence = (product) => {
    const title = firstNonEmpty(product.product_title, product.title, product.product_id, '未知商品')
    const price = money(product.price)
    const sold = toInt(product.sold_count, 0)
    const sales = money(product.sales_amount)
    return `${String(title).slice(0, 28)}（价格 ${price != null ? `¥${price}` : '暂无'}，销量 ${sold || '暂无'}，销额 ${sales != null ? `¥${sales}` : '暂无'}）`
  }
  const highProductText = highPerformanceProducts.length
    ? highPerformanceProducts.map(formatProductEvidence).join('；')
    : '高销量/高销额代表商品样本不足'
  const ordinaryProductText = ordinaryProducts.length
    ? ordinaryProducts.map(formatProductEvidence).join('；')
    : '普通或低表现商品样本不足'
  const reviewExamples = products.flatMap((product) => product.review_examples || []).slice(0, 3)
  const reviewQaCount = safeArray(report.price_band_report).reduce((sum, band) => (
    sum + toInt(band.review_count_total, 0) + toInt(band.qa_count_total, 0)
  ), 0)
  const hasReviewQaEvidence = reviewExamples.length > 0 || reviewQaCount > 0
  const reviewQaText = hasReviewQaEvidence && demandTerms.length
    ? demandTerms
      .slice(0, 3)
      .map((item) => `${item.term}${item.evidence ? `（${String(item.evidence).slice(0, 40)}）` : ''}`)
      .join('；')
    : '评价/问大家样本不足，先以商品标题、主图识别和销量表现判断。'
  const reviewEvidenceText = reviewExamples.length
    ? reviewExamples.map((item) => `“${String(item.text || item).slice(0, 46)}”`).join('；')
    : reviewQaText
  const salesScore = highPerformanceProducts.length ? 5 : 2
  const demandScore = hasReviewQaEvidence
    ? (reviewExamples.length >= 3 || demandTerms.length >= 3 ? 5 : 3)
    : 2
  const gapScore = ordinaryProducts.length ? 4 : 2
  const visualScore = sellingTerms.length ? 5 : 3
  const primaryDemandTerm = hasReviewQaEvidence ? (demandTerms[0]?.term || '购买疑虑') : (mainstreamBand.price_band || report.summary?.price_range || '主流价格带')
  const differentiationDirections = [
    {
      direction_title: `方向 1：「${sellingTerms[0]?.term || keyword}」—— 对标高表现商品的明确利益表达`,
      compared_products: [`高表现：${highProductText}`, `对照：${ordinaryProductText}`],
      sales_evidence: `高表现商品优先按销额/销量排序；样本总销量 ${totalSold || '暂无'}，总销售额 ${totalSales ?? '暂无'}。`,
      review_qa_evidence: reviewEvidenceText,
      opportunity_score: differentiationScore({
        salesScore,
        demandScore,
        gapScore,
        visualScore,
        reason: '有高表现商品销售验证，且主图/标题卖点可被转化为直观图片证据。',
      }),
      market_meaning: `同类商品中，能把${sellingTerms[0]?.term || '核心卖点'}讲清楚并转成用户收益的商品更容易获得点击和转化。`,
      image_strategy: `前 2-4 张图用场景、对比和局部细节证明${sellingTerms.slice(0, 3).map((item) => item.term).join('、')}，不要只堆文字。`,
    },
    {
      direction_title: hasReviewQaEvidence
        ? `方向 2：「${primaryDemandTerm}」—— 用评价/问大家反推竞品缺口`
        : `方向 2：「${primaryDemandTerm}」—— 用高销价带校准主图承诺`,
      compared_products: [`高表现：${highProductText}`, `对照：${ordinaryProductText}`],
      sales_evidence: `价格范围 ${report.summary?.price_range || mainstreamBand.price_band || '-'}，用销量/销额高的商品验证主图卖点优先级。`,
      review_qa_evidence: reviewEvidenceText,
      opportunity_score: differentiationScore({
        salesScore: Math.max(3, salesScore - 1),
        demandScore,
        gapScore,
        visualScore,
        reason: hasReviewQaEvidence
          ? '真实评价/问大家中出现的疑虑适合提前用图片回答，可降低购买决策成本。'
          : '当前没有真实评价/问大家样本，优先使用价格带、销量和主图标题信号做保守判断。',
      }),
      market_meaning: hasReviewQaEvidence
        ? '用户在评价/问大家中反复确认的问题，往往就是同类商品最需要被图片提前回答的转化阻力。'
        : '缺少真实评论和问大家时，不应输出消费者原话判断；先看用户实际成交在哪个价格带，以及高销商品标题和主图承诺了什么。',
      image_strategy: hasReviewQaEvidence
        ? `把${primaryDemandTerm}做成痛点解决图，画面直接给出使用场景、结果证明或细节对比。`
        : `围绕${primaryDemandTerm}价带的购买理由组织主图，优先讲清${sellingTerms.slice(0, 3).map((item) => item.term).join('、')}，少放无法被数据验证的主观文案。`,
    },
    {
      direction_title: '方向 3：「少文字强证明」—— 用图片结构拉开同质竞品',
      compared_products: [`高表现：${highProductText}`, `对照：${ordinaryProductText}`],
      sales_evidence: '代表商品来自同一竞品集合，按销量、销额和价格综合排序。',
      review_qa_evidence: reviewEvidenceText,
      opportunity_score: differentiationScore({
        salesScore: Math.max(3, salesScore - 1),
        demandScore: Math.max(2, demandScore - 1),
        gapScore: Math.max(3, gapScore),
        visualScore: 5,
        reason: '同质卖点下图片结构本身就是差异化抓手，适合转成清晰图位分工。',
      }),
      market_meaning: '当同类商品卖点相似时，真正差异来自图片是否能快速说明“适合谁、解决什么、凭什么可信”。',
      image_strategy: '白底图看清产品，场景图建立用途，卖点图给结果，细节图证明品质；每张图只讲一个主信息。',
    },
  ]

  return {
    report_title: `${keyword}竞品市场分析与 Listing 图片生成策略报告`,
    analysis_scope: {
      product_name: keyword,
      site: report.summary?.source_platform || '淘宝/天猫',
      category: keyword,
      data_time: report.generated_at || new Date().toISOString(),
      sample_product_count: totalProducts,
      valid_product_count: totalProducts,
      review_sample_count: safeArray(report.price_band_report).reduce((sum, band) => sum + toInt(band.qa_and_review?.review_count_total, 0), 0),
      keyword_count: 1,
      data_sources: ['商品数据', '销量数据', '问大家/评价正文', '主图/详情图/单品图片分析报告', 'SKU价格/规格背景'],
      data_note: `本报告基于 ${totalProducts} 个同类商品，重点分析销售结构、卖点、需求和 Listing 图片生成策略。`,
    },
    market_core_conclusions: {
      one_sentence_judgement: `${keyword}市场当前主要由${mainstreamBand.price_band || '主流价格带'}贡献销售表现，图片应优先突出${sellingTerms.slice(0, 3).map((item) => item.term).join('、')}，同时回应${demandTerms.slice(0, 3).map((item) => item.term).join('、')}。`,
      core_metrics: {
        total_sales_amount: totalSales,
        total_sold_count: totalSold,
        top_10_sales_share: percentText(products.slice().sort((a, b) => toNumber(b.sales_amount, 0) - toNumber(a.sales_amount, 0)).slice(0, 10).reduce((sum, product) => sum + toNumber(product.sales_amount, 0), 0), totalSales),
        top_3_brand_sales_share: '暂无品牌字段或样本不足',
        mainstream_price_band: mainstreamBand.price_band || '-',
        high_sales_avg_rating: '暂无',
        high_sales_avg_review_count: '暂无',
      },
      top_conclusions: [
        {
          title: '销售集中在少数有效卖点组合',
          data_basis: `样本总销量 ${totalSold}，总销售额 ${totalSales ?? 0}`,
          market_meaning: `用户不是只看单一参数，而是在${sellingTerms.slice(0, 3).map((item) => item.term).join('、')}等组合中判断是否值得买。`,
          image_impact: '前四张图必须围绕已验证卖点做清晰证明，而不是堆参数。',
        },
        {
          title: '用户需求需要被图片直接解释',
          data_basis: `高频需求包括 ${demandTerms.slice(0, 4).map((item) => item.term).join('、')}`,
          market_meaning: '消费者购买前主要在确认效果、品质和使用场景是否符合预期。',
          image_impact: '副图应加入场景、对比和细节放大，降低理解成本。',
        },
        {
          title: '差异化机会来自竞品表达不足',
          data_basis: `机会卖点集中在 ${sellingTerms.slice(0, 5).map((item) => item.term).join('、')}`,
          market_meaning: '同质卖点需要保留，真正拉开差异的是更具体的使用收益表达。',
          image_impact: '将机会卖点做成核心定位图和痛点解决图。',
        },
      ],
      differentiation_directions: differentiationDirections,
    },
    sales_structure: {
      representative_products: representativeProducts(report, 6),
      price_band_analysis: safeArray(report.price_band_report).map((band) => ({
        price_band: band.price_band,
        product_count_share: percentText(band.competitor_count, totalProducts),
        sold_share: percentText(band.sold_count_total, totalSold),
        sales_share: percentText(band.sales_amount_total, totalSales),
        avg_rating: '暂无',
        main_selling_points: metricTerms(band.extracted_selling_points || [], 5).map((item) => item.term),
        market_judgement: band.price_band === mainstreamBand.price_band ? '当前样本中的主力贡献价格带' : '作为补充观察价格带',
      })),
      brand_concentration: Array.from(brandBuckets.values()).sort((a, b) => b.sales - a.sales).slice(0, 5).map((brand) => ({
        brand: brand.brand,
        product_count: brand.product_count,
        sold_share: percentText(brand.sold, totalSold),
        sales_share: percentText(brand.sales, totalSales),
        avg_price: brand.priceCount ? money(brand.priceTotal / brand.priceCount) : null,
        main_positioning: '根据店铺/品牌样本聚合',
      })),
      conclusions: [
        `销量主要集中在：${soldBand?.price_band || mainstreamBand.price_band || '-'}`,
        `销售额主要集中在：${salesBand?.price_band || mainstreamBand.price_band || '-'}`,
        `高销量商品共同特点：${sellingTerms.slice(0, 4).map((item) => item.term).join('、')}`,
        `可以支撑溢价的卖点：${sellingTerms.slice(0, 3).map((item) => item.term).join('、')}`,
      ],
    },
    high_sales_selling_point_analysis: {
      selling_point_performance: sellingTerms.slice(0, 6).map((item, index) => ({
        selling_point: item.term,
        product_coverage_rate: '待精算',
        covered_product_sales_share: '待精算',
        high_sales_product_coverage_rate: index < 3 ? '高' : '中',
        user_attention: index < 3 ? '高' : '中',
        market_attribute: index === 0 ? '核心卖点' : index < 3 ? '基础卖点' : '差异化卖点',
      })),
      categories: {
        market_basic_selling_points: sellingTerms.slice(0, 3).map((item) => item.term),
        validated_conversion_selling_points: sellingTerms.slice(0, 3).map((item) => item.term),
        homogenized_selling_points: sellingTerms.slice(3, 5).map((item) => item.term),
        opportunity_selling_points: demandTerms.slice(0, 3).map((item) => item.term),
      },
      image_strategy_notes: {
        market_basic_selling_points: '必须展示，但不建议占据最重要的第二张图。',
        validated_conversion_selling_points: '应进入前 2-4 张副图，并通过场景、对比或细节证明。',
        homogenized_selling_points: '可以保留，但应降低视觉优先级。',
        opportunity_selling_points: '优先作为本产品的差异化图片内容。',
      },
    },
    consumer_demand_analysis: {
      top_purchase_needs: demandTerms.slice(0, 5).map((item, index) => ({
        rank: index + 1,
        user_need: item.term,
        review_mention_rate: '待精算',
        keyword_demand: index < 3 ? '高' : '中',
        high_sales_product_satisfaction: index < 3 ? '中' : '待验证',
        market_gap: index < 3 ? '中' : '高',
        reason: `用户需要确认${item.term}是否被满足。`,
        scenario: '日常使用/购买决策场景',
        current_satisfaction: '竞品有覆盖，但表达深度不一。',
        image_expression: `用场景、对比或细节图表现${item.term}。`,
      })),
      positive_review_needs: demandTerms.slice(0, 4).map((item) => ({
        theme: item.term,
        mention_count: item.count,
        related_products: [],
        user_benefit: item.term,
        image_selling_point: item.term,
        representative_comment_summary: item.evidence || '来自问大家/评价/图片分析聚合',
        analysis_conclusion: `可转化为${item.term}相关图片卖点。`,
      })),
      negative_pain_points: demandTerms.slice(0, 4).map((item) => ({
        pain_point: item.term,
        mention_count: item.count,
        related_product_count: 0,
        conversion_impact: '中',
        reverse_selling_point: `通过图片证明${item.term}已被解决`,
      })),
      usage_scenarios: demandTerms.slice(0, 4).map((item) => ({
        scenario: item.term,
        demand_strength: '中',
        related_need: item.term,
        competitor_coverage: '中',
        image_opportunity: `把${item.term}做成真实场景或结果型画面。`,
      })),
    },
    selling_point_opportunity_matrix: sellingTerms.slice(0, 6).map((item, index) => ({
      selling_point: item.term,
      demand_strength_score: index < 3 ? 5 : 3,
      sales_validation_score: index < 3 ? 5 : 3,
      competition_gap_score: index < 3 ? 3 : 4,
      visual_expression_score: 5,
      overall_suggestion: index < 3 ? '必须展示' : '文案辅助',
      priority: index < 3 ? 'P0' : 'P1',
    })),
    product_positioning_visual_strategy: {
      target_audience: `${keyword}目标用户及高意向购买人群`,
      core_usage_scenarios: demandTerms.slice(0, 3).map((item) => item.term),
      suggested_price_band: mainstreamBand.price_band || '-',
      one_sentence_positioning: `面向${demandTerms[0]?.term || '核心需求'}人群，突出${sellingTerms.slice(0, 3).map((item) => item.term).join('、')}的${keyword}。`,
      core_selling_point_levels: sellingTerms.slice(0, 3).map((item, index) => ({
        level: ['第一核心卖点', '第二核心卖点', '第三核心卖点'][index],
        selling_point: item.term,
        user_benefit: demandTerms[index]?.term || item.term,
        data_basis: item.evidence || '来自竞品销售和图片分析',
        visual_expression: `用${item.term}的场景、细节或对比证明`,
        suggested_copy: item.term.slice(0, 10),
      })),
      visual_differentiation: [
        { dimension: '背景风格', competitor_common_practice: '浅色背景或场景背景', our_product_suggestion: '保持干净，核心图突出产品和结果' },
        { dimension: '文案结构', competitor_common_practice: '卖点堆叠较多', our_product_suggestion: '每张图一个主卖点，短文案表达用户收益' },
        { dimension: '功能表现', competitor_common_practice: '参数罗列', our_product_suggestion: '用对比、局部放大和场景证明参数价值' },
      ],
    },
    listing_image_overall_plan: imagePlans,
    single_image_generation_plan: buildSingleImagePlans(keyword, imagePlans, sellingTerms, demandTerms),
    final_image_decision_card: {
      market_judgement: {
        mainstream_price_band: mainstreamBand.price_band || '-',
        max_sold_band: soldBand?.price_band || '-',
        max_sales_amount_band: salesBand?.price_band || '-',
        head_brands: Array.from(brandBuckets.values()).sort((a, b) => b.sales - a.sales).slice(0, 3).map((brand) => brand.brand),
        market_maturity: totalProducts >= 30 ? '竞争较成熟' : '样本较少，需继续补充竞品',
      },
      consumer_needs: {
        first_need: demandTerms[0]?.term || '-',
        second_need: demandTerms[1]?.term || '-',
        third_need: demandTerms[2]?.term || '-',
        biggest_pain_point: demandTerms[0]?.term || '-',
        main_usage_scenario: demandTerms[1]?.term || demandTerms[0]?.term || '-',
      },
      product_positioning: {
        target_audience: `${keyword}目标购买人群`,
        suggested_price: mainstreamBand.price_band || '-',
        one_sentence_positioning: `突出${sellingTerms.slice(0, 3).map((item) => item.term).join('、')}，解决${demandTerms.slice(0, 3).map((item) => item.term).join('、')}需求。`,
        first_core_selling_point: sellingTerms[0]?.term || '-',
        second_core_selling_point: sellingTerms[1]?.term || '-',
        third_core_selling_point: sellingTerms[2]?.term || '-',
      },
      image_strategy: {
        first_sub_image: imagePlans[1]?.core_selling_point || '-',
        second_sub_image: imagePlans[2]?.core_selling_point || '-',
        third_sub_image: imagePlans[3]?.core_selling_point || '-',
        must_have_scenes: demandTerms.slice(0, 3).map((item) => item.term),
        must_show_details: sellingTerms.slice(0, 3).map((item) => item.term),
        not_recommended_focus: sellingTerms.slice(5, 8).map((item) => item.term),
        suggested_visual_style: '清晰专业、少文字、强主体、结果导向',
      },
      final_image_order: imagePlans.map((item) => item.image_module),
    },
  }
}

function mergeStrategySections(baseReport, aiJson) {
  const fallback = buildStrategyReportFallback(baseReport)
  for (const key of STRATEGY_REPORT_KEYS) {
    baseReport[key] = aiJson?.[key] ?? fallback[key]
  }
  if (!baseReport.report_title) baseReport.report_title = fallback.report_title
  return baseReport
}

function mergeAiReport(baseReport, aiResult) {
  const aiBands = new Map((aiResult.aiJson.price_band_report || []).map((band) => [band.price_band, band]))
  const fallbackBands = new Map((fallbackAiJsonFromReport(baseReport).price_band_report || []).map((band) => [band.price_band, band]))
  for (const band of baseReport.price_band_report) {
    const aiBand = aiBands.get(band.price_band) || {}
    const fallbackBand = fallbackBands.get(band.price_band) || {}
    const sellingPoints = metricList(aiBand.extracted_selling_points)
    const demands = metricList(aiBand.extracted_demands)
    const fallbackSellingPoints = metricList(fallbackBand.extracted_selling_points)
    const fallbackDemands = metricList(fallbackBand.extracted_demands)
    band.extracted_selling_points = sellingPoints.length ? sellingPoints : fallbackSellingPoints
    band.extracted_demands = demands.length ? demands : fallbackDemands
    band.image_prompts = aiBand.image_prompts || fallbackBand.image_prompts || {}
    band.visual_summary = aiBand.visual_summary || ''
    const productAi = new Map((aiBand.product_analysis || []).map((product) => [String(product.product_id || ''), product]))
    const fallbackProductAi = new Map((fallbackBand.product_analysis || []).map((product) => [String(product.product_id || ''), product]))
    for (const product of band.product_analysis || []) {
      const aiProduct = productAi.get(String(product.product_id || '')) || {}
      const fallbackProduct = fallbackProductAi.get(String(product.product_id || '')) || {}
      const productSellingPoints = metricList(aiProduct.selling_points)
      const productDemands = metricList(aiProduct.demands)
      product.selling_points = productSellingPoints.length ? productSellingPoints : metricList(fallbackProduct.selling_points)
      product.demands = productDemands.length ? productDemands : metricList(fallbackProduct.demands)
      product.image_prompts = aiProduct.image_prompts || band.image_prompts || {}
      product.visual_observation = aiProduct.visual_observation || ''
    }
  }
  baseReport.summary.analysis_model = aiResult.model
  baseReport.summary.ark_response_id = aiResult.responseId
  baseReport.summary.vision_image_count = aiResult.imageCount
  baseReport.summary.vision_batch_count = aiResult.visualBatchCount || 0
  baseReport.summary.ai_usage = aiResult.usage || emptyUsage()
  baseReport.generated_at = new Date().toISOString()
  if (!aiResult.imageCount) baseReport.data_gaps.push('当前可用于视觉模型读取的图片链接数量为 0，图片分析会退化为标题/SKU/问大家分析。')
  for (const error of aiResult.visualErrors || []) {
    baseReport.data_gaps.push(error.error)
  }
  mergeStrategySections(baseReport, aiResult.aiJson || {})
  return baseReport
}

function renderMarkdown(report) {
  const strategy = mergeStrategySections({ ...report, price_band_report: report.price_band_report || [] }, report)
  const scope = strategy.analysis_scope || {}
  const core = strategy.market_core_conclusions || {}
  const sales = strategy.sales_structure || {}
  const sp = strategy.high_sales_selling_point_analysis || {}
  const demand = strategy.consumer_demand_analysis || {}
  const positioning = strategy.product_positioning_visual_strategy || {}
  const decision = strategy.final_image_decision_card || {}
  const table = (headers, rows) => {
    if (!rows?.length) return ''
    return [
      `| ${headers.join(' | ')} |`,
      `| ${headers.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${row.map((cell) => String(cell ?? '').replace(/\n/g, '<br>')).join(' | ')} |`),
    ].join('\n')
  }
  const metric = core.core_metrics || {}
  const lines = [
    `# ${strategy.report_title || `${report.summary?.keyword || '产品'}竞品市场分析与 Listing 图片生成策略报告`}`,
    '',
    '---',
    '',
    '# 01. 分析范围',
    '',
    table(['项目', '内容'], [
      ['产品名称', scope.product_name || report.summary?.keyword || '-'],
      ['站点/平台', scope.site || '淘宝/天猫'],
      ['类目', scope.category || report.summary?.keyword || '-'],
      ['数据时间', scope.data_time || report.generated_at || '-'],
      ['商品样本数量', scope.sample_product_count ?? report.summary?.competitor_count ?? 0],
      ['有效商品数量', scope.valid_product_count ?? report.summary?.competitor_count ?? 0],
      ['评论/问大家样本数量', scope.review_sample_count ?? 0],
      ['数据来源', safeArray(scope.data_sources).join('、') || '-'],
    ]),
    '',
    '## 数据说明',
    '',
    scope.data_note || `本报告基于 ${report.summary?.competitor_count || 0} 个同类商品进行分析，重点研究销量、销售额、价格带、卖点、消费者需求和 Listing 图片生成策略。`,
    '',
    '# 02. 市场核心结论',
    '',
    '## 市场一句话判断',
    '',
    `> ${core.one_sentence_judgement || '-'}`,
    '',
    '## 核心数据',
    '',
    table(['指标', '结果'], [
      ['样本商品总销售额', metric.total_sales_amount ?? '-'],
      ['样本商品总销量', metric.total_sold_count ?? '-'],
      ['Top 10 商品销售额占比', metric.top_10_sales_share ?? '-'],
      ['Top 3 品牌销售额占比', metric.top_3_brand_sales_share ?? '-'],
      ['主流价格带', metric.mainstream_price_band ?? '-'],
      ['高销量商品平均评分', metric.high_sales_avg_rating ?? '-'],
      ['高销量商品平均评论数', metric.high_sales_avg_review_count ?? '-'],
    ]),
    '',
    '## 最重要的三个市场结论',
    '',
    ...safeArray(core.top_conclusions).slice(0, 3).flatMap((item, index) => [
      `### 结论 ${index + 1}：${item.title || '-'}`,
      '',
      `- 数据依据：${item.data_basis || '-'}`,
      `- 市场含义：${item.market_meaning || '-'}`,
      `- 对生图的影响：${item.image_impact || '-'}`,
      '',
    ]),
    '# 03. 销售额与销量结构',
    '',
    '## 3.1 头部商品表现',
    '',
    table(['排名', '品牌/型号', '价格', '月销量', '月销售额', '评分', '核心卖点', '代表原因'], safeArray(sales.representative_products).slice(0, 10).map((item) => [
      item.rank,
      item.brand_or_model,
      item.price,
      item.monthly_sold,
      item.monthly_sales_amount,
      item.rating,
      safeArray(item.core_selling_points).join('、'),
      item.representative_reason,
    ])),
    '',
    '## 3.2 价格带分析',
    '',
    table(['价格带', '商品数量占比', '销量占比', '销售额占比', '平均评分', '主要卖点', '市场判断'], safeArray(sales.price_band_analysis).map((item) => [
      item.price_band,
      item.product_count_share,
      item.sold_share,
      item.sales_share,
      item.avg_rating,
      safeArray(item.main_selling_points).join('、'),
      item.market_judgement,
    ])),
    '',
    '## 3.3 品牌集中度',
    '',
    table(['品牌', '商品数量', '销量占比', '销售额占比', '平均价格', '主要定位'], safeArray(sales.brand_concentration).map((item) => [
      item.brand,
      item.product_count,
      item.sold_share,
      item.sales_share,
      item.avg_price,
      item.main_positioning,
    ])),
    '',
    '## 销售结构结论',
    '',
    ...safeArray(sales.conclusions).map((item) => `- ${item}`),
    '',
    '# 04. 高销量商品卖点分析',
    '',
    table(['卖点', '商品覆盖率', '覆盖商品销售额占比', '高销量商品覆盖率', '用户关注度', '市场属性'], safeArray(sp.selling_point_performance).map((item) => [
      item.selling_point,
      item.product_coverage_rate,
      item.covered_product_sales_share,
      item.high_sales_product_coverage_rate,
      item.user_attention,
      item.market_attribute,
    ])),
    '',
    '## 4.2 卖点分类',
    '',
    `### A. 市场基础卖点\n${safeArray(sp.categories?.market_basic_selling_points).map((item) => `- ${item}`).join('\n') || '- 暂无'}`,
    '',
    `### B. 已验证的高转化卖点\n${safeArray(sp.categories?.validated_conversion_selling_points).map((item) => `- ${item}`).join('\n') || '- 暂无'}`,
    '',
    `### C. 同质化严重的卖点\n${safeArray(sp.categories?.homogenized_selling_points).map((item) => `- ${item}`).join('\n') || '- 暂无'}`,
    '',
    `### D. 潜在机会卖点\n${safeArray(sp.categories?.opportunity_selling_points).map((item) => `- ${item}`).join('\n') || '- 暂无'}`,
    '',
    '# 05. 消费者市场需求分析',
    '',
    table(['排名', '用户需求', '评论提及率', '关键词需求', '高销量商品满足度', '市场缺口', '图片表现'], safeArray(demand.top_purchase_needs).map((item) => [
      item.rank,
      item.user_need,
      item.review_mention_rate,
      item.keyword_demand,
      item.high_sales_product_satisfaction,
      item.market_gap,
      item.image_expression,
    ])),
    '',
    '## 5.2 好评需求分析',
    '',
    table(['好评主题', '提及频次', '对应用户收益', '可转化图片卖点', '分析结论'], safeArray(demand.positive_review_needs).map((item) => [
      item.theme,
      item.mention_count,
      item.user_benefit,
      item.image_selling_point,
      item.analysis_conclusion,
    ])),
    '',
    '## 5.3 差评痛点分析',
    '',
    table(['差评痛点', '提及频次', '涉及商品数量', '对转化影响', '可反推卖点'], safeArray(demand.negative_pain_points).map((item) => [
      item.pain_point,
      item.mention_count,
      item.related_product_count,
      item.conversion_impact,
      item.reverse_selling_point,
    ])),
    '',
    '## 5.4 使用场景需求',
    '',
    table(['使用场景', '需求强度', '对应需求', '竞品覆盖度', '图片机会'], safeArray(demand.usage_scenarios).map((item) => [
      item.scenario,
      item.demand_strength,
      item.related_need,
      item.competitor_coverage,
      item.image_opportunity,
    ])),
    '',
    '# 06. 卖点机会矩阵',
    '',
    table(['卖点', '需求强度', '销售验证', '竞争缺口', '可视化程度', '综合建议', '优先级'], safeArray(strategy.selling_point_opportunity_matrix).map((item) => [
      item.selling_point,
      item.demand_strength_score,
      item.sales_validation_score,
      item.competition_gap_score,
      item.visual_expression_score,
      item.overall_suggestion,
      item.priority,
    ])),
    '',
    '# 07. 产品定位与视觉策略',
    '',
    `**目标人群：** ${positioning.target_audience || '-'}`,
    '',
    `**核心使用场景：** ${safeArray(positioning.core_usage_scenarios).join('、') || '-'}`,
    '',
    `**建议价格带：** ${positioning.suggested_price_band || '-'}`,
    '',
    `**一句话定位：** ${positioning.one_sentence_positioning || '-'}`,
    '',
    '## 核心卖点层级',
    '',
    ...safeArray(positioning.core_selling_point_levels).flatMap((item) => [
      `### ${item.level || ''}`,
      `- 卖点：${item.selling_point || '-'}`,
      `- 用户收益：${item.user_benefit || '-'}`,
      `- 数据依据：${item.data_basis || '-'}`,
      `- 建议视觉表现：${item.visual_expression || '-'}`,
      `- 建议文案：${item.suggested_copy || '-'}`,
      '',
    ]),
    '## 视觉差异化方向',
    '',
    table(['维度', '竞品普遍做法', '本产品建议'], safeArray(positioning.visual_differentiation).map((item) => [
      item.dimension,
      item.competitor_common_practice,
      item.our_product_suggestion,
    ])),
    '',
    '# 08. Listing 图片整体规划',
    '',
    table(['图号', '图片模块', '主要任务', '核心卖点', '用户需求', '数据依据'], safeArray(strategy.listing_image_overall_plan).map((item) => [
      item.image_no,
      item.image_module,
      item.main_task,
      item.core_selling_point,
      item.user_need,
      item.data_basis,
    ])),
    '',
    '# 09. 单张图片生成方案',
    '',
    ...safeArray(strategy.single_image_generation_plan).flatMap((item) => [
      `## 图片 ${item.image_no}：${item.image_name}`,
      '',
      `### 1. 图片目标\n${item.image_goal || '-'}`,
      '',
      `### 2. 对应市场结论\n- 销售数据依据：${item.market_basis?.sales_data_basis || '-'}\n- 用户需求依据：${item.market_basis?.user_need_basis || '-'}\n- 竞品缺口：${item.market_basis?.competitor_gap || '-'}`,
      '',
      `### 3. 核心卖点\n${item.core_selling_point || '-'}`,
      '',
      `### 4. 用户收益\n${item.user_benefit || '-'}`,
      '',
      `### 5. 文案层级\n- 主标题：${item.copy_hierarchy?.main_title || '-'}\n- 副标题：${item.copy_hierarchy?.subtitle || '-'}\n- 辅助标签：${safeArray(item.copy_hierarchy?.badges).join('、') || '-'}`,
      '',
      '### 6. 完整生图提示词',
      '',
      '```text',
      item.full_prompt || '-',
      '```',
      '',
    ]),
    '# 10. 最终生图决策卡',
    '',
    `## 市场判断\n- 主流价格带：${decision.market_judgement?.mainstream_price_band || '-'}\n- 最大销量区间：${decision.market_judgement?.max_sold_band || '-'}\n- 最大销售额区间：${decision.market_judgement?.max_sales_amount_band || '-'}\n- 头部品牌：${safeArray(decision.market_judgement?.head_brands).join('、') || '-'}\n- 市场成熟度：${decision.market_judgement?.market_maturity || '-'}`,
    '',
    `## 消费者需求\n- 第一需求：${decision.consumer_needs?.first_need || '-'}\n- 第二需求：${decision.consumer_needs?.second_need || '-'}\n- 第三需求：${decision.consumer_needs?.third_need || '-'}\n- 最大痛点：${decision.consumer_needs?.biggest_pain_point || '-'}\n- 主要使用场景：${decision.consumer_needs?.main_usage_scenario || '-'}`,
    '',
    `## 产品定位\n- 目标人群：${decision.product_positioning?.target_audience || '-'}\n- 建议价格：${decision.product_positioning?.suggested_price || '-'}\n- 一句话定位：${decision.product_positioning?.one_sentence_positioning || '-'}\n- 第一核心卖点：${decision.product_positioning?.first_core_selling_point || '-'}\n- 第二核心卖点：${decision.product_positioning?.second_core_selling_point || '-'}\n- 第三核心卖点：${decision.product_positioning?.third_core_selling_point || '-'}`,
    '',
    `## 图片策略\n- 第一张副图展示：${decision.image_strategy?.first_sub_image || '-'}\n- 第二张副图展示：${decision.image_strategy?.second_sub_image || '-'}\n- 第三张副图展示：${decision.image_strategy?.third_sub_image || '-'}\n- 必须出现的场景：${safeArray(decision.image_strategy?.must_have_scenes).join('、') || '-'}\n- 必须展示的产品细节：${safeArray(decision.image_strategy?.must_show_details).join('、') || '-'}\n- 不建议重点展示的卖点：${safeArray(decision.image_strategy?.not_recommended_focus).join('、') || '-'}\n- 建议整体视觉风格：${decision.image_strategy?.suggested_visual_style || '-'}`,
    '',
    '## 最终图片顺序',
    '',
    ...safeArray(decision.final_image_order).map((item, index) => `${index + 1}. ${item}`),
    '',
  ]
  return lines.join('\n')
}

const MARKET_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS market_analysis_run (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    report_no VARCHAR(64) NOT NULL,
    report_hash CHAR(64) NOT NULL,
    source_platform VARCHAR(32) NOT NULL DEFAULT 'taobao',
    data_source VARCHAR(32) NULL,
    keyword VARCHAR(255) NULL,
    competitor_count INT NOT NULL DEFAULT 0,
    price_band_count INT NOT NULL DEFAULT 0,
    cost_price DECIMAL(18,2) NULL,
    cost_model_json LONGTEXT NULL,
    report_json LONGTEXT NULL,
    report_path TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_market_analysis_hash (report_hash),
    KEY idx_market_analysis_keyword (keyword),
    KEY idx_market_analysis_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_price_band_analysis (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    price_band VARCHAR(64) NOT NULL,
    competitor_count INT NOT NULL DEFAULT 0,
    price_min DECIMAL(18,2) NULL,
    price_max DECIMAL(18,2) NULL,
    price_avg DECIMAL(18,2) NULL,
    sold_count_total BIGINT NOT NULL DEFAULT 0,
    sales_amount_total DECIMAL(18,2) NULL,
    review_count_total BIGINT NOT NULL DEFAULT 0,
    qa_count_total BIGINT NOT NULL DEFAULT 0,
    selling_points_json LONGTEXT NULL,
    demands_json LONGTEXT NULL,
    qa_examples_json LONGTEXT NULL,
    display_images_json LONGTEXT NULL,
    profit_simulation_json LONGTEXT NULL,
    image_prompts_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_price_band_run_band (run_id, price_band),
    KEY idx_price_band_run (run_id),
    KEY idx_price_band_name (price_band)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_price_band_competitor (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    price_band_id BIGINT UNSIGNED NOT NULL,
    price_band VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NULL,
    product_title TEXT NULL,
    price DECIMAL(18,2) NULL,
    sold_count BIGINT NULL,
    sales_amount DECIMAL(18,2) NULL,
    product_link TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_band_competitor_run (run_id),
    KEY idx_band_competitor_band (price_band_id),
    KEY idx_band_competitor_product (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_price_band_image (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    price_band_id BIGINT UNSIGNED NOT NULL,
    price_band VARCHAR(64) NOT NULL,
    image_type VARCHAR(64) NULL,
    product_id VARCHAR(64) NULL,
    sku_id VARCHAR(64) NULL,
    image_url TEXT NULL,
    image_path TEXT NULL,
    file_name VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_band_image_run (run_id),
    KEY idx_band_image_band (price_band_id),
    KEY idx_band_image_product (product_id),
    KEY idx_band_image_sku (sku_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_price_band_insight (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    price_band_id BIGINT UNSIGNED NOT NULL,
    price_band VARCHAR(64) NOT NULL,
    insight_type VARCHAR(32) NOT NULL,
    term VARCHAR(255) NOT NULL,
    occurrence_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_band_insight_run (run_id),
    KEY idx_band_insight_band (price_band_id),
    KEY idx_band_insight_type (insight_type),
    KEY idx_band_insight_term (term)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_price_band_product_analysis (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    price_band_id BIGINT UNSIGNED NOT NULL,
    price_band VARCHAR(64) NOT NULL,
    source_job_id BIGINT UNSIGNED NULL,
    product_id VARCHAR(64) NULL,
    product_title TEXT NULL,
    category_name VARCHAR(255) NULL,
    product_link TEXT NULL,
    price DECIMAL(18,2) NULL,
    price_min DECIMAL(18,2) NULL,
    price_max DECIMAL(18,2) NULL,
    sold_count BIGINT NULL,
    sales_amount DECIMAL(18,2) NULL,
    review_count BIGINT NULL,
    favorite_count BIGINT NULL,
    question_count BIGINT NULL,
    sku_count INT NOT NULL DEFAULT 0,
    qa_count INT NOT NULL DEFAULT 0,
    image_count INT NOT NULL DEFAULT 0,
    sku_json LONGTEXT NULL,
    image_json LONGTEXT NULL,
    qa_examples_json LONGTEXT NULL,
    selling_points_json LONGTEXT NULL,
    demands_json LONGTEXT NULL,
    profit_simulation_json LONGTEXT NULL,
    image_prompts_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_market_product_run (run_id),
    KEY idx_market_product_band (price_band_id),
    KEY idx_market_product_product (product_id),
    KEY idx_market_product_price (price)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_product_asset (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    price_band_id BIGINT UNSIGNED NOT NULL,
    product_analysis_id BIGINT UNSIGNED NOT NULL,
    price_band VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NULL,
    sku_id VARCHAR(64) NULL,
    asset_type VARCHAR(64) NULL,
    asset_url TEXT NULL,
    asset_path TEXT NULL,
    file_name VARCHAR(255) NULL,
    sort_no INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_market_asset_run (run_id),
    KEY idx_market_asset_product_analysis (product_analysis_id),
    KEY idx_market_asset_product (product_id),
    KEY idx_market_asset_band (price_band_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_product_insight (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    price_band_id BIGINT UNSIGNED NOT NULL,
    product_analysis_id BIGINT UNSIGNED NOT NULL,
    price_band VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NULL,
    insight_type VARCHAR(32) NOT NULL,
    term VARCHAR(255) NOT NULL,
    occurrence_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_market_product_insight_run (run_id),
    KEY idx_market_product_insight_product_analysis (product_analysis_id),
    KEY idx_market_product_insight_product (product_id),
    KEY idx_market_product_insight_type (insight_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_listing_generation (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    price_band_id BIGINT UNSIGNED NOT NULL,
    product_analysis_id BIGINT UNSIGNED NULL,
    price_band VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NULL,
    generation_type VARCHAR(32) NOT NULL DEFAULT 'image_prompt_seed',
    title_text TEXT NULL,
    main_image_prompt TEXT NULL,
    detail_image_prompt TEXT NULL,
    buyer_show_prompt TEXT NULL,
    generation_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_listing_generation_run (run_id),
    KEY idx_listing_generation_band (price_band_id),
    KEY idx_listing_generation_product_analysis (product_analysis_id),
    KEY idx_listing_generation_product (product_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS product_main_image_analysis (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    source_platform VARCHAR(32) NOT NULL DEFAULT 'taobao',
    collection_keyword VARCHAR(255) NULL,
    product_id VARCHAR(64) NULL,
    product_title TEXT NULL,
    product_url TEXT NULL,
    shop_name VARCHAR(255) NULL,
    price DECIMAL(18,2) NULL,
    sold_count BIGINT NULL,
    main_image_url LONGTEXT NULL,
    main_image_path TEXT NULL,
    sku_json LONGTEXT NULL,
    qa_json LONGTEXT NULL,
    report_json LONGTEXT NULL,
    model VARCHAR(128) NULL,
    response_id VARCHAR(128) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_product_main_image_analysis_product (product_id),
    KEY idx_product_main_image_analysis_keyword (collection_keyword),
    KEY idx_product_main_image_analysis_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS market_main_image_ai_report (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT NOT NULL,
    cache_key VARCHAR(64) NOT NULL,
    result_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_main_image_ai_cache (cache_key),
    KEY idx_main_image_ai_run (run_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
]

async function ensureMarketSchema(connection) {
  for (const statement of MARKET_SCHEMA_STATEMENTS) {
    await connection.query(statement)
  }
}

async function persistMarketReport(report) {
  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    await connection.beginTransaction()
    try {
      const reportJson = jsonText(report)
      const reportHash = crypto.createHash('sha256').update(reportJson).digest('hex')
      const reportNo = `ai-market-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`
      const [runResult] = await connection.query(`
        INSERT INTO market_analysis_run (
          report_no, report_hash, source_platform, data_source, keyword,
          competitor_count, price_band_count, cost_price, cost_model_json, report_json, report_path
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `, [
        reportNo,
        reportHash,
        'taobao',
        report.summary.source,
        report.summary.keyword,
        toInt(report.summary.competitor_count),
        toInt(report.summary.price_band_count),
        money(report.summary.cost_price),
        jsonText(report.summary.cost_model || {}),
        reportJson,
        null,
      ])
      const runId = Number(runResult.insertId)
      const stats = { run_id: runId, bands: 0, competitors: 0, band_images: 0, band_insights: 0, products: 0, product_assets: 0, product_insights: 0, listing_generations: 0 }

      for (const band of report.price_band_report || []) {
        const qa = band.qa_and_review || {}
        const display = band.display_images || {}
        const [bandResult] = await connection.query(`
          INSERT INTO market_price_band_analysis (
            run_id, price_band, competitor_count, price_min, price_max, price_avg,
            sold_count_total, sales_amount_total, review_count_total, qa_count_total,
            selling_points_json, demands_json, qa_examples_json, display_images_json,
            profit_simulation_json, image_prompts_json
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `, [
          runId,
          band.price_band,
          toInt(band.competitor_count),
          money(band.price_min),
          money(band.price_max),
          money(band.price_avg),
          toInt(band.sold_count_total),
          money(band.sales_amount_total),
          toInt(qa.review_count_total),
          toInt(qa.qa_count_total),
          jsonText(band.extracted_selling_points || []),
          jsonText(band.extracted_demands || []),
          jsonText(qa.qa_examples || []),
          jsonText(display.available_images || []),
          jsonText(band.profit_simulation),
          jsonText(band.image_prompts || {}),
        ])
        const bandId = Number(bandResult.insertId)
        stats.bands += 1

        for (const item of band.competitor_links || []) {
          await connection.query(`
            INSERT INTO market_price_band_competitor (
              run_id, price_band_id, price_band, product_id, product_title, price, sold_count, sales_amount, product_link
            ) VALUES (?,?,?,?,?,?,?,?,?)
          `, [runId, bandId, band.price_band, item.product_id, item.title, money(item.price), toInt(item.sold_count, null), money(item.sales_amount), item.link])
          stats.competitors += 1
        }

        for (const image of display.available_images || []) {
          await connection.query(`
            INSERT INTO market_price_band_image (
              run_id, price_band_id, price_band, image_type, product_id, sku_id, image_url, image_path, file_name
            ) VALUES (?,?,?,?,?,?,?,?,?)
          `, [runId, bandId, band.price_band, image.image_type, image.product_id, image.sku_id, image.url, image.path, image.file_name])
          stats.band_images += 1
        }

        for (const [insightType, key] of [['selling_point', 'extracted_selling_points'], ['demand', 'extracted_demands']]) {
          for (const insight of band[key] || []) {
            await connection.query(`
              INSERT INTO market_price_band_insight (
                run_id, price_band_id, price_band, insight_type, term, occurrence_count
              ) VALUES (?,?,?,?,?,?)
            `, [runId, bandId, band.price_band, insightType, insight.term || insight.keyword, toInt(insight.count)])
            stats.band_insights += 1
          }
        }

        for (const product of band.product_analysis || []) {
          const [productResult] = await connection.query(`
            INSERT INTO market_price_band_product_analysis (
              run_id, price_band_id, price_band, source_job_id, product_id, product_title,
              category_name, product_link, price, price_min, price_max, sold_count,
              sales_amount, review_count, favorite_count, question_count, sku_count,
              qa_count, image_count, sku_json, image_json, qa_examples_json,
              selling_points_json, demands_json, profit_simulation_json, image_prompts_json
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `, [
            runId,
            bandId,
            band.price_band,
            toInt(product.job_id, null),
            product.product_id,
            product.product_title,
            product.category_name,
            product.product_link,
            money(product.price),
            money(product.price_min),
            money(product.price_max),
            toInt(product.sold_count, null),
            money(product.sales_amount),
            toInt(product.review_count, null),
            toInt(product.favorite_count, null),
            toInt(product.question_count, null),
            toInt(product.sku_count),
            toInt(product.qa_count),
            toInt(product.image_count),
            jsonText(product.skus || []),
            jsonText(product.images || []),
            jsonText(product.qa_examples || []),
            jsonText(product.selling_points || []),
            jsonText(product.demands || []),
            jsonText(product.profit_simulation),
            jsonText(product.image_prompts || {}),
          ])
          const productAnalysisId = Number(productResult.insertId)
          stats.products += 1

          for (const [index, image] of (product.images || []).entries()) {
            await connection.query(`
              INSERT INTO market_product_asset (
                run_id, price_band_id, product_analysis_id, price_band, product_id,
                sku_id, asset_type, asset_url, asset_path, file_name, sort_no
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
            `, [runId, bandId, productAnalysisId, band.price_band, product.product_id, image.sku_id, image.image_type, image.url, image.path, image.file_name, index])
            stats.product_assets += 1
          }

          for (const [insightType, key] of [['selling_point', 'selling_points'], ['demand', 'demands']]) {
            for (const insight of product[key] || []) {
              await connection.query(`
                INSERT INTO market_product_insight (
                  run_id, price_band_id, product_analysis_id, price_band, product_id,
                  insight_type, term, occurrence_count
                ) VALUES (?,?,?,?,?,?,?,?)
              `, [runId, bandId, productAnalysisId, band.price_band, product.product_id, insightType, insight.term || insight.keyword, toInt(insight.count)])
              stats.product_insights += 1
            }
          }

          const prompts = product.image_prompts || {}
          await connection.query(`
            INSERT INTO market_listing_generation (
              run_id, price_band_id, product_analysis_id, price_band, product_id,
              generation_type, title_text, main_image_prompt, detail_image_prompt,
              buyer_show_prompt, generation_json
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
          `, [
            runId,
            bandId,
            productAnalysisId,
            band.price_band,
            product.product_id,
            'ark_vision_prompt',
            prompts.title_direction || band.image_prompts?.title_direction || null,
            prompts.main_image_prompt || null,
            prompts.detail_image_prompt || null,
            prompts.buyer_show_prompt || null,
            jsonText(prompts),
          ])
          stats.listing_generations += 1
        }
      }

      await connection.commit()
      return { ok: true, report_hash: reportHash, ...stats }
    } catch (error) {
      await connection.rollback()
      throw error
    }
  })
}

function mergeReportRuns(rows) {
  if (!rows.length) return null
  const parsed = rows
    .map((row) => ({ row, reportJson: row.report_json ? JSON.parse(row.report_json) : null }))
    .filter((item) => item.reportJson)
  if (!parsed.length) return null

  const latest = parsed[0]
  const bandMap = new Map()
  let competitorTotal = 0
  let usage = emptyUsage()
  const runIds = []
  const dataGaps = []
  for (const item of parsed) {
    runIds.push(item.row.id)
    addUsage(usage, item.reportJson.summary?.ai_usage)
    competitorTotal = Math.max(competitorTotal, toInt(item.reportJson.summary?.competitor_count ?? item.row.competitor_count, 0))
    for (const gap of item.reportJson.data_gaps || []) {
      if (!dataGaps.includes(gap)) dataGaps.push(gap)
    }
    for (const band of item.reportJson.price_band_report || []) {
      if (bandMap.has(band.price_band)) continue
      bandMap.set(band.price_band, band)
    }
  }

  const bands = Array.from(bandMap.values())
    .sort((a, b) => toNumber(a.price_min, 0) - toNumber(b.price_min, 0))
  const reportJson = {
    ...latest.reportJson,
    summary: {
      ...latest.reportJson.summary,
      competitor_count: competitorTotal,
      price_band_count: bands.length,
      merged_run_ids: runIds,
      merged_run_count: runIds.length,
      ai_usage: usage,
    },
    price_band_report: bands,
    data_gaps: dataGaps,
  }
  return {
    keyword: latest.row.keyword,
    costPrice: latest.row.cost_price,
    generatedAt: latest.row.created_at,
    saveToDb: true,
    persistStats: { run_id: latest.row.id, merged_run_ids: runIds },
    reportJson,
    markdown: renderMarkdown(reportJson),
  }
}

export async function readLatestMarketReport(keyword = '') {
  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    const cleanKeyword = String(keyword || '').trim()
    if (cleanKeyword) {
      const [rows] = await connection.query(`
        SELECT *
        FROM market_analysis_run
        WHERE keyword = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 30
      `, [cleanKeyword])
      return mergeReportRuns(rows)
    }

    const [rows] = await connection.query(`
      SELECT *
      FROM market_analysis_run
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `)
    if (!rows.length) return null
    const row = rows[0]
    const reportJson = row.report_json ? JSON.parse(row.report_json) : null
    return {
      keyword: row.keyword,
      costPrice: row.cost_price,
      generatedAt: row.created_at,
      saveToDb: true,
      persistStats: { run_id: row.id },
      reportJson,
      markdown: reportJson ? renderMarkdown(reportJson) : '',
    }
  })
}

function metricTerms(items, limit = 6) {
  return (items || [])
    .map((item) => ({
      term: String(item.term || item.keyword || '').trim(),
      count: toInt(item.count, 1),
    }))
    .filter((item) => item.term)
    .slice(0, limit)
}

function uniqueText(items, limit = 5) {
  const seen = new Set()
  const result = []
  for (const item of items || []) {
    const text = String(item || '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
    if (result.length >= limit) break
  }
  return result
}

const KEYWORD_MATRIX_STOP_WORDS = new Set([
  '这个', '那个', '一种', '一起', '一直', '已经', '没有', '就是', '非常', '不错', '值得',
  '购买', '收到', '宝贝', '商品', '产品', '主图', '图片', '展示', '适合', '专用', '专属',
  '一个', '两个', '多个', '可以', '进行', '使用', '主要', '核心', '标题', '文字', '标注',
  '左侧', '右侧', '顶部', '底部', '中部', '前方', '背景', '画面', '视觉', '风格',
  '净含量', '标准', '推荐', '升级', '回购', '囤货', '混合', '口味', '规格', '选择',
  '多多', '火腿', '香精', '诱食剂', '含量', '添加', '每天', '多次', '喜欢', '很喜欢', '很好', '好用', '挺好', '质量', '我家', '疯狂', '小狗', '0香', '0诱',
  '本地', '本地提取', '本地兜底', '批次', '摘要', '批次摘要', '批次摘要本地', '评价', '提取',
  '大家', '来自', '需求', '评论', '问大家', '卖点', '洞察', '数据', '样本', '用户', '商品关键词',
  '商品标题', '报告', '分析', '来源', '入库', '可用', '已有', '信号', '覆盖',
  '店长', '店长推荐', '不加', '共计', '合计', '详情', '详情页',
  'ip', 'ip联名', '联名挂钩', 'ip联名挂钩',
  'term', 'count', 'evidence', 'reason', 'score', 'label', 'value', 'name', 'type',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'over', 'under',
  // 技术属性词 / SKU 系统字段
  'id', 'image', 'info', 'price', 'qty', 'coupon', 'url', 'link', 'src', 'sku',
  'http', 'https', 'com', 'jpg', 'png', 'gif', 'html', 'css', 'json', 'xml',
  '快照', '商品快照', '链接', '商品链接', '店铺', '价格', '优惠券', '原价', '到手价',
  '数量', '属性', '参数', '字段', '编号', '编码', '条码', '二维码', 'sku_id',
  'color', 'size', 'weight', 'width', 'height', 'length', 'material', 'style',
  'option', 'variant', 'stock', 'status', 'category', 'brand', 'model',
  'item', 'product', 'goods', 'order', 'cart', 'shop', 'store',
  'description', 'feature', 'specification', 'detail', 'information',
  'default', 'custom', 'template', 'config', 'setting', 'option',
  'image_url', 'img', 'pic', 'photo', 'banner', 'logo', 'icon',
  // 常见虚词/连词/副词（不是有意义的关键词）
  '还是', '但是', '而且', '或者', '如果', '因为', '所以', '虽然', '不过', '然后',
  '之后', '之前', '以后', '以前', '现在', '刚才', '马上', '立刻', '终于', '竟然',
  '居然', '果然', '当然', '自然', '显然', '明显', '确实', '真的', '确实', '实在',
  '比较', '特别', '非常', '十分', '相当', '稍微', '略微', '大概', '大约', '左右',
  '东西', '事情', '时候', '地方', '问题', '情况', '方面', '部分', '整体', '全部',
  '整体来说', '总的来说', '总体来说', '综合来看', '综合来说',
])

const PURE_TECHNICAL_WORD = /^(?:id|image|info|price|qty|coupon|url|link|src|sku|http|https|com|jpg|png|gif|html|css|json|xml|color|size|weight|width|height|length|material|style|option|variant|stock|status|category|brand|model|item|product|goods|order|cart|shop|store|description|feature|specification|detail|information|default|custom|template|config|setting|img|pic|photo|banner|logo|icon|sku[_-]?id)$/i

const zhSegmenter = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
  : null

function normalizeKeywordTerm(value) {
  return String(value || '')
    .replace(/[，。；：！？、（）【】《》“”‘’"'`~!@#$%^&*_+=|\\/<>[\]{}(),.;:?]/g, ' ')
    .replace(/™|®|★|#|【|】/g, ' ')
    .replace(/[ＯOo](?=盐|香|诱)/g, '0')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isUsefulKeywordTerm(term) {
  const text = String(term || '').trim()
  if (!text) return false
  if (KEYWORD_MATRIX_STOP_WORDS.has(text)) return false
  if (PURE_TECHNICAL_WORD.test(text)) return false
  if (/\b(?:term|count|evidence|reason|score|label|value|type|status|default|config|option|variant|specification|feature|description|information|material|category|brand|model)\b/i.test(text)) return false
  if (/^(?:本地|来自|批次|摘要|评价|提取|大家|需求|评论|问大家|卖点|洞察|样本|数据|用户|标题|主图|sku|快照|链接|店铺|价格|优惠|编号|编码)$/i.test(text)) return false
  // 纯英文单词且不含中文 → 大概率是系统字段名
  if (/^[a-z0-9_-]+$/i.test(text) && !/[\u4e00-\u9fff]/.test(text) && text.length <= 12) return false
  if (/^\d+(?:\.\d+)?(?:g|kg|克|斤|包|根|袋|元|个月|月龄|年|岁)?$/i.test(text)) return false
  if (/^共?\d+(?:\.\d+)?(?:g|kg|克|斤|包|根|袋)$/i.test(text)) return false
  if (/^\d+[张抽包提共·*xX]+\d*$/i.test(text)) return false
  if (/^[0o][张抽提包]|[张抽提包]·?包$/i.test(text)) return false
  if (/^共\d+(?:张|抽|包|提|卷|片)?$/i.test(text)) return false
  if (/^\d+(?:张|抽|包|提|卷|片)(?:·|每|一)?(?:包|提)?$/i.test(text)) return false
  if (/^\d+提共\d+$/i.test(text)) return false
  if (/^(?:超韧)?抽纸\d+$/i.test(text)) return false
  if (/[\u4e00-\u9fff]\d$/.test(text)) return false
  if (/^[\d\s.gkg克斤包根袋元]+$/i.test(text)) return false
  if (/^[\d\s.,，。:：;；\-]+$/.test(text)) return false
  if (/^[一二三四五六七八九十]+$/.test(text)) return false
  if (text.length < 2 && !/^0[\u4e00-\u9fff]/.test(text)) return false
  if (text.length > 40) return false
  return true
}

function splitKeywordTerms(value) {
  const normalized = normalizeKeywordTerm(value)
  if (!normalized) return []
  const terms = []
  const chunks = normalized
    .replace(/([0０][\u4e00-\u9fff])/g, ' $1')
    .split(/[\s|/／,，.。;；:：()[\]{}【】<>《》]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  for (const phrase of normalized.match(/[a-z0-9]+(?:[- ][a-z0-9]+){1,8}/g) || []) {
    if (isUsefulKeywordTerm(phrase)) terms.push(phrase)
  }

  for (const chunk of chunks) {
    if (/^[a-z0-9-]{2,}$/i.test(chunk)) {
      if (isUsefulKeywordTerm(chunk)) terms.push(chunk)
      continue
    }

    const directMatches = chunk.match(/0盐|0香精|0诱食剂|无盐|无香精|无诱食剂|无添加剂|无添加|人食品级工厂|淀粉|肉多多|火腿肠|小型犬|宠物香肠|狗零食|狗粮|泰迪|鸡肉味|牛肉味|混合味/g) || []
    for (const term of directMatches) {
      if (isUsefulKeywordTerm(term)) terms.push(term)
    }

    const words = zhSegmenter
      ? Array.from(zhSegmenter.segment(chunk))
        .filter((part) => part.isWordLike)
        .map((part) => String(part.segment || '').trim())
        .filter((part) => isUsefulKeywordTerm(part))
      : (chunk.match(/[\u4e00-\u9fff]{2,6}/g) || [])

    for (const word of words) terms.push(word)
    for (let start = 0; start < words.length; start += 1) {
      let combined = ''
      for (let end = start; end < Math.min(words.length, start + 4); end += 1) {
        combined += words[end]
        if (end > start && combined.length <= 12 && isUsefulKeywordTerm(combined)) terms.push(combined)
      }
    }

    if (/[\u4e00-\u9fff]/.test(chunk) && chunk.length >= 2 && chunk.length <= 12 && isUsefulKeywordTerm(chunk)) {
      terms.push(chunk)
    }
  }

  return uniqueText(terms, 80)
}

function collectKeywordTextsFromJson(value, bucket, source, weight = 1) {
  const json = typeof value === 'string' ? parseJson(value, null) : value
  if (!json || typeof json !== 'object') return
  const pushText = (text, nextSource = source, nextWeight = weight) => {
    const clean = String(text || '').trim()
    if (clean) bucket.push({ text: clean, source: nextSource, weight: nextWeight })
  }
  const visit = (node, key = '') => {
    if (node == null) return
    if (typeof node === 'string') {
      pushText(node, key.includes('demand') || key.includes('need') ? '需求洞察' : source, weight)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 80)) visit(item, key)
      return
    }
    if (typeof node !== 'object') return
    for (const [childKey, childValue] of Object.entries(node)) {
      if (['term', 'keyword', 'selling_point', 'need', 'pain_point', 'question', 'answer', 'review_text', 'sku_info', 'sku_title'].includes(childKey)) {
        pushText(childValue, childKey.includes('need') || childKey.includes('pain') || childKey.includes('question') || childKey.includes('answer') ? '需求洞察' : source, weight)
      } else if (['main_image_ocr_text', 'image_selling_points', 'title_selling_points', 'qa_user_needs', 'listing_suggestions'].includes(childKey)) {
        visit(childValue, childKey)
      }
    }
  }
  visit(json)
}

function addKeywordSignal(stats, term, { source, productId = '', sold = 0, weight = 1 }) {
  const keyword = normalizeKeywordTerm(term)
  if (!isUsefulKeywordTerm(keyword)) return
  const current = stats.get(keyword) || {
    keyword,
    frequency: 0,
    weightedScore: 0,
    salesSignal: 0,
    productIds: new Set(),
    sources: new Set(),
    demandSignal: 0,
    titleSignal: 0,
    titleProductIds: new Set(),
    evidence: [],
  }
  current.frequency += 1
  current.weightedScore += weight
  current.salesSignal += Math.max(0, toNumber(sold, 0)) * weight
  if (productId) current.productIds.add(String(productId))
  if (source) current.sources.add(source)
  if (source && /需求|评论|问大家/.test(source)) current.demandSignal += weight
  if (source === '商品标题') {
    current.titleSignal += weight
    if (productId) current.titleProductIds.add(String(productId))
  }
  if (source && current.evidence.length < 3) current.evidence.push(source)
  stats.set(keyword, current)
}

function keywordMatrixSourceSummary(sources = []) {
  const sourceSet = new Set(sources)
  const parts = []
  if (sourceSet.has('评论')) parts.push('评论')
  if (sourceSet.has('问大家')) parts.push('问大家')
  if (sourceSet.has('需求洞察')) parts.push('需求洞察')
  if (sourceSet.has('卖点洞察')) parts.push('卖点洞察')
  if (sourceSet.has('SKU')) parts.push('SKU')
  if (sourceSet.has('主图分析')) parts.push('主图分析')
  if (sourceSet.has('商品标题')) parts.push('标题')
  return parts.length ? parts.slice(0, 3).join('、') : '数据库'
}

function keywordMatrixIntentHint(keyword) {
  const text = String(keyword || '').toLowerCase()
  if (/挂钩|悬挂|收纳/.test(text)) {
    return '更像赠品、悬挂或收纳便利点，适合放在副图角标或场景图里，不建议单独当标题主词。'
  }
  if (/联名|新年|发财|卡通|图案|颜值|设计/.test(text)) {
    return '偏款式/活动视觉卖点，适合做限定款或包装差异化表达，使用前要确认授权与品牌风险。'
  }
  if (/吸水|柔|韧|厚|纸张|纸质|纸感|不掉屑|亲肤|原木|无香|无荧光|母婴|加厚|三层|3层/.test(text)) {
    return '属于可感知的使用体验或品质证明，适合用对比图、测试图和短标签强化信任。'
  }
  if (/整箱|大包|家庭装|量贩|组合|套装|囤|包|抽|张|提/.test(text)) {
    return '属于规格和性价比信号，适合在主图/副图明确数量、包装组合和使用周期。'
  }
  if (/维达|清风|洁柔|心相印|植护|漫花|卡其猫/.test(text)) {
    return '更像竞品品牌信号，不建议直接作为上架关键词，可用于观察竞品流量来源。'
  }
  return ''
}

function keywordOpportunityReason(row, { blueOcean = false } = {}) {
  const sourceText = keywordMatrixSourceSummary(row.sources)
  const evidence = []
  if (row.productCoverage >= 60) {
    evidence.push(`覆盖 ${row.productCoverage}% 商品`)
  } else if (row.productCoverage > 0) {
    evidence.push(`只覆盖 ${row.productCoverage}% 商品`)
  }
  evidence.push(row.titleCoverage <= 0 ? '标题暂未覆盖' : `标题覆盖 ${row.titleCoverage}%`)
  if (row.demandSignals > 0) evidence.push(`需求信号 ${row.demandSignals}`)
  if (row.salesSignal > 0) evidence.push(`销量权重 ${Number(row.salesSignal).toLocaleString('zh-CN')}`)

  const sourceSet = new Set(row.sources || [])
  const onlyFromSku = sourceSet.size <= 2 && sourceSet.has('SKU') && !sourceSet.has('评论') && !sourceSet.has('问大家') && !sourceSet.has('卖点洞察') && !sourceSet.has('需求洞察')
  const hasDemandSource = sourceSet.has('评论') || sourceSet.has('问大家') || sourceSet.has('需求洞察')

  const intentHint = keywordMatrixIntentHint(row.keyword)
  if (intentHint) {
    return `${sourceText}中多次出现"${row.keyword}"，${evidence.join('，')}。${intentHint}`
  }

  // 仅来自 SKU 且无需求信号 → 低价值词
  if (onlyFromSku && row.demandSignals <= 0) {
    return `"${row.keyword}"仅出现在 SKU 属性中，${evidence.join('，')}。属于系统字段/属性词，不建议作为标题或图片卖点。`
  }

  // 标题已普遍覆盖 → 红海词
  if (row.titleCoverage >= 60) {
    return `"${row.keyword}"在标题中已较普遍，${evidence.join('，')}。属于基础承接词，差异化价值有限。`
  }

  // 高潜力蓝海词：有需求信号 + 标题低覆盖 + 商品覆盖广
  if (blueOcean && row.demandSignals > 0 && row.titleCoverage <= 20 && row.productCoverage >= 40) {
    return `【高潜力】"${row.keyword}"在${sourceText}中有明确用户需求，覆盖 ${row.productCoverage}% 商品但标题仅覆盖 ${row.titleCoverage}%，销量权重 ${Number(row.salesSignal).toLocaleString('zh-CN')}。建议优先纳入主图或标题差异化表达。`
  }

  // 中潜力蓝海词：有需求信号但覆盖偏低
  if (blueOcean && row.demandSignals > 0 && row.titleCoverage <= 30) {
    return `【中潜力】"${row.keyword}"来自${sourceText}，有用户侧需求信号，${evidence.join('，')}。可作为长尾词或副图卖点补充测试。`
  }

  // 少数高销量商品带出
  if (row.productCoverage <= 20 && row.salesSignal > 0) {
    return `"${row.keyword}"主要由少数高销量商品带出，${evidence.join('，')}。可作为测试卖点，先不要直接放大为核心定位。`
  }

  // 标题覆盖偏高
  if (row.titleCoverage >= 40) {
    return `"${row.keyword}"在${sourceText}里出现，${evidence.join('，')}。标题已有一定覆盖，建议作为辅助表达词而非核心差异点。`
  }

  return `"${row.keyword}"在${sourceText}里出现，${evidence.join('，')}。可作为辅助表达词，结合商品图和价格带再判断优先级。`
}

function keywordRowsFromStats(stats, productTotal, { blueOcean = false, limit = 10 } = {}) {
  const rows = Array.from(stats.values())
    .map((item) => {
      const titleCoverage = productTotal > 0 ? Math.round((item.titleProductIds.size || 0) / productTotal * 100) : 0
      const productCoverage = productTotal > 0 ? Math.round(item.productIds.size / productTotal * 100) : 0
      const opportunityScore = item.demandSignal * 2 + item.weightedScore - item.titleSignal * 1.5
      const row = {
        keyword: item.keyword,
        frequency: item.frequency,
        productCoverage,
        titleCoverage,
        demandSignals: Math.round(item.demandSignal),
        salesSignal: Math.round(item.salesSignal),
        sources: Array.from(item.sources).slice(0, 4),
        sortScore: blueOcean ? opportunityScore : item.weightedScore * 2 + item.salesSignal / 1000 + item.productIds.size,
      }
      return {
        ...row,
        reason: keywordOpportunityReason(row, { blueOcean }),
      }
    })
    .filter((item) => item.keyword)
    .filter((item) => {
      if (!blueOcean) return true
      // 蓝海词门槛：必须有需求信号或来自评论/问大家/卖点洞察，且标题覆盖偏低
      if (item.demandSignals <= 0 && !item.sources.some((s) => /评论|问大家|需求|卖点/.test(s))) return false
      if (item.titleCoverage >= 60) return false
      return true
    })
    .sort((a, b) => b.sortScore - a.sortScore || b.frequency - a.frequency || a.keyword.localeCompare(b.keyword, 'zh-CN'))
    .slice(0, limit)

  return rows.map(({ sortScore, ...row }) => row)
}

function topicDefinitionsForKeyword(keyword = '') {
  const text = String(keyword || '').toLowerCase()
  const isPaperCategory = /纸|抽纸|餐巾纸|卫生纸|面巾纸|厕纸/.test(text)
  const isFoodCategory = /包子|馒头|饺子|烧麦|馅饼|手抓饼|发糕|花卷|汤圆|粽子|月饼|面包|蛋糕|饼干|零食|肉脯|肉干|坚果|水果|蔬菜|土豆|地瓜|玉米|大米|面粉|面条|方便面|速食|早餐|食品|小吃/.test(text)
  const basePositive = [
    { key: '功能效果', patterns: [/防晒|防紫外线|遮阳|upf|降噪|吸水|可湿水|防水|保暖|清洁|效果/], action: '把效果做成可视化证明图，例如参数、对比、场景前后差异。' },
    { key: isFoodCategory ? '口感体验' : '舒适体验', patterns: isFoodCategory ? [/好吃|美味|香|软糯|酥脆|细腻|顺滑|新鲜|鲜嫩|入味|回甘|醇香/] : [/舒服|舒适|柔软|亲肤|不勒|不闷|轻薄|透气|冰丝|无痕|不痛|贴合/], action: isFoodCategory ? '用食物特写、切面/掰开瞬间和真实食用场景证明口感。' : '用材质细节、佩戴/使用场景和长时间体验文案降低顾虑。' },
    { key: '品质材料', patterns: isFoodCategory ? [/质量|真材实料|配料|原料|食材|新鲜|纯正|无添加|0添加|健康|营养/] : [/质量|厚实|韧性|结实|做工|面料|材质|不掉屑|耐用|细腻/], action: isFoodCategory ? '用配料表、食材实拍和生产过程展示证明品质。' : '用细节放大、拉扯/湿水/材质对比证明品质。' },
    { key: '性价比/囤货', patterns: [/便宜|划算|优惠|性价比|实惠|多买|囤|加量|不加价|整箱|量贩/], action: '主图或副图直接写清数量、到手价、使用周期和囤货场景。' },
    { key: isPaperCategory ? '规格尺寸' : isFoodCategory ? '分量规格' : '尺寸/贴合', patterns: isFoodCategory ? [/分量|足量|大份|小份|克重|个数|只数|袋数/] : [/大小合适|合适|尺寸|贴合|包裹|立体|全脸|脸基尼|大号|中号/], action: isPaperCategory ? '增加单包尺寸、纸张大小和抽数参照，减少买家对规格的疑虑。' : isFoodCategory ? '明确单袋/单盒分量、个数和实物大小参照，减少买家对分量的疑虑。' : '增加真人/实物尺寸参照，减少买家对大小和贴合度的疑虑。' },
    { key: '外观颜色', patterns: [/颜色|好看|显白|黑色|灰|粉|颜值|款式|设计|联名/], action: '把颜色、款式和上身/上手效果做成选择引导图。' },
    { key: '物流包装', patterns: [/物流|包装|发货|完整|快|到货/], action: '这类卖点适合作为详情页信任背书，不建议占据首图核心位置。' },
  ]
  const basePain = [
    { key: isPaperCategory ? '规格偏小/分量不足' : isFoodCategory ? '分量不足/个数少' : '尺寸偏小/不贴合', patterns: isFoodCategory ? [/太少|分量少|不够吃|个数少|太小|偏小|不值/] : [/太小|偏小|尺码小|不合适|压耳|勒|滑落|掉落|戴不住|包不住|小包/], reverse: isPaperCategory ? '明确单包尺寸、抽数/张数、整箱数量和实物参照，避免买家误判规格。' : isFoodCategory ? '明确单袋分量、个数和实物大小参照，用称重/实拍图证明分量充足。' : '加大覆盖面积、立体剪裁、弹力贴合；图片里放真人佩戴和尺寸参照。' },
    { key: isFoodCategory ? '口感/食用体验差' : '佩戴/使用不舒适', patterns: isFoodCategory ? [/难吃|不好吃|口感差|硬|干|柴|腻|腥|异味|不新鲜|变质|坏了/] : [/闷|热|不透气|勒|痛|难受|不舒服|刺|压迫/], reverse: isFoodCategory ? '主打现做现发、锁鲜工艺，用食物特写和真实食用场景证明口感软糯/酥脆/新鲜。' : '主打轻薄透气、无痕不压脸/不压耳，用材质和长时间场景证明。' },
    { key: isFoodCategory ? '加热/复热效果差' : '功能效果不足', patterns: isFoodCategory ? [/加热|复热|蒸|煮|煎|微波炉|回软|塌陷|不蓬松|粘牙/] : [/不防晒|晒|效果不好|防紫外线差|吸水差|掉屑|太薄|不结实|漏/], reverse: isFoodCategory ? '提供详细加热指南（蒸/煮/煎/微波时间），用加热前后对比图证明复热效果。' : '把核心功能做成明确参数和对比证据，避免只写形容词。' },
    { key: '质量耐用问题', patterns: isFoodCategory ? [/破|坏|漏|变质|过期|发霉|有虫|异物/] : [/破|坏|脱线|掉色|变形|开裂|质量差|粗糙|异味/], reverse: isFoodCategory ? '用生产日期、保质期、质检报告和冷链运输证明食品安全。' : '用做工细节、材质认证、耐用测试和售后承诺反推信任。' },
    { key: '价格/分量不满', patterns: [/贵|不划算|分量少|太少|缩水|小包|不值/], reverse: '明确到手规格、单件/单包成本和同价位优势。' },
    { key: '颜色/实物差异', patterns: [/色差|颜色不对|不好看|图片不符|实物不符/], reverse: '增加自然光实拍、色卡对照和多角度展示。' },
    { key: '包装/物流问题', patterns: [/包装破|物流慢|漏发|少发|压坏|破损|融化|化了/], reverse: isFoodCategory ? '用冷链运输、保温包装和坏单包赔承诺降低风险。' : '用包装保护、发货检查和售后补发承诺降低风险。' },
  ]
  if (/口罩|面罩|防晒|脸基尼/.test(text)) {
    basePositive.unshift(
      { key: '防晒防护', patterns: [/防晒|防紫外线|遮阳|upf|全脸|防护/], action: '首屏突出 UPF/防晒等级、全脸覆盖范围和开车/户外场景。' },
      { key: '冰丝透气', patterns: [/冰丝|透气|轻薄|不闷|凉感|无痕/], action: '用材质微距和夏季佩戴场景证明不闷不压脸。' },
    )
  }
  return { positive: basePositive, pain: basePain }
}

function compactEvidenceText(value, limit = 92) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
  if (!text) return ''
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function addTopicMatch(topicMap, topic, { text = '', source = '', productId = '', productTitle = '', weight = 1 }) {
  const cleanText = String(text || '').trim()
  if (!cleanText) return false
  const matched = topic.patterns.some((pattern) => pattern.test(cleanText))
  if (!matched) return false
  if (topic.reverse) {
    const isSizePain = topic.key === '尺寸偏小/不贴合' || topic.key === '规格偏小/分量不足'
    if (topic.key === '价格/分量不满' && /(便宜|划算|优惠|超值|性价比|值了|合适)/.test(cleanText) && !/(贵|不划算|分量少|太少|缩水|小包|不值)/.test(cleanText)) return false
    if (isSizePain && /(不会太小|不太小|不是小包|非小包|大小合适|足够用|够用|合适不会太小|比.{0,8}小包.{0,8}强)/.test(cleanText)) return false
    if (isSizePain && !/(太小|偏小|尺码小|不合适|压耳|勒|滑落|掉落|戴不住|包不住|小包)/.test(cleanText)) return false
    if (topic.key === '功能效果不足' && /(不掉屑|不掉絮|不易破|不会破|没有[^，。；]*掉|可湿水|吸水性.{0,6}好)/.test(cleanText) && !/(吸水差|掉屑严重|太薄|不结实|效果不好|不防晒)/.test(cleanText)) return false
    if (topic.key === '质量耐用问题' && /(不比.{0,12}质量差|质量不差|不掉|不易破|不会破|没有[^，。；]*掉|不粗糙|质量好|质量很好|厚实|结实|耐用)/.test(cleanText) && !/(容易破|破损|质量差得|坏了|脱线|掉色|变形|开裂|异味)/.test(cleanText)) return false
  }
  const current = topicMap.get(topic.key) || {
    title: topic.key,
    count: 0,
    sources: new Set(),
    productIds: new Set(),
    evidence: [],
    action: topic.action,
    reverseSellingPoint: topic.reverse,
  }
  current.count += weight
  if (source) current.sources.add(source)
  if (productId) current.productIds.add(String(productId))
  if (cleanText && current.evidence.length < 3) {
    current.evidence.push({
      text: compactEvidenceText(cleanText),
      source,
      productTitle: compactEvidenceText(productTitle, 42),
    })
  }
  topicMap.set(topic.key, current)
  return true
}

function rowsFromTopicMap(topicMap, limit = 3) {
  return Array.from(topicMap.values())
    .map((item) => ({
      title: item.title,
      count: Math.round(item.count),
      productCoverage: item.productIds.size,
      sources: Array.from(item.sources).slice(0, 4),
      evidence: item.evidence,
      action: item.action || '',
      reverseSellingPoint: item.reverseSellingPoint || '',
    }))
    .sort((a, b) => b.count - a.count || b.productCoverage - a.productCoverage || a.title.localeCompare(b.title, 'zh-CN'))
    .slice(0, limit)
}

function topTermRowsFromStats(stats, limit = 8) {
  return Array.from(stats.values())
    .sort((a, b) => b.weightedScore - a.weightedScore || b.frequency - a.frequency)
    .slice(0, limit)
    .map((item) => item.keyword)
}

function buildTitleSuggestion({ keyword, products, skuTerms, positiveRows, keywordMatrix }) {
  const titleWords = uniqueText([
    keyword,
    ...topTermRowsFromStats(skuTerms, 6),
    ...safeArray(keywordMatrix?.blueOceanKeywords).map((item) => item.keyword).slice(0, 4),
    ...positiveRows.map((item) => item.title),
  ], 10).filter((item) => !['价格', '包装', '纸巾'].includes(item))
  const productTitle = products[0]?.title || ''
  const suffix = /口罩|面罩|防晒|脸基尼/.test(`${keyword} ${productTitle}`)
    ? ['防晒', '防紫外线', '冰丝轻薄', '全脸防护', '夏季开车户外']
    : titleWords.slice(1, 6)
  return uniqueText([keyword, ...suffix], 8).join(' / ')
}

function buildSearchTerms({ keyword, keywordMatrix, skuTerms, positiveRows, painRows }) {
  return uniqueText([
    keyword,
    ...safeArray(keywordMatrix?.coreKeywords).map((item) => item.keyword),
    ...safeArray(keywordMatrix?.blueOceanKeywords).map((item) => item.keyword),
    ...topTermRowsFromStats(skuTerms, 12),
    ...positiveRows.map((item) => item.title),
    ...painRows.map((item) => item.title),
  ], 18).join(' ')
}

function buildImageOrder({ keyword, positiveRows, painRows, keywordMatrix }) {
  const blue = safeArray(keywordMatrix?.blueOceanKeywords).map((item) => item.keyword)
  const p1 = positiveRows[0]?.title || blue[0] || '核心功能'
  const p2 = positiveRows[1]?.title || blue[1] || '品质细节'
  const p3 = painRows[0]?.title || blue[2] || '购买顾虑'
  const p4 = positiveRows[2]?.title || blue[3] || '规格/颜色'
  const p5 = painRows[1]?.title || '场景信任'
  if (/口罩|面罩|防晒|脸基尼/.test(String(keyword || ''))) {
    return [
      `防晒防护：突出 UPF/防紫外线和全脸覆盖范围`,
      `冰丝透气：证明夏季佩戴不闷、轻薄无痕`,
      `贴合尺寸：真人佩戴展示脸部/耳部/颈部覆盖`,
      `颜色款式：展示多色 SKU 和肤色/穿搭适配`,
      `场景闭环：开车、骑行、户外通勤等真实用途`,
    ]
  }
  return [
    `${p1}：放在第一张主卖点图，先回答为什么买`,
    `${p2}：用细节/对比证明品质，不只写形容词`,
    `${p3}：把主要差评顾虑转成反推卖点`,
    `${p4}：明确规格、款式、数量或组合选择`,
    `${p5}：用场景、评价证据和售后承诺收口`,
  ]
}

function listingPointEvidence(item = {}, fallback = '', { excludeSources = [] } = {}) {
  const excluded = new Set(excludeSources)
  const evidence = safeArray(item.evidence)
    .filter((entry) => !excluded.has(String(entry?.source || '').trim()))
    .map((entry) => compactEvidenceText(entry?.text || entry, 64))
    .filter(Boolean)
  return evidence[0] || fallback || ''
}

function displaySourcesForMainImage(sources = []) {
  const filtered = safeArray(sources)
    .map((source) => String(source || '').trim())
    .filter((source) => source && source !== 'SKU')
  return filtered.length ? uniqueText(filtered, 4) : ['数据库信号']
}

// ====== 语义归组规则：将同类卖点词归并为一个维度 ======
const SEMANTIC_GROUPS = [
  { group: '整箱量贩装', category: '性价比', patterns: /^\d+包$|^\d+提|^\d+卷$|^\d+抽$|^\d+张$|^\d+片$|量贩|囤货|整箱|实惠装|家用装|批发/, displayTitle: '整箱量贩超值装', priority: 2 },
  { group: '够用时长', category: '性价比', patterns: /够用\S*|\d+天|\d+月|半年|一整年|全年/, displayTitle: '够用一整年', priority: 1 },
  { group: '层数厚度', category: '品质原料', patterns: /^\d+层$|^\d+ply$|加厚|特厚|厚实/, displayTitle: '加厚多层面纸', priority: 1 },
  { group: '柔软亲肤', category: '品质原料', patterns: /柔软|亲肤|温和|柔韧|细韧|绵柔|丝滑|婴儿级/, displayTitle: '柔软亲肤触感', priority: 1 },
  { group: '吸水韧性', category: '功能健康', patterns: /吸水|湿水|韧性|不易破|不掉屑|不掉毛|强韧|耐拉扯/, displayTitle: '强韧吸水不易破', priority: 1 },
  { group: '原生木浆', category: '功能健康', patterns: /原生木浆|原生浆|天然|纯木|木浆|无荧光|无漂白|食品级/, displayTitle: '原生木浆安全无忧', priority: 1 },
  { group: '高蛋白营养', category: '功能健康', patterns: /高蛋白|高营养|蛋白质|低脂|0添加|无添加|非油炸/, displayTitle: '高蛋白轻负担', priority: 1 },
  { group: '品质真材实料', category: '品质原料', patterns: /品质|优质|真材实料|特级|精选|严选|大块|整片|原切/, displayTitle: '真材实料好品质', priority: 1 },
  { group: '产地正宗', category: '产地背书', patterns: /靖江|金华|潮汕|云南|新疆|进口|原产|老字号|非遗/, displayTitle: '正宗产地风味', priority: 1 },
  { group: '口感美味', category: '口感体验', patterns: /口感|酥脆|嚼劲|香脆|软糯|鲜嫩|入味|好吃|美味|回味|手撕|Q弹|鲜香/, displayTitle: '口感一吃就停不下来', priority: 1 },
  { group: '多口味选择', category: '口味选择', patterns: /口味|风味|蜜汁|香辣|原味|五香|麻辣|芝士|多味|多口味/, displayTitle: '多口味随心选', priority: 1 },
  { group: '场景便利', category: '场景便利', patterns: /解馋|休闲|办公室|追剧|即食|便携|独立包装|小袋|旅行|充饥|代餐|下午茶/, displayTitle: '随时随地解馋好搭档', priority: 1 },
  { group: '品牌信任', category: '信任保障', patterns: /联名|品牌|正品|保障|认证|质检|溯源|大厂|旗舰/, displayTitle: '品牌品质有保障', priority: 1 },
]

// 根据关键词/标题判断类目族：纸品 / 食品 / 通用
function categoryFamilyForKeyword(text) {
  const raw = String(text || '')
  if (/纸|抽纸|餐巾纸|卫生纸|面巾纸|厕纸/.test(raw)) return 'paper'
  if (/包子|馒头|饺子|烧麦|馅饼|手抓饼|发糕|花卷|汤圆|粽子|月饼|面包|蛋糕|饼干|零食|肉脯|肉干|坚果|水果|蔬菜|土豆|地瓜|玉米|大米|面粉|面条|方便面|速食|早餐|食品|小吃/.test(raw)) return 'food'
  return 'general'
}

// 语义组展示名随类目自适应，避免纸品/零食话术串到其他类目（如水杯出现“加厚多层面纸”）
function groupDisplayTitle(rule, family = 'general') {
  const titles = {
    '整箱量贩装': { paper: '整箱量贩超值装', food: '整箱量贩超值装', general: '量贩实惠装' },
    '够用时长': { paper: '够用一整年', general: '持久耐用省心' },
    '层数厚度': { paper: '加厚多层面纸', general: '加厚耐用材质' },
    '柔软亲肤': { paper: '柔软亲肤触感', general: '柔软舒适触感' },
    '吸水韧性': { paper: '强韧吸水不易破', general: '强韧耐用不易破' },
    '原生木浆': { paper: '原生木浆安全无忧', general: '安全材质放心用' },
    '高蛋白营养': { food: '高蛋白轻负担', general: '健康轻负担' },
    '品质真材实料': { general: '真材实料好品质' },
    '产地正宗': { food: '正宗产地风味', general: '正宗产地出品' },
    '口感美味': { food: '口感一吃就停不下来', general: '体验出色好用' },
    '多口味选择': { food: '多口味随心选', general: '多款规格可选' },
    '场景便利': { food: '随时随地解馋好搭档', paper: '居家日用好帮手', general: '便携随行好搭档' },
    '品牌信任': { general: '品牌品质有保障' },
  }
  const map = titles[rule.group] || {}
  return map[family] || map.general || rule.displayTitle
}

// 判断卖点词是否为纯数量词（如 "40包"、"20包"、"M码18包整箱"）
function isPureQuantityTerm(term) {
  const text = String(term || '').trim()
  if (/^\d+[包提卷抽张片瓶袋盒箱罐个件套组]?$/.test(text)) return true
  if (/^(M|L|S|XL|XS)?码?\d+[包提卷抽张片瓶袋盒箱罐个件套组]+/.test(text)) return true
  return false
}

// 判断卖点词是否为季节性/营销噱头
function isGimmickTerm(term) {
  const text = String(term || '').trim()
  if (/新年|圣诞|双11|双十一|618|年货|节日|马上|恭喜|发财|福到|龙年|蛇年|虎年/.test(text)) return true
  if (/联名款|限定|限量版|IP款/.test(text) && text.length > 8) return true
  return false
}

// 语义归组：返回该词属于哪个组，null 表示不归组
function findSemanticGroup(term) {
  const text = String(term || '').trim()
  for (const rule of SEMANTIC_GROUPS) {
    if (rule.patterns.test(text)) return rule
  }
  return null
}

// 判断卖点词是否为系统垃圾词（过长/含视觉描述/含关键词本身）
function isGarbageSellingPoint(term, cleanKeyword) {
  const text = String(term || '').trim()
  if (!text || text.length > 20) return true
  if (text === cleanKeyword || text.replace(/[铺脯纸]/g, '') === cleanKeyword.replace(/[铺脯纸]/g, '')) return true
  if (/^(?:来自|商品|标题|快照|兜底|本地|提取|洞察|分析|数据|报告|信号|覆盖)/.test(text)) return true
  if (/(?:背景|画面|视觉|展示|摆放|构图|色彩|配色|拍摄|角度|布局|风格|主体)/.test(text)) return true
  if (/(?:突出|强调|呈现|标注|营造|搭配|组合|排列|堆叠|放置|位于)/.test(text) && text.length > 8) return true
  if (/^[a-z0-9_-]+$/i.test(text)) return true
  if (/\d{4,}/.test(text)) return true // 含4位以上数字（如 "200提共200000张"）
  // 过滤泛场景词（如"家庭分享"、"家庭装"、"分享装"等不是具体卖点）
  if (/^(?:家庭|家人|全家|亲子|朋友|同事|同学)(?:分享|共享|一起|共同)/.test(text)) return true
  if (/^(?:分享|共享|一起|共同)(?:装|包|盒|袋)/.test(text)) return true
  return false
}

// 卖点分类器（兼容旧逻辑，新逻辑用 SEMANTIC_GROUPS）
const SELLING_POINT_CATEGORIES = [
  { key: '功能健康', patterns: /高蛋白|低脂|0添加|无添加|非油炸|低糖|低卡|营养|健康|维生素|纤维|钙|铁|锌|益生菌|膳食纤维/ },
  { key: '品质原料', patterns: /品质|优质|真材实料|特级|精选|原料|新鲜|纯正|地道|手工|匠心|严选|大块|整片/ },
  { key: '产地背书', patterns: /靖江|金华|潮汕|云南|新疆|西藏|日本|韩国|进口|国产|原产|老字号|非遗|地理标/ },
  { key: '口感体验', patterns: /口感|酥脆|嚼劲|香脆|软糯|鲜嫩|入味|好吃|美味|回味|醇香|浓郁|爽滑|Q弹|手撕|拉丝|弹牙|嫩滑|焦香|烟熏|蜜汁|鲜香/ },
  { key: '口味选择', patterns: /口味|风味|蜜汁|香辣|原味|五香|麻辣|芝士|海苔|烧烤|咖喱|多味|组合/ },
  { key: '场景便利', patterns: /解馋|休闲|办公室|追剧|即食|便携|独立包装|小袋|旅行|充饥|代餐|下午茶|夜宵/ },
  { key: '信任保障', patterns: /联名|品牌|正品|保障|认证|检验|报告|质检|溯源|可查|大厂|工厂|旗舰/ },
  { key: '性价比', patterns: /实惠|划算|性价比|大份|量贩|囤|加量|促销|满减|多规格|整箱|批发/ },
]

function classifySellingPoint(term) {
  for (const cat of SELLING_POINT_CATEGORIES) {
    if (cat.patterns.test(term)) return cat.key
  }
  return '其他'
}

function mainImageBenefitByCategory(category, term) {
  const map = {
    '功能健康': `让用户在主图第一秒就感知到"${term}"的健康价值，建立理性购买理由。`,
    '品质原料': `通过实物细节证明"${term}"的品质感，让用户相信这不是普通货。`,
    '产地背书': `用产地标签建立信任差异化，让用户觉得"${term}"更正宗可靠。`,
    '口感体验': `用产品特写和质感表达让用户"看到就想吃/想用"，激活感官期待。`,
    '口味选择': `展示多口味/多规格选择，降低用户"万一不好吃/不好用"的试错顾虑。`,
    '场景便利': `代入真实使用场景（办公室/追剧/出行），让用户觉得"这就是为我准备的"。`,
    '信任保障': `用品牌/认证/检测报告建立信任，降低用户"是不是杂牌"的犹豫。`,
    '性价比': `用规格对比或到手价让用户觉得"这个价格买这个值了"。`,
  }
  return map[category] || `把"${term}"做成主图可感知的核心购买理由。`
}

function mainImageVisualByCategory(category, term, index) {
  const map = {
    '功能健康': `主图角标突出"${term}"参数（如蛋白质含量对比图），产品主体清晰，背景干净。`,
    '品质原料': `产品微距特写展示质感/纹理/色泽，搭配"${term}"短文案角标，光线温暖有食欲。`,
    '产地背书': `地图标注产地 + 产品实物组合，或产地实拍背景虚化，"${term}"作为信任标签。`,
    '口感体验': `产品掰开/切面/拉丝等动态瞬间，展示"${term}"的质感，色彩饱和度高，激发食欲。`,
    '口味选择': `多口味产品并排平铺或扇形展开，每种口味标注名称，色彩丰富有辨识度。`,
    '场景便利': `产品放入真实生活场景（办公桌/沙发/背包旁），"${term}"作为场景标签，营造使用代入感。`,
    '信任保障': `品牌Logo/联名标识/质检报告截图作为角标，产品主体居中，增强权威感。`,
    '性价比': `规格对比图或"到手XX元/件"角标，产品堆叠展示分量感，突出量大实惠。`,
  }
  const defaultExpr = index === 0
    ? `主图核心位置突出"${term}"，产品主体占画面 60% 以上，文案精简不超过 8 字。`
    : `副图或角标呈现"${term}"，搭配实物细节或场景证明。`
  return map[category] || defaultExpr
}

// 实时读取每个竞品最新一份单品主图分析报告的卖点（主图识别 + 标题提炼 + 保留建议），
// 保证主图卖点总结只基于主图分析，且覆盖所有已入库主图分析的竞品
async function loadMainImageSellingPointsByProduct(connection, productIds = []) {
  const ids = [...new Set((productIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return new Map()
  const [rows] = await connection.query(`
    SELECT a.*
    FROM product_main_image_analysis a
    JOIN (
      SELECT product_id, MAX(id) AS id
      FROM product_main_image_analysis
      WHERE product_id IN (?)
      GROUP BY product_id
    ) latest ON latest.id = a.id
  `, [ids])
  const map = new Map()
  for (const row of rows) {
    const report = parseJson(row.report_json, {}) || {}
    const terms = [
      ...safeArray(report.image_selling_points),
      ...safeArray(report.title_selling_points),
      ...safeArray(report.listing_suggestions?.keep_points),
    ]
      .map((item) => String(item?.term || item?.keyword || item || '').trim())
      .filter(Boolean)
    if (terms.length) map.set(String(row.product_id), terms)
  }
  return map
}

// 把 AI 全主图分析结果归一化为前端 SELL 区块可直接渲染的结构
function normalizeMainImageAiReport(aiJson = {}, analyzedCount = 0) {
  const points = safeArray(aiJson.selling_points).slice(0, 6).map((item, index) => ({
    priority: index + 1,
    title: String(item?.title || item?.term || '').trim() || `卖点${index + 1}`,
    customerBenefit: String(item?.customer_benefit || item?.benefit || '').trim(),
    visualExpression: String(item?.visual_expression || '').trim(),
    dataBasis: String(item?.data_basis || '').trim() || '来自 AI 对全部竞品主图的视觉分析。',
    source: ['主图AI分析'],
  })).filter((item) => item.title)
  const copySuggestions = safeArray(aiJson.copy_suggestions).slice(0, 4).map((item) => ({
    mainText: String(item?.main_text || '').trim(),
    subText: String(item?.sub_text || '').trim(),
    position: String(item?.position || '').trim(),
  })).filter((item) => item.mainText)
  const layoutAdvice = String(aiJson.layout_advice || '').trim()
  const imageTextCopy = (layoutAdvice || copySuggestions.length)
    ? `【布局建议】${layoutAdvice || '中心构图，产品主体占画面 60% 以上，文案精简集中在画面上方或左上角。'}\n【推荐主图文案】\n${copySuggestions.map((s, i) => `${i + 1}. 大字：「${s.mainText}」| 副文案：${s.subText || '（无）'} | 位置：${s.position || '角标'}`).join('\n')}`
    : ''
  return {
    summary: String(aiJson.summary || '').trim(),
    mainImageSellingPoints: points,
    imageTextCopy,
    analyzedCount,
  }
}

// AI 视觉分析全部竞品主图，输出一份可直接用于生图的报告（带 DB 缓存）
export async function getMainImageAiReport({ id = '' } = {}) {
  const runId = toInt(id, 0)
  if (!runId) throw new Error('缺少报告ID')
  const pending = mainImageAiReportInflight.get(runId)
  if (pending) return pending
  const promise = runMainImageAiReport(runId).finally(() => mainImageAiReportInflight.delete(runId))
  mainImageAiReportInflight.set(runId, promise)
  return promise
}

const mainImageAiReportInflight = new Map()

async function runMainImageAiReport(runId) {
  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    const [runRows] = await connection.query('SELECT * FROM market_analysis_run WHERE id = ? LIMIT 1', [runId])
    if (!runRows.length) throw new Error('没有找到对应的整体报告')
    const reportView = transformReportForAnalysisView(runRows[0])
    const keyword = reportView?.keyword || runRows[0].keyword || ''
    const productIds = safeArray(reportView?.priceBandProducts)
      .flatMap((band) => safeArray(band.products).map((p) => String(p.id || '').trim()))
      .filter(Boolean)
    if (!productIds.length) throw new Error('该报告没有竞品商品')
    const [rows] = await connection.query(`
      SELECT a.*
      FROM product_main_image_analysis a
      JOIN (
        SELECT product_id, MAX(id) AS id
        FROM product_main_image_analysis
        WHERE product_id IN (?)
        GROUP BY product_id
      ) latest ON latest.id = a.id
    `, [productIds])
    // 每个竞品在 RPA 目录里通常有多张主图（product_page_images/main/001~00N.jpg），
    // 数据库只存了第一张，这里从本地目录展开全部主图一起送给 AI
    const MAX_TOTAL_IMAGES = 20
    const perProductCap = Math.min(5, Math.max(1, Math.floor(MAX_TOTAL_IMAGES / Math.max(1, rows.length))))
    const analyzed = []
    let totalImages = 0
    for (const row of rows) {
      const report = parseJson(row.report_json, {}) || {}
      const known = [
        ...safeArray(report.image_selling_points),
        ...safeArray(report.title_selling_points),
      ].map((item) => String(item?.term || '').trim()).filter(Boolean)
      let urls = []
      const mainDir = row.main_image_path
        ? path.join(path.dirname(path.dirname(String(row.main_image_path))), 'main')
        : ''
      if (mainDir && fs.existsSync(mainDir)) {
        urls = fs.readdirSync(mainDir)
          .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
          .sort()
          .slice(0, perProductCap)
          .map((f) => maybeLocalImageAsDataUrl(path.join(mainDir, f)))
          .filter(Boolean)
      }
      if (!urls.length) {
        const single = normalizeUrl(row.main_image_url)
          || maybeLocalImageAsDataUrl(row.main_image_url)
          || maybeLocalImageAsDataUrl(row.main_image_path)
          || ''
        if (single) urls = [single]
      }
      if (!urls.length) continue
      totalImages += urls.length
      analyzed.push({ ...row, known, urls })
    }
    if (!analyzed.length) throw new Error('竞品还没有可读取的主图，请先完成单品主图分析入库')

    const cacheKey = crypto.createHash('sha256').update(`${runId}:${analyzed.map((row) => row.id).join(',')}:${totalImages}`).digest('hex')
    const [cached] = await connection.query('SELECT result_json FROM market_main_image_ai_report WHERE cache_key = ? LIMIT 1', [cacheKey])
    if (cached.length) {
      const parsed = parseJson(cached[0].result_json, null)
      if (parsed?.summary) return { ok: true, source: 'ai', cached: true, ...parsed }
    }

    const content = [{
      type: 'input_text',
      text: [
        `你是资深电商视觉分析师。下面给你「${keyword || '当前'}」品类 ${analyzed.length} 个竞品共 ${totalImages} 张商品主图（每个竞品的图组前标注了编号、标题和已识别卖点，图按主图顺序排列）。`,
        '请综合看全部主图，输出一份可直接用于该品类主图生图的中文 JSON 报告：',
        '1）提炼该品类主图应突出的核心卖点（必须来自主图真实表达，不要臆造）；',
        '2）每个卖点给出用户利益、画面表达方式、以及来自哪几个竞品主图（编号）；',
        '3）给出主图布局建议和可上图文案（大字+副文案+位置）；',
        '4）summary 写一段连贯的分析结论，点明核心卖点和主图生成建议。',
        '',
        '【卖点定义 — 严格遵守】',
        '卖点 = 能让用户产生购买欲望的「用户利益」或「差异化价值」，而不是产品属性描述。',
        '❌ 禁止：纯数量规格（"40包""5斤装"）、包装描述（"实惠装""整箱装"）、SKU变体名、品类通用词、价格促销词、泛场景词（"家庭分享"）。',
        '',
        '只输出 JSON，不要 Markdown。返回结构：',
        JSON.stringify({
          summary: '主图卖点分析总结（连贯一段话，含核心卖点与主图生成建议）',
          selling_points: [{ title: '卖点', customer_benefit: '用户利益', visual_expression: '画面如何表达', data_basis: '来自哪几个竞品（编号）主图的什么表达' }],
          layout_advice: '主图布局建议',
          copy_suggestions: [{ main_text: '上图大字', sub_text: '副文案', position: '画面位置' }],
        }, null, 2),
      ].join('\n'),
    }]
    analyzed.forEach((row, index) => {
      content.push({
        type: 'input_text',
        text: `竞品${index + 1}：product_id=${row.product_id}，标题=${row.product_title}，共 ${row.urls.length} 张主图（按顺序），已识别卖点：${row.known.join('、') || '无'}`,
      })
      for (const url of row.urls) {
        content.push({ type: 'input_image', image_url: url })
      }
    })
    content.push({ type: 'input_text', text: `以上是全部 ${analyzed.length} 个竞品共 ${totalImages} 张主图，请综合分析后只输出 JSON。` })

    const aiResult = await callArkResponsesRaw(content, { maxOutputTokens: 16000, timeoutMs: 480000 })
    let aiJson = null
    try {
      aiJson = parseJsonFromText(aiResult.text)
    } catch (error) {
      const status = aiResult.data?.status ? `，status=${aiResult.data.status}` : ''
      const reason = aiResult.data?.incomplete_details?.reason ? `，reason=${aiResult.data.incomplete_details.reason}` : ''
      const errorInfo = safeArray(aiResult.data?.error).length ? `，error=${JSON.stringify(aiResult.data.error)}` : (aiResult.data?.error ? `，error=${JSON.stringify(aiResult.data.error)}` : '')
      const snippet = String(aiResult.text || '').slice(0, 200)
      throw new Error(`AI 全主图分析返回内容不可用${status}${reason}${errorInfo}：${error instanceof Error ? error.message : String(error)}${snippet ? `，原文开头：${snippet}` : '，模型返回了空内容'}`)
    }
    const normalized = normalizeMainImageAiReport(aiJson || {}, totalImages)
    if (!normalized.summary) throw new Error('AI 没有返回可用的主图分析报告')
    await connection.query(`
      INSERT INTO market_main_image_ai_report (run_id, cache_key, result_json)
      VALUES (?,?,?)
      ON DUPLICATE KEY UPDATE result_json = VALUES(result_json)
    `, [runId, cacheKey, JSON.stringify(normalized)])
    return { ok: true, source: 'ai', cached: false, ...normalized }
  })
}

function buildListingSellingPointsForReport({ keyword = '', report = null, keywordMatrix = null, recommendationActions = null, mainImagePointsByProduct = null } = {}) {
  const cleanKeyword = String(keyword || report?.keyword || '').trim()
  const positiveRows = safeArray(recommendationActions?.positiveSellingPoints)
  const painRows = safeArray(recommendationActions?.negativePainPoints)
  const allProducts = safeArray(report?.priceBandProducts).flatMap((band) => safeArray(band.products))
  const productTitle = allProducts
    .sort((a, b) => toNumber(b.totalSales, 0) - toNumber(a.totalSales, 0) || toInt(b.totalSold, 0) - toInt(a.totalSold, 0))[0]?.title || ''
  const isSunMask = /口罩|面罩|防晒|脸基尼/.test(`${cleanKeyword} ${productTitle}`)
  // 优先实时读取 product_main_image_analysis 表（每个竞品最新一份主图分析报告）
  const useDbPoints = Boolean(mainImagePointsByProduct && mainImagePointsByProduct.size > 0)
  const family = categoryFamilyForKeyword(`${cleanKeyword} ${productTitle}`)

  // ====== 主图卖点唯一数据源：竞品主图识别分析（用于生图） ======
  const groupStats = new Map() // 语义组 → 聚合统计
  const individualStats = new Map() // 未归组的独立卖点
  let analyzedProductCount = 0
  for (const product of allProducts) {
    const sold = toInt(product.totalSold, 0)
    const dbTerms = useDbPoints ? (mainImagePointsByProduct.get(String(product.id || '')) || null) : null
    if (useDbPoints && !dbTerms) continue // 该竞品没有主图分析报告，不参与主图卖点聚合
    analyzedProductCount += 1
    const terms = useDbPoints ? dbTerms : safeArray(product.sellingPoints)
    for (const term of terms) {
      const text = String(term || '').trim()
      if (!text || isGarbageSellingPoint(text, cleanKeyword) || isGimmickTerm(text)) continue
      // 排除 SKU 属性词：纯数量词、规格参数、价格相关、包装描述、SKU变体名等
      if (isPureQuantityTerm(text)) continue
      if (/^\d+[包提卷抽张片瓶袋盒箱罐个件套组]$|^\d+层$|^\d+抽$|^\d+ml$|^\d+g$/i.test(text)) continue
      if (/(?:实惠装|量贩|囤货装|家用装|批发|整箱|\d+包|大包装)/.test(text) && !/评论|好评|用户/.test(text)) continue
      // 排除 SKU变体名（商品名+重量/规格组合，如"老面馒头5斤装""猪肉味200g"）
      if (/\d+[斤公斤gml升L袋包盒瓶罐]+[装]?\s*$/.test(text)) continue
      if (/^.{2,6}\d+[斤公斤g]+/.test(text) && !/[0添加|进口|有机|非转|手工|古法|纯手]/.test(text)) continue
      // 排除纯价格促销词
      if (/^(?:限时|特价|买一送一|领券|立减|秒杀|清仓|促销|折扣)/.test(text)) continue
      // 排除纯口味/规格罗列（如"原味+黑胡椒""红豆+绿豆+花生"）
      if (/^[\u4e00-\u9fff]{1,4}[+\+、，,][\u4e00-\u9fff]{1,4}([+\+、，,][\u4e00-\u9fff]{1,4})*$/.test(text) && text.length < 20) continue
      const group = findSemanticGroup(text)
      if (group) {
        // 跳过纯 SKU 属性的语义组（如“整箱量贩装”组主要由数量词构成）
        if (group.category === '性价比' && /^\d+/.test(text)) continue
        if (!groupStats.has(group.group)) groupStats.set(group.group, { group, count: 0, totalSold: 0, products: new Set(), terms: new Set() })
        const cur = groupStats.get(group.group)
        cur.count += 1
        cur.totalSold += sold
        if (product.id) cur.products.add(String(product.id))
        cur.terms.add(text)
      } else {
        if (!individualStats.has(text)) individualStats.set(text, { term: text, count: 0, totalSold: 0, products: new Set() })
        const cur = individualStats.get(text)
        cur.count += 1
        cur.totalSold += sold
        if (product.id) cur.products.add(String(product.id))
      }
    }
  }

  // ====== 综合评分：基于主图识别分析选出 4-5 个最佳主图卖点 ======
  const candidates = []
  // 语义组（归并后的主图卖点）
  for (const [name, stat] of groupStats) {
    candidates.push({
      term: groupDisplayTitle(stat.group, family),
      groupKey: name,
      groupCategory: stat.group.category,
      source: 'group',
      count: stat.count,
      totalSold: stat.totalSold,
      productCount: stat.products.size,
      termCount: stat.terms.size,
      finalScore: stat.count * 80 + stat.totalSold / 50 + stat.products.size * 100,
      sourceLabel: '主图分析',
    })
  }
  // 独立卖点（未归组）
  for (const [text, stat] of individualStats) {
    candidates.push({
      term: text,
      source: 'individual',
      count: stat.count,
      totalSold: stat.totalSold,
      productCount: stat.products.size,
      finalScore: stat.count * 100 + stat.totalSold / 80 + stat.products.size * 60,
      sourceLabel: '主图分析',
    })
  }

  // 排序并分类去重
  candidates.sort((a, b) => b.finalScore - a.finalScore)
  const categoryUsed = new Map()
  const selectedPoints = []
  for (const point of candidates) {
    // 确定分类：优先用语义组的标准 category，其次用分类器
    let cat = '其他'
    if (point.groupCategory) {
      cat = point.groupCategory
    } else if (point.groupKey) {
      cat = point.groupKey
    } else {
      cat = classifySellingPoint(point.term)
    }
    const used = categoryUsed.get(cat) || 0
    if (used >= 1) continue // 每个维度最多 1 个，确保差异化
    categoryUsed.set(cat, used + 1)
    selectedPoints.push(point)
    if (selectedPoints.length >= 5) break
  }

  // ====== 生成综合总结话术（仅基于主图识别分析） ======
  const summaryParts = []

  // 第一段：总体判断
  const topTitles = selectedPoints.slice(0, 3).map((p) => `「${p.term}」`)
  summaryParts.push(`基于 ${useDbPoints ? analyzedProductCount : allProducts.length} 款竞品的主图识别分析，「${cleanKeyword}」品类主图应重点突出 ${topTitles.join('、') || '核心卖点'} 等核心卖点。`)

  // 第二段：各卖点的主图分析依据
  const pointDetails = selectedPoints.slice(0, 4).map((point) => {
    if (point.source === 'group') {
      return `「${point.term}」由 ${point.termCount} 个主图相关表述归并而来，覆盖 ${point.productCount} 个竞品，累计销量权重 ${Number(point.totalSold || 0).toLocaleString('zh-CN')}`
    }
    return `「${point.term}」在 ${point.count} 个竞品主图中出现，累计销量 ${Number(point.totalSold || 0).toLocaleString('zh-CN')}`
  })
  if (pointDetails.length) {
    summaryParts.push(pointDetails.join('；') + '。')
  }

  // 第三段：主图生成建议
  const visualHints = selectedPoints.slice(0, 3).map((p) => {
    const cat = p.groupCategory || p.groupKey || classifySellingPoint(p.term)
    const hintMap = {
      '性价比': '用产品堆叠或规格对比突出量贩感',
      '品质原料': '用产品微距特写展示质感',
      '产地背书': '用产地标识建立信任',
      '功能健康': '用参数角标传递功能价值',
      '口感体验': '用产品动态瞬间激发感官',
      '口味选择': '用多口味平铺展示选择丰富',
      '场景便利': '用真实场景代入使用感',
      '信任保障': '用品牌或认证标识增强权威',
    }
    return hintMap[cat] || `突出「${p.term}」`
  })
  summaryParts.push(`主图生成建议：${visualHints.join('，')}，文案精简不超过 8 字，产品主体占画面 60% 以上。`)

  const summary = summaryParts.join('')
  const mainImageSellingPoints = selectedPoints.map((point, index) => {
    const cat = point.groupCategory || point.groupKey || classifySellingPoint(point.term)
    // 构建数据依据文本（仅来自主图识别分析）
    let dataBasis = ''
    if (point.source === 'group') {
      dataBasis = `${point.productCount} 个竞品主图共 ${point.termCount} 个相关表述归并，累计销量权重 ${Number(point.totalSold || 0).toLocaleString('zh-CN')}。`
    } else {
      dataBasis = `${point.count} 个竞品主图出现，累计销量权重 ${Number(point.totalSold || 0).toLocaleString('zh-CN')}。`
    }
    return {
      title: point.term,
      priority: index + 1,
      customerBenefit: mainImageBenefitByCategory(cat, point.term),
      visualExpression: mainImageVisualByCategory(cat, point.term, index),
      dataBasis: dataBasis || '来自竞品主图识别分析。',
      source: displaySourcesForMainImage(['主图分析']),
      category: cat,
    }
  })

  // 防晒类特殊兜底
  const sunMaskFallback = isSunMask ? [
    {
      title: '全脸防晒防护',
      customerBenefit: '让用户一眼知道它解决夏季开车、骑行、户外通勤的脸部防晒问题。',
      visualExpression: '真人佩戴正侧面 + 遮挡范围标注 + UPF/防紫外线参数角标。',
      dataBasis: '商品标题、SKU 和关键词矩阵均出现防晒、防紫外线、全脸、防护信号。',
    },
    {
      title: '冰丝轻薄不闷',
      customerBenefit: '降低夏季佩戴闷热、压脸、勒耳的购买顾虑。',
      visualExpression: '材质微距、透气孔/轻薄布料展示，搭配夏季户外或车内场景。',
      dataBasis: 'SKU/洞察中出现冰丝、轻薄、无痕、透气等卖点。',
    },
    {
      title: '立体贴合不易滑',
      customerBenefit: '让买家相信脸型适配和长时间佩戴稳定性。',
      visualExpression: '真人佩戴细节、耳部/鼻梁/下颌贴合点放大，配尺寸参照。',
      dataBasis: '从面罩类常见疑虑反推，结合无痕立体轻薄款 SKU 信号。',
    },
    {
      title: '多色好搭配',
      customerBenefit: '减少颜色选择犹豫，提高多 SKU 点击和加购。',
      visualExpression: '多色平铺 + 上脸效果 + 肤色/穿搭建议标签。',
      dataBasis: 'SKU 中存在深灰、黑色、浅灰、粉色等多色款。',
    },
  ] : []

  const finalMainPoints = isSunMask
    ? sunMaskFallback
    : mainImageSellingPoints.length ? mainImageSellingPoints : sunMaskFallback
  const normalizedMainPoints = finalMainPoints.slice(0, 5).map((item, index) => ({
    priority: item.priority || index + 1,
    title: item.title,
    customerBenefit: item.customerBenefit,
    visualExpression: item.visualExpression,
    dataBasis: item.dataBasis || '来自竞品主图识别分析。',
    source: displaySourcesForMainImage(item.source || ['主图分析']),
  }))

  const detailFromPositive = positiveRows.slice(0, 4).map((item, index) => ({
    priority: index + 1,
    title: `${item.title}证据页`,
    contentFocus: item.action || `解释“${item.title}”为什么值得买。`,
    proofPoints: uniqueText([
      listingPointEvidence(item),
      item.count ? `提及频次 ${item.count}` : '',
      item.productCoverage ? `覆盖 ${item.productCoverage} 个竞品` : '',
    ], 3),
    recommendedModule: index === 0 ? '核心卖点解释' : index === 1 ? '材质/功能证明' : '场景与口碑证明',
  }))
  const detailFromPain = painRows.slice(0, 3).map((item, index) => ({
    priority: detailFromPositive.length + index + 1,
    title: `${item.title}反推页`,
    contentFocus: item.reverseSellingPoint || `把“${item.title}”这个顾虑转成可验证承诺。`,
    proofPoints: uniqueText([
      listingPointEvidence(item),
      item.count ? `痛点提及 ${item.count} 条` : '暂无真实差评样本，作为风险验证项',
    ], 3),
    recommendedModule: '痛点解决/FAQ',
  }))

  const detailFallback = isSunMask
    ? [
      {
        title: '防晒参数与覆盖范围',
        contentFocus: '解释 UPF/防紫外线、脸部/颈部覆盖范围和适用场景。',
        proofPoints: ['标题与 SKU 明确出现防晒、防紫外线、全脸防护'],
        recommendedModule: '功能证明',
      },
      {
        title: '材质透气与佩戴舒适',
        contentFocus: '解释冰丝、轻薄、无痕贴合，回答夏天会不会闷。',
        proofPoints: ['SKU 出现轻薄、无痕、透气等信号'],
        recommendedModule: '材质细节',
      },
      {
        title: '颜色 SKU 与场景选择',
        contentFocus: '展示多色 SKU、真人佩戴和开车/骑行/户外通勤场景。',
        proofPoints: ['SKU 多色覆盖，适合做选择引导'],
        recommendedModule: 'SKU 选择',
      },
    ]
    : []

  const detailPageSellingPoints = isSunMask
    ? [
      ...detailFallback.map((item, index) => ({ ...item, priority: index + 1 })),
      ...detailFromPain.map((item, index) => ({ ...item, priority: detailFallback.length + index + 1 })),
    ].slice(0, 8)
    : [...detailFromPositive, ...detailFromPain].length
      ? [...detailFromPositive, ...detailFromPain].slice(0, 8)
      : detailFallback.map((item, index) => ({ ...item, priority: index + 1 }))

  // ====== 生成主图文案建议（可直接放在图上的文字）======
  const visualObservations = allProducts
    .map((p) => String(p.visualObservation || '').trim())
    .filter((v) => v && !v.startsWith('本地兜底'))
  const hasRealVisual = visualObservations.length > 0

  // 提取竞品主图上的文案布局模式
  const layoutPatterns = []
  if (hasRealVisual) {
    for (const obs of visualObservations) {
      if (/左上角|左上/.test(obs)) layoutPatterns.push('左上角卖点标注')
      if (/右上角|右上/.test(obs)) layoutPatterns.push('右上角产品名')
      if (/左侧.*标签|卖点标签/.test(obs)) layoutPatterns.push('左侧卖点标签')
      if (/中心构图|中心摆放|中心放置/.test(obs)) layoutPatterns.push('中心构图突出主体')
      if (/文字.*上方|宣传文字/.test(obs)) layoutPatterns.push('文字位于画面上方')
    }
  }
  const uniqueLayouts = [...new Set(layoutPatterns)].slice(0, 3)

  // 根据卖点分类生成具体文案
  const textSuggestions = selectedPoints.slice(0, 4).map((point, index) => {
    const cat = point.groupCategory || classifySellingPoint(point.term)
    const term = point.term
    // 根据分类生成主图文案（大字 + 副文案 + 位置建议）
    const copyMap = {
      '性价比': {
        mainText: /量贩|超值|整箱/.test(term) ? '整箱超值装' : `${term}`,
        subText: point.source === 'group' ? `${point.termCount}种规格可选` : '',
        position: index === 0 ? '主图中心大字' : '右侧角标',
      },
      '品质原料': {
        mainText: /柔软|亲肤|细韧|绵柔/.test(term) ? '柔软亲肤' : /品质|真材实料/.test(term) ? '真材实料' : term.replace(/[的]/g, '').substring(0, 6),
        subText: /材料|品质/.test(term) ? '看得见的品质' : '',
        position: index === 0 ? '主图中心大字' : '左侧标签',
      },
      '产地背书': {
        mainText: /靖江|金华|潮汕|云南/.test(term) ? term.substring(0, 4) + '特产' : '正宗产地',
        subText: '地道风味 传承工艺',
        position: '左上角产地标识',
      },
      '功能健康': {
        mainText: /高蛋白/.test(term) ? '高蛋白' : /吸水|韧性|不易破/.test(term) ? '强韧吸水' : /木浆|原生/.test(term) ? '原生木浆' : term.substring(0, 6),
        subText: /高蛋白/.test(term) ? '健康轻负担' : /吸水/.test(term) ? '湿水不易破' : '安全放心用',
        position: '左上方参数角标',
      },
      '口感体验': {
        mainText: /酥脆|脆/.test(term) ? '一口咔嚓脆' : /嚼劲|Q弹/.test(term) ? '越嚼越香' : /手撕|拉丝/.test(term) ? '手撕才过瘾' : '一口就爱上',
        subText: '好吃到停不下来',
        position: '画面上方大字',
      },
      '口味选择': {
        mainText: /多味|多口味/.test(term) ? '多味可选' : term.substring(0, 6),
        subText: '总有一款适合你',
        position: '下方口味展示条',
      },
      '场景便利': {
        mainText: /解馋/.test(term) ? '解馋神器' : /办公/.test(term) ? '办公室必备' : /追剧/.test(term) ? '追剧好搭档' : '随时来一口',
        subText: '独立小包装 随身带',
        position: '场景标签 + 角标',
      },
      '信任保障': {
        mainText: /品牌|联名/.test(term) ? '品牌品质' : term.substring(0, 6),
        subText: '质量有保障',
        position: '左上角品牌标识',
      },
    }
    const fallback = { mainText: term.substring(0, 8), subText: '', position: index === 0 ? '主图中心大字' : '角标' }
    return { ...fallback, ...(copyMap[cat] || {}) }
  })

  // 布局建议文本
  const layoutSummary = hasRealVisual
    ? `竞品主图普遍采用${uniqueLayouts.join('、') || '中心构图'}，产品主体占画面 60% 以上，文案精简且集中在画面上半部分。`
    : `根据品类特征，建议采用中心构图，产品主体占画面 60% 以上，文案精简集中在画面上方或左上角。`

  const imageTextCopy = `【布局建议】${layoutSummary}\n【推荐主图文案】\n${textSuggestions.map((s, i) => `${i + 1}. 大字：「${s.mainText}」| 副文案：${s.subText || '（无）'} | 位置：${s.position}`).join('\n')}`

  return {
    source: 'database',
    generatedAt: new Date().toISOString(),
    mainImageSellingPoints: normalizedMainPoints,
    detailPageSellingPoints,
    imageTextCopy,
    summary: summary || `主图优先承接 ${normalizedMainPoints.slice(0, 3).map((item) => item.title).join('、') || '核心卖点'}；详情页负责补齐证据、场景、规格和痛点反推。`,
  }
}

function buildMainImagePromptSeed({ listingSellingPoints = null } = {}) {
  // “商品卖点&要求”文本框只注入主图卖点分析总结，用于生图
  return String(listingSellingPoints?.summary || '').trim()
}

async function buildRecommendationActionsForReport(connection, { runIds = [], keyword = '', report = null, keywordMatrix = null } = {}) {
  const cleanKeyword = String(keyword || report?.keyword || '').trim()
  const products = new Map()
  const addProduct = (item = {}) => {
    const productId = String(item.product_id || item.productId || item.id || '').trim()
    if (!productId) return
    const current = products.get(productId) || { productId, title: '', sold: 0, sales: 0, price: null }
    current.title = firstNonEmpty(item.product_title, item.title, current.title)
    current.sold = Math.max(current.sold || 0, toInt(item.sold_count ?? item.soldCount ?? item.totalSold, 0))
    current.sales = Math.max(current.sales || 0, toNumber(item.sales_amount ?? item.totalSales, 0))
    current.price = firstNumber(item.price, item.price_min, item.avgPrice, current.price)
    products.set(productId, current)
  }

  for (const band of safeArray(report?.priceBandProducts)) {
    for (const product of safeArray(band.products)) addProduct(product)
  }

  if (runIds.length) {
    const [generatedProducts] = await connection.query(`
      SELECT *
      FROM market_price_band_product_analysis
      WHERE run_id IN (?)
      ORDER BY COALESCE(sales_amount, 0) DESC, COALESCE(sold_count, 0) DESC
      LIMIT 200
    `, [runIds])
    for (const product of generatedProducts) addProduct(product)
  }

  const productIds = Array.from(products.keys())
  if (!productIds.length) {
    return {
      source: 'database',
      generatedAt: new Date().toISOString(),
      productCount: 0,
      reviewCount: 0,
      qaCount: 0,
      skuCount: 0,
      actionPlan: null,
      positiveSellingPoints: [],
      negativePainPoints: [],
      dataNote: '当前报告没有可关联的商品 ID，暂无法从数据库生成建议动作。',
    }
  }

  const [reviewRows] = await connection.query(`
    SELECT product_id, review_text, follow_review
    FROM product_review_snapshot
    WHERE product_id IN (?)
    ORDER BY id DESC
    LIMIT 1200
  `, [productIds])
  const [qaRows] = await connection.query(`
    SELECT product_id, question, answer
    FROM product_qa_snapshot
    WHERE product_id IN (?)
    ORDER BY id DESC
    LIMIT 600
  `, [productIds])
  const [skuRows] = await connection.query(`
    SELECT product_id, sku_title, sku_info, package_type, price, coupon_price
    FROM product_sku_snapshot
    WHERE product_id IN (?)
    ORDER BY id DESC
    LIMIT 1200
  `, [productIds])
  const [insightRows] = runIds.length
    ? await connection.query(`
      SELECT product_id, insight_type, term, occurrence_count
      FROM market_product_insight
      WHERE run_id IN (?)
      ORDER BY occurrence_count DESC, id DESC
      LIMIT 800
    `, [runIds])
    : [[]]

  const { positive: positiveTopics, pain: painTopics } = topicDefinitionsForKeyword(cleanKeyword)
  const positiveMap = new Map()
  const painMap = new Map()
  const skuTerms = new Map()

  const addSkuTerm = (text, row = {}, weight = 1) => {
    for (const term of splitKeywordTerms(text)) {
      addKeywordSignal(skuTerms, term, {
        source: 'SKU',
        productId: row.product_id,
        sold: products.get(String(row.product_id || ''))?.sold || 0,
        weight,
      })
    }
  }

  for (const row of skuRows) {
    const text = `${row.sku_title || ''} ${row.sku_info || ''} ${row.package_type || ''}`
    addSkuTerm(text, row, 1.2)
  }

  for (const row of insightRows) {
    const text = row.term || ''
    const weight = Math.max(1, toInt(row.occurrence_count, 1))
    addSkuTerm(text, row, weight)
  }

  for (const row of reviewRows) {
    const product = products.get(String(row.product_id || '')) || {}
    const reviewText = `${row.review_text || ''} ${row.follow_review || ''}`.trim()
    if (!reviewText) continue
    for (const topic of positiveTopics) addTopicMatch(positiveMap, topic, { text: reviewText, source: '评论', productId: row.product_id, productTitle: product.title, weight: 1 })
    for (const topic of painTopics) addTopicMatch(painMap, topic, { text: reviewText, source: '评论', productId: row.product_id, productTitle: product.title, weight: 1 })
  }

  let positiveRows = rowsFromTopicMap(positiveMap, 3)
  let painRows = rowsFromTopicMap(painMap, 3)

  const productList = Array.from(products.values()).sort((a, b) => (b.sales || 0) - (a.sales || 0) || (b.sold || 0) - (a.sold || 0))
  const priceValues = [
    ...productList.map((item) => item.price).filter((value) => value != null && value > 0),
    ...skuRows.map((item) => firstNumber(item.coupon_price, item.price)).filter((value) => value != null && value > 0),
  ]
  const minPrice = priceValues.length ? Math.min(...priceValues) : null
  const maxPrice = priceValues.length ? Math.max(...priceValues) : null
  const mainPrice = minPrice != null && maxPrice != null
    ? minPrice === maxPrice ? `¥${money(minPrice)}` : `¥${money(minPrice)}-¥${money(maxPrice)}`
    : report?.priceRange || '暂无'

  return {
    source: 'database',
    generatedAt: new Date().toISOString(),
    productCount: productList.length,
    reviewCount: reviewRows.length,
    qaCount: qaRows.length,
    skuCount: skuRows.length,
    actionPlan: {
      titleStructure: buildTitleSuggestion({ keyword: cleanKeyword, products: productList, skuTerms, positiveRows, keywordMatrix }),
      priceAnchor: `当前样本价格锚点 ${mainPrice}；建议用主流成交价承接流量，高配 SKU 用功能/材质差异支撑溢价。`,
      searchTerms: buildSearchTerms({ keyword: cleanKeyword, keywordMatrix, skuTerms, positiveRows, painRows }),
      imageOrder: buildImageOrder({ keyword: cleanKeyword, positiveRows, painRows, keywordMatrix }),
    },
    positiveSellingPoints: positiveRows,
    negativePainPoints: painRows,
    dataNote: reviewRows.length
      ? `好评/差评仅基于 ${reviewRows.length} 条评价正文和追评；SKU 仅用于价格、规格分类和搜索词辅助，不参与好评/差评分析。`
      : `当前商品暂无评价正文/追评样本，因此不生成好评/差评分析；SKU 仅用于价格、规格分类和搜索词辅助。`,
  }
}

async function buildKeywordMatrixForReport(connection, { runIds = [], keyword = '', report = null } = {}) {
  const cleanKeyword = String(keyword || report?.keyword || '').trim()
  const stats = new Map()
  const products = new Map()
  const textRows = []
  const addProduct = (item = {}) => {
    const productId = String(item.product_id || item.productId || item.id || '').trim()
    if (!productId) return
    const current = products.get(productId) || { productId, title: '', sold: 0 }
    current.title = firstNonEmpty(item.product_title, item.title, current.title)
    current.sold = Math.max(current.sold || 0, toInt(item.sold_count ?? item.soldCount ?? item.totalSold ?? item.monthly_received ?? item.payer_count, 0))
    products.set(productId, current)
  }

  for (const band of safeArray(report?.priceBandProducts)) {
    for (const product of safeArray(band.products)) addProduct(product)
  }

  if (runIds.length) {
    const [generatedProducts] = await connection.query(`
      SELECT *
      FROM market_price_band_product_analysis
      WHERE run_id IN (?)
      ORDER BY COALESCE(sales_amount, 0) DESC, COALESCE(sold_count, 0) DESC
      LIMIT 200
    `, [runIds])
    for (const product of generatedProducts) {
      addProduct(product)
      textRows.push({ productId: product.product_id, sold: product.sold_count, source: '商品标题', weight: 1.8, text: product.product_title })
      textRows.push({ productId: product.product_id, sold: product.sold_count, source: '需求洞察', weight: 2, text: product.demands_json })
      textRows.push({ productId: product.product_id, sold: product.sold_count, source: '卖点洞察', weight: 2.2, text: product.selling_points_json })
      textRows.push({ productId: product.product_id, sold: product.sold_count, source: '问大家', weight: 1.8, text: product.qa_examples_json })
    }

    const [insights] = await connection.query(`
      SELECT product_id, insight_type, term, occurrence_count
      FROM market_product_insight
      WHERE run_id IN (?)
      ORDER BY occurrence_count DESC, id DESC
      LIMIT 500
    `, [runIds])
    for (const insight of insights) {
      addKeywordSignal(stats, insight.term, {
        source: insight.insight_type === 'demand' ? '需求洞察' : '卖点洞察',
        productId: insight.product_id,
        sold: products.get(String(insight.product_id || ''))?.sold || 0,
        weight: Math.max(1, toInt(insight.occurrence_count, 1)) * 2,
      })
    }
  }

  const knownProductIds = Array.from(products.keys())
  let rawProducts = []
  if (knownProductIds.length) {
    const [rows] = await connection.query(`
      SELECT p.*
      FROM product_snapshot p
      JOIN (
        SELECT MAX(id) AS id
        FROM product_snapshot
        WHERE product_id IN (?)
        GROUP BY product_id
      ) latest ON latest.id = p.id
      ORDER BY COALESCE(p.monthly_received, p.sold_count, p.payer_count, 0) DESC, p.id DESC
      LIMIT 200
    `, [knownProductIds])
    rawProducts = rows
  } else if (cleanKeyword) {
    const like = `%${cleanKeyword}%`
    const [rows] = await connection.query(`
      SELECT p.*
      FROM product_snapshot p
      JOIN (
        SELECT MAX(id) AS id
        FROM product_snapshot
        WHERE product_title LIKE ? OR category_name LIKE ?
        GROUP BY COALESCE(NULLIF(product_id, ''), CAST(id AS CHAR))
      ) latest ON latest.id = p.id
      ORDER BY COALESCE(p.monthly_received, p.sold_count, p.payer_count, 0) DESC, p.id DESC
      LIMIT 120
    `, [like, like])
    rawProducts = rows
  }

  for (const product of rawProducts) {
    addProduct(product)
    textRows.push({ productId: product.product_id, sold: product.monthly_received ?? product.sold_count ?? product.payer_count, source: '商品标题', weight: 1.8, text: product.product_title })
    textRows.push({ productId: product.product_id, sold: product.monthly_received ?? product.sold_count ?? product.payer_count, source: '类目', weight: 1, text: product.category_name })
  }

  const productIds = Array.from(products.keys())
  if (productIds.length) {
    const [qaRows] = await connection.query(`
      SELECT product_id, question, answer
      FROM product_qa_snapshot
      WHERE product_id IN (?)
      ORDER BY id DESC
      LIMIT 500
    `, [productIds])
    for (const qa of qaRows) {
      const product = products.get(String(qa.product_id || '')) || {}
      textRows.push({ productId: qa.product_id, sold: product.sold, source: '问大家', weight: 1.8, text: `${qa.question || ''} ${qa.answer || ''}` })
    }

    const [reviewRows] = await connection.query(`
      SELECT product_id, review_text, follow_review
      FROM product_review_snapshot
      WHERE product_id IN (?)
      ORDER BY id DESC
      LIMIT 800
    `, [productIds])
    for (const review of reviewRows) {
      const product = products.get(String(review.product_id || '')) || {}
      const reviewText = `${review.review_text || ''} ${review.follow_review || ''}`.trim()
      if (reviewText) textRows.push({ productId: review.product_id, sold: product.sold, source: '评论', weight: 1.6, text: reviewText })
    }

    const [imageReports] = await connection.query(`
      SELECT product_id, product_title, sold_count, report_json
      FROM product_main_image_analysis
      WHERE product_id IN (?) ${cleanKeyword ? 'OR collection_keyword = ?' : ''}
      ORDER BY id DESC
      LIMIT 200
    `, cleanKeyword ? [productIds, cleanKeyword] : [productIds])
    for (const imageReport of imageReports) {
      addProduct(imageReport)
      textRows.push({ productId: imageReport.product_id, sold: imageReport.sold_count, source: '商品标题', weight: 1.8, text: imageReport.product_title })
      collectKeywordTextsFromJson(imageReport.report_json, textRows, '主图分析', 2)
    }
  }

  if (cleanKeyword) {
    addKeywordSignal(stats, cleanKeyword, { source: '报告关键词', productId: productIds[0] || '', sold: 0, weight: 3 })
  }

  for (const row of textRows) {
    const sold = row.sold ?? products.get(String(row.productId || ''))?.sold ?? 0
    for (const term of splitKeywordTerms(row.text)) {
      addKeywordSignal(stats, term, { source: row.source, productId: row.productId, sold, weight: row.weight })
    }
  }

  const productTotal = Math.max(1, products.size || toInt(report?.competitorCount, 0) || 1)
  const coreKeywords = keywordRowsFromStats(stats, productTotal, { limit: 10 })
  const blueOceanCandidates = keywordRowsFromStats(stats, productTotal, { blueOcean: true, limit: 24 })
  let blueOceanKeywords = blueOceanCandidates
    .filter((item) => !coreKeywords.some((core) => core.keyword === item.keyword))
    .slice(0, 10)
  if (!blueOceanKeywords.length) {
    blueOceanKeywords = blueOceanCandidates
      .filter((item) => !coreKeywords.slice(0, 5).some((core) => core.keyword === item.keyword))
      .slice(0, 10)
  }

  return {
    source: 'database',
    generatedAt: new Date().toISOString(),
    productCount: products.size,
    textSampleCount: textRows.length,
    coreKeywords,
    blueOceanKeywords,
  }
}

function imageFeatureTerms(images, fallbackTerms = []) {
  const counts = new Map()
  for (const image of images || []) {
    const type = String(image.image_type || image.type || '').trim()
    if (!type) continue
    const label = type.includes('detail')
      ? '详情图'
      : type.includes('main')
        ? '主图'
        : type.includes('sku')
          ? 'SKU图'
          : type
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  const terms = Array.from(counts.entries()).map(([term, count]) => ({ term, count }))
  return terms.length ? terms.slice(0, 6) : fallbackTerms.slice(0, 3)
}

function mergeMetricItems(groups, limit = 20) {
  const counts = new Map()
  for (const items of groups || []) {
    for (const item of items || []) {
      const term = String(item?.term || item?.keyword || '').trim()
      if (!term) continue
      counts.set(term, (counts.get(term) || 0) + toInt(item?.count, 1))
    }
  }
  return Array.from(counts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function collapseManualOverallBands(bands) {
  const productsById = new Map()
  const images = []
  const qaExamples = []
  const priceValues = []

  for (const band of bands || []) {
    for (const value of [band?.price_min, band?.price_max, band?.price_avg]) {
      const numeric = money(value)
      if (numeric != null && numeric > 0) priceValues.push(numeric)
    }

    for (const image of band?.display_images?.available_images || []) {
      images.push(image)
    }
    for (const qa of band?.qa_and_review?.qa_examples || []) {
      qaExamples.push(qa)
    }

    for (const product of band?.product_analysis || []) {
      const key = String(product.product_id || product.id || product.product_title || '').trim()
      if (!key) continue
      if (!productsById.has(key)) {
        productsById.set(key, product)
        const price = money(product.price ?? product.price_avg)
        if (price != null && price > 0) priceValues.push(price)
        for (const sku of product.skus || []) {
          const skuPrice = money(sku.coupon_price ?? sku.price)
          if (skuPrice != null && skuPrice > 0) priceValues.push(skuPrice)
        }
      }
    }
  }

  const products = Array.from(productsById.values())
  const totalSold = bands.reduce((sum, band) => sum + toInt(band?.sold_count_total, 0), 0)
  const totalSales = bands.reduce((sum, band) => sum + (money(band?.sales_amount_total) || 0), 0)
  const minPrice = priceValues.length ? Math.min(...priceValues) : null
  const maxPrice = priceValues.length ? Math.max(...priceValues) : null
  const avgPrice = totalSold > 0 && totalSales > 0
    ? money(totalSales / totalSold)
    : priceValues.length
      ? money(priceValues.reduce((sum, value) => sum + value, 0) / priceValues.length)
      : null
  const firstPrompt = bands.find((band) => band?.image_prompts)?.image_prompts || {}

  return [{
    price_band: '全量竞品集合',
    price_min: minPrice,
    price_max: maxPrice,
    price_avg: avgPrice,
    competitor_count: products.length || bands.reduce((sum, band) => sum + toInt(band?.competitor_count, 0), 0),
    sold_count_total: totalSold,
    sales_amount_total: totalSales,
    extracted_selling_points: mergeMetricItems(bands.map((band) => band?.extracted_selling_points), 30),
    extracted_demands: mergeMetricItems(bands.map((band) => band?.extracted_demands), 30),
    display_images: {
      available_images: images.slice(0, 60),
      note: '整体报告不自动划分价格段，价格段由用户后续手动选择。',
    },
    qa_and_review: {
      qa_examples: qaExamples.slice(0, 30),
    },
    image_prompts: {
      ...firstPrompt,
      title_direction: firstPrompt.title_direction || firstPrompt.main_image_prompt || '基于全量竞品集合提炼统一卖点、图片规律和用户需求，后续由用户手动选择价格段再生成上架内容。',
    },
    profit_simulation: bands.find((band) => band?.profit_simulation)?.profit_simulation || {},
    product_analysis: products,
  }]
}

function decodeBase64Url(value) {
  try {
    return Buffer.from(String(value || ''), 'base64url').toString('utf8')
  } catch {
    return ''
  }
}

function imagePriority(type) {
  const text = String(type || '').toLowerCase()
  if (text.includes('main')) return 0
  if (text.includes('page')) return 1
  if (text.includes('detail')) return 2
  if (text.includes('sku')) return 3
  return 9
}

function pickDisplayImage(images = []) {
  return (images || [])
    .map((image) => ({
      ...image,
      url: maybeLocalImageAsDataUrl(image.path || image.storage_path || image.asset_path || image.image_path)
        || normalizeUrl(image.url || image.image_url || image.asset_url || image.source_url || image.sku_image_url),
      type: image.image_type || image.asset_type || image.type || '',
    }))
    .filter((image) => image.url)
    .sort((a, b) => imagePriority(a.type) - imagePriority(b.type))[0]?.url || ''
}

function normalizeSkuRows(skus = []) {
  return (skus || [])
    .map((sku) => ({
      skuId: String(sku.sku_id || sku.id || '').trim(),
      title: String(sku.sku_title || sku.sku_info || sku.name || 'SKU').trim(),
      info: String(sku.sku_info || '').trim(),
      price: money(sku.coupon_price ?? sku.price),
      stockQty: toInt(sku.stock_qty, null),
      imageUrl: maybeLocalImageAsDataUrl(sku.sku_image_path) || normalizeUrl(sku.sku_image_url),
    }))
    .filter((sku) => sku.title || sku.skuId)
    .slice(0, 80)
}

function productOverviewFromGenerated(row) {
  const skus = normalizeSkuRows(parseJson(row.sku_json, []))
  const images = parseJson(row.image_json, [])
  const imageUrl = pickDisplayImage(images)
  return {
    id: String(row.product_id || row.id),
    productId: row.product_id || '',
    title: row.product_title || '-',
    shopName: row.shop_name || '',
    productUrl: row.product_link || '',
    price: money(row.price),
    priceRange: priceRangeText(row.price_min, row.price_max),
    soldCount: toInt(row.sold_count, 0),
    salesAmount: money(row.sales_amount),
    skuCount: toInt(row.sku_count ?? skus.length, skus.length),
    imageUrl,
    imageCount: toInt(row.image_count ?? images.length, images.length),
    skus,
    mainImageAnalysisId: null,
    mainImageAnalyzedAt: '',
  }
}

function productOverviewFromRaw(product, skus = [], media = []) {
  const normalizedSkus = normalizeSkuRows(skus)
  const mediaImages = (media || [])
    .map((asset) => ({
      image_type: asset.image_type,
      url: imageUrlFrom(asset),
      path: asset.storage_path,
    }))
    .filter((image) => image.url)
  const skuImages = normalizedSkus
    .map((sku) => ({
      image_type: 'sku',
      url: sku.imageUrl,
    }))
    .filter((image) => image.url)
  const imageUrl = pickDisplayImage([...mediaImages, ...skuImages])
  const priceMin = firstNumber(product.effective_min_price, product.min_coupon_price, product.min_price)
  const priceMax = firstNumber(product.effective_max_price, product.max_coupon_price, product.max_price)
  return {
    id: String(product.product_id || product.id),
    productId: product.product_id || '',
    title: product.product_title || '-',
    shopName: product.shop_name || '',
    productUrl: product.product_url || (product.product_id ? `https://item.taobao.com/item.htm?id=${product.product_id}` : ''),
    price: money(firstNumber(priceMin, priceMax)),
    priceRange: priceRangeText(priceMin, priceMax),
    soldCount: toInt(product.sold_count ?? product.monthly_received ?? product.payer_count, 0),
    salesAmount: money(product.sales_amount),
    skuCount: toInt(product.sku_count ?? normalizedSkus.length, normalizedSkus.length),
    imageUrl,
    imageCount: mediaImages.length + skuImages.length,
    skus: normalizedSkus,
    mainImageAnalysisId: null,
    mainImageAnalyzedAt: '',
  }
}

async function attachProductMainImageAnalysisStatus(connection, products) {
  const productIds = products.map((product) => product.productId).filter(Boolean)
  if (!productIds.length) return products
  const [rows] = await connection.query(`
    SELECT a.product_id, a.id, a.created_at
    FROM product_main_image_analysis a
    JOIN (
      SELECT product_id, MAX(id) AS id
      FROM product_main_image_analysis
      WHERE product_id IN (?)
      GROUP BY product_id
    ) latest ON latest.id = a.id
  `, [productIds])
  const statusByProduct = new Map(rows.map((row) => [String(row.product_id), row]))
  return products.map((product) => {
    const status = statusByProduct.get(String(product.productId))
    return status
      ? { ...product, mainImageAnalysisId: toInt(status.id, null), mainImageAnalyzedAt: status.created_at || '' }
      : product
  })
}

function transformReportForAnalysisView(row) {
  const reportJson = row.reportJson || parseJson(row.report_json, null)
  if (!reportJson) return null
  const source = reportJson.summary?.source || row.data_source || ''
  const priceGroupingMode = reportJson.summary?.price_grouping_mode || ''
  const shouldUseManualOverallView = priceGroupingMode === 'manual_required'
  const bands = shouldUseManualOverallView
    ? collapseManualOverallBands(reportJson.price_band_report || [])
    : (reportJson.price_band_report || [])
  const prices = bands.flatMap((band) => [band.price_min, band.price_max]).map((value) => money(value)).filter((value) => value != null)
  const totalSoldAll = bands.reduce((sum, band) => sum + toInt(band.sold_count_total, 0), 0)
  const fallbackTitle = `${row.keyword || reportJson.summary?.keyword || '报告'}${compactDateTime(row.created_at)}`
  const reportTitle = reportJson.report_title || fallbackTitle

  return {
    title: reportTitle,
    fallbackTitle,
    keyword: row.keyword || reportJson.summary?.keyword || '',
    source,
    analysisEngine: reportJson.summary?.analysis_engine || '',
    priceGroupingMode: shouldUseManualOverallView ? 'manual_required' : priceGroupingMode,
    priceRange: prices.length ? priceRangeText(Math.min(...prices), Math.max(...prices)) : '-',
    competitorCount: toInt(row.competitor_count ?? reportJson.summary?.competitor_count),
    collectTime: row.created_at,
    salesAnalysis: bands.map((band) => {
      const totalSold = toInt(band.sold_count_total, 0)
      return {
        band: band.price_band,
        minPrice: money(band.price_min) || 0,
        maxPrice: money(band.price_max) || 0,
        competitorCount: toInt(band.competitor_count),
        avgPrice: money(band.price_avg) || 0,
        totalSold,
        totalSales: money(band.sales_amount_total) || 0,
        share: totalSoldAll > 0 ? money((totalSold / totalSoldAll) * 100) || 0 : 0,
      }
    }),
    sellingAnalysis: bands.map((band) => {
      const coreSellingPoints = metricTerms(band.extracted_selling_points, 8)
      const images = band.display_images?.available_images || []
      return {
        band: band.price_band,
        coreSellingPoints,
        imageFeatures: imageFeatureTerms(images, coreSellingPoints),
      }
    }),
    demandAnalysis: bands.map((band) => {
      const demands = metricTerms(band.extracted_demands, 8).map((item) => item.term)
      const points = metricTerms(band.extracted_selling_points, 4).map((item) => item.term)
      const titleDirection = String(band.image_prompts?.title_direction || band.image_prompts?.main_image_prompt || '').trim()
      return {
        band: band.price_band,
        unmetNeeds: demands.length ? demands : ['暂无明确痛点数据'],
        opportunities: uniqueText([
          titleDirection,
          points.length ? `围绕${points.join('、')}做差异化表达` : '',
          band.profit_simulation?.gross_margin != null ? `该价格段测算毛利率约 ${money(Number(band.profit_simulation.gross_margin) * 100)}%` : '',
        ], 4),
      }
    }),
    layoutSuggestions: bands.map((band) => {
      const points = metricTerms(band.extracted_selling_points, 5).map((item) => item.term)
      return {
        band: band.price_band,
        coreSellingPoints: points.join('、') || '待 AI 分析补充',
        priceRange: priceRangeText(band.price_min, band.price_max),
        suggestion: String(band.image_prompts?.title_direction || band.image_prompts?.main_image_prompt || '建议结合该价格段销量、卖点和问大家需求，生成主图与详情内容。'),
      }
    }),
    priceBandProducts: bands.map((band) => ({
      band: band.price_band,
      products: (band.product_analysis || []).slice(0, 30).map((product) => ({
        id: String(product.product_id || product.id || product.product_title),
        shopName: product.shop_name || '-',
        title: product.product_title || product.title || '-',
        productUrl: product.product_link || product.product_url || '',
        skuCount: toInt(product.sku_count ?? product.skus?.length, 0),
        avgPrice: money(product.price ?? product.price_avg) || 0,
        totalSold: toInt(product.sold_count, 0),
        totalSales: money(product.sales_amount) || 0,
        sellingPoints: metricTerms(product.selling_points || product.extracted_selling_points || [], 5).map((item) => item.term),
        visualObservation: product.visual_observation || '',
        skus: (product.skus || []).slice(0, 20).map((sku) => ({
          name: sku.sku_title || sku.sku_info || sku.name || 'SKU',
          price: money(sku.coupon_price ?? sku.price) || 0,
        })),
      })),
    })),
    reviewAnalysis: bands.map((band) => {
      const demands = metricTerms(band.extracted_demands, 5).map((item) => item.term)
      const points = metricTerms(band.extracted_selling_points, 5).map((item) => item.term)
      return {
        band: band.price_band,
        negativeReviews: demands.length ? demands : ['暂无差评/痛点提炼数据'],
        positiveReviews: points.length ? points : ['暂无好评卖点提炼数据'],
        userDemands: demands.length ? demands : ['暂无用户诉求提炼数据'],
      }
    }),
    qaAnalysis: bands.map((band) => {
      const qaExamples = band.qa_and_review?.qa_examples || []
      const demandQuestions = metricTerms(band.extracted_demands, 3).map((item) => ({
        question: `${item.term}相关问题`,
        count: item.count,
      }))
      return {
        band: band.price_band,
        questions: qaExamples.length
          ? qaExamples.slice(0, 6).map((item, index) => ({ question: item.question || item.answer || `问大家 ${index + 1}`, count: 1 }))
          : demandQuestions,
      }
    }),
    report_title: reportJson.report_title || reportTitle,
    analysis_scope: reportJson.analysis_scope || null,
    market_core_conclusions: reportJson.market_core_conclusions || null,
    sales_structure: reportJson.sales_structure || null,
    high_sales_selling_point_analysis: reportJson.high_sales_selling_point_analysis || null,
    consumer_demand_analysis: reportJson.consumer_demand_analysis || null,
    selling_point_opportunity_matrix: reportJson.selling_point_opportunity_matrix || [],
    product_positioning_visual_strategy: reportJson.product_positioning_visual_strategy || null,
    listing_image_overall_plan: reportJson.listing_image_overall_plan || [],
    single_image_generation_plan: reportJson.single_image_generation_plan || [],
    final_image_decision_card: reportJson.final_image_decision_card || null,
  }
}

export async function getAnalysisReportView({ id = '', keyword = '' } = {}) {
  const cleanId = String(id || '').trim()
  const cleanKeyword = String(keyword || '').trim()
  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    let rows = []
    const runId = cleanId.startsWith('run-') ? Number(cleanId.replace(/^run-/, '')) : Number(cleanId)
    if (Number.isFinite(runId) && runId > 0) {
      ;[rows] = await connection.query(`
        SELECT *
        FROM market_analysis_run
        WHERE id = ?
        LIMIT 1
      `, [runId])
    }
    if (!rows.length && cleanKeyword) {
      ;[rows] = await connection.query(`
        SELECT *
        FROM market_analysis_run
        WHERE keyword = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 30
      `, [cleanKeyword])
    }
    if (!rows.length) return { ok: true, hasReport: false, report: null }
    const merged = rows.length > 1 ? mergeReportRuns(rows) : null
    const report = merged
      ? transformReportForAnalysisView({
        keyword: merged.keyword,
        competitor_count: merged.reportJson?.summary?.competitor_count,
        created_at: merged.generatedAt,
        reportJson: merged.reportJson,
      })
      : transformReportForAnalysisView(rows[0])
    if (report) {
      report.keywordMatrix = await buildKeywordMatrixForReport(connection, {
        runIds: rows.map((row) => toInt(row.id, null)).filter((value) => value != null),
        keyword: report.keyword || cleanKeyword,
        report,
      })
      report.recommendationActions = await buildRecommendationActionsForReport(connection, {
        runIds: rows.map((row) => toInt(row.id, null)).filter((value) => value != null),
        keyword: report.keyword || cleanKeyword,
        report,
        keywordMatrix: report.keywordMatrix,
      })
      report.listingSellingPoints = buildListingSellingPointsForReport({
        keyword: report.keyword || cleanKeyword,
        report,
        keywordMatrix: report.keywordMatrix,
        recommendationActions: report.recommendationActions,
        mainImagePointsByProduct: await loadMainImageSellingPointsByProduct(connection, safeArray(report.priceBandProducts).flatMap((band) => safeArray(band.products).map((p) => p.id))),
      })
    }
    return { ok: true, hasReport: Boolean(report), report }
  })
}

export async function getAnalysisProductsView({ id = '', keyword = '' } = {}) {
  const cleanId = String(id || '').trim()
  const cleanKeyword = String(keyword || '').trim()
  const rawRequested = cleanId.startsWith('raw-')

  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)

    let products = []
    let source = ''
    let title = cleanKeyword || '全部商品'
    let priceRange = '-'
    let collectTime = ''

    const runId = cleanId.startsWith('run-') ? Number(cleanId.replace(/^run-/, '')) : Number(cleanId)
    if (Number.isFinite(runId) && runId > 0) {
      const [rows] = await connection.query(`
        SELECT p.*, b.price_min AS band_price_min, b.price_max AS band_price_max, r.keyword, r.created_at AS run_created_at
        FROM market_price_band_product_analysis p
        LEFT JOIN market_price_band_analysis b ON b.id = p.price_band_id
        LEFT JOIN market_analysis_run r ON r.id = p.run_id
        WHERE p.run_id = ?
        ORDER BY COALESCE(p.sold_count, 0) DESC, p.id ASC
      `, [runId])
      products = rows.map(productOverviewFromGenerated)
      source = 'market_analysis_run'
      title = rows[0]?.keyword || cleanKeyword || title
      collectTime = rows[0]?.run_created_at || ''
    }

    if (!rawRequested && !products.length && (cleanId.startsWith('run-group-') || cleanKeyword)) {
      const [runRows] = await connection.query(`
        SELECT id, created_at
        FROM market_analysis_run
        WHERE keyword = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 30
      `, [cleanKeyword])
      const runIds = runRows.map((row) => toInt(row.id)).filter(Boolean)
      if (runIds.length) {
        const [rows] = await connection.query(`
          SELECT p.*
          FROM market_price_band_product_analysis p
          WHERE p.run_id IN (?)
          ORDER BY p.run_id DESC, COALESCE(p.sold_count, 0) DESC, p.id ASC
        `, [runIds])
        const byProduct = new Map()
        for (const row of rows) {
          const key = String(row.product_id || row.product_title || row.id)
          if (!byProduct.has(key)) byProduct.set(key, row)
        }
        products = Array.from(byProduct.values()).map(productOverviewFromGenerated)
        source = 'market_analysis_group'
        title = cleanKeyword || title
        collectTime = runRows[0]?.created_at || ''
      }
    }

    if (!products.length) {
      const rawCollectionKey = rawRequested ? decodeBase64Url(cleanId.slice(4)) : ''
      const where = []
      const params = []
      if (rawCollectionKey) {
        where.push('sf.local_path LIKE ?')
        params.push(`%${rawCollectionKey}%`)
        title = collectionNameFromPath(rawCollectionKey, cleanKeyword) || cleanKeyword || title
      } else if (cleanKeyword) {
        where.push('(p.product_title LIKE ? OR p.category_name LIKE ? OR sf.local_path LIKE ?)')
        params.push(`%${cleanKeyword}%`, `%${cleanKeyword}%`, `%${cleanKeyword}%`)
      }

      const [rows] = await connection.query(`
        SELECT p.*, sf.local_path
        FROM product_snapshot p
        LEFT JOIN (
          SELECT job_id, MIN(local_path) AS local_path
          FROM source_file_record
          WHERE local_path IS NOT NULL AND local_path <> ''
          GROUP BY job_id
        ) sf ON sf.job_id = p.job_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY COALESCE(p.sold_count, p.monthly_received, p.payer_count, 0) DESC, p.id DESC
        LIMIT 500
      `, params)

      const byProduct = new Map()
      for (const row of rows) {
        const key = String(row.product_id || row.id)
        if (!byProduct.has(key)) byProduct.set(key, row)
      }
      const rawProducts = Array.from(byProduct.values())
      const productIds = rawProducts.map((product) => product.product_id).filter(Boolean)
      const skuByProduct = new Map()
      const mediaByProduct = new Map()
      if (productIds.length) {
        const [skuRows] = await connection.query(`
          SELECT *
          FROM product_sku_snapshot
          WHERE product_id IN (?)
          ORDER BY id DESC
        `, [productIds])
        for (const sku of skuRows) {
          const bucket = skuByProduct.get(sku.product_id) || []
          bucket.push(sku)
          skuByProduct.set(sku.product_id, bucket)
        }

        const [mediaRows] = await connection.query(`
          SELECT *
          FROM media_asset
          WHERE product_id IN (?)
          ORDER BY sort_no ASC, id ASC
        `, [productIds])
        for (const media of mediaRows) {
          const bucket = mediaByProduct.get(media.product_id) || []
          bucket.push(media)
          mediaByProduct.set(media.product_id, bucket)
        }
      }
      products = rawProducts.map((product) => productOverviewFromRaw(
        product,
        skuByProduct.get(product.product_id) || [],
        mediaByProduct.get(product.product_id) || [],
      ))
      source = 'product_snapshot'
      collectTime = rawProducts[0]?.created_at || ''
    }

    const prices = products
      .flatMap((product) => String(product.priceRange || '').split('-').map((item) => money(item)))
      .filter((value) => value != null)
    priceRange = prices.length ? priceRangeText(Math.min(...prices), Math.max(...prices)) : '-'
    products = await attachProductMainImageAnalysisStatus(connection, products)

    return {
      ok: true,
      source,
      collection: {
        id: cleanId,
        keyword: title,
        priceRange,
        productCount: products.length,
        collectTime,
      },
      products,
    }
  })
}

function productMainImageReportSchema() {
  return {
    product_id: '商品ID',
    product_title: '商品标题',
    main_image_ocr_text: ['主图中识别到的文字，尽量保留原文'],
    visual_layout: {
      background: '背景/场景',
      product_subject: '主体呈现方式',
      composition: '构图',
      color_style: '配色与风格',
      trust_elements: ['品牌、认证、规格、利益点等信任元素'],
    },
    image_selling_points: [{ term: '主图中传达的用户利益点（如"柔软亲肤""一口就停不下来"），禁止填入纯规格词', evidence: '图片中对应的视觉证据' }],
    title_selling_points: [{ term: '标题中传达的差异化卖点（如"0添加防腐剂""靖江特产"），禁止填入纯数量/规格/包装词', evidence: '标题或SKU中的原文依据' }],
    qa_user_needs: [{ term: '问大家反映的用户真实需求或顾虑', evidence: '问大家原文证据' }],
    audience_and_scene: {
      audience: '适用人群',
      scene: '使用/消费场景',
      pain_points: ['用户痛点'],
    },
    listing_suggestions: {
      keep_points: ['值得沿用的差异化表达'],
      differentiation_points: ['可差异化补强的方向'],
      main_image_prompt_seed: '后续主图生成可复用的提示词种子',
    },
    confidence: 'high/medium/low',
    data_gaps: ['缺失或不确定的信息'],
  }
}

function collectProductMainImageAnalysisContent(product) {
  const content = [{
    type: 'input_text',
    text: [
      '你是资深电商商品图和用户需求分析师。请分析单个商品主图，并结合标题、SKU、问大家数据，生成可入库复用的中文 JSON 报告。',
      '重点：1）识别主图文字和画面结构；2）提炼图片中表达的用户利益点；3）结合问大家提炼用户真实需求/顾虑；4）输出后续整体竞品报告可复用的商品级结论。',
      '',
      '【卖点定义 — 严格遵守】',
      '卖点 = 能让用户产生购买欲望的「用户利益」或「差异化价值」，而不是产品属性描述。',
      '',
      '✅ 合格卖点示例（应该提取）：',
      '- 品质类："0添加防腐剂"、"进口原料"、"纯手工制作"、"A类安全标准"',
      '- 体验类："柔软亲肤不刺激"、"一口就停不下来"、"3秒速溶不结块"',
      '- 信任类："老字号传承"、"明星同款"、"销量100万+"',
      '- 场景类："出差旅行必备"、"办公室下午茶"、"宝宝辅食首选"',
      '- 食品口感类："外皮暄软蓬松"、"馅料饱满多汁"、"现做现发锁鲜"、"加热后依然酥脆"',
      '',
      '❌ 禁止提取为卖点（必须排除）：',
      '- 纯数量规格："40包"、"20包"、"5斤装"、"100抽"、"3层"',
      '- 包装描述："实惠装"、"整箱装"、"家庭装"、"量贩装"、"礼盒装"',
      '- SKU变体名："老面馒头5斤装"、"猪肉味200g"、"原味+黑胡椒"',
      '- 品类通用词："抽纸"、"纸巾"、"肉脯"、"包子"（品类名本身不是卖点）',
      '- 价格促销词："限时特价"、"买一送一"、"领券立减"',
      '- 泛场景词："家庭分享"、"全家共享"、"朋友聚会"（不是具体卖点）',
      '',
      '只输出 JSON，不要 Markdown，不要解释。字段缺失时用空数组或空字符串，不要编造具体事实。',
      '',
      '返回 JSON 结构：',
      JSON.stringify(productMainImageReportSchema(), null, 2),
      '',
      '商品数据：',
      JSON.stringify({
        product_id: product.product_id,
        product_title: product.product_title,
        product_url: product.product_url,
        shop_name: product.shop_name,
        price: product.price,
        sold_count: product.sold_count,
        skus: product.skus,
        qa_examples: product.qa_examples,
      }, null, 2),
    ].join('\n'),
  }]
  if (product.main_image_url) {
    content.push({
      type: 'input_text',
      text: `下面这张图片是商品主图，请优先识别主图文字、卖点表达、构图和视觉风格。商品ID=${product.product_id}`,
    })
    content.push({ type: 'input_image', image_url: product.main_image_url })
  }
  return content
}

async function loadProductMainImageDataset(connection, { productId, keyword = '', fallback = {} }) {
  const cleanProductId = String(productId || fallback.productId || '').trim()
  if (!cleanProductId) throw new Error('缺少商品ID，无法做主图分析')

  const [productRows] = await connection.query(`
    SELECT *
    FROM product_snapshot
    WHERE product_id = ?
    ORDER BY id DESC
    LIMIT 1
  `, [cleanProductId])
  const product = productRows[0] || {}

  const [skuRows] = await connection.query(`
    SELECT *
    FROM product_sku_snapshot
    WHERE product_id = ?
    ORDER BY id DESC
    LIMIT 100
  `, [cleanProductId])

  const [qaRows] = await connection.query(`
    SELECT *
    FROM product_qa_snapshot
    WHERE product_id = ?
    ORDER BY id DESC
    LIMIT 80
  `, [cleanProductId])

  const [mediaRows] = await connection.query(`
    SELECT *
    FROM media_asset
    WHERE product_id = ?
    ORDER BY sort_no ASC, id ASC
    LIMIT 80
  `, [cleanProductId])

  const [sourceRows] = product.job_id
    ? await connection.query(`
      SELECT local_path
      FROM source_file_record
      WHERE job_id = ? AND local_path IS NOT NULL AND local_path <> ''
      ORDER BY id ASC
    `, [product.job_id])
    : [[]]
  const imageRoots = sourceRootsFromRows(sourceRows)

  const mediaImages = mediaRows
    .map((asset) => ({
      image_type: asset.image_type,
      url: imageUrlFrom(asset, imageRoots),
      path: localImagePathFrom(asset, imageRoots) || asset.storage_path,
      file_name: asset.file_name,
    }))
    .filter((image) => image.url)
  const fallbackImageUrl = normalizeUrl(fallback.imageUrl)
  const mainImageUrl = pickDisplayImage(mediaImages) || fallbackImageUrl
  const price = firstNumber(
    product.effective_min_price,
    product.min_coupon_price,
    product.min_price,
    product.effective_max_price,
    product.max_coupon_price,
    product.max_price,
    fallback.price,
  )
  return {
    collection_keyword: String(keyword || '').trim(),
    product_id: cleanProductId,
    product_title: product.product_title || fallback.title || '',
    product_url: product.product_url || fallback.productUrl || (cleanProductId ? `https://item.taobao.com/item.htm?id=${cleanProductId}` : ''),
    shop_name: product.shop_name || fallback.shopName || '',
    price: money(price),
    sold_count: toInt(product.sold_count ?? product.monthly_received ?? product.payer_count ?? fallback.soldCount, 0),
    main_image_url: mainImageUrl,
    main_image_path: mediaImages.find((image) => image.url === mainImageUrl)?.path || '',
    skus: normalizeSkuRows(skuRows.length ? skuRows : fallback.skus || []),
    qa_examples: qaRows.map((qa) => ({
      question: qa.question || '',
      answer: qa.answer || '',
      qa_time: qa.qa_time || '',
    })).filter((qa) => qa.question || qa.answer),
  }
}

export async function analyzeProductMainImageAndSave({ productId, keyword = '', fallback = {} } = {}) {
  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    const product = await loadProductMainImageDataset(connection, { productId, keyword, fallback })
    if (!product.main_image_url) throw new Error('该商品没有可读取的主图，无法进行主图分析')

    const aiResult = await callArkResponses(collectProductMainImageAnalysisContent(product), {
      maxOutputTokens: 16000,
      timeoutMs: ARK_ANALYSIS_TIMEOUT_MS,
    })
    const reportJson = {
      ...aiResult.json,
      product_id: aiResult.json.product_id || product.product_id,
      product_title: aiResult.json.product_title || product.product_title,
      source: {
        collection_keyword: product.collection_keyword,
        product_url: product.product_url,
        main_image_url: product.main_image_url,
        sku_count: product.skus.length,
        qa_count: product.qa_examples.length,
        model: aiResult.model,
        response_id: aiResult.responseId,
        usage: aiResult.usage || null,
      },
      generated_at: new Date().toISOString(),
    }

    const [result] = await connection.query(`
      INSERT INTO product_main_image_analysis (
        source_platform, collection_keyword, product_id, product_title, product_url,
        shop_name, price, sold_count, main_image_url, main_image_path,
        sku_json, qa_json, report_json, model, response_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      'taobao',
      product.collection_keyword,
      product.product_id,
      product.product_title,
      product.product_url,
      product.shop_name,
      money(product.price),
      toInt(product.sold_count, null),
      product.main_image_url && !product.main_image_url.startsWith('data:') ? product.main_image_url : (product.main_image_path || ''),
      product.main_image_path,
      jsonText(product.skus),
      jsonText(product.qa_examples),
      jsonText(reportJson),
      aiResult.model,
      aiResult.responseId,
    ])

    return {
      ok: true,
      id: Number(result.insertId),
      productId: product.product_id,
      analyzedAt: new Date().toISOString(),
      report: reportJson,
    }
  })
}

export async function getProductMainImageAnalysis({ id = '', productId = '' } = {}) {
  const cleanId = toInt(id, 0)
  const cleanProductId = String(productId || '').trim()
  return withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    const params = []
    let where = ''
    if (cleanId > 0) {
      where = 'id = ?'
      params.push(cleanId)
    } else if (cleanProductId) {
      where = 'product_id = ?'
      params.push(cleanProductId)
    } else {
      throw new Error('缺少报告ID或商品ID')
    }

    const [rows] = await connection.query(`
      SELECT *
      FROM product_main_image_analysis
      WHERE ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, params)
    const row = rows[0]
    if (!row) return { ok: true, hasReport: false, report: null }
    return {
      ok: true,
      hasReport: true,
      report: {
        id: row.id,
        productId: row.product_id,
        productTitle: row.product_title,
        productUrl: row.product_url,
        shopName: row.shop_name,
        price: money(row.price),
        soldCount: toInt(row.sold_count, 0),
        mainImageUrl: row.main_image_url,
        mainImagePath: row.main_image_path,
        skus: parseJson(row.sku_json, []),
        qa: parseJson(row.qa_json, []),
        reportJson: parseJson(row.report_json, {}),
        model: row.model,
        responseId: row.response_id,
        createdAt: row.created_at,
      },
    }
  })
}

function metricFromTerms(terms = [], evidence = '来自单品主图分析报告') {
  const counts = new Map()
  for (const term of terms || []) {
    const text = String(term?.term || term?.keyword || term || '').trim()
    if (!text) continue
    const current = counts.get(text) || { term: text, count: 0, evidence: term?.evidence || evidence }
    current.count += toInt(term?.count, 1)
    if (!current.evidence && term?.evidence) current.evidence = term.evidence
    counts.set(text, current)
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
}

function compactReviewExample(row = {}) {
  const text = `${row.review_text || ''} ${row.follow_review || ''}`.replace(/\s+/g, ' ').trim()
  if (!text) return null
  return {
    text: text.length > 120 ? `${text.slice(0, 120)}...` : text,
    review_time: row.review_time || row.created_at || '',
  }
}

async function loadReviewExamplesForProducts(productIds = [], perProductLimit = 8) {
  const cleanIds = uniqueText(productIds.map((id) => String(id || '').trim()).filter(Boolean), 300)
  if (!cleanIds.length) return new Map()
  try {
    return await withConnection(async (connection) => {
      const [rows] = await connection.query(`
        SELECT product_id, review_text, follow_review, review_time, created_at
        FROM product_review_snapshot
        WHERE product_id IN (?)
          AND (
            (review_text IS NOT NULL AND review_text <> '')
            OR (follow_review IS NOT NULL AND follow_review <> '')
          )
        ORDER BY id DESC
        LIMIT 3000
      `, [cleanIds])
      const grouped = new Map()
      for (const row of rows) {
        const productId = String(row.product_id || '').trim()
        const current = grouped.get(productId) || []
        if (current.length >= perProductLimit) continue
        const example = compactReviewExample(row)
        if (!example) continue
        current.push(example)
        grouped.set(productId, current)
      }
      return grouped
    })
  } catch {
    return new Map()
  }
}

function compactMainImageReport(row) {
  const report = parseJson(row.report_json, {}) || {}
  const skus = parseJson(row.sku_json, []) || []
  const qa = parseJson(row.qa_json, []) || []
  const imageSellingPoints = report.image_selling_points || []
  const titleSellingPoints = report.title_selling_points || []
  const qaNeeds = report.qa_user_needs || []
  const suggestions = report.listing_suggestions || {}
  const audience = report.audience_and_scene || {}
  const sellingPointTerms = [
    ...imageSellingPoints,
    ...titleSellingPoints,
    ...(suggestions.keep_points || []),
  ]
  const demandTerms = [
    ...qaNeeds,
    ...(audience.pain_points || []),
  ]
  return {
    job_id: null,
    product_id: row.product_id,
    product_title: row.product_title,
    category_name: '',
    product_link: row.product_url || (row.product_id ? `https://item.taobao.com/item.htm?id=${row.product_id}` : ''),
    price: money(row.price),
    price_min: money(row.price),
    price_max: money(row.price),
    sold_count: toInt(row.sold_count, 0),
    sales_amount: row.price != null ? money(toNumber(row.price, 0) * toInt(row.sold_count, 0)) : null,
    review_count: 0,
    favorite_count: 0,
    question_count: qa.length,
    skus: skus.slice(0, 20).map((sku) => ({
      sku_id: sku.skuId || sku.sku_id || '',
      sku_title: sku.title || sku.sku_title || '',
      sku_info: sku.info || sku.sku_info || '',
      price: money(sku.price),
      coupon_price: money(sku.coupon_price ?? sku.price),
      stock_qty: toInt(sku.stockQty ?? sku.stock_qty, null),
      sku_image_url: normalizeUrl(sku.imageUrl || sku.sku_image_url),
    })),
    images: row.main_image_url ? [{
      image_type: 'main',
      product_id: row.product_id,
      sku_id: '',
      url: row.main_image_url,
      path: row.main_image_path || '',
      file_name: '',
    }] : [],
    qa_examples: qa.slice(0, 12),
    review_examples: [],
    selling_points: metricFromTerms(sellingPointTerms, '来自主图/标题分析'),
    demands: metricFromTerms(demandTerms, '来自问大家/痛点分析'),
    image_prompts: {
      title_direction: suggestions.main_image_prompt_seed || '',
      main_image_prompt: suggestions.main_image_prompt_seed || '',
      detail_image_prompt: '',
      buyer_show_prompt: '',
    },
    visual_observation: [
      report.visual_layout?.background,
      report.visual_layout?.product_subject,
      report.visual_layout?.composition,
      report.visual_layout?.color_style,
    ].filter(Boolean).join('；'),
    source_report: {
      id: row.id,
      model: row.model,
      created_at: row.created_at,
      ocr_text: report.main_image_ocr_text || [],
      image_selling_points: imageSellingPoints,
      title_selling_points: titleSellingPoints,
      qa_user_needs: qaNeeds,
      audience_and_scene: audience,
      listing_suggestions: suggestions,
      data_gaps: report.data_gaps || [],
    },
  }
}

function compactSnapshotFallbackReport(product = {}, keyword = '') {
  const skuRows = normalizeSkuRows(product.skus || []).slice(0, 20)
  const priceValues = String(product.priceRange || '')
    .split('-')
    .map((item) => money(item))
    .filter((value) => value != null)
  const price = money(product.price ?? priceValues[0])
  const priceMin = priceValues.length ? Math.min(...priceValues) : price
  const priceMax = priceValues.length ? Math.max(...priceValues) : price
  const soldCount = toInt(product.soldCount, 0)
  const salesAmount = money(product.salesAmount) ?? (price != null && soldCount ? money(price * soldCount) : null)
  const title = String(product.title || '').trim()
  const fallbackTerms = uniqueText([
    keyword,
    ...['高蛋白', '靖江', '原切', '厚切', '手撕', '独立包装', '大片', '蜜汁', '黑椒', '休闲零食', '解馋', '办公室']
      .filter((term) => title.includes(term)),
  ], 6).map((term) => ({ term, evidence: '来自商品标题/商品快照兜底' }))

  return {
    job_id: null,
    product_id: product.productId,
    product_title: product.title || product.productId || '',
    category_name: '',
    product_link: product.productUrl || (product.productId ? `https://item.taobao.com/item.htm?id=${product.productId}` : ''),
    price,
    price_min: priceMin,
    price_max: priceMax,
    sold_count: soldCount,
    sales_amount: salesAmount,
    review_count: 0,
    favorite_count: 0,
    question_count: 0,
    skus: skuRows.map((sku) => ({
      sku_id: sku.skuId || sku.sku_id || '',
      sku_title: sku.title || sku.sku_title || '',
      sku_info: sku.info || sku.sku_info || '',
      price: money(sku.price),
      coupon_price: money(sku.coupon_price ?? sku.price),
      stock_qty: toInt(sku.stockQty ?? sku.stock_qty, null),
      sku_image_url: normalizeUrl(sku.imageUrl || sku.sku_image_url),
    })),
    images: product.imageUrl ? [{
      image_type: 'snapshot',
      product_id: product.productId,
      sku_id: '',
      url: product.imageUrl,
      path: '',
      file_name: '',
    }] : [],
    qa_examples: [],
    review_examples: [],
    selling_points: metricFromTerms(fallbackTerms, '来自商品标题/商品快照兜底'),
    demands: [],
    image_prompts: {
      title_direction: '',
      main_image_prompt: '',
      detail_image_prompt: '',
      buyer_show_prompt: '',
    },
    visual_observation: product.imageUrl ? '商品快照有可用图片，但未完成单品主图视觉分析。' : '商品缺少可用主图，未完成单品主图视觉分析。',
    source_report: {
      type: 'product_snapshot_fallback',
      data_gaps: ['未完成单品主图分析入库，仅用于价格、销量、标题、SKU 和竞品覆盖统计。'],
    },
  }
}

function productRepresentativePrice(item) {
  const direct = money(item?.price ?? item?.price_avg ?? item?.price_min ?? item?.price_max)
  if (direct != null) return direct
  const skuPrices = (item?.skus || [])
    .map((sku) => money(sku.coupon_price ?? sku.price))
    .filter((price) => price != null)
  return skuPrices.length ? money(Math.min(...skuPrices)) : null
}

function normalizePriceBandInput(bands = []) {
  return (Array.isArray(bands) ? bands : [])
    .map((band) => {
      if (typeof band === 'string') {
        const text = band.trim()
        const match = text.replace(/[–—－−]/g, '-').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
        if (!match) return null
        const min = money(match[1])
        const max = money(match[2])
        return min == null || max == null ? null : {
          label: text || `${min}-${max}元`,
          price_min: Math.min(min, max),
          price_max: Math.max(min, max),
        }
      }
      const min = money(band?.price_min ?? band?.min ?? band?.low)
      const max = money(band?.price_max ?? band?.max ?? band?.high)
      if (min == null && max == null) return null
      const low = min == null ? max : min
      const high = max == null ? min : max
      return {
        label: String(band?.label || band?.price_band || `${Math.min(low, high)}-${Math.max(low, high)}元`).trim(),
        price_min: Math.min(low, high),
        price_max: Math.max(low, high),
        reason: String(band?.reason || '').trim(),
      }
    })
    .filter(Boolean)
}

function fallbackAiPriceBands(products, desiredCount = 3) {
  const priced = (products || [])
    .map((product) => productRepresentativePrice(product))
    .filter((price) => price != null)
    .sort((a, b) => a - b)
  if (!priced.length) return []
  const count = Math.max(1, Math.min(5, toInt(desiredCount, 3), priced.length))
  const bands = []
  for (let index = 0; index < count; index += 1) {
    const start = Math.floor((index * priced.length) / count)
    const end = Math.max(start, Math.floor(((index + 1) * priced.length) / count) - 1)
    const min = money(priced[start])
    const max = money(priced[end])
    bands.push({
      label: min === max ? `${min}元` : `${min}-${max}元`,
      price_min: min,
      price_max: max,
      reason: '本地按价格分位兜底划分',
    })
  }
  return bands
}

async function generateAiPriceBands(products, { keyword = '', desiredCount = 3 } = {}) {
  const productList = (products || []).map((product) => ({
    product_id: product.product_id,
    title: product.product_title,
    price: productRepresentativePrice(product),
    sold_count: toInt(product.sold_count, 0),
    sales_amount: money(product.sales_amount),
    selling_points: metricTerms(product.selling_points, 5).map((item) => item.term),
    demands: metricTerms(product.demands, 5).map((item) => item.term),
  }))
  const result = await callArkResponses([{
    type: 'input_text',
    text: [
      '你是电商价格带策略分析师。请基于商品价格、销量、标题和已提炼卖点，为这个商品集合划分适合做整体竞品报告的价格区间。',
      `商品关键词：${keyword || '未提供'}`,
      `期望价格区间数量：${Math.max(1, Math.min(6, toInt(desiredCount, 3)))}`,
      '要求：1）价格区间尽量覆盖全部有价格商品；2）区间不要大量重叠；3）结合销量密集区和商品价格断层；4）不要输出 Markdown。',
      '只输出 JSON：{"bands":[{"label":"价格带名称","price_min":0,"price_max":30,"reason":"划分理由"}]}',
      '',
      '商品数据：',
      JSON.stringify(productList, null, 2),
    ].join('\n'),
  }], {
    maxOutputTokens: 8000,
    timeoutMs: ARK_ANALYSIS_TIMEOUT_MS,
  })
  const bands = normalizePriceBandInput(result.json?.bands || result.json?.price_bands || [])
  if (!bands.length) throw new Error('AI 没有返回可用价格区间')
  return { bands, aiResult: result }
}

function groupProductsByPriceBands(products, bands) {
  const cleanBands = normalizePriceBandInput(bands)
  if (!cleanBands.length) {
    return [{ price_band: '全量竞品集合', products, price_min: null, price_max: null }]
  }

  const groups = cleanBands.map((band) => ({
    price_band: band.label,
    price_min: band.price_min,
    price_max: band.price_max,
    reason: band.reason || '',
    products: [],
  }))
  const unmatched = []
  for (const product of products || []) {
    const price = productRepresentativePrice(product)
    const group = price == null
      ? null
      : groups.find((band) => price >= band.price_min && price <= band.price_max)
    if (group) group.products.push(product)
    else unmatched.push(product)
  }
  const nonEmpty = groups.filter((group) => group.products.length)
  if (unmatched.length) {
    nonEmpty.push({ price_band: '未匹配价格', products: unmatched, price_min: null, price_max: null, reason: '商品价格为空或不在已设定区间内' })
  }
  return nonEmpty.length ? nonEmpty : [{ price_band: '全量竞品集合', products, price_min: null, price_max: null }]
}

function buildReportFromProductMainImageReports(keyword, products, costModel, options = {}) {
  const groupingMode = options.priceGroupingMode === 'ai' ? 'ai' : normalizePriceBandInput(options.manualPriceBands).length ? 'manual' : 'manual_required'
  const groupedBands = groupProductsByPriceBands(products, options.manualPriceBands)
  const priceBandReport = groupedBands.map((band) => {
    const items = band.products
    const prices = items.map((item) => productRepresentativePrice(item)).filter((price) => price != null)
    const soldTotal = items.reduce((sum, item) => sum + toInt(item.sold_count, 0), 0)
    const salesTotal = items.reduce((sum, item) => sum + toNumber(item.sales_amount, 0), 0)
    const avg = prices.length ? money(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null
    const qaExamples = items.flatMap((item) => item.qa_examples || []).slice(0, 12)
    const reviewExamples = items.flatMap((item) => item.review_examples || []).slice(0, 24)
    const sellingPoints = metricFromTerms(items.flatMap((item) => item.selling_points || []), '来自单品主图分析报告')
    const demands = metricFromTerms(items.flatMap((item) => item.demands || []), '来自单品主图分析报告')
    return {
      price_band: band.price_band,
      competitor_count: items.length,
      price_min: prices.length ? money(Math.min(...prices)) : money(band.price_min),
      price_max: prices.length ? money(Math.max(...prices)) : money(band.price_max),
      price_avg: avg,
      sold_count_total: soldTotal,
      sales_amount_total: money(salesTotal),
      competitor_links: items.map((item) => ({
        product_id: item.product_id,
        title: item.product_title,
        price: item.price,
        sold_count: item.sold_count,
        sales_amount: item.sales_amount,
        link: item.product_link,
      })),
      display_images: {
        available_images: items.flatMap((item) => item.images || []).slice(0, 40),
        note: band.reason || '该集合展示图来自已经入库的单品主图分析报告。',
      },
      extracted_selling_points: sellingPoints,
      qa_and_review: {
        review_count_total: items.reduce((sum, item) => sum + (item.review_examples || []).length, 0),
        qa_count_total: items.reduce((sum, item) => sum + (item.qa_examples || []).length, 0),
        qa_examples: qaExamples,
        review_examples: reviewExamples,
      },
      extracted_demands: demands,
      profit_simulation: calculateProfit(avg, costModel),
      image_prompts: {
        title_direction: sellingPoints.length ? `围绕${sellingPoints.slice(0, 4).map((item) => item.term).join('、')}组织标题和主图表达` : '',
        main_image_prompt: sellingPoints.length ? `电商主图，突出${sellingPoints.slice(0, 4).map((item) => item.term).join('、')}，画面清晰，主体明确，文字少而准，适合上架转化。` : '',
        detail_image_prompt: demands.length ? `详情页围绕${demands.slice(0, 4).map((item) => item.term).join('、')}展开痛点、证明、场景和保障。` : '',
        buyer_show_prompt: demands.length ? `买家秀场景围绕${demands.slice(0, 4).map((item) => item.term).join('、')}展示真实使用/消费体验。` : '',
      },
      visual_summary: uniqueText(items.map((item) => item.visual_observation), 6).join('；'),
      product_analysis: items.map((item) => ({
        ...item,
        sku_count: item.skus.length,
        sku_price_range: (() => {
          const skuPrices = (item.skus || []).map((sku) => money(sku.coupon_price ?? sku.price)).filter((price) => price != null)
          return skuPrices.length ? priceRangeText(Math.min(...skuPrices), Math.max(...skuPrices)) : ''
        })(),
        qa_count: item.qa_examples.length,
        review_count: item.review_examples.length,
        image_count: item.images.length,
        profit_simulation: calculateProfit(item.price, costModel),
      })),
    }
  })

  return {
    summary: {
      keyword,
      source: 'product_main_image_analysis',
      analysis_engine: 'ark_product_report_summary',
      analysis_model: currentModel(),
      competitor_count: products.length,
      price_band_count: priceBandReport.length,
      price_grouping_mode: groupingMode,
      price_grouping_note: groupingMode === 'ai'
        ? '价格区间由 AI 根据价格、销量和商品分布辅助划分。'
        : groupingMode === 'manual'
          ? '价格区间由用户手动划分。'
          : '整体报告不自动划分价格段，价格段由用户后续手动指定。',
      cost_price: costModel.costPrice,
      cost_model: costModel,
      source_product_report_count: products.length,
    },
    price_band_report: priceBandReport,
    data_gaps: [],
  }
}

function collectOverallReportFromProductReportsContent(report) {
  const payload = {
    summary: report.summary,
    price_band_report: report.price_band_report.map((band) => ({
      price_band: band.price_band,
      competitor_count: band.competitor_count,
      price_min: band.price_min,
      price_max: band.price_max,
      price_avg: band.price_avg,
      sold_count_total: band.sold_count_total,
      sales_amount_total: band.sales_amount_total,
      product_reports: (band.product_analysis || []).slice(0, 80).map((product) => ({
        product_id: product.product_id,
        title: product.product_title,
        price: product.price,
        sold_count: product.sold_count,
        sales_amount: product.sales_amount,
        sku_count: product.sku_count,
        sku_price_range: product.sku_price_range,
        qa_examples: (product.qa_examples || []).slice(0, 8),
        review_examples: (product.review_examples || []).slice(0, 8),
        single_report: product.source_report,
      })),
    })),
  }

  return [{
    type: 'input_text',
    text: [
      '你是资深电商竞品策略分析师。下面输入不是原始图片，而是每个商品已经完成的“单品主图分析报告”、商品数据、问大家、真实评价正文和销售数据。',
      `请生成《${report.summary?.keyword || '产品'}竞品市场分析与 Listing 图片生成策略报告》。`,
      '这份报告的真实目标是：从几十到上百个竞品数据中，找出哪些产品卖得好、为什么卖得好、消费者真正需要什么，最后把结论转化成一套可直接生成 Listing 图片的视觉方案。',
      '整体分析链路必须围绕：销售数据 → 市场需求 → 有效卖点 → 差异化定位 → 图片内容规划 → 生图提示词。',
      '重点回答四件事：1）哪类商品贡献了主要销售额；2）消费者为什么购买，以及为什么给差评；3）本产品应该优先突出哪三个卖点；4）每张 Listing 图片具体生成什么内容。',
      '不要写成完整亚马逊运营报告，不要过多展开认证、后台关键词、完整 Listing 标题五点、大量原始表格或与图片无关的运营建议。',
      '全量商品用于统计：总销量、总销售额、品牌/店铺集中度、卖点覆盖、需求聚类、图片模块规律。正文只展示 5-10 个代表商品：销售额最高、销量最高、高客单代表、差异化代表、与目标产品最接近的商品。',
      '重要：输入中的 price_band_report 是现有兼容字段，可能来自用户手动价格区间，也可能只有一个整体集合。不要强制把报告主体写成价格段报告；价格区间只作为销售结构中的一个分析维度。若用户未手动分段，请保持输入分组，不要自行新增多个价格段。',
      '必须生成 market_core_conclusions.differentiation_directions，且它不是单个卖点总结，而是同一种类下不同竞品商品之间的横向差异化。',
      '差异化方向必须比较：高销量/高销额代表商品 vs 普通/低表现/同质化商品，并回答“相对谁差异化、差异在哪里、证据是什么、图片如何表现”。',
      '每条差异化方向必须同时引用销量/销额/价格等销售证据，并结合评价或问大家反馈；如果评价/问大家样本不足，要明确写“样本不足”，不能编造。',
      '差异化分析优先使用销售表现、商品标题、单品主图识别报告、真实评价正文、问大家和图片表达交叉验证，结论必须服务 Listing 图片生成。',
      '重要限制：SKU 只允许作为价格区间、规格数量和 SKU 数量的背景信息，不得把 sku_title、sku_info、sku_text 当作卖点、用户需求、评论证据或差异化方向。',
      '每条 differentiation_directions 必须输出 opportunity_score，评分包括 sales_validation_score、demand_strength_score、competitor_gap_score、visual_expression_score、overall_score 和 score_reason。',
      '必须输出这些结构化内容：分析范围、市场核心结论、销售额与销量结构、高销量商品卖点分析、消费者市场需求分析、卖点机会矩阵、产品定位与视觉策略、Listing 图片整体规划、单张图片生成方案、最终生图决策卡。',
      '每个卖点要给三个评分：市场需求分、卖点机会分、图片优先级分。只有图片优先级 4-5 分的卖点才建议进入前四张图片。',
      'Listing 图片规划必须包含 1-8 张：白底主图、核心定位图、痛点解决图、核心功能图、使用场景图、细节品质图、参数对比图、多场景/包装/售后图。',
      '每张图片生图提示词必须包含：图片目标、对应市场结论、核心卖点、用户收益、画面内容、文案层级、版式建议、生图重点和完整提示词。文案必须短，避免 AI 图片中文字乱码。',
      '要求：1）不要编造不存在的问大家/评价数据；2）保留输入中的销量、价格、销额等数字；3）输出可被数据库解析的 JSON；4）旧 price_band_report 字段仍需保留以兼容页面，但主体结论放入新报告字段。',
      '只输出 JSON，不要 Markdown，不要解释。',
      '',
      '返回 JSON 结构：',
      JSON.stringify(reportOutputSchema(), null, 2),
      '',
      '已入库单品报告数据：',
      JSON.stringify(payload, null, 2),
    ].join('\n'),
  }]
}

function mergeOverallProductReport(baseReport, aiResult) {
  const aiBands = new Map((aiResult.json?.price_band_report || []).map((band) => [normalizePriceBandKey(band.price_band), band]))
  for (const band of baseReport.price_band_report || []) {
    const aiBand = aiBands.get(normalizePriceBandKey(band.price_band)) || {}
    const sellingPoints = metricList(aiBand.extracted_selling_points)
    const demands = metricList(aiBand.extracted_demands)
    if (sellingPoints.length) band.extracted_selling_points = sellingPoints
    if (demands.length) band.extracted_demands = demands
    band.image_prompts = aiBand.image_prompts || band.image_prompts || {}
    band.visual_summary = aiBand.visual_summary || band.visual_summary || ''
    const productAi = new Map((aiBand.product_analysis || []).map((product) => [String(product.product_id || ''), product]))
    for (const product of band.product_analysis || []) {
      const aiProduct = productAi.get(String(product.product_id || '')) || {}
      const productSellingPoints = metricList(aiProduct.selling_points)
      const productDemands = metricList(aiProduct.demands)
      if (productSellingPoints.length) product.selling_points = productSellingPoints
      if (productDemands.length) product.demands = productDemands
      product.image_prompts = aiProduct.image_prompts || product.image_prompts || band.image_prompts || {}
      product.visual_observation = aiProduct.visual_observation || product.visual_observation || ''
    }
  }
  baseReport.summary.analysis_model = aiResult.model
  baseReport.summary.ark_response_id = aiResult.responseId
  baseReport.summary.ai_usage = addUsage(emptyUsage(), aiResult.usage)
  baseReport.generated_at = new Date().toISOString()
  mergeStrategySections(baseReport, aiResult.json || {})
  return baseReport
}

export async function generateOverallReportFromProductMainImageReports({
  collectionId = '',
  keyword,
  limit,
  priceGroupingMode = 'manual',
  manualPriceBands = [],
  aiPriceBandCount = 3,
  costPrice,
  shippingCost,
  packagingCost,
  laborCost,
  platformFeeRate,
  adFeeRate,
  targetMargin,
  saveToDb,
  skippedProducts = [],
  onProgress,
}) {
  const cleanKeyword = String(keyword || '').trim()
  onProgress?.({ stage: 'load', message: '正在读取该集合下已入库的单品主图分析报告', current: 0, total: 1 })
  const view = await getAnalysisProductsView({ id: collectionId, keyword: cleanKeyword })
  const productIds = (view.products || []).map((product) => String(product.productId || '').trim()).filter(Boolean)
  if (!productIds.length) throw new Error('该集合下没有商品数据，无法生成整体报告')

  const safeLimit = Math.max(1, Math.min(200, toInt(limit, productIds.length || 120)))
  const selectedProductIds = productIds.slice(0, safeLimit)
  const rows = await withConnection(async (connection) => {
    await ensureMarketSchema(connection)
    const [result] = await connection.query(`
      SELECT a.*
      FROM product_main_image_analysis a
      JOIN (
        SELECT product_id, MAX(id) AS id
        FROM product_main_image_analysis
        WHERE product_id IN (?)
        GROUP BY product_id
      ) latest ON latest.id = a.id
      ORDER BY FIELD(a.product_id, ${selectedProductIds.map(() => '?').join(',')})
    `, [selectedProductIds, ...selectedProductIds])
    return result
  })
  if (!rows.length) {
    throw new Error('这一批商品还没有“主图分析入库”的单品报告。请先点“查看全部商品”，对商品做主图分析入库，再生成整体报告。')
  }

  const costModel = {
    costPrice: costPrice == null || costPrice === '' ? null : toNumber(costPrice, null),
    shippingCost: toNumber(shippingCost, 0),
    packagingCost: toNumber(packagingCost, 0),
    laborCost: toNumber(laborCost, 0),
    platformFeeRate: toNumber(platformFeeRate, 0),
    adFeeRate: toNumber(adFeeRate, 0),
    targetMargin: toNumber(targetMargin, 0.3),
  }

  const reviewExamplesByProduct = await loadReviewExamplesForProducts(selectedProductIds, 8)
  const analyzedProductIds = new Set(rows.map((row) => String(row.product_id || '').trim()).filter(Boolean))
  const productOverviewById = new Map((view.products || []).map((product) => [String(product.productId || '').trim(), product]))
  const analyzedProducts = rows.map((row) => {
    const product = compactMainImageReport(row)
    return {
      ...product,
      review_examples: reviewExamplesByProduct.get(String(product.product_id || '')) || [],
    }
  })
  const fallbackProducts = selectedProductIds
    .filter((productId) => !analyzedProductIds.has(String(productId)))
    .map((productId) => productOverviewById.get(String(productId)))
    .filter(Boolean)
    .map((product) => {
      const fallbackProduct = compactSnapshotFallbackReport(product, cleanKeyword || view.collection?.keyword || '')
      return {
        ...fallbackProduct,
        review_examples: reviewExamplesByProduct.get(String(fallbackProduct.product_id || '')) || [],
      }
    })
  const products = [...analyzedProducts, ...fallbackProducts]
  let selectedPriceBands = normalizePriceBandInput(manualPriceBands)
  let priceBandAiResult = null
  const cleanGroupingMode = priceGroupingMode === 'ai' ? 'ai' : 'manual'
  if (cleanGroupingMode === 'ai') {
    onProgress?.({ stage: 'price_grouping', message: '正在让 AI 根据价格和销量划分价格区间', current: 1, total: 3 })
    try {
      const aiBandResult = await generateAiPriceBands(products, {
        keyword: cleanKeyword || view.collection?.keyword || '整体报告',
        desiredCount: aiPriceBandCount,
      })
      selectedPriceBands = aiBandResult.bands
      priceBandAiResult = aiBandResult.aiResult
    } catch (error) {
      selectedPriceBands = fallbackAiPriceBands(products, aiPriceBandCount)
      if (!selectedPriceBands.length) selectedPriceBands = []
      onProgress?.({
        stage: 'price_grouping',
        message: 'AI 价格区间划分返回格式异常，已改用本地价格分位继续生成',
        current: 1,
        total: 1,
      })
      priceBandAiResult = {
        model: currentModel(),
        responseId: '',
        usage: null,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const baseReport = buildReportFromProductMainImageReports(cleanKeyword || view.collection?.keyword || '整体报告', products, costModel, {
    priceGroupingMode: cleanGroupingMode,
    manualPriceBands: selectedPriceBands,
  })
  if (priceBandAiResult) {
    baseReport.summary.price_grouping_model = priceBandAiResult.model
    baseReport.summary.price_grouping_response_id = priceBandAiResult.responseId
    baseReport.summary.price_grouping_usage = priceBandAiResult.usage || null
    if (priceBandAiResult.error) baseReport.data_gaps.push(`AI 价格区间划分失败，已使用本地价格分位兜底：${priceBandAiResult.error}`)
  }
  baseReport.data_gaps.push(
    fallbackProducts.length
      ? `本报告覆盖 ${products.length}/${selectedProductIds.length} 个商品，其中 ${rows.length} 个来自单品主图分析报告，${fallbackProducts.length} 个缺失主图分析的商品已用商品快照/SKU/销量兜底进入统计。`
      : `本报告由 ${rows.length}/${selectedProductIds.length} 个已入库单品主图分析报告汇总生成。`,
  )
  const normalizedSkippedProducts = safeArray(skippedProducts)
    .map((item) => ({
      product_id: String(item?.productId || item?.product_id || '').trim(),
      title: String(item?.title || item?.product_title || '').trim(),
      error: String(item?.error || '').trim(),
    }))
    .filter((item) => item.product_id || item.title || item.error)
  if (normalizedSkippedProducts.length) {
    const skippedSummary = normalizedSkippedProducts
      .slice(0, 8)
      .map((item) => `${item.title || item.product_id || '未知商品'}${item.error ? `（${item.error}）` : ''}`)
      .join('；')
    baseReport.data_gaps.push(`自动补齐单品主图分析时跳过 ${normalizedSkippedProducts.length} 个商品：${skippedSummary}${normalizedSkippedProducts.length > 8 ? '；等' : ''}`)
    baseReport.skipped_products = normalizedSkippedProducts
  }

  onProgress?.({ stage: 'compose', message: `正在按 ${baseReport.price_band_report.length} 个价格区间汇总 ${rows.length} 个单品报告`, current: 2, total: 3 })
  let reportJson
  try {
    const aiResult = await callArkResponses(collectOverallReportFromProductReportsContent(baseReport), {
      maxOutputTokens: 16000,
      timeoutMs: ARK_ANALYSIS_TIMEOUT_MS * 2,
    })
    reportJson = mergeOverallProductReport(baseReport, aiResult)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    baseReport.data_gaps.push(`整体报告 AI JSON 解析失败，已使用已入库单品报告生成本地结构化兜底报告：${message}`)
    onProgress?.({
      stage: 'compose',
      message: 'AI 整体报告返回格式异常，已使用已入库单品报告生成兜底报告',
      current: 3,
      total: 3,
    })
    reportJson = mergeOverallProductReport(baseReport, {
      json: buildStrategyReportFallback(baseReport),
      responseId: '',
      model: `${currentModel()} + local_fallback`,
      usage: null,
    })
    reportJson.summary.ai_report_error = message
  }
  const markdown = renderMarkdown(reportJson)

  onProgress?.({ stage: 'persist', message: saveToDb === false ? '正在整理整体报告结果' : '正在把整体报告写入数据库', current: 3, total: 3 })
  const persistStats = saveToDb === false ? null : await persistMarketReport(reportJson)

  return {
    ok: true,
    hasReport: true,
    reportJson,
    markdown,
    report: {
      keyword: reportJson.summary.keyword,
      limit: safeLimit,
      costPrice: costModel.costPrice,
      shippingCost: costModel.shippingCost,
      packagingCost: costModel.packagingCost,
      laborCost: costModel.laborCost,
      platformFeeRate: costModel.platformFeeRate,
      adFeeRate: costModel.adFeeRate,
      targetMargin: costModel.targetMargin,
      saveToDb: saveToDb !== false,
      generatedAt: new Date().toISOString(),
      analysisEngine: 'ark_product_report_summary',
      model: reportJson.summary.analysis_model,
      persistStats,
      sourceProductReportCount: rows.length,
      fallbackProductCount: fallbackProducts.length,
      sourceProductCount: selectedProductIds.length,
      priceGroupingMode: reportJson.summary.price_grouping_mode,
      priceBandCount: reportJson.summary.price_band_count,
    },
  }
}

export async function generateAiMarketReport({
  keyword,
  limit,
  costPrice,
  shippingCost,
  packagingCost,
  laborCost,
  platformFeeRate,
  adFeeRate,
  targetMargin,
  saveToDb,
  targetPriceBand,
  onProgress,
}) {
  onProgress?.({ stage: 'load', message: '正在读取数据库竞品、SKU、问大家和图片数据', current: 0, total: 1 })
  const products = await fetchCompetitorDataset(keyword, limit)
  if (!products.length) {
    throw new Error(`数据库里没有找到“${keyword}”相关竞品。请先下载并入库该商品数据。`)
  }

  const costModel = {
    costPrice: costPrice == null || costPrice === '' ? null : toNumber(costPrice, null),
    shippingCost: toNumber(shippingCost, 0),
    packagingCost: toNumber(packagingCost, 0),
    laborCost: toNumber(laborCost, 0),
    platformFeeRate: toNumber(platformFeeRate, 0),
    adFeeRate: toNumber(adFeeRate, 0),
    targetMargin: toNumber(targetMargin, 0.3),
  }
  const baseReport = buildNumericReport(keyword, products, costModel)
  const scopedReport = filterReportToPriceBand(baseReport, targetPriceBand)
  const aiResult = await callArkVision(scopedReport, onProgress)
  const reportJson = mergeAiReport(scopedReport, aiResult)
  const markdown = renderMarkdown(reportJson)
  onProgress?.({ stage: 'persist', message: saveToDb === false ? '正在整理报告结果' : '正在把分析报告写入数据库', current: 1, total: 1 })
  const persistStats = saveToDb === false ? null : await persistMarketReport(reportJson)

  return {
    ok: true,
    hasReport: true,
    reportJson,
    markdown,
    report: {
      keyword,
      limit,
      costPrice: costModel.costPrice,
      shippingCost: costModel.shippingCost,
      packagingCost: costModel.packagingCost,
      laborCost: costModel.laborCost,
      platformFeeRate: costModel.platformFeeRate,
      adFeeRate: costModel.adFeeRate,
      targetMargin: costModel.targetMargin,
      saveToDb: saveToDb !== false,
      targetPriceBand: targetPriceBand || '',
      generatedAt: new Date().toISOString(),
      analysisEngine: 'ark_vision',
      model: reportJson.summary.analysis_model,
      persistStats,
    },
  }
}
