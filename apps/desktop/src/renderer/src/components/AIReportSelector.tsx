import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, CircleHelp, Loader2 } from 'lucide-react'

export type SuiteProduct = {
  value: string
  label: string
  keyword?: string
  count: number
  priceRange?: string
  status?: string
  reportId?: string | number
  latestAt?: string
}

// 标题样式对照旧版 SectionTitle（mb-4 flex gap-1 text-[14px] font-semibold text-[#171A1D] + CircleHelp）
export function SectionTitle({ children, help = false }: { children: ReactNode; help?: boolean }) {
  return (
    <h2 className="mb-4 flex items-center gap-1 text-[14px] font-semibold text-[#171A1D]">
      {children}
      {help && <CircleHelp className="h-3.5 w-3.5 text-[#8B949E]" />}
    </h2>
  )
}

export interface AIReportSelectorProps {
  /** 当前选中的报告 id（受控） */
  value: string
  /** 选中/清除报告时回调 */
  onChange: (reportId: string, report: SuiteProduct | null) => void
}

export function AIReportSelector({ value, onChange }: AIReportSelectorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [suiteProducts, setSuiteProducts] = useState<SuiteProduct[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  // 记录最近一次选中的报告对象，避免列表尚未刷新时显示空
  const [recentSelected, setRecentSelected] = useState<SuiteProduct | null>(null)

  const matchedFromList = suiteProducts.find((item) => item.value === value) || null
  const selectedReport = matchedFromList || (value === recentSelected?.value ? recentSelected : null)

  // 数据流保持桌面端现状：数据流：IPC report.list 读取本地 SQLite 报告
  async function loadReports(search = '') {
    setLoadingProducts(true)
    try {
      // 桌面端后端 AnalysisRun.status 的权威完成值为 'success'（report.service.ts 唯一写入处），按真实枚举过滤
      const res = await window.desktop?.capabilities.invoke('report.list', {
        tenantId: 'local',
        status: 'success',
        keyword: search.trim() || undefined,
        pageSize: 100,
      }) as { rows?: Array<Record<string, unknown>> } | undefined
      const rows = Array.isArray(res?.rows) ? res.rows : []
      const items: SuiteProduct[] = rows.map((r: Record<string, unknown>) => ({
        value: String(r.id),
        label: String(r.title || r.keyword || `报告 #${r.id}`),
        keyword: (r.keyword as string) || '商品报告',
        count: Number(r.competitorCount || 0),
        priceRange: (r.priceMin != null && r.priceMax != null ? `¥${r.priceMin}-${r.priceMax}` : '') as string,
        status: r.status as string,
        reportId: r.id as string,
        latestAt: r.createdAt as string,
      }))
      setSuiteProducts(items)
    } catch {
      // 静默失败，保留旧列表（对照旧版 legacy:80-81）
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    void loadReports('')
  }, [])

  // 点击下拉外部区域时自动收起
  useEffect(() => {
    if (!productDropdownOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (containerRef.current && !containerRef.current.contains(target)) {
        setProductDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [productDropdownOpen])

  function selectReport(product: SuiteProduct) {
    setRecentSelected(product)
    onChange(product.value, product)
    setProductDropdownOpen(false)
  }

  // 以下结构逐字对照旧版 AIReportSelector.tsx
  return (
    <>
      <SectionTitle help>选择AI报告</SectionTitle>
      <div ref={containerRef} className="relative mb-4">
        <button
          type="button"
          onClick={() => {
            setProductDropdownOpen((current) => !current)
            if (!suiteProducts.length) void loadReports('')
          }}
          className={`flex h-[44px] w-full cursor-pointer items-center justify-between rounded-[8px] border-0 px-3 text-left text-[13px] font-medium transition-colors ${
            productDropdownOpen ? 'bg-white text-[#171A1D] ring-1 ring-[#3388ff]' : 'bg-[#F2F3F5] text-[#171A1D] hover:bg-[#ECEFF4]'
          }`}
        >
          <span className={`min-w-0 truncate ${selectedReport ? 'text-[#171A1D]' : 'text-[#8B949E]'}`}>
            {selectedReport ? selectedReport.label : '选择已完成的商品报告'}
          </span>
          {loadingProducts ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#8B949E]" />
          ) : (
            <ChevronDown className={`h-5 w-5 shrink-0 text-[#0A1B39] transition-transform ${productDropdownOpen ? 'rotate-180' : ''}`} />
          )}
        </button>
        {productDropdownOpen && (
          <div className="absolute left-0 right-0 top-[50px] z-40 rounded-[8px] border border-[#E5EAF2] bg-white p-2 shadow-[0_14px_32px_rgba(15,23,41,.14)]">
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void loadReports(productSearch)
              }}
              placeholder="搜索报告关键词"
              className="mb-2 h-8 w-full rounded-[8px] border border-[#DDE3EC] px-3 text-[12px] text-[#171A1D] outline-none focus:border-[#3388ff]"
            />
            <div className="max-h-[230px] overflow-y-auto custom-scrollbar">
              {suiteProducts.length ? (
                suiteProducts.map((product) => (
                  <button
                    key={product.value}
                    type="button"
                    onClick={() => selectReport(product)}
                    className={`mb-1 w-full cursor-pointer rounded-[8px] border-0 px-3 py-2 text-left transition-colors last:mb-0 ${
                      value === product.value ? 'bg-[#EAF4FF]' : 'bg-white hover:bg-[#F5F6F8]'
                    }`}
                  >
                    <div className={`truncate text-[13px] font-semibold ${value === product.value ? 'text-[#1683FF]' : 'text-[#171A1D]'}`}>
                      {product.label}
                    </div>
                    <div className="mt-1 truncate text-[11px] font-normal text-[#8B949E]">
                      {product.keyword || '商品报告'} · {product.priceRange || '价格区间未记录'} · {product.count || 0} 个竞品
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[8px] bg-[#F8FAFC] px-3 py-4 text-center text-[12px] text-[#8B949E]">
                  {loadingProducts ? '正在读取报告' : '暂无已完成的商品报告'}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void loadReports(productSearch)}
              className="mt-2 h-8 w-full cursor-pointer rounded-[8px] border-0 bg-[#F2F3F5] text-[12px] font-semibold text-[#3388ff] transition-colors hover:bg-[#EAF4FF]"
            >
              刷新报告
            </button>
          </div>
        )}
      </div>
    </>
  )
}
