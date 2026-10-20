import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReportMarkdown } from './SkillProductReports'

describe('report markdown rendering', () => {
  it('renders headings and tables while treating embedded HTML as text', () => {
    const html = renderToStaticMarkup(<ReportMarkdown text={'## 商品核心卖点\n| 来源 | 结论 |\n|---|---|\n| 评价 | **防水** |\n<script>alert(1)</script>\n[链接](javascript:alert(1))'} />)
    expect(html).toContain('<table')
    expect(html).toContain('<strong>防水</strong>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('href=')
  })
})
