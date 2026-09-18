import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ChevronLeft, ChevronRight, FileBarChart, Loader2, Search, X } from 'lucide-react'
import { api } from '../api/client'
import { formatDateTime } from '../utils/format'
import { PageHeader } from '../components/PageHeader'

interface AnalysisRun {
  id: string
  jobId: string
  reportNo: string | null
  status: string
  competitorCount: number | null
  priceMin: number | null
  priceMax: number | null
  updatedAt: string
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

function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  placeholder = '请选择日期范围',
}: {
  startDate: string
  endDate: string
  onStartChange: (val: string) => void
  onEndChange: (val: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const hasValue = Boolean(startDate || endDate)
  const displayText = startDate && endDate ? `${startDate} 至 ${endDate}` : placeholder

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full min-w-0 cursor-pointer items-center justify-between rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-left text-[13px] outline-none focus:border-[#409eff]"
      >
        <span className={`truncate ${hasValue ? 'text-[#0A1B39]' : 'text-[#c0c4cc]'}`} title={displayText}>
          {displayText}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {hasValue && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                onStartChange('')
                onEndChange('')
              }}
              className="text-[#c0c4cc] hover:text-[#86909C]"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <Calendar className="h-3.5 w-3.5 text-[#c0c4cc]" />
        </div>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border border-[#e6e9ef] bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[12px] text-[#86909C]">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartChange(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2 text-[13px] outline-none focus:border-[#409eff]"
              />
            </div>
            <span className="mt-4 text-[12px] text-[#86909C]">至</span>
            <div className="flex-1">
              <label className="mb-1 block text-[12px] text-[#86909C]">结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndChange(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2 text-[13px] outline-none focus:border-[#409eff]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onStartChange('')
                onEndChange('')
              }}
              className="h-7 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-3 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
            >
              清除
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 cursor-pointer rounded-lg border-0 bg-[#409eff] px-3 text-[13px] text-white hover:bg-[#66b1ff]"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ReportsListPage() {
  const navigate = useNavigate()

  // 数据流保持桌面端现状：GET /api/reports + react-query
  const { data, isLoading } = useQuery<AnalysisRun[]>({
    queryKey: ['analysis-runs'],
    queryFn: async () => (await api.get<AnalysisRun[]>('/api/reports')).data,
  })

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

  const rows = data || []

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const kw = appliedKeyword.trim().toLowerCase()
      const matchKeyword =
        !kw ||
        (row.reportNo && row.reportNo.toLowerCase().includes(kw)) ||
        row.jobId.toLowerCase().includes(kw) ||
        row.id.toLowerCase().includes(kw)
      const matchStart = !appliedStartTime || row.updatedAt >= appliedStartTime
      const matchEnd = !appliedEndTime || row.updatedAt <= appliedEndTime + ' 23:59:59'
      const matchStatus =
        !appliedStatus ||
        row.status === appliedStatus ||
        (appliedStatus === 'completed' && (row.status === 'completed' || row.status === 'success'))
      return matchKeyword && matchStart && matchEnd && matchStatus
    })
  }, [rows, appliedKeyword, appliedStartTime, appliedEndTime, appliedStatus])

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1
  const safePage = Math.min(currentPage, totalPages)
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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
  }

  const renderPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader breadcrumbs={[{ label: '市场' }, { label: '竞品分析' }, { label: '分析报告' }]} />

      {/* 查询条件卡 */}
      <div className="mb-4 rounded-xl bg-white p-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">关键词</label>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                placeholder="请输入"
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">更新时间</label>
            <DateRangePicker startDate={startTime} endDate={endTime} onStartChange={setStartTime} onEndChange={setEndTime} />
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

      {/* 数据表格卡 */}
      <div className="rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                <th className="whitespace-nowrap px-4 py-3.5 text-left text-[13px] font-medium text-[#86909C]">报告编号</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-left text-[13px] font-medium text-[#86909C]">价格区间</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-left text-[13px] font-medium text-[#86909C]">竞品数量</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-left text-[13px] font-medium text-[#86909C]">更新时间</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-left text-[13px] font-medium text-[#86909C]">报告状态</th>
                <th className="whitespace-nowrap px-4 py-3.5 text-left text-[13px] font-medium text-[#86909C]">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[14px] text-[#86909C]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      加载中…
                    </span>
                  </td>
                </tr>
              )}
              {!isLoading &&
                pageRows.map((row) => {
                  const view = statusView(row.status)
                  const canView = row.status === 'completed' || row.status === 'success'
                  return (
                    <tr key={row.id} className="border-b border-[#eef1f5] transition-colors hover:bg-[#f9fafb]">
                      <td className="whitespace-nowrap px-4 py-4 text-[14px] text-[#0A1B39]">
                        {row.reportNo || `REP-${row.id.slice(0, 10).toUpperCase()}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[14px] text-[#344054]">
                        {row.priceMin != null && row.priceMax != null ? `¥${row.priceMin} ~ ¥${row.priceMax}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[14px] text-[#344054]">{row.competitorCount ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-[14px] text-[#86909C]">{formatDateTime(row.updatedAt)}</td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[12px] ${view.className}`}>{view.text}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="flex items-center gap-3">
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
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {!isLoading && pageRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <FileBarChart className="mb-4 h-16 w-16 text-[#d0d5dd]" />
            <p className="text-[16px] text-[#86909C]">暂无数据</p>
            <p className="mt-2 text-[14px] text-[#86909C]">前往「AI数据采集」页面采集竞品数据后查看报告</p>
          </div>
        )}

        {filteredRows.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#eef1f5] px-6 py-4">
            <span className="text-[13px] text-[#86909C]">共 {filteredRows.length} 条</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#eef1f5] bg-white text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {renderPageNumbers().map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`flex h-8 min-w-[32px] cursor-pointer items-center justify-center rounded-lg px-2 text-[13px] transition-colors ${
                    safePage === pageNum ? 'border-0 bg-[#3388ff] text-white' : 'border border-[#eef1f5] bg-white text-[#344054] hover:bg-[#f9fafb]'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#eef1f5] bg-white text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
