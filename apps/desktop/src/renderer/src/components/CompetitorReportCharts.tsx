import { useId, useState } from 'react'
import { ChevronDown, Package, Star } from 'lucide-react'
import { chartCount, chartNumber, chartPrice, COMPETITOR_SORT_LABELS, defaultCompetitorSort, fallbackChartProducts, positivePointRanking, rankCompetitors, reviewSourceAttribution, type CompetitorSort, type ReportChartProduct } from '../../../shared/report-charts'
import type { ProductSkillReport } from '../../../shared/report-skill'

export type ReportChartImage = { productId: string; dataUrl: string }

export function CompetitorPoolChart({ products, reports, images, total, loading, error, onRetry }: {
  products: ReportChartProduct[]; reports: ProductSkillReport[]; images: ReportChartImage[]; total: number
  loading: boolean; error: boolean; onRetry: () => void
}) {
  const [sort, setSort] = useState<CompetitorSort | null>(null)
  const source = products.length ? products : fallbackChartProducts(reports)
  const selectedSort = sort ?? defaultCompetitorSort(source)
  const rows = rankCompetitors(source, selectedSort)
  const prices = source.map((item) => chartNumber(item.price)).filter((price): price is number => price != null)
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const average = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : null
  return <>
    <div className="cr-chart-toolbar"><span>本批 {source.length}/{total} 件 · 展示 {rows.length} 件</span><label>排序<select aria-label="竞品排序" value={selectedSort} onChange={(event) => setSort(event.target.value as CompetitorSort)}>{Object.entries(COMPETITOR_SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {!!prices.length && <dl className="cr-chart-price-summary"><div><dt>最低价</dt><dd>{chartPrice(Math.min(...prices))}</dd></div><div><dt>均价</dt><dd>{chartPrice(average)}</dd></div><div><dt>最高价</dt><dd>{chartPrice(maxPrice)}</dd></div></dl>}
    {loading && <p className="cr-document-note" role="status">正在读取竞品…</p>}
    {error && <p className="cr-document-note" role="alert">价格与销量暂时无法读取。<button className="cr-document-text-button" onClick={onRetry}>重试</button></p>}
    {!!rows.length && <div className="cr-document-table-scroll cr-chart-competitor-frame"><table className="cr-chart-competitor-table">
      <caption className="sr-only">本批竞品价格与采集销量对比，最多展示十件</caption>
      <thead><tr><th scope="col">竞品 / 商品 ID</th><th scope="col">价格对比</th><th scope="col">采集销量</th><th scope="col">评分</th><th scope="col">核心卖点</th></tr></thead>
      <tbody>{rows.map((item, index) => {
        const image = images.find((entry) => entry.productId === item.productId)
        const points = reports.find((report) => report.productId === item.productId)?.sellingPoints.slice(0, 2) ?? []
        const rating = chartNumber(item.rating)
        return <tr key={item.productId}>
          <th scope="row"><div className="cr-chart-product"><span className="cr-chart-rank">{String(index + 1).padStart(2, '0')}</span><span className="cr-chart-product-image">{image ? <img src={image.dataUrl} alt="" loading="lazy" /> : <Package size={18} />}</span><span className="cr-chart-product-text"><strong title={item.title || item.productId}>{item.title || item.productId}</strong><small title={item.shopName || undefined}>{item.shopName || '店铺未采集'}</small><small>{item.productId}</small></span></div></th>
          <td><div className="cr-chart-price-value">{chartPrice(item.price)}</div>{chartNumber(item.price) != null && <div className="cr-chart-track" aria-hidden="true"><span style={{ width: `${maxPrice ? item.price! / maxPrice * 100 : 0}%` }} /></div>}</td>
          <td className="cr-chart-number" title="采集页面展示的销量，不视为月销量">{chartCount(item.sold)}</td>
          <td className="cr-chart-number">{rating != null && rating <= 5 ? <span className="cr-chart-rating"><Star size={12} />{rating.toFixed(1)}</span> : <span className="cr-chart-missing" title="未采集商品评分">—</span>}</td>
          <td><div className="cr-chart-product-points">{points.length ? points.map((point, pointIndex) => <span key={pointIndex} title={point}>{point}</span>) : <span className="cr-chart-missing">待分析</span>}</div></td>
        </tr>
      })}</tbody>
    </table></div>}
    {!loading && !rows.length && <p className="cr-document-note">暂无竞品快照。</p>}
    <p className="cr-chart-footnote">本批样本排行 · 销量为采集值 · — 未采集</p>
  </>
}

export function PositiveSellingPointChart({ reports, products, images }: { reports: ProductSkillReport[]; products: ReportChartProduct[]; images: ReportChartImage[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const idPrefix = useId()
  const ranking = positivePointRanking(reports)
  const maxCount = Math.max(1, ...ranking.points.map((item) => item.count))
  const collected = [...new Map(reports.map((report) => [report.productId, report])).values()].reduce((sum, report) => sum + report.sampleCounts.reviewsTotal, 0)
  return <>
    <div className="cr-chart-review-summary"><span><b>{ranking.analysedCount}<small>/{collected}</small></b>已解析评价</span><span><b>{ranking.positiveCount}</b>正面评价</span><span><b>{ranking.productCount}</b>件竞品</span></div>
    <div className="cr-chart-positive-list" aria-label="好评卖点提及次数排行">{ranking.points.map((item, index) => {
      const open = expanded === item.point
      const detailId = `${idPrefix}-${index}`
      return <div className="cr-chart-positive-item" key={item.point}>
        <span className="cr-chart-rank">{String(index + 1).padStart(2, '0')}</span>
        <div className="cr-chart-positive-main"><div className="cr-chart-positive-title"><strong>{item.point}</strong><b>{item.count}<small> 次提及</small></b></div><div className="cr-chart-track" aria-hidden="true"><span style={{ width: `${item.count / maxCount * 100}%` }} /></div><div className="cr-chart-positive-meta"><span>{item.productCount} 件竞品</span><button className="cr-document-text-button" aria-label={`${open ? '收起' : '查看'}${item.point}的好评依据`} aria-expanded={open} aria-controls={detailId} onClick={() => setExpanded(open ? null : item.point)}>看依据<ChevronDown size={12} /></button></div>
          {open && <div id={detailId} className="cr-chart-quotes">{item.examples.map((example) => {
            const source = reviewSourceAttribution(example, products, reports)
            const image = images.find((entry) => entry.productId === example.productId)
            return <blockquote key={`${example.productId}:${example.reviewId}:${example.quote}`}>
              <p>{example.quote}</p>
              <cite className="cr-chart-review-source" title={source.detail}>
                <span className="cr-chart-source-image">{image ? <img src={image.dataUrl} alt="" loading="lazy" /> : <Package size={14} />}</span>
                <span className="cr-chart-source-title"><span>来源：</span><strong>{source.productTitle}</strong></span>
                <span className="cr-chart-source-review">{source.reviewLabel}</span>
              </cite>
            </blockquote>
          })}</div>}
        </div>
      </div>
    })}</div>
    {!ranking.points.length && <p className="cr-document-note">暂无可统计的好评解析。</p>}
    <p className="cr-chart-footnote">按相同解析要点计数 · 同条评价不重复计数 · 非全量好评率</p>
  </>
}
