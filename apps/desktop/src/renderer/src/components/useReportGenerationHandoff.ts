import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { readReportGenerationHandoff, type ReportGenerationKind } from './report-generation-handoff'

/** A report starts a fresh form once; subsequent refreshes can restore a generated draft normally. */
export function useReportGenerationHandoff(kind: ReportGenerationKind) {
  const location = useLocation()
  const navigate = useNavigate()
  const [handoff] = useState(() => readReportGenerationHandoff(location.state, kind))
  useEffect(() => {
    if (!readReportGenerationHandoff(location.state, kind)) return
    const { reportGeneration: _consumed, ...remainingState } = location.state as Record<string, unknown>
    navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, {
      replace: true,
      state: Object.keys(remainingState).length ? remainingState : null,
    })
  }, [kind, location.state, location.pathname, location.search, location.hash, navigate])
  return handoff
}
