import { describe, expect, it } from 'vitest'
import type { CreativePlan } from '../../../shared/creative-report'
import { creativeFixture } from '../../../worker/test-fixtures/creative'
import { createReportGenerationHandoff, readReportGenerationHandoff, REPORT_GENERATION_ROUTES } from './report-generation-handoff'

function plan(): CreativePlan {
  const report: CreativePlan = {
    ...creativeFixture(), version: 'test', generatedAt: '2026-11-16', model: 'fixture',
    dataCounts: { products: 2, reviews: 99, images: 12, qa: 0 },
    evidence: [{ id: 'review-1', productId: 'competitor-1', kind: 'review', label: '评价原文', text: '仅供研究的评价原文' }],
    researchMarkdown: '很长的研究附录',
  }
  report.mainImages.forEach((item, index) => { item.headline = `主图文案 ${index + 1}` })
  report.detailImages.forEach((item, index) => { item.headline = `详情文案 ${index + 1}` })
  return report
}

describe('report to image generation', () => {
  it('sends the main-image plan to 商品主图 and keeps the report association', () => {
    const handoff = createReportGenerationHandoff(plan(), 'main', 'report-1', '猫粮')
    expect(REPORT_GENERATION_ROUTES[handoff.kind]).toBe('/product-sets')
    expect(handoff.report).toMatchObject({ value: 'report-1', label: '猫粮', count: 2 })
    expect(handoff.headlines).toHaveLength(5)
    expect(handoff.text).toContain('主图文案 5')
    expect(handoff.text).not.toContain('详情文案')
  })

  it('sends all detail scripts to 详情图 without the main-image scripts or research appendix', () => {
    const handoff = createReportGenerationHandoff(plan(), 'detail', 'report-1', '猫粮')
    expect(REPORT_GENERATION_ROUTES[handoff.kind]).toBe('/aplus')
    expect(handoff.headlines).toHaveLength(8)
    expect(handoff.text).toContain('详情文案 8')
    expect(handoff.text).not.toContain('主图文案')
    expect(handoff.text).not.toContain('很长的研究附录')
    expect(handoff.text).not.toContain('仅供研究的评价原文')
  })

  it('retains production constraints, additional instructions and missing-material requirements', () => {
    const report = plan()
    report.mainImages[0].visual = '正面实拍'
    report.mainImages[0].prompt = '保留准确结构，不生成虚构数字'
    report.mainImages[0].requirements = ['尺寸核实后使用，温度不得写成 5°C']
    const handoff = createReportGenerationHandoff(report, 'main', 'report-1', '猫粮')
    for (const text of ['正面实拍', '保留准确结构，不生成虚构数字', '尺寸核实后使用，温度不得写成 5°C', '我方商品资料', '样本较少', '以我方上传的商品原图']) expect(handoff.text).toContain(text)
  })

  it('ignores unrelated, incomplete or wrong-destination navigation state', () => {
    const handoff = createReportGenerationHandoff(plan(), 'main', 'report-1', '猫粮')
    expect(readReportGenerationHandoff({ reportGeneration: handoff }, 'main')).toBe(handoff)
    for (const state of [null, {}, { reportGeneration: handoff }, { reportGeneration: { ...handoff, text: '' } }, { reportGeneration: { ...handoff, headlines: [null] } }, { reportGeneration: { ...handoff, report: null } }]) {
      expect(readReportGenerationHandoff(state, 'detail')).toBeNull()
    }
    expect(readReportGenerationHandoff({ reportGeneration: { ...handoff, report: { value: '' } } }, 'main')).toBeNull()
    expect(readReportGenerationHandoff({ reportGeneration: { ...handoff, text: '' } }, 'main')).toBeNull()
    expect(readReportGenerationHandoff({ reportGeneration: { ...handoff, headlines: [null] } }, 'main')).toBeNull()
  })
})
