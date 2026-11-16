export interface ReportNavigationTarget<Id extends string = string> {
  id: Id
  scrollTop: number
}

export interface ReportSectionPosition<Id extends string = string> {
  id: Id
  top: number
  bottom: number
}

type ReportScroller = Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight' | 'clientTop' | 'getBoundingClientRect' | 'scrollTo'>
type ReportTarget = Pick<HTMLElement, 'getBoundingClientRect' | 'focus'>

/** Scroll only the report viewport. scrollIntoView also moves overflow-hidden app ancestors. */
export function scrollReportToTarget(scroller: ReportScroller, target: ReportTarget, offset: number): number {
  const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
  const desired = scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientTop - offset
  const top = Math.max(0, Math.min(maximum, desired))
  scroller.scrollTo({ top, behavior: 'auto' })
  target.focus({ preventScroll: true })
  return top
}

export function findActiveReportSection<Id extends string>({ scrollTop, scrollHeight, clientHeight, viewportTop, viewportBottom, readingOffset, sections, navigationTarget }: {
  scrollTop: number; scrollHeight: number; clientHeight: number
  viewportTop: number; viewportBottom: number; readingOffset: number
  sections: ReportSectionPosition<Id>[]
  navigationTarget: ReportNavigationTarget<Id> | null
}): { id: Id | undefined; navigationTarget: ReportNavigationTarget<Id> | null } {
  const readingTop = viewportTop + readingOffset
  const visible = (section: ReportSectionPosition<Id>) => section.bottom > readingTop && section.top < viewportBottom
  // A short final section cannot always reach the reading line. Keep the clicked chapter
  // selected at its clamped destination until the reader actually scrolls somewhere else.
  if (navigationTarget && Math.abs(scrollTop - navigationTarget.scrollTop) <= 1 && sections.some((section) => section.id === navigationTarget.id && visible(section))) {
    return { id: navigationTarget.id, navigationTarget }
  }
  const maximum = Math.max(0, scrollHeight - clientHeight)
  const last = sections.at(-1)
  const current = maximum > 1 && maximum - scrollTop <= 1 && last && visible(last)
    ? last
    : sections.filter((section) => section.top <= readingTop).at(-1) ?? sections[0]
  return { id: current?.id, navigationTarget: null }
}
