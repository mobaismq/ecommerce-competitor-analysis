import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, CircleHelp, Loader2 } from "lucide-react";

export type SuiteProduct = {
  value: string;
  label: string;
  keyword?: string;
  count: number;
  priceRange?: string;
  status?: string;
  reportId?: number;
  latestRunId?: number;
  latestAt?: string;
};

type AnalysisReportRow = {
  id?: string;
  runId?: number;
  keyword?: string;
  priceRange?: string;
  competitorCount?: number;
  collectTime?: string;
  status?: string;
  reportTitle?: string;
};

export function SectionTitle({ children, help = false }: { children: ReactNode; help?: boolean }) {
  return <h2 className="mb-4 flex items-center gap-1 text-[14px] font-semibold text-[#171A1D]">{children}{help && <CircleHelp className="h-3.5 w-3.5 text-[#8B949E]" />}</h2>;
}

export type AIReportSelectorProps = {
  /** 当前选中的 runId（受控） */
  value: string;
  /** 选中/清除报告时回调 */
  onChange: (runId: string, report: SuiteProduct | null) => void;
};

export function AIReportSelector({ value, onChange }: AIReportSelectorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [suiteProducts, setSuiteProducts] = useState<SuiteProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  // 记录最近一次选中的报告对象，避免列表尚未刷新时显示空
  const [recentSelected, setRecentSelected] = useState<SuiteProduct | null>(null);

  const matchedFromList = suiteProducts.find((item) => item.value === value) || null;
  const selectedReport = matchedFromList || (value === recentSelected?.value ? recentSelected : null);

  async function loadProducts(search = "") {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.set("status", "generated");
      if (search.trim()) params.set("keyword", search.trim());
      const response = await fetch(`/api/report/analysis-list?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取AI报告失败");
      const products: SuiteProduct[] = (data.rows || [])
        .map((row: AnalysisReportRow) => {
          const runId = Number(row.runId || 0);
          if (!runId) return null;
          const keyword = String(row.keyword || "商品报告").trim();
          const collectTime = String(row.collectTime || "").trim();
          const fallbackTitle = collectTime ? `${keyword}${collectTime.replace(/\D/g, "").slice(0, 12)}` : keyword;
          return {
            value: String(runId),
            label: String(row.reportTitle || fallbackTitle),
            keyword,
            count: Number(row.competitorCount || 0),
            priceRange: row.priceRange,
            status: row.status,
            reportId: runId,
            latestRunId: runId,
            latestAt: row.collectTime,
          };
        })
        .filter((item: SuiteProduct | null): item is SuiteProduct => Boolean(item));
      setSuiteProducts(products);
    } catch {
      // 静默失败，UI 仍会显示"暂无已完成的商品报告"
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    loadProducts("").catch(() => undefined);
  }, []);

  // 点击下拉外部区域时自动收起
  useEffect(() => {
    if (!productDropdownOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setProductDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [productDropdownOpen]);

  function selectReport(product: SuiteProduct) {
    setRecentSelected(product);
    onChange(product.value, product);
    setProductDropdownOpen(false);
  }

  return (
    <>
      <SectionTitle help>选择AI报告</SectionTitle>
      <div ref={containerRef} className="relative mb-4">
        <button
          type="button"
          onClick={() => {
            setProductDropdownOpen((current) => !current);
            if (!suiteProducts.length) loadProducts("").catch(() => undefined);
          }}
          className={`flex h-[44px] w-full items-center justify-between rounded-[8px] bg-[#F2F3F5] px-3 text-left text-[13px] font-medium transition-colors ${productDropdownOpen ? "bg-white ring-1 ring-[#3388ff]" : "hover:bg-[#ECEFF4]"}`}
        >
          <span className={`min-w-0 truncate ${selectedReport ? "text-[#171A1D]" : "text-[#8B949E]"}`}>
            {selectedReport ? selectedReport.label : "选择已完成的商品报告"}
          </span>
          {loadingProducts ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#8B949E]" />
          ) : (
            <ChevronDown className={`h-5 w-5 shrink-0 text-[#0A1B39] transition-transform ${productDropdownOpen ? "rotate-180" : ""}`} />
          )}
        </button>
        {productDropdownOpen && (
          <div className="absolute left-0 right-0 top-[50px] z-40 rounded-[8px] border border-[#E5EAF2] bg-white p-2 shadow-[0_14px_32px_rgba(15,23,41,.14)]">
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadProducts(productSearch).catch(() => undefined);
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
                    className={`mb-1 w-full rounded-[8px] px-3 py-2 text-left transition-colors last:mb-0 ${value === product.value ? "bg-[#EAF4FF]" : "hover:bg-[#F5F6F8]"}`}
                  >
                    <div className={`truncate text-[13px] font-semibold ${value === product.value ? "text-[#1683FF]" : "text-[#171A1D]"}`}>{product.label}</div>
                    <div className="mt-1 truncate text-[11px] font-normal text-[#8B949E]">
                      {product.keyword || "商品报告"} · {product.priceRange || "价格区间未记录"} · {product.count || 0} 个竞品
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[8px] bg-[#F8FAFC] px-3 py-4 text-center text-[12px] text-[#8B949E]">
                  {loadingProducts ? "正在读取报告" : "暂无已完成的商品报告"}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => loadProducts(productSearch).catch(() => undefined)}
              className="mt-2 h-8 w-full rounded-[8px] bg-[#F2F3F5] text-[12px] font-semibold text-[#3388ff] transition-colors hover:bg-[#EAF4FF]"
            >
              刷新报告
            </button>
          </div>
        )}
      </div>
    </>
  );
}