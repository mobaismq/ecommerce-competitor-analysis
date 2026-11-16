import { describe, expect, it } from 'vitest'
import { creativeBrief, creativePlanMarkdown, creativeScriptInstructions, creativeScriptText, type CreativePlan } from './creative-report'
import { creativePlanHtml } from './creative-report-html'
import { creativeFixture } from '../worker/test-fixtures/creative'
const plan = (): CreativePlan => ({ ...creativeFixture(), version: 'test', generatedAt: '2026-11-12', model: 'fixture', dataCounts: { products: 2, reviews: 99, images: 12, qa: 0 }, evidence: [{ id: 'p1:r1', productId: 'p1', kind: 'review', label: '评价', text: '<script>alert(1)</script>真实原文' }], brief: { conclusion: '先把实物拍清楚', priorities: [{ title: '优先做实拍', finding: '评价关注实物', action: '先拍颗粒特写', evidenceIds: ['p1:r1'] }] } })
describe('focused report exports', () => {
  it('leads with actions and preserves every script and source in the appendix', () => {
    const markdown = creativePlanMarkdown(plan())
    expect(markdown.indexOf('先拍颗粒特写')).toBeLessThan(markdown.indexOf('主图内容脚本'))
    expect(markdown).toContain('### 05 ·')
    expect(markdown).toContain('### 08 ·')
    expect(markdown).toContain('来源 ID：p1:r1')
    expect(markdown).not.toContain('| 图序 |')
  })
  it('produces readable HTML with closed details, escaped model content, and reference anchors', () => {
    const html = creativePlanHtml(plan(), '<img src=x onerror=alert(1)>')
    expect(html).toContain('先把实物拍清楚')
    expect(html).toContain('这份报告帮你做什么？')
    for (const title of ['01 结论与行动', '02 竞品池 Top 10', '03 好评卖点 Top 3', '04 主图策划', '05 详情页策划', '06 素材与依据', '07 单品完整分析']) expect(html).toContain(title)
    expect(html).toContain('href="#source-1"')
    expect(html).toContain('id="source-1"')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toMatch(/<details[^>]*\sopen[\s>]/)
    expect(html.match(/class="script"/g)).toHaveLength(13)
  })
  it('reads older reports without regenerating or inventing an executive summary', () => {
    const original = plan()
    delete original.brief
    original.insights = [{ title: '已有洞察', finding: '已有依据', action: '已有动作', evidenceIds: [] }]
    expect(creativeBrief(original)).toEqual({ conclusion: original.direction, priorities: original.insights })
  })
  it('keeps the seven reading modules in order when exporting the full research', () => {
    const markdown = creativePlanMarkdown(plan(), '原始单品研究正文')
    const headings = ['## 01 结论与行动', '## 02 竞品池 Top 10', '## 03 好评卖点 Top 3', '## 04 主图策划', '## 05 详情页策划', '## 06 素材与依据', '## 07 单品完整分析']
    let previous = -1
    for (const heading of headings) {
      const index = markdown.indexOf(heading)
      expect(index).toBeGreaterThan(previous)
      previous = index
    }
    expect(markdown.match(/原始单品研究正文/g)).toHaveLength(1)
  })
  it('merges repeated production descriptions but retains added instructions', () => {
    expect(creativeScriptInstructions({ visual: '正面实拍，预留文案位。', prompt: '正面实拍 预留文案位' })).toEqual(['正面实拍，预留文案位。'])
    expect(creativeScriptInstructions({ visual: '正面实拍', prompt: '正面实拍；不得改变拉链结构' })).toEqual(['正面实拍', '正面实拍；不得改变拉链结构'])
    expect(creativeScriptInstructions({ visual: '正面实拍', prompt: '保留我方商标，不生成数字' })).toEqual(['正面实拍', '保留我方商标，不生成数字'])
    expect(creativeScriptInstructions({ visual: '', prompt: '右侧留白' })).toEqual(['右侧留白'])
  })
  it('preserves signs, numeric constraints and negation when comparing descriptions', () => {
    for (const [visual, prompt] of [['温度 -5°C', '温度 5°C'], ['数值 >= 20', '数值 <= 20'], ['数值 20', '数值 200'], ['展示拉链', '不展示拉链，也不展示口袋']]) {
      expect(creativeScriptInstructions({ visual, prompt })).toEqual([visual, prompt])
    }
  })
  it('uses the same complete brief for copying and exports without repeating identical descriptions', () => {
    const report = plan()
    const item = report.mainImages[0]
    item.visual = item.prompt = '唯一画面：包装右侧留白'
    item.evidenceIds = ['p1:r1']
    const copied = creativeScriptText(item, report)
    expect(copied.match(/唯一画面/g)).toHaveLength(1)
    expect(copied).toContain(item.headline)
    expect(copied).toContain(item.requirements[0])
    expect(copied).toContain('真实原文')
    expect(creativePlanMarkdown(report).match(/唯一画面/g)).toHaveLength(1)
    expect(creativePlanHtml(report).match(/唯一画面/g)).toHaveLength(1)
  })
})
