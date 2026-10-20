import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, DatePicker, Dropdown, Empty, Menu, Message, Table } from '@arco-design/web-react'
import { ArrowUpRight, ClipboardList, Image as ImageIcon, Layers3, MoreHorizontal, RefreshCw, Search, Sparkles } from 'lucide-react'
import dayjs from 'dayjs'
import type { CreativePlan } from '../../../shared/creative-report'
import { formatDateTime } from '../utils/format'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../store/auth'
import '../styles/creative-report.css'

interface AnalysisRun {
  id: string; jobId: string; reportNo: string | null; status: string; competitorCount: number | null; keyword?: string | null; updatedAt: string
  source?: 'collection' | 'report'; collectionJobId?: string | null; priceMin?: number | null; priceMax?: number | null
  reportJson?: { priceBands?: Array<{ priceMin: number; priceMax: number }>; creativePlan?: CreativePlan; productReports?: Array<{ sampleCounts: { reviewsTotal: number; imagesAvailable: number } }> } | null
}
function priceRange(row: AnalysisRun) {
  const bands = row.reportJson?.priceBands ?? []
  const min = row.priceMin ?? (bands.length ? Math.min(...bands.map((item) => item.priceMin)) : null)
  const max = row.priceMax ?? (bands.length ? Math.max(...bands.map((item) => item.priceMax)) : null)
  return min == null || max == null ? '未取得价格' : min === max ? `¥${min}` : `¥${min} – ¥${max}`
}
const PAGE_SIZE = 10
export function ReportsListPage() {
  const navigate = useNavigate(), userId = useAuth((state) => state.user?.id ?? '')
  const [searchKeyword, setSearchKeyword] = useState(''), [startTime, setStartTime] = useState(''), [endTime, setEndTime] = useState(''), [reportStatus, setReportStatus] = useState('')
  const [filters, setFilters] = useState({ keyword: '', startTime: '', endTime: '', status: '' }), [currentPage, setCurrentPage] = useState(1)
  const [generatingId, setGeneratingId] = useState<string | null>(null), [progress, setProgress] = useState('')
  const inFlight = useRef(false)
  const { data, isLoading, isError, error, refetch } = useQuery<{ rows: AnalysisRun[]; total: number }>({
    queryKey: ['analysis-report-catalog', filters, currentPage],
    queryFn: async () => {
      if (!window.desktop?.capabilities) throw new Error('桌面数据服务未就绪，请重启客户端后重试')
      const result = await window.desktop?.capabilities.invoke('report.list', { tenantId: 'local', includeCollections: true, keyword: filters.keyword.trim() || undefined,
        status: filters.status || undefined, startTime: filters.startTime ? dayjs(filters.startTime).startOf('day').toISOString() : undefined,
        endTime: filters.endTime ? dayjs(filters.endTime).endOf('day').toISOString() : undefined, page: currentPage, pageSize: PAGE_SIZE }) as { rows?: AnalysisRun[]; total?: number }
      if (!result || !Array.isArray(result.rows)) throw new Error('数据服务返回异常，未能读取报告列表')
      return { rows: result.rows, total: result.total ?? result.rows.length }
    },
  })
  useEffect(() => { setCurrentPage(1) }, [filters])
  const rows = data?.rows ?? [], plans = rows.flatMap((row) => row.reportJson?.creativePlan ? [row.reportJson.creativePlan] : [])
  const apply = () => { const next = { keyword: searchKeyword, startTime, endTime, status: reportStatus }; if (JSON.stringify(next) === JSON.stringify(filters) && currentPage === 1) void refetch(); else { setFilters(next); setCurrentPage(1) } }
  const reset = () => { setSearchKeyword(''); setStartTime(''); setEndTime(''); setReportStatus(''); setFilters({ keyword: '', startTime: '', endTime: '', status: '' }); setCurrentPage(1) }
  const generate = async (row: AnalysisRun) => {
    if (!userId) { Message.error('请重新登录后生成报告'); return }
    if (inFlight.current) return
    inFlight.current = true; setGeneratingId(row.id); setProgress('正在读取商品、图片和评价…')
    const unsubscribe = window.desktop?.capabilities.onStream((event) => {
      const item = event.data
      if (event.type === 'report-progress' && item && (row.collectionJobId ? item.collectionJobId === row.collectionJobId : item.jobId === row.jobId)) setProgress(`${item.stage}（${item.done}/${item.total} 件）`)
    })
    try {
      const result = await window.desktop?.capabilities.invoke('report.generate', { userId, tenantId: 'local', keyword: row.keyword ?? '', collectionJobId: row.collectionJobId ?? undefined, jobId: row.jobId, regenerate: row.source !== 'collection' }) as { reportId?: string }
      if (!result?.reportId) throw new Error('报告生成未返回有效结果')
      Message.success('出图内容策划已生成'); await refetch(); navigate(`/market/competitive/report/view?id=${encodeURIComponent(result.reportId)}`)
    } catch (error) { Message.error(`生成失败：${error instanceof Error ? error.message : String(error)}`) }
    finally { unsubscribe?.(); inFlight.current = false; setGeneratingId(null); setProgress('') }
  }
  const columns = [
    { title: '分析主题', dataIndex: 'keyword', width: 220, render: (_: unknown, row: AnalysisRun) => <div className="cr-row-topic"><span className="cr-stat-icon"><ImageIcon size={18} /></span><div><h3>{row.keyword || '竞品分析'}</h3><p>{row.reportNo || '已采集 · 待生成策划'}</p></div></div> },
    { title: '数据基础', dataIndex: 'competitorCount', width: 150, render: (_: unknown, row: AnalysisRun) => { const counts = row.reportJson?.creativePlan?.dataCounts; return <div><div style={{ color: '#526b87', fontWeight: 550 }}>{row.competitorCount ?? 0} 件竞品 · {priceRange(row)}</div><p className="cr-meta" style={{ marginTop: 6 }}>{counts ? `${counts.reviews} 条评价 · ${counts.images} 条图片记录` : '点击查看采集数据'}</p></div> } },
    { title: '内容交付', dataIndex: 'reportJson', width: 145, render: (_: unknown, row: AnalysisRun) => { const plan = row.reportJson?.creativePlan; return plan ? <div><div className="cr-script-counts"><span className="cr-tag">主图 {plan.mainImages.length} 张</span><span className="cr-tag">详情 {plan.detailImages.length} 屏</span></div><span className="cr-meta">含文案、画面与证据</span></div> : <span className="cr-meta">生成后查看图片脚本</span> } },
    { title: '更新时间', dataIndex: 'updatedAt', width: 155, render: (value: string) => <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDateTime(value)}</span> },
    { title: '报告状态', dataIndex: 'status', width: 105, render: (_: unknown, row: AnalysisRun) => <span className={`cr-status ${row.reportJson?.creativePlan ? '' : 'pending'}`}><span className="cr-dot" style={{ width: 4, height: 4, background: 'currentColor' }} />{generatingId === row.id ? '正在生成' : row.reportJson?.creativePlan ? '策划已就绪' : row.source === 'collection' ? '待生成' : ['failure', 'failed'].includes(row.status) ? '生成失败' : '分析已生成'}</span> },
    { title: '操作', dataIndex: 'op', width: 170, render: (_: unknown, row: AnalysisRun) => <div className="cr-row-actions"><button className="cr-button cr-primary" disabled={!row.reportJson?.creativePlan && generatingId !== null} onClick={() => row.reportJson?.creativePlan ? navigate(`/market/competitive/report/view?id=${encodeURIComponent(row.id)}`) : void generate(row)}>{generatingId === row.id ? '生成中…' : row.reportJson?.creativePlan ? '查看出图方案' : '生成出图方案'}{generatingId !== row.id && <ArrowUpRight size={13} />}</button><Dropdown trigger="click" position="br" droplist={<Menu><Menu.Item key="data" onClick={() => navigate(`/market/competitive/report/products?id=${encodeURIComponent(row.id)}`)}>查看采集数据</Menu.Item>{row.source !== 'collection' && <Menu.Item key="analysis" onClick={() => navigate(`/market/competitive/report/view?id=${encodeURIComponent(row.id)}`)}>查看分析报告</Menu.Item>}{row.source !== 'collection' && <Menu.Item key="regenerate" disabled={generatingId !== null} onClick={() => void generate(row)}>重新生成报告</Menu.Item>}<Menu.Item key="chat" onClick={() => navigate(`/market/competitive/agent?reportId=${encodeURIComponent(row.id)}`)}>智能问答</Menu.Item></Menu>}><button className="cr-text-button" aria-label={`${row.keyword}的更多操作`}><MoreHorizontal size={18} /></button></Dropdown></div> },
  ]
  return <div className="cr-page cr-catalog custom-scrollbar"><PageHeader breadcrumbs={[{ label: '市场' }, { label: '竞品分析' }, { label: '分析报告' }]} />
    <header className="cr-title-row"><div><div className="cr-eyebrow"><Sparkles size={14} />把竞品资料转成图片内容</div><h1>竞品内容策划</h1><p className="cr-meta">从图片、评价和问答提炼方向，生成可交给美工的主图与详情页脚本。</p></div><button className="cr-button" onClick={() => void refetch()}><RefreshCw size={14} />刷新列表</button></header>
    <div className="cr-stat-grid"><div className="cr-stat"><span className="cr-stat-icon"><ClipboardList size={19} /></span><div><b>{data?.total ?? 0}<small> 个报告批次</small></b><span>按当前筛选条件统计</span></div></div><div className="cr-stat"><span className="cr-stat-icon violet"><ImageIcon size={19} /></span><div><b>{plans.reduce((sum, plan) => sum + plan.mainImages.length, 0)}<small> 张主图脚本</small></b><span>当前页可用的内容任务</span></div></div><div className="cr-stat"><span className="cr-stat-icon teal"><Layers3 size={19} /></span><div><b>{plans.reduce((sum, plan) => sum + plan.detailImages.length, 0)}<small> 屏详情脚本</small></b><span>含文案、画面安排与依据</span></div></div></div>
    <div className="cr-filter"><div><label htmlFor="report-keyword">关键词</label><input id="report-keyword" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') apply() }} placeholder="搜索分析主题" /></div><div><label>更新时间</label><DatePicker.RangePicker value={startTime && endTime ? [dayjs(startTime), dayjs(endTime)] : []} onChange={(value) => { setStartTime(value?.[0] ?? ''); setEndTime(value?.[1] ?? '') }} allowClear /></div><div><label htmlFor="report-status">报告状态</label><select id="report-status" value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}><option value="">全部状态</option><option value="success">已生成</option><option value="not_generated">未生成</option><option value="failed">生成失败</option></select></div><div className="cr-actions"><button className="cr-button cr-primary" onClick={apply}><Search size={13} />查询</button><button className="cr-button" onClick={reset}>重置</button></div></div>
    {generatingId && <Alert className="cr-catalog-progress" type="info" content={`${progress}，请保持页面打开。完整方案生成成功后会自动进入报告。`} />}
    {isError && <Alert className="cr-catalog-progress" type="error" title="报告加载失败" content={<span>{error instanceof Error ? error.message : '无法连接本地数据服务'} <button className="cr-text-button" onClick={() => void refetch()}>重新连接</button></span>} />}
    <section className="cr-catalog-table"><div className="cr-catalog-caption"><div><h2>分析与策划报告</h2><p>已生成的分析可更新为出图方案，采集资料和分析依据均可保留查看。</p></div><span className="cr-tag">主图 + 详情页</span></div><Table columns={columns} data={rows} rowKey="id" border={false} loading={isLoading} noDataElement={<Empty description={isError ? '数据加载失败' : '暂无匹配数据，完成采集后可在这里生成策划报告'} />} pagination={(data?.total ?? 0) > 0 ? { pageSize: PAGE_SIZE, current: currentPage, total: data?.total ?? 0, showTotal: true, onChange: setCurrentPage } : false} /></section>
  </div>
}
