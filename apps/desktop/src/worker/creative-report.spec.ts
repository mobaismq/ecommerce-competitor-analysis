import { describe, expect, it, vi } from 'vitest'
import { creativeFixture } from './test-fixtures/creative'
import { validateCreativePlan, createCreativePlan } from './creative-report'
import { creativePlanMarkdown } from '../shared/creative-report'
import type { ReportProductInput } from './report-skill-pipeline'

const sources = [{ id: 'p1:review-0', kind: 'review' as const, productId: 'p1', label: '评价', text: '拉链容易卡住' }]
const counts = { products: 1, reviews: 1, images: 0, qa: 0 }
describe('creative report', () => {
  it('requires all image tasks and rejects invented evidence before persistence', () => {
    const fixture = creativeFixture()
    expect(() => validateCreativePlan({ ...fixture, detailImages: fixture.detailImages.slice(1) }, sources, counts, 'mock')).toThrow('8 个完整脚本')
    fixture.mainImages[0].evidenceIds = ['missing'] as never[]
    expect(() => validateCreativePlan(fixture, sources, counts, 'mock')).toThrow('未提供的证据')
  })
  it('exports scripts, requirements and traceable evidence in markdown', () => {
    const fixture = creativeFixture()
    const plan = validateCreativePlan(fixture, sources, counts, 'mock')
    const exported = creativePlanMarkdown(plan)
    expect(plan.mainImages).toHaveLength(5)
    expect(plan.detailImages).toHaveLength(8)
    expect(exported).toContain('拉链容易卡住')
    expect(exported).toContain('我方商品资料')
    expect(exported).toContain('[我方品牌]')
  })
  it('uses real reviews, QA answers and available visual parsing as input', async () => {
    const product: ReportProductInput = { externalProductId: 'p1', title: '背包', price: 99, shopName: null, sold: null, salesAmount: null, imageUrl: null, productUrl: null, rawJson: null, skus: [], reviews: ['拉链容易卡住'], qas: ['能放电脑吗？回答：能放14寸'] }
    const generateText = vi.fn(async (_request: { prompt: string; system?: string }) => ({ text: JSON.stringify(creativeFixture()), model: 'offline' }))
    const plan = await createCreativePlan('背包', [product], [], { generateText })
    expect(generateText.mock.calls[0][0].prompt).toContain('拉链容易卡住')
    expect(generateText.mock.calls[0][0].prompt).toContain('能放14寸')
    expect(plan.evidence.map((item) => item.id)).toContain('p1:review-0')
    expect(plan.dataCounts).toEqual({ products: 1, reviews: 1, images: 0, qa: 1 })
  })
})
