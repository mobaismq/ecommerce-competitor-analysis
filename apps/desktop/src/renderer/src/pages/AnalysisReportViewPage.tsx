import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react'
import { Message } from '@arco-design/web-react'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'

// 数据契约对齐后端 GET /api/reports/:id 返回结构：
// AnalysisRun（含 reportJson）+ priceBands（analysisPriceBand 表：bandName/priceMin/priceMax/productCount）。
// 注意：AnalysisRun 无 priceMin/priceMax 标量，也无 summaryJson；报告区间与 AI 总结需从 priceBands / reportJson 读取。
interface PriceBand {
  id: string
  bandName: string
  priceMin: number | null
  priceMax: number | null
  productCount: number
}

interface AnalysisReportDetail {
  id: string
  reportNo: string | null
  jobId: string
  status: string
  competitorCount: number | null
  reportJson: {
    summary?: string
    insights?: Array<{ type: string; title?: string; content?: string }>
  } | null
  updatedAt: string
  createdAt: string
  priceBands?: PriceBand[]
}

// SectionCard 对照旧版 AnalysisReportView 的统一区块（mb-5 rounded-2xl bg-white p-6 shadow + 编号色块）
function SectionCard({
  badge,
  badgeColor,
  title,
  subtitle,
  children,
}: {
  badge: string
  badgeColor: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="mb-5 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
      <div className="mb-5 flex items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-extrabold text-white ${badgeColor}`}>{badge}</div>
        <div>
          <h2 className="m-0 text-[16px] font-extrabold text-[#0A1B39]">{title}</h2>
          <p className="m-0 mt-0.5 text-[12px] text-[#86909C]">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export function AnalysisReportViewPage() {
  // id/keyword 兼容两种入口：主路由 report/view?id=（旧版查询串契约）与别名 analysis/reports/:id
  const params = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id') || params.id
  const keyword = searchParams.get('keyword') || ''
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)

  // 数据流保持桌面端现状：GET /api/reports/:id + POST export
  const { data: report, isLoading, refetch, isError } = useQuery<AnalysisReportDetail>({
    queryKey: ['report-detail', id],
    queryFn: async () => {
      const res = await api.get<AnalysisReportDetail>(`/api/reports/${id}`)
      return res.data
    },
    enabled: Boolean(id),
    retry: false,
  })

  const handleExport = async (format: 'xlsx' | 'json') => {
    if (!id) return
    setExporting(true)
    try {
      const res = await api.post(`/api/reports/${id}/export`, { format })
      Message.success(`导出成功：${res.data?.filename || '已生成导出文件'}`)
    } catch {
      Message.error('导出报告失败，请稍后重试')
    } finally {
      setExporting(false)
    }
  }

  const backBreadcrumbs = [
    { label: '市场', to: '/market/competitive/ai-collect' },
    { label: '竞品分析', to: '/market/competitive/ai-collect' },
    { label: '分析报告', to: '/market/competitive/report' },
    { label: '报告查看' },
  ]

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
        <PageHeader breadcrumbs={backBreadcrumbs} />
        <div className="grid place-items-center py-24 text-[14px] text-[#86909C]">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          正在加载竞品分析报告数据...
        </div>
      </div>
    )
  }

  if (isError || !report) {
    return (
      <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
        <PageHeader breadcrumbs={backBreadcrumbs} />
        <div className="grid place-items-center rounded-2xl bg-white py-24 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="text-center">
            <p className="text-[16px] text-[#86909C]">未找到对应的竞品分析报告</p>
            <button
              type="button"
              onClick={() => navigate('/market/competitive/report')}
              className="mt-4 cursor-pointer rounded-lg border-0 bg-[#3388ff] px-5 py-2 text-[14px] font-bold text-white hover:bg-[#1a6fe8]"
            >
              返回报告列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  // priceBands 来自后端 analysisPriceBand（bandName/priceMin/priceMax/productCount），无销量/销额字段
  const priceBands = report.priceBands || []
  const totalProducts = report.competitorCount ?? priceBands.reduce((sum, b) => sum + (b.productCount || 0), 0)
  const reportJson = report.reportJson || {}
  const summaryText = reportJson.summary?.trim() || ''

  // 价格区间：从 priceBands 推导整体范围（AnalysisRun 无 priceMin/priceMax 标量）
  const rangeMin = priceBands.length ? Math.min(...priceBands.map((b) => b.priceMin ?? Infinity)) : null
  const rangeMax = priceBands.length ? Math.max(...priceBands.map((b) => b.priceMax ?? -Infinity)) : null

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader
        breadcrumbs={backBreadcrumbs.map((item, idx) => (idx === 3 ? { label: keyword ? '报告查看' : '报告查看' } : item))}
      />

      {/* 返回链接（对照旧版） */}
      <Link to="/market/competitive/report" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[#3388ff] hover:text-[#1a6fe8]">
        <ArrowLeft className="h-3.5 w-3.5" />
        返回报告列表
      </Link>

      {/* 标题行（对照旧版 h1 text-[28px] + 右侧操作） */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="m-0 text-[28px] font-extrabold text-[#0A1B39]">
          {report.reportNo || `报告 ${report.id.slice(0, 10).toUpperCase()}`}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e6e9ef] bg-white px-3 text-[13px] font-semibold text-[#0A1B39] hover:border-[#b8d7ff]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
          <button
            type="button"
            onClick={() => void handleExport('xlsx')}
            disabled={exporting}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#3388ff] px-3 text-[13px] font-bold text-white hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:bg-[#b8d7ff]"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            导出 Excel
          </button>
          <button
            type="button"
            onClick={() => void handleExport('json')}
            disabled={exporting}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e6e9ef] bg-white px-3 text-[13px] font-semibold text-[#0A1B39] hover:border-[#b8d7ff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            导出 JSON
          </button>
        </div>
      </div>

      {/* 报告说明卡（对照旧版 rounded-2xl grid-cols-4 指标块） */}
      <div className="mb-5 grid grid-cols-4 gap-4 rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        {[
          { label: '样本竞品总数', value: `${totalProducts} 件`, color: 'text-[#3388ff]' },
          {
            label: '核心价格区间',
            value: rangeMin != null && rangeMax != null ? `¥${rangeMin} - ¥${rangeMax}` : '暂无',
            color: 'text-[#2e7d32]',
          },
          { label: '细分价格带数量', value: `${priceBands.length} 个`, color: 'text-[#722ed1]' },
          { label: '总分析月销量', value: '暂无', color: 'text-[#f57c00]' },
        ].map((item) => (
          <div key={item.label}>
            <p className="m-0 text-[12px] font-semibold text-[#86909C]">{item.label}</p>
            <p className={`m-0 mt-1 text-[20px] font-extrabold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ¥ 价格区间分析（数据：priceBands；后端当前仅提供价格区间与竞品数） */}
      <SectionCard badge="¥" badgeColor="bg-[#22a06b]" title="价格区间分析" subtitle="各价格带竞品密度与分布">
        {priceBands.length === 0 ? (
          <p className="m-0 py-10 text-center text-[14px] text-[#86909C]">暂无价格带数据</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">价格区间</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">竞品商品数</th>
                </tr>
              </thead>
              <tbody>
                {priceBands.map((band) => (
                  <tr key={band.id} className="border-b border-[#eef1f5] transition-colors hover:bg-[#f9fafb]">
                    <td className="whitespace-nowrap px-4 py-3.5 text-[14px] font-bold text-[#0A1B39]">
                      ¥{band.priceMin} - ¥{band.priceMax}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[14px] text-[#344054]">{band.productCount} 款商品</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* SELL AI 总结（数据：reportJson.summary） */}
      <SectionCard badge="S" badgeColor="bg-[#7a5af8]" title="AI 策略总结" subtitle="AI 提炼的核心结论与策略建议">
        <div className="rounded-xl border border-[#eef1f5] bg-[#f8fafc] p-4 text-[14px] leading-7 text-[#344054]">
          {summaryText || '暂无 AI 策略总结。'}
        </div>
      </SectionCard>
    </div>
  )
}
