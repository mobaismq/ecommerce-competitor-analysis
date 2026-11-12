import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { REPORT_SECTIONS, ReportSectionGuide } from './ReportSectionGuide'

describe('report section orientation', () => {
  it('gives every navigation destination a question and an explicit deliverable', () => {
    expect(REPORT_SECTIONS.map(item => item.key)).toEqual(['overview', 'main', 'detail', 'sources', 'research'])
    for (const section of REPORT_SECTIONS) {
      const html = renderToStaticMarkup(<ReportSectionGuide section={section.key} output="本模块输出" />)
      expect(html).toContain(section.title)
      expect(html).toContain(section.audience)
      expect(html).toContain(section.question)
      expect(html).toContain('本模块交付')
      expect(html).toContain('本模块输出')
    }
  })
})
