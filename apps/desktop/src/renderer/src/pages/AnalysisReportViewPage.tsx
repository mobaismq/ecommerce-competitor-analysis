import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Loader2, RefreshCw, X } from 'lucide-react'
import { Message } from '@arco-design/web-react'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'

// 富报告契约对齐后端报告生成 report.service reportJson：除 summary 外含富价格带（代表商品）、卖点/痛点/需求/机会。
interface RichSku {
  name?: string | null
  price?: number | null
}
interface RichPriceBand {
  bandName: string
  priceMin: number
  priceMax: number
  productCount: number
  avgPrice?: number | null
  representativeProducts?: Array<{
    title?: string | null
    shopName?: string | null
    price?: number | null
    skuCount?: number
    skus?: RichSku[]
  }>
}
interface RichReportJson {
  summary?: string
  priceBands?: RichPriceBand[]
  sellingPoints?: Array<{ term: string; count: number }>
  painPoints?: string[]
  userDemands?: string[]
  opportunities?: string[]
}

// 列表接口 priceBands（analysisPriceBand 表：仅计数）作为无富结构时的回退
interface TablePriceBand {
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
  keyword?: string | null
  competitorCount: number | null
  reportJson?: RichReportJson | null
  updatedAt: string
  createdAt: string
  priceBands?: TablePriceBand[]
}

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
  const params = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id') || params.id
  const keyword = searchParams.get('keyword') || ''
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)

  // 利润测算（对照旧版 AnalysisReportView calculateProfit/resetProfitModal，纯前端）
  const [profitModal, setProfitModal] = useState(false)
  const [sellingPrice, setSellingPrice] = useState('')
  const [productCost, setProductCost] = useState('')
  const [warehouseCost, setWarehouseCost] = useState('2')
  const [afterSalesCost, setAfterSalesCost] = useState('5')
  const [profitResult, setProfitResult] = useState<{
    grossProfit: number
    grossMargin: number
    netProfit: number
    netMargin: number
  } | null>(null)

  const calculateProfit = () => {
    const price = parseFloat(sellingPrice)
    const cost = parseFloat(productCost)
    const warehouse = parseFloat(warehouseCost) || 0
    const afterSales = parseFloat(afterSalesCost) || 0
    if (isNaN(price) || isNaN(cost) || price <= 0) return
    const taxRate = 0.05
    const commissionRate = 0.08
    const grossProfit = price - cost
    const grossMargin = (grossProfit / price) * 100
    const tax = price * taxRate
    const commission = price * commissionRate
    const netProfit = price - cost - warehouse - afterSales - tax - commission
    const netMargin = (netProfit / price) * 100
    setProfitResult({ grossProfit, grossMargin: Math.round(grossMargin * 100) / 100, netProfit, netMargin: Math.round(netMargin * 100) / 100 })
  }

  const openProfitModal = () => {
    setSellingPrice('')
    setProductCost('')
    setWarehouseCost('2')
    setAfterSalesCost('5')
    setProfitResult(null)
    setProfitModal(true)
  }

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

  const rj = report.reportJson || {}
  const summaryText = rj.summary?.trim() || ''
  // 富价格带优先，回退列表接口 analysisPriceBand 表（仅计数）
  const richBands = (rj.priceBands as RichPriceBand[] | undefined) || []
  const tableBands = report.priceBands || []
  const bands = richBands.length ? richBands : tableBands
  const totalProducts = report.competitorCount ?? bands.reduce((sum, b) => sum + (b.productCount || 0), 0)
  const rangeMin = bands.length ? Math.min(...bands.map((b) => b.priceMin ?? Infinity)) : null
  const rangeMax = bands.length ? Math.max(...bands.map((b) => b.priceMax ?? -Infinity)) : null
  const sellingPoints = rj.sellingPoints || []
  const painPoints = rj.painPoints || []
  const userDemands = rj.userDemands || []
  const opportunities = rj.opportunities || []
  const hasRichStory = Boolean(richBands.length || sellingPoints.length || painPoints.length || userDemands.length || opportunities.length)

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader breadcrumbs={backBreadcrumbs.map((item, idx) => (idx === 3 ? { label: '报告查看' } : item))} />

      <Link to="/market/competitive/report" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[#3388ff] hover:text-[#1a6fe8]">
        <ArrowLeft className="h-3.5 w-3.5" />
        返回报告列表
      </Link>

      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="m-0 text-[28px] font-extrabold text-[#0A1B39]">
          {report.reportNo || `报告 ${report.id.slice(0, 10).toUpperCase()}`}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openProfitModal}
            className="flex h-9 cursor-pointer items-center rounded-lg border border-[#3388ff] bg-white px-3 text-[13px] font-semibold text-[#3388ff] hover:bg-[#f0f7ff]"
          >
            利润测算
          </button>
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

      <div className="mb-5 grid grid-cols-4 gap-4 rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        {[
          { label: '分析关键词', value: keyword || report.keyword || '—', color: 'text-[#3388ff]' },
          { label: '样本竞品总数', value: `${totalProducts} 件`, color: 'text-[#3388ff]' },
          { label: '核心价格区间', value: rangeMin != null && rangeMax != null ? `¥${rangeMin} - ¥${rangeMax}` : '暂无', color: 'text-[#2e7d32]' },
          { label: '细分价格带数量', value: `${bands.length} 个`, color: 'text-[#722ed1]' },
          { label: '总分析月销量', value: '未采集', color: 'text-[#f57c00]' },
          { label: '采集时间', value: report.createdAt ? new Date(report.createdAt).toLocaleString() : '—', color: 'text-[#86909C]' },
        ].map((item) => (
          <div key={item.label}>
            <p className="m-0 text-[12px] font-semibold text-[#86909C]">{item.label}</p>
            <p className={`m-0 mt-1 text-[20px] font-extrabold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* ¥ 价格区间分析（含均价与代表商品） */}
      <SectionCard badge="¥" badgeColor="bg-[#22a06b]" title="价格区间分析" subtitle="各价格带竞品分布、均价与代表商品">
        {bands.length === 0 ? (
          <p className="m-0 py-10 text-center text-[14px] text-[#86909C]">暂无价格带数据</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">价格区间</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-[13px] font-medium text-[#86909C]">竞品数</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-[13px] font-medium text-[#86909C]">均价</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">代表商品</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((band, idx) => {
                  const reps = 'representativeProducts' in band ? ((band as RichPriceBand).representativeProducts || []) : []
                  return (
                    <tr key={band.bandName || idx} className="border-b border-[#eef1f5] transition-colors hover:bg-[#f9fafb]">
                      <td className="whitespace-nowrap px-4 py-3.5 text-[14px] font-bold text-[#0A1B39]">
                        ¥{band.priceMin} - ¥{band.priceMax}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-[14px] text-[#344054]">{band.productCount} 款</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-[14px] text-[#344054]">
                        {'avgPrice' in band && band.avgPrice != null ? `¥${band.avgPrice}` : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        {reps.length ? (
                          <div className="flex flex-col gap-1.5">
                            {reps.slice(0, 3).map((p, i) => (
                              <div key={i} className="truncate text-[13px] text-[#344054]">
                                <span className="font-semibold text-[#0A1B39]">{p.title || '无标题'}</span>
                                <span className="ml-2 text-[#98A2B3]">{p.shopName || '未知店铺'}</span>
                                <span className="ml-2 font-semibold text-[#ff4d00]">¥{p.price ?? '-'}</span>
                                {p.skuCount ? <span className="ml-2 text-[#98A2B3]">{p.skuCount} SKU</span> : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[13px] text-[#98A2B3]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {!hasRichStory ? (
        // 无富结构（老报告）时仅展示 AI 策略总结
        <SectionCard badge="S" badgeColor="bg-[#7a5af8]" title="AI 策略总结" subtitle="AI 提炼的核心结论与策略建议">
          <div className="rounded-xl border border-[#eef1f5] bg-[#f8fafc] p-4 text-[14px] leading-7 text-[#344054]">
            {summaryText || '暂无 AI 策略总结。'}
          </div>
        </SectionCard>
      ) : (
        <>
          {/* 卖点 */}
          <SectionCard badge="S" badgeColor="bg-[#7a5af8]" title="核心卖点" subtitle="AI 从竞品标题、评价与问大家提炼的高频卖点">
            {sellingPoints.length ? (
              <div className="flex flex-wrap gap-2">
                {sellingPoints.map((pt, idx) => (
                  <span key={`${pt.term}-${idx}`} className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${idx < 3 ? 'bg-[#f0f7ff] text-[#3388ff]' : 'bg-[#f2f4f7] text-[#4e5969]'}`}>
                    {pt.term}
                    {pt.count != null && <span className="ml-1.5 font-medium opacity-70">({pt.count}次)</span>}
                  </span>
                ))}
              </div>
            ) : (
              <p className="m-0 py-6 text-center text-[14px] text-[#86909C]">暂无卖点提炼数据</p>
            )}
          </SectionCard>

          {/* 痛点与机会 */}
          <SectionCard badge="A" badgeColor="bg-[#f57c00]" title="用户痛点与机会点" subtitle="高频差评痛点、用户需求与差异化机会方向">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-[#ffd7d7] bg-[#fff9f9] p-4">
                <p className="m-0 mb-3 text-[13px] font-extrabold text-[#c62828]">差评与痛点</p>
                {painPoints.length ? (
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {painPoints.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[13px] text-[#8c3a3a]">
                        <span className="font-extrabold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 text-[13px] text-[#98A2B3]">暂无数据</p>
                )}
              </div>
              <div className="flex flex-col gap-5">
                <div className="rounded-xl border border-[#b7eb8f] bg-[#f6ffed] p-4">
                  <p className="m-0 mb-3 text-[13px] font-extrabold text-[#2e7d32]">用户需求</p>
                  {userDemands.length ? (
                    <div className="flex flex-wrap gap-2">
                      {userDemands.map((item, idx) => (
                        <span key={idx} className="rounded-lg bg-[#e8f5e9] px-3 py-1 text-[13px] text-[#2e7d32]">{item}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="m-0 text-[13px] text-[#98A2B3]">暂无数据</p>
                  )}
                </div>
                <div className="rounded-xl border border-[#d8ebff] bg-[#f5faff] p-4">
                  <p className="m-0 mb-3 text-[13px] font-extrabold text-[#3388ff]">差异化机会点</p>
                  {opportunities.length ? (
                    <div className="flex flex-wrap gap-2">
                      {opportunities.map((item, idx) => (
                        <span key={idx} className="rounded-lg bg-[#f0f7ff] px-3 py-1 text-[13px] text-[#3388ff]">{item}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="m-0 text-[13px] text-[#98A2B3]">暂无数据</p>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* AI 策略总结 */}
          <SectionCard badge="T" badgeColor="bg-[#7a5af8]" title="AI 策略总结" subtitle="AI 提炼的核心结论与策略建议">
            <div className="rounded-xl border border-[#eef1f5] bg-[#f8fafc] p-4 text-[14px] leading-7 text-[#344054]">
              {summaryText || '暂无 AI 策略总结。'}
            </div>
          </SectionCard>
        </>
      )}

      {/* 利润测算弹窗（对照旧版 AnalysisReportView） */}
      {profitModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setProfitModal(false)}>
          <div
            className="w-[min(480px,90vw)] rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(29,38,52,.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[18px] text-[#0A1B39]">利润测算</h2>
              <button
                onClick={() => setProfitModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] text-[#667085]">售价</label>
                <div className="relative">
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="请输入商品售价"
                    inputMode="decimal"
                    className="h-10 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 pr-12 text-[13px] text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">元</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] text-[#667085]">商品成本</label>
                <div className="relative">
                  <input
                    type="number"
                    value={productCost}
                    onChange={(e) => setProductCost(e.target.value)}
                    placeholder="请输入商品成本"
                    inputMode="decimal"
                    className="h-10 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 pr-12 text-[13px] text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">元</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] text-[#667085]">仓配成本</label>
                <div className="relative">
                  <input
                    type="number"
                    value={warehouseCost}
                    onChange={(e) => setWarehouseCost(e.target.value)}
                    inputMode="decimal"
                    className="h-10 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 pr-12 text-[13px] text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">元</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] text-[#667085]">售后成本</label>
                <div className="relative">
                  <input
                    type="number"
                    value={afterSalesCost}
                    onChange={(e) => setAfterSalesCost(e.target.value)}
                    inputMode="decimal"
                    className="h-10 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 pr-12 text-[13px] text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">元</span>
                </div>
              </div>

              <button
                onClick={calculateProfit}
                className="h-11 w-full rounded-lg bg-[#3388ff] text-[14px] text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8]"
              >
                利润测算
              </button>

              {profitResult && (
                <div className="rounded-lg bg-[#f8fafc] p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[12px] text-[#86909C]">毛利润</p>
                      <p className="text-[18px] text-[#0A1B39]">¥{profitResult.grossProfit.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#86909C]">毛利率</p>
                      <p className="text-[18px] text-[#2e7d32]">{profitResult.grossMargin.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#86909C]">纯利润</p>
                      <p className={`text-[18px] ${profitResult.netProfit >= 0 ? 'text-[#0A1B39]' : 'text-[#e53935]'}`}>
                        ¥{profitResult.netProfit.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#86909C]">纯利润率</p>
                      <p className={`text-[18px] ${profitResult.netMargin >= 0 ? 'text-[#2e7d32]' : 'text-[#e53935]'}`}>
                        {profitResult.netMargin.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}