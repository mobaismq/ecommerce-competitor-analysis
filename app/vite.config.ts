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
const REPORT_STATE_FILE = path.resolve(__dirname, '.analysis-report-state.json')

function localRpaApi() {
  let currentRun = readRunState()
  let currentReport = readReportState()
  let currentReportJob = null

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
    steps.push(
      {
        key: 'overall_image_report',
        label: '整体图片报告生成',
        status: 'pending',
        current: 0,
        total: 1,
        ...reportStep,
      },
    )
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
          const importFailures: Array<{ productId: string; title: string; error: string }> = []

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
              const message = error instanceof Error ? error.message : String(error || '主图分析失败')
              importFailures.push({
                productId: String(product.productId || ''),
                title: String(product.title || ''),
                error: message,
              })
            }

            updateReportJobProgress({
              stage: 'product_main_image_import',
              message: importFailures.length
                ? `单品主图分析入库 ${index + 1}/${pendingProducts.length}，成功 ${importedCount}/${selectedProducts.length}，已跳过 ${importFailures.length} 个失败商品`
                : `单品主图分析入库 ${index + 1}/${pendingProducts.length}，成功 ${importedCount}/${selectedProducts.length}`,
              current: index + 1,
              total: pendingProducts.length + 1,
              warnings: importFailures,
              steps: overallReportSteps(
                {
                  status: 'running',
                  current: importedCount,
                  total: selectedProducts.length,
                  message: importFailures.length
                    ? `已跳过 ${importFailures.length} 个失败商品，继续处理剩余商品`
                    : '正在自动补齐未入库商品',
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
          }

          if (importedCount <= 0) {
            const reasonCounts = new Map<string, number>()
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
              steps: overallReportSteps(
                {
                  status: 'completed',
                  current: importedCount,
                  total: selectedProducts.length,
                  message: importFailures.length
                    ? `可用 ${importedCount}/${selectedProducts.length} 个，跳过 ${importFailures.length} 个失败商品`
                    : pendingProducts.length
                      ? `已自动补齐 ${pendingProducts.length} 个商品`
                      : '全部已入库',
                },
                { status: 'pending', current: 0, total: 1, message: '等待价格区间划分完成' },
                {
                  status: 'running',
                  current: 0,
                  total: 1,
                  message: request.priceGroupingMode === 'ai'
                    ? `AI 正在划分约 ${request.aiPriceBandCount} 个价格区间`
                    : request.manualPriceBands?.length
                      ? `正在应用 ${request.manualPriceBands.length} 个手动价格区间`
                      : '未设置手动价格区间，将按全量集合汇总',
                },
              ),
            })

            payload = await generateOverallReportFromProductMainImageReports({
              ...request,
              skippedProducts: importFailures,
              onProgress(progress) {
                const groupingRunning = progress.stage === 'price_grouping'
                const groupingDone = ['compose', 'persist'].includes(progress.stage || '')
                updateReportJobProgress({
                  ...progress,
                  stage: groupingRunning ? 'price_grouping' : 'overall_image_report',
                  message: progress.message || '正在生成整体图片报告',
                  current: pendingProducts.length + (progress.current || 0),
                  total: pendingProducts.length + Math.max(1, progress.total || 1),
                  warnings: importFailures,
                  steps: overallReportSteps(
                    {
                      status: 'completed',
                      current: importedCount,
                      total: selectedProducts.length,
                      message: importFailures.length
                        ? `可用 ${importedCount}/${selectedProducts.length} 个，跳过 ${importFailures.length} 个失败商品`
                        : pendingProducts.length
                          ? `已自动补齐 ${pendingProducts.length} 个商品`
                          : '全部已入库',
                    },
                    {
                      status: groupingRunning ? 'running' : groupingDone ? 'completed' : 'pending',
                      current: groupingRunning || groupingDone ? 1 : 0,
                      total: 1,
                      message: groupingRunning
                        ? progress.message || '正在划分价格区间'
                        : groupingDone
                          ? '价格区间已确认'
                          : '等待价格区间划分',
                    },
                    {
                      status: groupingRunning ? 'pending' : 'running',
                      current: groupingRunning ? 0 : progress.current || 0,
                      total: Math.max(1, progress.total || 1),
                      message: groupingRunning ? '等待价格区间划分完成' : progress.message || '正在生成整体图片报告',
                    },
                  ),
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
        // 报告生成完成后，后台自动跑 AI 全主图分析并缓存，之后打开报告页总结卖点直接可用
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

  return {
    name: 'local-rpa-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/rpa/') && !req.url?.startsWith('/api/report/') && !req.url?.startsWith('/api/product-sets/') && !req.url?.startsWith('/api/taobao/')) return next()

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
                image: body.image,
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

            const args = [
              RPA_SCRIPT,
              '--product-name', productName,
              '--top-n', String(topN),
              '--search-pages', String(searchPages),
              '--background',
            ]
            if (importMysql) args.push('--import-mysql')
            args.push('--speed-profile', speedProfile)
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
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
