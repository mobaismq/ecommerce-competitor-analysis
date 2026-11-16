import { describe, expect, it, vi } from 'vitest'
import { findActiveReportSection, scrollReportToTarget, type ReportNavigationTarget } from './report-scroll'

describe('report chapter navigation', () => {
  it('scrolls the report container and focuses without scrolling ancestor application panes', () => {
    const appPane = { scrollTop: 0 }
    const scrollTo = vi.fn()
    const focus = vi.fn()
    const target = {
      getBoundingClientRect: () => ({ top: 450 }) as DOMRect,
      focus,
      scrollIntoView: () => { appPane.scrollTop = 300; throw new Error('must not scroll all ancestors') },
    }
    const result = scrollReportToTarget({ scrollTop: 200, scrollHeight: 2000, clientHeight: 800, clientTop: 2, getBoundingClientRect: () => ({ top: 50 }) as DOMRect, scrollTo }, target, 60)
    expect(result).toBe(538)
    expect(scrollTo).toHaveBeenCalledWith({ top: 538, behavior: 'auto' })
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(appPane.scrollTop).toBe(0)
  })

  it('clamps the final chapter and the first chapter to the report viewport bounds', () => {
    const scroller = { scrollTop: 500, scrollHeight: 1300, clientHeight: 800, clientTop: 0, getBoundingClientRect: () => ({ top: 50 }) as DOMRect, scrollTo: vi.fn() }
    const target = { getBoundingClientRect: () => ({ top: 650 }) as DOMRect, focus: vi.fn() }
    expect(scrollReportToTarget(scroller, target, 60)).toBe(500)
    target.getBoundingClientRect = () => ({ top: -800 }) as DOMRect
    expect(scrollReportToTarget(scroller, target, 60)).toBe(0)
  })

  const viewport = {
    scrollTop: 500, scrollHeight: 1300, clientHeight: 800, viewportTop: 50, viewportBottom: 850, readingOffset: 100,
    sections: [{ id: 'overview', top: -900, bottom: -200 }, { id: 'sources', top: 80, bottom: 300 }, { id: 'research', top: 350, bottom: 750 }],
    navigationTarget: null as ReportNavigationTarget | null,
  }

  it('selects the final visible chapter at the bottom even when its heading cannot reach the top', () => {
    expect(findActiveReportSection(viewport).id).toBe('research')
  })

  it('retains either explicitly clicked chapter when neighboring short chapters share the same bottom position', () => {
    for (const id of ['sources', 'research']) {
      const navigationTarget = { id, scrollTop: 500 }
      expect(findActiveReportSection({ ...viewport, navigationTarget })).toEqual({ id, navigationTarget })
    }
  })

  it('returns to scroll tracking after the reader leaves the clicked position', () => {
    expect(findActiveReportSection({ ...viewport, scrollTop: 400, navigationTarget: { id: 'research', scrollTop: 500 } })).toEqual({ id: 'sources', navigationTarget: null })
  })

  it('does not keep a clicked chapter highlighted after it is no longer visible', () => {
    expect(findActiveReportSection({ ...viewport, navigationTarget: { id: 'overview', scrollTop: 500 } })).toEqual({ id: 'research', navigationTarget: null })
  })

  it('keeps the initial chapter selected when the whole report fits without scrolling', () => {
    expect(findActiveReportSection({ ...viewport, scrollTop: 0, scrollHeight: 700, sections: [{ id: 'overview', top: 80, bottom: 250 }, { id: 'research', top: 350, bottom: 700 }] }).id).toBe('overview')
  })
})
