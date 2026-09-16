import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface AnalysisRun {
  id: string
  reportNo: string | null
  status: string
  competitorCount: number | null
  updatedAt: string
}

export function ReportsListPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['analysis-runs'],
    queryFn: async () => (await api.get<AnalysisRun[]>('/api/reports')).data,
  })
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>竞品报告</h2>
        <button className="ghost" onClick={() => void refetch()}>刷新</button>
      </div>
      {isLoading ? <p>加载中...</p> : (
        <table>
          <thead>
            <tr><th>报告编号</th><th>状态</th><th>竞品数</th><th>更新时间</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((run) => (
              <tr key={run.id}>
                <td>{run.reportNo ?? run.id}</td>
                <td>{run.status}</td>
                <td>{run.competitorCount ?? '-'}</td>
                <td>{new Date(run.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={4}>暂无数据</td></tr>}
          </tbody>
        </table>
      )}
    </section>
  )
}
