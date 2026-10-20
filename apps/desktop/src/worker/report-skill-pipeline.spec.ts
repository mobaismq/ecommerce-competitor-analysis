import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { REPORT_SECTION_TITLES } from '../shared/report-skill'
import type { TextRequest, VisionRequest } from './ai-provider'
import { anthropicImage } from './ai-provider'
import { createProductSkillReport, createSkillReports, normalizeReportConfidence, prepareProductEvidence, readReportSkill, validateReportMarkdown, type ReportProductInput } from './report-skill-pipeline'

const root = mkdtempSync(join(tmpdir(), 'report-evidence-'))
const original = process.env.ECOMMERCE_DATA_ROOT
beforeAll(() => { process.env.ECOMMERCE_DATA_ROOT = root; mkdirSync(join(root, 'ecommerce'), { recursive: true }); mkdirSync(join(root, '.ecommerce')) })
afterAll(() => { if (original === undefined) delete process.env.ECOMMERCE_DATA_ROOT; else process.env.ECOMMERCE_DATA_ROOT = original; rmSync(root, { force: true, recursive: true }) })
const product: ReportProductInput = { externalProductId: 'p1', title: '防水背包', price: 100, shopName: '店铺', sold: null, salesAmount: null, imageUrl: null, productUrl: null, rawJson: null, skus: [], reviews: ['好评', '防水不错', '拉链易坏'], qas: ['问题：能装电脑吗；回答：可以放14寸电脑'] }
const result = (extra = {}) => ({ text: JSON.stringify({ summary: '防水与拉链需核实', markdown: REPORT_SECTION_TITLES.map((title) => `## ${title}\n真实分析`).join('\n\n'), evidence: [{ claim: '拉链风险', sourceIds: ['review-0', 'review-1'], quote: '拉链易坏' }], reviewAnalysis: [{ reviewId: 'review-1', sentiment: 'negative', quote: '拉链易坏', point: '拉链耐用性' }], ...extra }), model: 'offline' })

describe('skill report evidence and validation', () => {
  it('loads the supplied template, filters default reviews, and preserves QA answers', () => {
    expect(readReportSkill().template).toContain('使用人群画像')
    const data = prepareProductEvidence(product)
    expect(data.reviews).toHaveLength(2)
    expect(data.reviewsExcluded).toBe(1)
    expect(data.qas[0].content).toContain('14寸电脑')
    expect(data.sources.map((source) => source.kind)).not.toContain('main_image')
    expect(() => validateReportMarkdown('## 商品标题分析\n摘要')).toThrow('数据源可用性概览')
  })
  it('sends actual local image bytes, not filenames; computes confidence from source types', async () => {
    const path = join(root, 'ecommerce', 'main.png')
    writeFileSync(path, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=', 'base64'))
    const text = vi.fn(async (_request: TextRequest) => result())
    const vision = vi.fn(async (_request: VisionRequest) => result({ imageObservations: [{ imageId: 'main_image-0', ocr: ['防水'], observation: '背包外形' }] }))
    const report = await createProductSkillReport({ ...product, rawJson: { sourceData: { exportDirectory: join(root, 'ecommerce'), images: { images: [{ image_type: 'main_image', storage_path: 'main.png' }] } } } }, { generateText: text, analyzeImage: vision }, readReportSkill())
    expect(vision.mock.calls[0][0].images[0]).toMatch(/^data:image\/png;base64,/)
    expect(vision.mock.calls[0][0].system).toContain('[stage:report-image-parsing]')
    expect(text.mock.calls[0][0].prompt).toContain('背包外形')
    expect(text.mock.calls[0][0].prompt).toContain('回答：可以放14寸电脑')
    expect(text.mock.calls[0][0].system).toContain('[stage:skill-report]')
    expect(report.evidence[0].confidence).toBe('单源推断')
    expect(report.sampleCounts.imagesUsed).toBe(1)
    expect(report.reviewAnalysis[0].quote).toBe('拉链易坏')
  })
  it('does not upload local files outside the collection data roots', () => {
    const path = join(root, 'private.png')
    writeFileSync(path, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const evidence = prepareProductEvidence({ ...product, imageUrl: path })
    expect(evidence.images).toHaveLength(0)
    expect(evidence.limitations.join()).toContain('未读取')
  })
  it('falls back explicitly when vision fails and rejects invented source citations', async () => {
    const text = vi.fn(async (_request: TextRequest) => result())
    const report = await createProductSkillReport({ ...product, imageUrl: 'https://example.invalid/main.png' }, { generateText: text, analyzeImage: async () => { throw new Error('vision unavailable') } }, readReportSkill())
    expect(report.limitations.join()).toContain('视觉模型调用或解析失败')
    expect(report.sampleCounts.imagesUsed).toBe(0)
    expect(text.mock.calls[0][0].prompt).not.toContain('main_image-0')
    await expect(createProductSkillReport(product, { generateText: async () => result({ evidence: [{ claim: '编造', sourceIds: ['missing'], quote: 'test' }] }), analyzeImage: vi.fn() }, readReportSkill())).rejects.toThrow('未提供的数据来源')
  })
  it('stops scheduling more products after a failure and settles active calls before rejecting', async () => {
    let active = false
    const generateText = vi.fn(async () => {
      if (generateText.mock.calls.length === 1) throw new Error('invalid report')
      active = true
      await new Promise((resolve) => setTimeout(resolve, 15))
      active = false
      return result()
    })
    await expect(createSkillReports([product, product, product], { generateText, analyzeImage: vi.fn() })).rejects.toThrow('invalid report')
    expect(generateText).toHaveBeenCalledTimes(2)
    expect(active).toBe(false)
  })
  it('retries a transient provider failure once without silently saving a failed report', async () => {
    const generateText = vi.fn().mockRejectedValueOnce(new Error('AI 请求失败: Provider returned error')).mockResolvedValueOnce(result())
    const report = await createProductSkillReport(product, { generateText, analyzeImage: vi.fn() }, readReportSkill())
    expect(generateText).toHaveBeenCalledTimes(2)
    expect(report.markdown).toContain('商品标题分析')
  })
  it('corrects model confidence in report tables using available source types', () => {
    const markdown = '| 卖点 | 印证来源 | 置信度 |\n|---|---|---|\n| 防水 | 标题+评价 | 【多源印证】 |\n| 耐用 | 多条好评+差评 | 【多源印证】 |\n| 外观 | 主图 | 【多源印证】 |'
    const result = normalizeReportConfidence(markdown, [{ id: 'title', kind: 'title', label: '标题' }, { id: 'review-0', kind: 'review', label: '评价' }])
    expect(result).toContain('标题+评价 | 【双源印证】')
    expect(result).toContain('多条好评+差评 | 【单源推断，置信度较低】')
    expect(result).toContain('主图 | 信息不足，来源未核实')
  })
  it('encodes base64 images correctly for Anthropic and keeps remote URLs supported', () => {
    expect(anthropicImage('data:image/png;base64,aGVsbG8=')).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' } })
    expect(anthropicImage('https://example.invalid/image.png')).toEqual({ type: 'image', source: { type: 'url', url: 'https://example.invalid/image.png' } })
  })
})
