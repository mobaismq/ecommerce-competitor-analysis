import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { spawn } from 'child_process'
import { analyzeProductMainImageAndSave, deleteGeneratedMainImages, generateAiMarketReport, generateOverallReportFromProductMainImageReports, getAnalysisProductsView, getAnalysisReportView, getMainImageAiReport, getOpenAiSettings, getProductMainImageAnalysis, getSuiteMainImageDescriptions, listAnalysisReportRows, listGeneratedMainImages, listProductOptions, listSuitePriceBands, listSuiteProducts, previewMarketPriceBands, readLatestMarketReport, saveGeneratedMainImages, saveOpenAiSettings, testArkResponsesConnection } from './src/server/aiMarketAnalysis.js'
import { generateProductSetImage } from './src/server/arkImageGeneration.js'
import { expandProductSetPrompts, extractProductSetImageText, streamProductSetInformation } from './src/server/mainImagePromptExpansion.js'
import { fetchTaobaoCategories, fetchTaobaoShops, getTaobaoConfigStatus } from './src/server/taobaoTopClient.js'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

const RPA_SCRIPT = path.resolve(process.cwd(), '../skills/diantoushi-product-research/scripts/run_diantoushi_rpa.py')
const STATE_FILE = path.resolve(__dirname, '.rpa-run-state.json')
const BACKEND_TARGET = process.env.BACKEND_TARGET || process.env.VITE_BACKEND_TARGET || 'http://127.0.0.1:8787'
const ENABLE_RPA_API = process.env.ENABLE_RPA_API !== 'false' && process.env.NODE_ENV !== 'production'

function localRpaApi() {
  let currentRun = readRunState()

  function readRunState() {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    } catch {
      return null
    }
  }

  function writeRunState(run) {
    currentRun = run
    fs.writeFileSync(STATE_FILE, JSON.stringify(run, null, 2))
  }

  function sendJson(res, status, payload) {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload, null, 2))
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

  function isPidAlive(pid) {
    if (!pid) return false
    try {
      process.kill(Number(pid), 0)
      return true
    } catch {
      return false
    }
  }

  function readLogTail(logFile, maxBytes = 160000) {
    if (!logFile || !fs.existsSync(logFile)) return ''
    const text = fs.readFileSync(logFile, 'utf8')
    return text.slice(-maxBytes)
  }

  function findBatchSummaryFile(run) {
    if (!run) return ''
    const directPaths = [
      run.batch_summary_file,
      run.batchSummaryFile,
      run.run_dir ? path.join(run.run_dir, 'batch_summary.json') : '',
    ].filter(Boolean)
    for (const filePath of directPaths) {
      if (fs.existsSync(filePath)) return filePath
    }

    const runDirName = path.basename(String(run.run_dir || ''))
    const timeMatch = runDirName.match(/(\d{8}-\d{6})$/)
    const timestamp = timeMatch?.[1] || ''
    const productName = String(run.productName || '').trim()
    const root = path.resolve(__dirname, '..', 'rpa_runs')
    if (!fs.existsSync(root)) return ''
    for (const name of fs.readdirSync(root)) {
      if (productName && !name.includes(productName)) continue
      if (timestamp && !name.includes(timestamp)) continue
      const candidate = path.join(root, name, 'batch_summary.json')
      if (fs.existsSync(candidate)) return candidate
    }
    return ''
  }

  function readBatchSummary(run) {
    const summaryFile = findBatchSummaryFile(run)
    if (!summaryFile) return null
    try {
      return { file: summaryFile, summary: JSON.parse(fs.readFileSync(summaryFile, 'utf8')) }
    } catch {
      return null
    }
  }

  function progressFromBatchSummary(batchSummary, run) {
    const summary = batchSummary?.summary
    if (!summary) return null
    const counted = Number(summary.success_count || 0) + Number(summary.failed_count || 0)
    const current = Number(summary.results?.length ?? (counted > 0 ? counted : summary.selected_count) ?? 0)
    const total = Number(summary.top_n ?? run?.topN ?? summary.selected_count ?? current)
    const safeCurrent = Number.isFinite(current) ? current : 0
    const safeTotal = Number.isFinite(total) && total > 0 ? total : safeCurrent
    return {
      current: safeCurrent,
      total: safeTotal,
      percent: safeTotal > 0 ? Math.min(100, Math.round((safeCurrent / safeTotal) * 100)) : 0,
      label: '下载完成',
      detail: `已完成 ${safeCurrent}/${safeTotal} 个商品`,
      summaryFile: batchSummary.file,
      successCount: Number(summary.success_count || 0),
      failedCount: Number(summary.failed_count || 0),
      mysqlImportedCount: Number(summary.mysql_imported_count || 0),
    }
  }

  function parseJsonFromOutput(text) {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end < start) return null
    return JSON.parse(text.slice(start, end + 1))
  }

  function statusPayload() {
    if (!currentRun) currentRun = readRunState()
    if (!currentRun) return { ok: true, hasRun: false }
    const running = isPidAlive(currentRun.pid)
    const logTail = readLogTail(currentRun.log_file)
    const batchSummary = readBatchSummary(currentRun)
    const summaryProgress = progressFromBatchSummary(batchSummary, currentRun)
    const terminalStatus = running
      ? 'running'
      : logTail.includes('\n=== failed')
        ? 'failed'
        : summaryProgress || logTail.includes('\n=== batch summary') || logTail.includes('\n=== summary')
          ? 'completed'
          : 'stopped'
    return {
      ok: true,
      hasRun: true,
      running,
      status: terminalStatus,
      run: currentRun,
      progress: summaryProgress,
      logTail,
    }
  }

  return {
    name: 'local-rpa-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/rpa/')) return next()
        if (!ENABLE_RPA_API) return sendJson(res, 404, { ok: false, error: 'RPA API 已关闭' })

        try {
          if (req.method === 'GET' && req.url.startsWith('/api/taobao/status')) {
            return sendJson(res, 200, { ok: true, ...getTaobaoConfigStatus() })
          }

          if (req.method === 'GET' && req.url.startsWith('/api/taobao/shops')) {
            try {
              const shops = await fetchTaobaoShops()
              return sendJson(res, 200, { ok: true, shops })
            } catch (error) {
              return sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) })
            }
          }

          if (req.method === 'GET' && req.url.startsWith('/api/taobao/categories')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const parentCid = Number(requestUrl.searchParams.get('parent_cid') || 0)
            try {
              const categories = await fetchTaobaoCategories(parentCid)
              return sendJson(res, 200, { ok: true, categories })
            } catch (error) {
              return sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) })
            }
          }

          if (req.method === 'GET' && req.url.startsWith('/api/product-sets/products')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const query = (requestUrl.searchParams.get('q') || '').trim()
            const payload = await listSuiteProducts(query)
            return sendJson(res, 200, payload)
          }

          if (req.method === 'GET' && req.url.startsWith('/api/product-sets/price-bands')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const keyword = (requestUrl.searchParams.get('keyword') || '').trim()
            const payload = await listSuitePriceBands(keyword)
            return sendJson(res, 200, payload)
          }

          if (req.method === 'GET' && req.url.startsWith('/api/product-sets/main-image-descriptions')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const keyword = (requestUrl.searchParams.get('keyword') || '').trim()
            const priceBand = (requestUrl.searchParams.get('priceBand') || '').trim()
            const runId = (requestUrl.searchParams.get('runId') || '').trim()
            const payload = await getSuiteMainImageDescriptions({ keyword, priceBand, runId })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'POST' && req.url.startsWith('/api/product-sets/generate-image')) {
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

          if (req.method === 'POST' && req.url.startsWith('/api/product-sets/extract-image-text')) {
            const body = await readBody(req)
            const payload = await extractProductSetImageText({
              image: body.image,
            })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'POST' && req.url.startsWith('/api/product-sets/generated-images/delete')) {
            const body = await readBody(req)
            const payload = await deleteGeneratedMainImages({ ids: Array.isArray(body?.ids) ? body.ids : [] })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'POST' && req.url.startsWith('/api/product-sets/generated-images')) {
            const body = await readBody(req)
            const payload = await saveGeneratedMainImages(body || {})
            return sendJson(res, 200, payload)
          }

          if (req.method === 'GET' && req.url.startsWith('/api/product-sets/generated-images')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const payload = await listGeneratedMainImages({
              productName: (requestUrl.searchParams.get('productName') || '').trim(),
            })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'POST' && req.url.startsWith('/api/product-sets/expand-prompts-stream')) {
            const body = await readBody(req)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache, no-transform')
            res.setHeader('Connection', 'keep-alive')
            const writeEvent = (event: unknown) => {
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

          if (req.method === 'POST' && req.url.startsWith('/api/product-sets/expand-prompts')) {
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

          if (req.method === 'GET' && req.url.startsWith('/api/report/openai-settings')) {
            return sendJson(res, 200, getOpenAiSettings())
          }

          if (req.method === 'POST' && req.url.startsWith('/api/report/openai-settings/test')) {
            const body = await readBody(req)
            const payload = await testArkResponsesConnection({
              imageUrl: body.imageUrl,
              text: body.text,
            })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'POST' && req.url.startsWith('/api/report/openai-settings')) {
            const body = await readBody(req)
            const payload = saveOpenAiSettings({
              apiKey: body.apiKey,
              model: body.model,
            })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'GET' && req.url.startsWith('/api/report/analysis-list')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const payload = await listAnalysisReportRows({
              keyword: (requestUrl.searchParams.get('keyword') || '').trim(),
              startTime: (requestUrl.searchParams.get('startTime') || '').trim(),
              endTime: (requestUrl.searchParams.get('endTime') || '').trim(),
              status: (requestUrl.searchParams.get('status') || '').trim(),
            })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'GET' && req.url.startsWith('/api/report/analysis-view')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const payload = await getAnalysisReportView({
              id: (requestUrl.searchParams.get('id') || '').trim(),
              keyword: (requestUrl.searchParams.get('keyword') || '').trim(),
            })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'GET' && req.url.startsWith('/api/report/main-image-ai-report')) {
            const requestUrl = new URL(req.url, 'http://localhost')
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

          if (req.method === 'GET' && req.url.startsWith('/api/report/products-view')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const payload = await getAnalysisProductsView({
              id: (requestUrl.searchParams.get('id') || '').trim(),
              keyword: (requestUrl.searchParams.get('keyword') || '').trim(),
            })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'POST' && req.url.startsWith('/api/report/product-main-image-analysis')) {
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

          if (req.method === 'GET' && req.url.startsWith('/api/report/product-main-image-analysis')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const payload = await getProductMainImageAnalysis({
              id: (requestUrl.searchParams.get('id') || '').trim(),
              productId: (requestUrl.searchParams.get('productId') || '').trim(),
            })
            return sendJson(res, 200, payload)
          }

          if (req.method === 'GET' && req.url.startsWith('/api/report/products')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const query = (requestUrl.searchParams.get('q') || '').trim()
            const payload = await listProductOptions(query)
            return sendJson(res, 200, payload)
          }

          if (req.method === 'GET' && req.url.startsWith('/api/report/price-bands-preview')) {
            const requestUrl = new URL(req.url, 'http://localhost')
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

          if (req.method === 'GET' && req.url.startsWith('/api/report/latest')) {
            const requestUrl = new URL(req.url, 'http://localhost')
            const keyword = (requestUrl.searchParams.get('keyword') || '').trim()
            if (!currentReport) currentReport = readReportState()
            const latestReport = keyword ? await readLatestMarketReport(keyword) : (currentReport?.reportJson ? currentReport : await readLatestMarketReport())
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

          if (req.method === 'GET' && req.url.startsWith('/api/report/generate-status')) {
            return sendJson(res, 200, reportJobPayload())
          }

          if (req.method === 'POST' && req.url.startsWith('/api/report/generate')) {
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

          if (req.method === 'GET' && req.url.startsWith('/api/rpa/status')) {
            return sendJson(res, 200, statusPayload())
          }

          if (req.method === 'POST' && req.url.startsWith('/api/rpa/stop')) {
            if (!currentRun) currentRun = readRunState()
            if (currentRun?.pid && isPidAlive(currentRun.pid)) {
              process.kill(Number(currentRun.pid), 'SIGTERM')
            }
            return sendJson(res, 200, statusPayload())
          }

          if (req.method === 'POST' && req.url.startsWith('/api/rpa/start')) {
            if (!fs.existsSync(RPA_SCRIPT)) {
              return sendJson(res, 500, { ok: false, error: `脚本不存在：${RPA_SCRIPT}` })
            }

            if (currentRun?.pid && isPidAlive(currentRun.pid)) {
              return sendJson(res, 409, { ok: false, error: '已有下载任务正在运行', current: statusPayload() })
            }

            const body = await readBody(req)
            const productName = String(body.productName || '').trim()
            if (!productName) {
              return sendJson(res, 400, { ok: false, error: '请输入商品名称' })
            }

            const topN = Number(body.topN || 100)
            const searchPages = Number(body.searchPages || 8)
            const minPrice = body.minPrice === '' || body.minPrice == null ? null : Number(body.minPrice)
            const maxPrice = body.maxPrice === '' || body.maxPrice == null ? null : Number(body.maxPrice)
            const importMysql = body.importMysql !== false
            const speedProfile = ['conservative', 'balanced', 'fast'].includes(String(body.speedProfile || ''))
              ? String(body.speedProfile)
              : 'fast'
            const skipProductImages = body.skipProductImages == null
              ? speedProfile === 'fast'
              : body.skipProductImages !== false

            const args = [
              RPA_SCRIPT,
              '--product-name', productName,
              '--top-n', String(topN),
              '--search-pages', String(searchPages),
              '--background',
            ]
            if (importMysql) args.push('--import-mysql')
            args.push('--speed-profile', speedProfile)
            if (skipProductImages) args.push('--skip-product-images')
            if (minPrice != null && Number.isFinite(minPrice)) args.push('--min-price', String(minPrice))
            if (maxPrice != null && Number.isFinite(maxPrice)) args.push('--max-price', String(maxPrice))

            const child = spawn('python3', args, {
              cwd: __dirname,
              env: {
                ...process.env,
                MYSQL_HOST: process.env.MYSQL_HOST || '127.0.0.1',
                MYSQL_PORT: process.env.MYSQL_PORT || '3306',
                MYSQL_USER: process.env.MYSQL_USER || 'root',
                MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
                MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'sys',
              },
            })

            let stdout = ''
            let stderr = ''
            child.stdout.on('data', (chunk) => { stdout += String(chunk) })
            child.stderr.on('data', (chunk) => { stderr += String(chunk) })
            child.on('close', (code) => {
              if (code !== 0) {
                return sendJson(res, 500, { ok: false, error: stderr || stdout || `启动失败，退出码 ${code}` })
              }
              try {
                const run = parseJsonFromOutput(stdout)
                if (!run?.pid) throw new Error('未解析到后台任务 PID')
                writeRunState({
                  ...run,
                  productName,
                  topN,
                  searchPages,
                  minPrice,
                  maxPrice,
                  importMysql,
                  skipProductImages,
                  analyzeAfterImport: false,
                  analysisCostPrice: null,
                  speedProfile,
                  startedAt: new Date().toISOString(),
                })
                return sendJson(res, 200, statusPayload())
              } catch (error) {
                return sendJson(res, 500, { ok: false, error: String(error), stdout, stderr })
              }
            })
            return
          }

          return sendJson(res, 404, { ok: false, error: 'API 不存在' })
        } catch (error) {
          return sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    localRpaApi(),
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used - do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/auth': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/api/report': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/api/product-sets': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      '/api/taobao': {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
