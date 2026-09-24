import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DatePicker, Empty, Table } from '@arco-design/web-react'
import dayjs from 'dayjs'
import { formatDateTime } from '../utils/format'
import { PageHeader } from '../components/PageHeader'
import { XSearchInput } from '../components/XInput'

interface AnalysisRun {
  id: string
  jobId: string
  reportNo: string | null
  status: string
  competitorCount: number | null
  keyword?: string | null
  updatedAt: string
  reportJson?: {
    priceBands?: Array<{ priceMin: number; priceMax: number }>
  } | null
}

// 价格区间来自报告生成时写入的 reportJson.priceBands（AnalysisRun 无 priceMin/priceMax 标量字段）
function priceRange(row: AnalysisRun): string {
  const bands = row.reportJson?.priceBands || []
  if (!bands.length) return '—'
  const min = Math.min(...bands.map((b) => b.priceMin))
  const max = Math.max(...bands.map((b) => b.priceMax))
  return `¥${min} ~ ¥${max}`
}

type StatusView = { text: string; className: string }

// 状态徽章配色对照旧版 AnalysisReport.tsx STATUS_CONFIG
function statusView(status: string): StatusView {
  if (status === 'completed' || status === 'success') return { text: '已生成', className: 'bg-[#e8f5e9] text-[#2e7d32]' }
  if (status === 'running') return { text: '生成中', className: 'bg-[#fff3e0] text-[#f57c00]' }
  if (status === 'failed') return { text: '生成失败', className: 'bg-[#ffEBEE] text-[#c62828]' }
  return { text: '未生成', className: 'bg-[#f2f4f7] text-[#86909C]' }
}

const PAGE_SIZE = 10

export function ReportsListPage() {
  const navigate = useNavigate()

  // 查询条件（对照旧版：输入态 + 查询后应用态）
  const [searchKeyword, setSearchKeyword] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reportStatus, setReportStatus] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [appliedStartTime, setAppliedStartTime] = useState('')
  const [appliedEndTime, setAppliedEndTime] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // 数据流：IPC report.list 查询本地 SQLite + 分页（兼容旧版 status=not_generated 等状态）
  const { data, isLoading } = useQuery<{ rows: AnalysisRun[]; total: number }>({
    queryKey: ['analysis-runs', appliedKeyword, appliedStartTime, appliedEndTime, appliedStatus, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (appliedKeyword.trim()) params.set('keyword', appliedKeyword.trim())
      if (appliedStatus) params.set('status', appliedStatus)
      if (appliedStartTime) params.set('startTime', appliedStartTime)
      if (appliedEndTime) params.set('endTime', appliedEndTime)
      params.set('page', String(currentPage))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await window.desktop?.capabilities.invoke('report.list', {
        tenantId: 'local',
        keyword: appliedKeyword.trim() || undefined,
        status: appliedStatus || undefined,
        page: currentPage,
        pageSize: PAGE_SIZE,
      }) as { rows?: AnalysisRun[]; total?: number } | undefined
      const rows = Array.isArray(res?.rows) ? res.rows : []
      return { rows, total: res?.total ?? rows.length }
    },
  })

  const rows = data?.rows || []
  const total = data?.total ?? rows.length
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1
  const safePage = Math.min(currentPage, totalPages)

  useEffect(() => {
    setCurrentPage(1)
  }, [appliedKeyword, appliedStartTime, appliedEndTime, appliedStatus])

  const applySearch = () => {
    setAppliedKeyword(searchKeyword)
    setAppliedStartTime(startTime)
    setAppliedEndTime(endTime)
    setAppliedStatus(reportStatus)
  }

  const resetSearch = () => {
    setSearchKeyword('')
    setStartTime('')
    setEndTime('')
    setReportStatus('')
    setAppliedKeyword('')
    setAppliedStartTime('')
    setAppliedEndTime('')
    setAppliedStatus('')
    setCurrentPage(1)
  }

  const columns = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      render: (keyword: string | null | undefined, row: AnalysisRun) => (
        <span className="whitespace-nowrap text-[14px] text-[#0A1B39]">
          {keyword || row.reportNo || `REP-${row.id.slice(0, 10).toUpperCase()}`}
        </span>
      ),
    },
    {
      title: '价格区间',
      dataIndex: 'reportJson',
      render: (_: unknown, row: AnalysisRun) => <span className="whitespace-nowrap text-[14px] text-[#344054]">{priceRange(row)}</span>,
    },
    {
      title: '竞品数量',
      dataIndex: 'competitorCount',
      render: (v: number | null) => <span className="whitespace-nowrap text-[14px] text-[#344054]">{v ?? '—'}</span>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (v: string) => <span className="whitespace-nowrap text-[14px] text-[#86909C]">{formatDateTime(v)}</span>,
    },
    {
      title: '报告状态',
      dataIndex: 'status',
      render: (status: string) => {
        const view = statusView(status)
        return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] ${view.className}`}>{view.text}</span>
      },
    },
    {
      title: '操作',
      dataIndex: 'op',
      render: (_: unknown, row: AnalysisRun) => {
        const canView = row.status === 'completed' || row.status === 'success'
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/market/competitive/report/products?id=${encodeURIComponent(row.id)}`)}
              className="flex cursor-pointer items-center border-0 bg-transparent p-0 text-[13px] text-[#3388ff] hover:text-[#1a6fe8]"
            >
              查看采集数据
            </button>
            <button
              type="button"
              onClick={() => navigate(`/market/competitive/report/view?id=${encodeURIComponent(row.id)}`)}
              disabled={!canView}
              className="flex cursor-pointer items-center border-0 bg-transparent p-0 text-[13px] text-[#3388ff] hover:text-[#1a6fe8] disabled:cursor-not-allowed disabled:text-[#b0b7c3]"
            >
              查看报告
            </button>
            <button
              type="button"
              onClick={() => navigate(`/market/competitive/agent?reportId=${row.id}`)}
              className="flex cursor-pointer items-center border-0 bg-transparent p-0 text-[13px] text-[#3388ff] hover:text-[#1a6fe8]"
            >
              智能问答
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader breadcrumbs={[{ label: '市场' }, { label: '竞品分析' }, { label: '分析报告' }]} />

      {/* 查询条件卡 */}
      <div className="mb-4 rounded-xl bg-white p-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">关键词</label>
            <XSearchInput
              value={searchKeyword}
              onChange={setSearchKeyword}
              onEnter={applySearch}
              placeholder="请输入"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">更新时间</label>
            <DatePicker.RangePicker
              className="min-w-0 flex-1"
              value={startTime && endTime ? [dayjs(startTime), dayjs(endTime)] : []}
              onChange={(dateString) => {
                setStartTime(dateString?.[0] ?? '')
                setEndTime(dateString?.[1] ?? '')
              }}
              allowClear
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">报告状态</label>
            <select
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
              className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] outline-none focus:border-[#409eff] ${reportStatus === '' ? 'text-[#98A2B3]' : 'text-[#0A1B39]'}`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c0c4cc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="">请选择</option>
              <option value="completed">已生成</option>
              <option value="running">生成中</option>
              <option value="failed">生成失败</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applySearch}
              className="h-8 shrink-0 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff]"
            >
              查询
            </button>
            <button
              type="button"
              onClick={resetSearch}
              className="h-8 shrink-0 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-4 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {/* 数据表格卡（Arco Table：服务端分页 / loading / 空状态内建） */}
      <div className="rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <Table
          columns={columns}
          data={rows}
          rowKey="id"
          loading={isLoading}
          border={false}
          noDataElement={
            <Empty
              description={
                <div>
                  <p className="m-0 text-[15px] text-[#86909C]">暂无数据</p>
                  <p className="m-0 mt-1 text-[13px] text-[#98A2B3]">前往「AI数据采集」页面采集竞品数据后查看报告</p>
                </div>
              }
            />
          }
          pagination={
            total > 0
              ? { pageSize: PAGE_SIZE, current: safePage, total, showTotal: true, onChange: (page) => setCurrentPage(page) }
              : false
          }
        />
      </div>
    </div>
  )
}
