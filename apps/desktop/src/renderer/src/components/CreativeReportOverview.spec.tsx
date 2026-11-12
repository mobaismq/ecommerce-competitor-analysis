import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CreativeReportOverview } from './CreativeReportOverview'
import { creativeFixture } from '../../../worker/test-fixtures/creative'
import type { CreativePlan } from '../../../shared/creative-report'
it('distinguishes competitor findings from our actions and points to preparation materials', () => {
  const plan: CreativePlan = { ...creativeFixture(), version: 'v1', generatedAt: '', model: 'mock', dataCounts: { products: 1, reviews: 2, images: 0, qa: 0 }, evidence: [], brief: { conclusion: '结论', priorities: [{ title: '首屏实拍', finding: '有评价依据', action: '先补实物照片', evidenceIds: [] }] } }
  const html = renderToStaticMarkup(<CreativeReportOverview plan={plan} onEvidence={() => {}} onScripts={() => {}} onMaterials={() => {}} />)
  expect(html).toContain('先补实物照片')
  expect(html).toContain('竞品发现')
  expect(html).toContain('我方建议动作')
  expect(html).toContain('查看素材与依据')
  expect(html).not.toMatch(/<details[^>]*\sopen[\s>]/)
  expect(html).not.toContain('完整Markdown')
})
