import type { ProductSkillReport } from './report-skill'

export interface ReportChartProduct {
  productId: string
  title: string | null
  shopName: string | null
  price: number | null
  sold?: number | null
  rating?: number | null
}
export type CompetitorSort = 'sold' | 'price-asc' | 'price-desc' | 'collected'
export const COMPETITOR_SORT_LABELS: Record<CompetitorSort, string> = { sold: '采集销量 ↓', 'price-asc': '价格 ↑', 'price-desc': '价格 ↓', collected: '采集顺序' }

export function chartNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}
export const chartPrice = (value: number | null | undefined) => chartNumber(value) == null ? '—' : `¥${value!.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
export const chartCount = (value: number | null | undefined) => chartNumber(value) == null ? '—' : value!.toLocaleString('zh-CN', { maximumFractionDigits: 2 })

export function defaultCompetitorSort(products: readonly ReportChartProduct[]): CompetitorSort {
  return products.some((item) => chartNumber(item.sold) != null) ? 'sold' : 'collected'
}

/** Rank only this batch's loaded snapshots; missing measurements never become zero. */
export function rankCompetitors(products: readonly ReportChartProduct[], sort = defaultCompetitorSort(products)): ReportChartProduct[] {
  const seen = new Set<string>()
  const rows = products.filter((item) => {
    if (!item.productId || seen.has(item.productId)) return false
    seen.add(item.productId)
    return true
  })
  if (sort === 'collected') return rows.slice(0, 10)
  const field = sort === 'sold' ? 'sold' : 'price'
  const direction = sort === 'price-asc' ? 1 : -1
  return rows.sort((a, b) => {
    const left = chartNumber(a[field]), right = chartNumber(b[field])
    if (left == null || right == null) return left == null ? right == null ? 0 : 1 : -1
    return direction * (left - right)
  }).slice(0, 10)
}

export interface PositivePoint {
  point: string
  count: number
  productCount: number
  examples: Array<{ productId: string; reviewId: string; quote: string }>
}

/** Count matching stored analysis labels. No inferred synonym merging or whole-market good-review rate. */
export function positivePointRanking(reports: readonly ProductSkillReport[]) {
  const analysed = new Set<string>(), positive = new Set<string>()
  const groups = new Map<string, { point: string; reviews: Set<string>; products: Set<string>; examples: PositivePoint['examples'] }>()
  const uniqueReports = [...new Map(reports.map((report) => [report.productId, report])).values()]
  for (const report of uniqueReports) for (const review of report.reviewAnalysis) {
    const quote = review.quote.trim()
    if (!quote) continue
    const reviewKey = `${report.productId}:${review.reviewId.trim() || quote}`
    analysed.add(reviewKey)
    if (review.sentiment !== 'positive') continue
    positive.add(reviewKey)
    const point = review.point.trim()
    if (!point) continue
    const key = point.normalize('NFKC').replace(/[\s，,。；;：:、]/g, '').toLocaleLowerCase()
    let group = groups.get(key)
    if (!group) { group = { point, reviews: new Set(), products: new Set(), examples: [] }; groups.set(key, group) }
    if (group.reviews.has(reviewKey)) continue
    group.reviews.add(reviewKey)
    group.products.add(report.productId)
    if (group.examples.length < 3) group.examples.push({ productId: report.productId, reviewId: review.reviewId, quote })
  }
  const points = [...groups.values()].map((group) => ({ point: group.point, count: group.reviews.size, productCount: group.products.size, examples: group.examples }))
    .sort((a, b) => b.count - a.count || b.productCount - a.productCount || a.point.localeCompare(b.point, 'zh-CN')).slice(0, 3)
  return { points, analysedCount: analysed.size, positiveCount: positive.size, productCount: uniqueReports.length }
}

export function fallbackChartProducts(reports: readonly ProductSkillReport[]): ReportChartProduct[] {
  return reports.map((report) => ({ productId: report.productId, title: report.title, shopName: null, price: null }))
}

export function reviewSourceAttribution(example: { productId: string; reviewId: string }, products: readonly ReportChartProduct[] = [], reports: readonly ProductSkillReport[] = []) {
  const product = products.find((item) => item.productId === example.productId)
  const report = reports.find((item) => item.productId === example.productId)
  const productTitle = product?.title?.trim() || report?.title.trim() || product?.shopName?.trim() || `商品 ${example.productId}`
  // The analysis pipeline assigns review-0 to its first sampled review.
  const sample = /^review-(0|[1-9]\d*)$/.exec(example.reviewId)
  const index = sample ? Number(sample[1]) : null
  const reviewLabel = index != null && Number.isSafeInteger(index) && index < Number.MAX_SAFE_INTEGER ? `评价 ${String(index + 1).padStart(2, '0')}` : '用户评价'
  const detail = `${productTitle}\n商品 ID：${example.productId}${example.reviewId ? `\n解析来源：${example.reviewId}` : ''}`
  return { productTitle, reviewLabel, detail }
}

const markdownCell = (text: string) => text.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
const htmlEscape = (text: string) => text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function reportChartsMarkdown(products: readonly ReportChartProduct[] = [], reports: readonly ProductSkillReport[] = []): string {
  const rows = rankCompetitors(products.length ? products : fallbackChartProducts(reports))
  const ranking = positivePointRanking(reports)
  return [
    '## 02 竞品池 Top 10',
    `本批快照 · ${COMPETITOR_SORT_LABELS[defaultCompetitorSort(products)]} · 展示 ${rows.length} 件；非全市场排名。销量为采集值，评分缺失留空。`,
    '| 序号 | 商品 / ID | 价格 | 采集销量 | 商品评分 | 核心卖点 |', '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((item, index) => `| ${index + 1} | ${markdownCell(item.title || item.productId)} / ${item.productId} | ${chartPrice(item.price)} | ${chartCount(item.sold)} | ${chartNumber(item.rating) != null && item.rating! <= 5 ? item.rating : '—'} | ${markdownCell(reports.find((report) => report.productId === item.productId)?.sellingPoints.slice(0, 2).join('；') || '待分析')} |`),
    ...(!rows.length ? ['暂无竞品快照。'] : []),
    '## 03 好评卖点 Top 3',
    `已解析 ${ranking.analysedCount} 条 · 正面 ${ranking.positiveCount} 条。按相同解析要点统计，同一评价每个要点计一次；非全量好评率。`,
    ...ranking.points.map((item, index) => `### ${index + 1}. ${item.point} · ${item.count} 次提及 / ${item.productCount} 件竞品\n\n${item.examples.map((example) => {
      const source = reviewSourceAttribution(example, products, reports)
      return `- 来源商品：${source.productTitle} · ${source.reviewLabel}（商品 ID：${example.productId} / ${example.reviewId}）：“${example.quote}”`
    }).join('\n')}`),
    ...(!ranking.points.length ? ['暂无可统计的好评解析。'] : []),
  ].join('\n\n')
}

export function reportChartsHtml(products: readonly ReportChartProduct[] = [], reports: readonly ProductSkillReport[] = []): string {
  const source = products.length ? products : fallbackChartProducts(reports), rows = rankCompetitors(source)
  const ranking = positivePointRanking(reports)
  const maxPrice = Math.max(0, ...rows.map((item) => chartNumber(item.price) ?? 0))
  const maxCount = Math.max(1, ...ranking.points.map((item) => item.count))
  const sourceCitation = (example: PositivePoint['examples'][number]) => {
    const attribution = reviewSourceAttribution(example, products, reports)
    return `<small class="chart-review-source" title="${htmlEscape(attribution.detail)}">来源商品：<b>${htmlEscape(attribution.productTitle)}</b> · ${htmlEscape(attribution.reviewLabel)}</small>`
  }
  return `<section class="module" id="competitor-pool"><h2>02 竞品池 Top 10</h2><p class="section-caption">本批快照 · ${COMPETITOR_SORT_LABELS[defaultCompetitorSort(source)]} · 展示 ${rows.length} 件；非全市场排名。销量为采集值，— 表示未采集。</p><div style="overflow-x:auto"><table class="chart-table"><thead><tr><th>商品 / ID</th><th>价格</th><th>采集销量</th><th>评分</th><th>核心卖点</th></tr></thead><tbody>${rows.map((item, index) => `<tr><th>${index + 1}. ${htmlEscape(item.title || item.productId)}<small>${htmlEscape(item.productId)}</small></th><td><b>${chartPrice(item.price)}</b>${chartNumber(item.price) != null ? `<div class="chart-track"><i style="width:${maxPrice ? item.price! / maxPrice * 100 : 0}%"></i></div>` : ''}</td><td>${chartCount(item.sold)}</td><td>${chartNumber(item.rating) != null && item.rating! <= 5 ? item.rating : '—'}</td><td>${htmlEscape(reports.find((report) => report.productId === item.productId)?.sellingPoints.slice(0, 2).join('；') || '待分析')}</td></tr>`).join('')}</tbody></table></div>${rows.length ? '' : '<p class="muted">暂无竞品快照。</p>'}</section><section class="module" id="positive-points"><h2>03 好评卖点 Top 3</h2><p class="section-caption">已解析 ${ranking.analysedCount} 条 · 正面 ${ranking.positiveCount} 条；相同要点合并，非全量好评率。</p>${ranking.points.map((item, index) => `<div class="chart-point"><strong>${index + 1}. ${htmlEscape(item.point)}</strong><span>${item.count} 次 · ${item.productCount} 件竞品</span><div class="chart-track"><i style="width:${item.count / maxCount * 100}%"></i></div><details><summary>评价依据</summary>${item.examples.map((example) => `<p>${htmlEscape(example.quote)}${sourceCitation(example)}</p>`).join('')}</details></div>`).join('') || '<p class="muted">暂无可统计的好评解析。</p>'}</section>`
}
