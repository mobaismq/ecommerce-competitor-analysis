import { describe, expect, it } from 'vitest'
import { chartCount, chartNumber, chartPrice, defaultCompetitorSort, positivePointRanking, rankCompetitors, reportChartsHtml, reportChartsMarkdown, reviewSourceAttribution, type ReportChartProduct } from './report-charts'
import type { ProductSkillReport } from './report-skill'

function report(productId: string, reviewAnalysis: ProductSkillReport['reviewAnalysis']): ProductSkillReport {
  return { productId, title: productId, summary: '', markdown: '', model: 'fixture', sources: [], evidence: [], imageObservations: [], reviewAnalysis,
    sampleCounts: { reviewsTotal: 10, reviewsUsed: 5, reviewsExcluded: 5, qaTotal: 0, qaUsed: 0, imagesAvailable: 0, imagesUsed: 0 }, limitations: [], sellingPoints: ['真实卖点'], painPoints: [], userDemands: [], opportunities: [] }
}
const review = (reviewId: string, point: string, sentiment: ProductSkillReport['reviewAnalysis'][number]['sentiment'] = 'positive') => ({ reviewId, point, sentiment, quote: `原文-${reviewId}` })
const product = (productId: string, sold: number | null, price: number | null = 100): ReportChartProduct => ({ productId, sold, price, title: productId, shopName: null })

describe('report charts data', () => {
  it('selects the real top ten after sorting all loaded products without mutating input', () => {
    const products = Array.from({ length: 12 }, (_, index) => product(`p${index}`, index * 10))
    const original = products.map((item) => item.productId)
    const top = rankCompetitors(products)
    expect(top).toHaveLength(10)
    expect(top[0].productId).toBe('p11')
    expect(top.at(-1)?.productId).toBe('p2')
    expect(products.map((item) => item.productId)).toEqual(original)
  })

  it('distinguishes missing, invalid and zero measurements and keeps missing values last', () => {
    const products = [product('missing', null, null), product('zero', 0, 0), product('priced', 10, 99), product('invalid', Number.NaN, -1)]
    expect(rankCompetitors(products).map((item) => item.productId)).toEqual(['priced', 'zero', 'missing', 'invalid'])
    expect(rankCompetitors(products, 'price-asc').map((item) => item.productId)).toEqual(['zero', 'priced', 'missing', 'invalid'])
    expect(chartPrice(0)).toBe('¥0')
    expect(chartCount(0)).toBe('0')
    expect(chartPrice(null)).toBe('—')
    expect(chartCount(undefined)).toBe('—')
    expect(chartNumber(Infinity)).toBeNull()
    expect(chartNumber(-10)).toBeNull()
  })

  it('keeps collection order when sales are unavailable and does not pad a short batch', () => {
    const products = [product('p2', null), product('p1', null), product('p2', null)]
    expect(defaultCompetitorSort(products)).toBe('collected')
    expect(rankCompetitors(products).map((item) => item.productId)).toEqual(['p2', 'p1'])
    expect(rankCompetitors([])).toEqual([])
  })

  it('counts positive labels once per review and product, with matching labels combined', () => {
    const result = positivePointRanking([
      report('p1', [review('r1', '适口性'), review('r1', '适口性'), review('r2', ' 适口性。 '), review('r3', '冻干'), review('r4', '质量', 'negative'), review('r5', '价格', 'mixed')]),
      report('p2', [review('r1', '适口性'), review('r2', '冻干'), review('r3', '包装')]),
    ])
    expect(result.analysedCount).toBe(8)
    expect(result.positiveCount).toBe(6)
    expect(result.points[0]).toMatchObject({ point: '适口性', count: 3, productCount: 2 })
    expect(result.points[1]).toMatchObject({ point: '冻干', count: 2, productCount: 2 })
    expect(result.points).toHaveLength(3)
    expect(result.points.flatMap((item) => item.examples)).not.toContainEqual(expect.objectContaining({ reviewId: 'r4' }))
  })

  it('does not infer synonyms, turn mixed feedback into praise, or fabricate three points', () => {
    const result = positivePointRanking([report('p1', [review('r1', '适口性'), review('r2', '适口性好'), review('r3', '肠胃', 'mixed'), { ...review('r4', '包装'), quote: '' }])])
    expect(result.points).toHaveLength(2)
    expect(result.points.every((item) => item.count === 1)).toBe(true)
    expect(positivePointRanking([])).toMatchObject({ points: [], analysedCount: 0, positiveCount: 0 })
  })

  it('attributes each review to its own named product and retains original identifiers for verification', () => {
    const products = [{ ...product('p1', 10), title: '聪颖冻干猫粮' }, { ...product('p2', 20), title: '佰萃猫粮' }]
    const reports = [{ ...report('p1', [review('review-0', '适口性')]), title: '旧商品名' }, { ...report('p2', [review('review-7', '适口性')]), title: '佰萃猫粮' }]
    const first = reviewSourceAttribution({ productId: 'p1', reviewId: 'review-0' }, products, reports)
    expect(first).toMatchObject({ productTitle: '聪颖冻干猫粮', reviewLabel: '评价 01' })
    expect(first.detail).toContain('商品 ID：p1')
    expect(first.detail).toContain('解析来源：review-0')
    expect(reviewSourceAttribution({ productId: 'p2', reviewId: 'review-7' }, [], reports)).toMatchObject({ productTitle: '佰萃猫粮', reviewLabel: '评价 08' })
    expect(reviewSourceAttribution({ productId: 'missing', reviewId: 'external-id' })).toMatchObject({ productTitle: '商品 missing', reviewLabel: '用户评价' })
    for (const output of [reportChartsMarkdown(products, reports), reportChartsHtml(products, reports)]) {
      expect(output).toMatch(/来源商品：[\s\S]*聪颖冻干猫粮[\s\S]*评价 01/)
      expect(output).toMatch(/来源商品：[\s\S]*佰萃猫粮[\s\S]*评价 08/)
    }
  })

  it('exports actual snapshot values and escapes source text in the standalone chart report', () => {
    const source = { ...product('p1', 100000, 89), title: '<script>alert(1)</script>', shopName: '店铺评分5.0' }
    const reports = [report('p1', [{ ...review('r1', '配方'), quote: '<img src=x onerror=alert(1)>' }])]
    const markdown = reportChartsMarkdown([source], reports)
    expect(markdown).toContain('竞品池 Top 10')
    expect(markdown).toContain('¥89 | 100,000 | —')
    expect(markdown).toContain('好评卖点 Top 3')
    const html = reportChartsHtml([source], reports)
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('NaN')
  })
})
