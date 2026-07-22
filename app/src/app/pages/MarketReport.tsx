import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { AlertCircle, BarChart3, Check, ChevronDown, ChevronRight, Database, ExternalLink, FileText, Image, KeyRound, Loader2, RefreshCw, Search, Sparkles, TrendingUp } from "lucide-react";

type Metric = {
  term?: string;
  keyword?: string;
  count?: number;
};

type CompetitorLink = {
  product_id?: string;
  title?: string;
  price?: number | null;
  sold_count?: number | null;
  sales_amount?: number | null;
  link?: string;
};

type DisplayImage = {
  image_type?: string;
  product_id?: string;
  sku_id?: string;
  url?: string;
  image_url?: string;
  sku_image_url?: string;
};

type PriceBand = {
  price_band: string;
  analysis_status?: "raw" | "partial" | "analyzed";
  competitor_count: number;
  price_min?: number | null;
  price_max?: number | null;
  price_avg?: number | null;
  sold_count_total?: number | null;
  sales_amount_total?: number | null;
  competitor_links?: CompetitorLink[];
  display_images?: {
    available_images?: DisplayImage[];
    note?: string;
  };
  extracted_selling_points?: Metric[];
  qa_and_review?: {
    review_count_total?: number;
    qa_count_total?: number;
    qa_examples?: Array<{ question?: string; answer?: string }>;
    note?: string;
  };
  extracted_demands?: Metric[];
  profit_simulation?: {
    target_price?: number;
    total_cost?: number;
    gross_profit?: number;
    gross_margin?: number;
    break_even_price?: number;
    target_margin_price?: number;
  } | null;
  image_prompts?: {
    main_image_prompt?: string;
    detail_image_prompt?: string;
    buyer_show_prompt?: string;
  };
};

type ReportJson = {
  summary?: {
    keyword?: string;
    competitor_count?: number;
    price_band_count?: number;
    cost_price?: number | null;
  };
  price_band_report?: PriceBand[];
  data_gaps?: string[];
};

type ReportPayload = {
  ok: boolean;
  hasReport?: boolean;
  reportJson?: ReportJson | null;
  markdown?: string;
  jsonFile?: string;
  markdownFile?: string;
  error?: string;
  report?: {
    keyword?: string;
    costPrice?: number | string | null;
  };
};

type ReportJob = {
  id: string;
  status: "running" | "completed" | "failed";
  keyword?: string;
  startedAt?: string;
  updatedAt?: string;
  progress?: {
    stage?: string;
    message?: string;
    current?: number;
    total?: number;
    imageCount?: number;
  };
  result?: ReportPayload | null;
  error?: string | null;
};

type ProductOption = {
  value: string;
  label: string;
  count: number;
  paths?: string[];
};

type PreviewPriceBand = {
  price_band: string;
  competitor_count: number;
  price_min?: number | null;
  price_max?: number | null;
  price_avg?: number | null;
  sold_count_total?: number | null;
  sales_amount_total?: number | null;
  competitor_links?: CompetitorLink[];
  display_images?: {
    available_images?: DisplayImage[];
    note?: string;
  };
  qa_and_review?: PriceBand["qa_and_review"];
  profit_simulation?: PriceBand["profit_simulation"];
  image_count?: number;
  qa_count_total?: number;
  gross_margin?: number | null;
};

type OpenAiSettings = {
  configured: boolean;
  maskedKey?: string;
  model?: string;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-[12px] font-bold text-[#667085]">{children}</label>;
}

function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "无数据";
  return `¥${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function formatCount(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "0";
  return Number(value).toLocaleString("zh-CN");
}

function imageUrl(image: DisplayImage) {
  const raw = image.url || image.image_url || image.sku_image_url || "";
  if (raw.startsWith("//")) return `https:${raw}`;
  return raw;
}

function metricText(items?: Metric[], limit = 3) {
  const list = (items || []).slice(0, limit).map((item) => item.term || item.keyword).filter(Boolean);
  return list.length ? list.join("、") : "暂无";
}

function aggregateMetrics(bands: PriceBand[], key: "extracted_selling_points" | "extracted_demands") {
  const counter = new Map<string, number>();
  bands.forEach((band) => {
    (band[key] || []).forEach((item) => {
      const name = item.term || item.keyword;
      if (!name) return;
      counter.set(name, (counter.get(name) || 0) + Number(item.count || 1));
    });
  });
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term, count]) => ({ term, count }));
}

function hasMetricItems(items?: Metric[]) {
  return (items || []).some((item) => Boolean((item.term || item.keyword || "").trim()));
}

function getAnalysisStatus(band: PriceBand): PriceBand["analysis_status"] {
  const hasSellingPoints = hasMetricItems(band.extracted_selling_points);
  const hasDemands = hasMetricItems(band.extracted_demands);
  if (hasSellingPoints || hasDemands) return "analyzed";
  return band.analysis_status === "raw" ? "raw" : "partial";
}

function analysisBadge(status?: PriceBand["analysis_status"]) {
  if (status === "analyzed") return { text: "已AI分析", className: "bg-[#e8fff1] text-[#16934a]" };
  if (status === "partial") return { text: "AI未产出", className: "bg-[#fff7e8] text-[#b76700]" };
  return { text: "基础数据", className: "bg-[#f2f4f7] text-[#667085]" };
}

function pendingAnalysisText(status?: PriceBand["analysis_status"]) {
  return status === "partial" ? "AI 未产出，建议重跑" : "待 AI 分析";
}

function rangeOverlap(aMin?: number | null, aMax?: number | null, bMin?: number | null, bMax?: number | null) {
  if (aMin == null || aMax == null || bMin == null || bMax == null) return 0;
  return Math.max(0, Math.min(Number(aMax), Number(bMax)) - Math.max(Number(aMin), Number(bMin)));
}

function chips(items?: Metric[]) {
  const list = (items || []).slice(0, 8);
  if (!list.length) return <span className="text-[13px] font-medium text-[#98A2B3]">暂无提炼结果</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((item, index) => (
        <span key={`${item.term || item.keyword}-${index}`} className="rounded-lg bg-[#eef6ff] px-2.5 py-1 text-[12px] font-bold text-[#286bd8]">
          {item.term || item.keyword} {item.count ? `×${item.count}` : ""}
        </span>
      ))}
    </div>
  );
}

function CompactInput({
  label,
  value,
  onChange,
  width = "w-[92px]",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  width?: string;
}) {
  return (
    <div className={`${width} shrink-0`}>
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
      />
    </div>
  );
}

export function MarketReport() {
  const [searchParams] = useSearchParams();
  const initialKeyword = searchParams.get("keyword") || "手表";
  const [keyword, setKeyword] = useState(initialKeyword);
  const [limit, setLimit] = useState("120");
  const [costPrice, setCostPrice] = useState("100");
  const [shippingCost, setShippingCost] = useState("0");
  const [packagingCost, setPackagingCost] = useState("0");
  const [laborCost, setLaborCost] = useState("0");
  const [platformFeeRate, setPlatformFeeRate] = useState("0");
  const [adFeeRate, setAdFeeRate] = useState("0");
  const [targetMargin, setTargetMargin] = useState("0.3");
  const [saveToDb, setSaveToDb] = useState(true);
  const [productSearch, setProductSearch] = useState(initialKeyword);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productOptionsLoading, setProductOptionsLoading] = useState(false);
  const [openAiSettings, setOpenAiSettings] = useState<OpenAiSettings | null>(null);
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [openAiModel, setOpenAiModel] = useState("doubao-seed-2-0-pro-260215");
  const [savingOpenAi, setSavingOpenAi] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [reportJob, setReportJob] = useState<ReportJob | null>(null);
  const [previewBands, setPreviewBands] = useState<PreviewPriceBand[]>([]);
  const [previewBandsLoading, setPreviewBandsLoading] = useState(false);
  const [targetPriceBand, setTargetPriceBand] = useState("");
  const [selectedBandName, setSelectedBandName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const detailRef = useRef<HTMLElement | null>(null);
  const productSelectRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollDetailRef = useRef(false);

  const report = payload?.reportJson || null;
  const summary = report?.summary;
  const reportKeyword = String(summary?.keyword || payload?.report?.keyword || "").trim();
  const reportMatchesKeyword = !reportKeyword || !keyword.trim() || reportKeyword === keyword.trim();
  const reportBands = useMemo(() => reportMatchesKeyword ? report?.price_band_report || [] : [], [report, reportMatchesKeyword]);
  const bands = useMemo(() => {
    const bucket = new Map<string, PriceBand>();
    previewBands.forEach((band) => {
      bucket.set(band.price_band, {
        price_band: band.price_band,
        analysis_status: "raw",
        competitor_count: band.competitor_count,
        price_min: band.price_min,
        price_max: band.price_max,
        price_avg: band.price_avg,
        sold_count_total: band.sold_count_total,
        sales_amount_total: band.sales_amount_total,
        competitor_links: band.competitor_links || [],
        display_images: band.display_images || {
          available_images: [],
          note: `数据库已有基础数据：${formatCount(band.image_count)} 张图片，${formatCount(band.qa_count_total)} 条问大家。AI 分析后会补充卖点、需求和作图提示词。`,
        },
        extracted_selling_points: [],
        extracted_demands: [],
        qa_and_review: band.qa_and_review || {
          review_count_total: 0,
          qa_count_total: band.qa_count_total || 0,
          qa_examples: [],
        },
        profit_simulation: band.profit_simulation ?? (band.gross_margin == null ? null : { gross_margin: band.gross_margin }),
        image_prompts: {},
      });
    });
    reportBands.forEach((band) => {
      const mergedBand = { ...bucket.get(band.price_band), ...band, analysis_status: getAnalysisStatus(band) };
      bucket.set(band.price_band, mergedBand);
    });
    return Array.from(bucket.values()).sort((a, b) => Number(a.price_min || 0) - Number(b.price_min || 0));
  }, [previewBands, reportBands]);
  const effectiveSummary = useMemo(() => {
    const baseBands = previewBands.length ? previewBands : bands;
    return {
      keyword: summary?.keyword || keyword,
      competitor_count: baseBands.reduce((sum, band) => sum + Number(band.competitor_count || 0), 0),
      price_band_count: bands.length,
      cost_price: summary?.cost_price ?? Number(costPrice || 0),
    };
  }, [summary, keyword, previewBands, bands, costPrice]);
  const hasDisplayData = bands.length > 0;
  const selectedBand = useMemo(() => bands.find((band) => band.price_band === selectedBandName) || null, [bands, selectedBandName]);
  const bestSalesBand = useMemo(() => [...bands].sort((a, b) => Number(b.sold_count_total || 0) - Number(a.sold_count_total || 0))[0] || null, [bands]);
  const bestProfitBand = useMemo(() => [...bands].sort((a, b) => Number(b.profit_simulation?.gross_margin || 0) - Number(a.profit_simulation?.gross_margin || 0))[0] || null, [bands]);
  const overallSellingPoints = useMemo(() => aggregateMetrics(bands, "extracted_selling_points"), [bands]);
  const overallDemands = useMemo(() => aggregateMetrics(bands, "extracted_demands"), [bands]);

  function resolveTargetPriceBand(bandName: string) {
    const cleanName = String(bandName || "").trim();
    if (!cleanName) return "";
    if (previewBands.some((band) => band.price_band === cleanName)) return cleanName;
    const sourceBand = bands.find((band) => band.price_band === cleanName);
    if (!sourceBand || !previewBands.length) return cleanName;
    const ranked = previewBands
      .map((band) => ({
        band,
        overlap: rangeOverlap(sourceBand.price_min, sourceBand.price_max, band.price_min, band.price_max),
        distance: Math.abs(Number(sourceBand.price_avg || sourceBand.price_min || 0) - Number(band.price_avg || band.price_min || 0)),
      }))
      .sort((a, b) => b.overlap - a.overlap || a.distance - b.distance);
    return ranked[0]?.overlap > 0 ? ranked[0].band.price_band : cleanName;
  }

  async function loadLatest(nextKeyword = keyword, syncForm = true) {
    const cleanKeyword = String(nextKeyword || "").trim();
    const params = cleanKeyword ? `?keyword=${encodeURIComponent(cleanKeyword)}` : "";
    const response = await fetch(`/api/report/latest${params}`);
    const data = await response.json();
    setPayload(data);
    setSelectedBandName("");
    const latestKeyword = data.report?.keyword || data.reportJson?.summary?.keyword;
    const latestCost = data.report?.costPrice ?? data.reportJson?.summary?.cost_price;
    if (syncForm && latestKeyword) {
      setKeyword(String(latestKeyword));
      setProductSearch(String(latestKeyword));
    }
    if (syncForm && latestCost != null) setCostPrice(String(latestCost));
    if (!data.ok && data.error) setError(data.error);
  }

  async function loadProductOptions(search = "") {
    setProductOptionsLoading(true);
    try {
      const response = await fetch(`/api/report/products?q=${encodeURIComponent(search)}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取商品列表失败");
      setProductOptions(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProductOptionsLoading(false);
    }
  }

  async function loadPreviewBands() {
    const cleanKeyword = keyword.trim();
    if (!cleanKeyword) {
      setPreviewBands([]);
      setTargetPriceBand("");
      return;
    }
    setPreviewBandsLoading(true);
    try {
      const params = new URLSearchParams({
        keyword: cleanKeyword,
        limit: String(Number(limit || 120)),
        costPrice,
        shippingCost,
        packagingCost,
        laborCost,
        platformFeeRate,
        adFeeRate,
        targetMargin,
      });
      const response = await fetch(`/api/report/price-bands-preview?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取价格段失败");
      const nextBands: PreviewPriceBand[] = data.bands || [];
      setPreviewBands(nextBands);
      setTargetPriceBand((current) => {
        if (current && nextBands.some((band) => band.price_band === current)) return current;
        const best = [...nextBands].sort((a, b) => Number(b.sold_count_total || 0) - Number(a.sold_count_total || 0))[0];
        return best?.price_band || "";
      });
    } catch (err) {
      setPreviewBands([]);
      setTargetPriceBand("");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewBandsLoading(false);
    }
  }

  async function loadOpenAiSettings() {
    const response = await fetch("/api/report/openai-settings");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "读取豆包 Ark 配置失败");
    setOpenAiSettings(data);
    if (data.model) setOpenAiModel(data.model);
  }

  async function saveOpenAiConfig() {
    setSavingOpenAi(true);
    setSettingsMessage("");
    setError("");
    try {
      const response = await fetch("/api/report/openai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: openAiApiKey,
          model: openAiModel,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "保存豆包 Ark 配置失败");
      setOpenAiSettings(data);
      setOpenAiApiKey("");
      setOpenAiModel(data.model || openAiModel);
      setSettingsMessage(`已保存豆包 Ark 配置：${data.maskedKey || "已配置"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingOpenAi(false);
    }
  }

  function chooseProduct(option: ProductOption) {
    setKeyword(option.value);
    setProductSearch(option.value);
    setProductDropdownOpen(false);
    setTargetPriceBand("");
    setSelectedBandName("");
    setPayload(null);
  }

  async function generateReport() {
    setLoading(true);
    setError("");
    setReportJob(null);
    try {
      const response = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          limit: Number(limit || 120),
          costPrice,
          shippingCost: Number(shippingCost || 0),
          packagingCost: Number(packagingCost || 0),
          laborCost: Number(laborCost || 0),
          platformFeeRate: Number(platformFeeRate || 0),
          adFeeRate: Number(adFeeRate || 0),
          targetMargin: Number(targetMargin || 0.3),
          saveToDb,
          targetPriceBand: resolveTargetPriceBand(targetPriceBand),
        }),
      });
      const data = await response.json();
      if (response.status === 409 && data.current) {
        setReportJob(data.current);
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.error || "生成报告失败");
      if (data.queued && data.job) {
        setReportJob(data.job);
      } else {
        setPayload(data);
        setSelectedBandName("");
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  async function pollReportJob() {
    const response = await fetch("/api/report/generate-status");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "读取报告任务状态失败");
    if (!data.hasJob) return;
    const job = data.job as ReportJob;
    setReportJob(job);
    if (job.status === "completed") {
      await loadLatest(keyword, false);
      setLoading(false);
    }
    if (job.status === "failed") {
      setError(job.error || job.progress?.message || "报告生成失败");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProductOptions().catch(() => undefined);
    loadOpenAiSettings().catch(() => undefined);
  }, []);

  useEffect(() => {
    setSelectedBandName("");
    const timer = window.setTimeout(() => {
      loadLatest(keyword, false).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProductOptions(productSearch).catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPreviewBands().catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [keyword, limit, costPrice, shippingCost, packagingCost, laborCost, platformFeeRate, adFeeRate, targetMargin]);

  useEffect(() => {
    if (!loading || !reportJob || reportJob.status !== "running") return;
    const timer = window.setInterval(() => {
      pollReportJob().catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    }, 2000);
    pollReportJob().catch(() => undefined);
    return () => window.clearInterval(timer);
  }, [loading, reportJob?.id, reportJob?.status]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!productSelectRef.current?.contains(event.target as Node)) {
        setProductDropdownOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!selectedBand || !shouldScrollDetailRef.current) return;
    shouldScrollDetailRef.current = false;
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedBand]);

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold text-[#0A1B39]">竞品分析报告</h1>
          <p className="mt-2 text-[14px] font-medium text-[#667085]">先筛选商品生成 AI 视觉报告，再从价格段总览进入详细分析。</p>
        </div>
        <button onClick={loadLatest} className="flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[13px] font-bold text-[#344054] shadow-[0_4px_16px_rgba(29,38,52,.06)] hover:bg-[#f8fafc]">
          <RefreshCw className="h-4 w-4" />
          最近报告
        </button>
      </div>

      <section className="mb-5 rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="flex flex-wrap items-end gap-3">
          <div ref={productSelectRef} className="relative min-w-[260px] flex-[1_1_360px]">
            <FieldLabel>商品</FieldLabel>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              <input
                value={productSearch}
                onFocus={() => setProductDropdownOpen(true)}
                onChange={(event) => {
                  const value = event.target.value;
                  setProductSearch(value);
                  setKeyword(value);
                  setProductDropdownOpen(true);
                  setSelectedBandName("");
                  setPayload(null);
                }}
                className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white pl-9 pr-10 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
                placeholder="搜索库里已有商品"
              />
              <button
                type="button"
                onClick={() => setProductDropdownOpen((open) => !open)}
                className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[#667085] hover:bg-[#f2f4f7]"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${productDropdownOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {productDropdownOpen && (
              <div role="listbox" className="absolute left-0 right-0 top-[64px] z-30 max-h-[320px] overflow-y-auto rounded-lg border border-[#dce3ee] bg-white p-2 shadow-[0_18px_48px_rgba(29,38,52,.16)]">
                {productOptionsLoading && <div className="px-3 py-3 text-[13px] font-bold text-[#667085]">正在读取商品...</div>}
                {!productOptionsLoading && productOptions.length === 0 && <div className="px-3 py-3 text-[13px] font-bold text-[#98A2B3]">没有匹配商品，可直接输入关键词生成报告</div>}
                {!productOptionsLoading && productOptions.map((option) => (
                  <button
                    key={option.value}
                    role="option"
                    aria-selected={keyword === option.value}
                    onClick={() => chooseProduct(option)}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#f4f8ff]"
                  >
                    <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#eef6ff] text-[#3388ff]">
                      {keyword === option.value ? <Check className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-extrabold text-[#0A1B39]">{option.label}</span>
                        <span className="shrink-0 rounded-md bg-[#f2f4f7] px-1.5 py-0.5 text-[11px] font-bold text-[#667085]">{formatCount(option.count)} 个</span>
                      </div>
                      {option.paths?.[0] && <div className="mt-1 truncate text-[12px] font-medium text-[#98A2B3]">{option.paths[0]}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <CompactInput label="数量" value={limit} onChange={setLimit} width="w-[82px]" />
          <div className="min-w-[220px] flex-[1_1_260px]">
            <FieldLabel>分析价格段</FieldLabel>
            <select
              value={targetPriceBand}
              onChange={(event) => setTargetPriceBand(event.target.value)}
              disabled={previewBandsLoading || previewBands.length === 0}
              className="h-10 w-full truncate rounded-lg border border-[#dce3ee] bg-white px-3 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff] disabled:bg-[#f8fafc] disabled:text-[#98A2B3]"
            >
              <option value="">{previewBandsLoading ? "正在分类价格段..." : "选择一个价格段"}</option>
              {previewBands.map((band) => (
                <option key={band.price_band} value={band.price_band}>
                  {band.price_band} · {formatCount(band.competitor_count)}品 · 销量{formatCount(band.sold_count_total)} · 图{formatCount(band.image_count)} · 问{formatCount(band.qa_count_total)}
                </option>
              ))}
            </select>
          </div>
          <CompactInput label="成本" value={costPrice} onChange={setCostPrice} width="w-[88px]" />
          <CompactInput label="目标毛利" value={targetMargin} onChange={setTargetMargin} width="w-[92px]" />

          <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#dce3ee] bg-[#f8fafc] px-3 text-[13px] font-bold text-[#344054]">
            <input checked={saveToDb} onChange={(event) => setSaveToDb(event.target.checked)} type="checkbox" className="h-4 w-4 accent-[#3388ff]" />
            入库
          </label>

          <button onClick={generateReport} disabled={loading || !targetPriceBand} className="ml-auto flex h-10 w-[140px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#3388ff] text-[13px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#b8d7ff]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "生成中" : "AI生成报告"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[#eef1f5] pt-3">
          <div className="w-[88px] shrink-0 text-[12px] font-extrabold text-[#667085]">成本细项</div>
          <CompactInput label="运费" value={shippingCost} onChange={setShippingCost} width="w-[82px]" />
          <CompactInput label="包装" value={packagingCost} onChange={setPackagingCost} width="w-[82px]" />
          <CompactInput label="人工" value={laborCost} onChange={setLaborCost} width="w-[82px]" />
          <CompactInput label="平台费率" value={platformFeeRate} onChange={setPlatformFeeRate} width="w-[92px]" />
          <CompactInput label="推广费率" value={adFeeRate} onChange={setAdFeeRate} width="w-[92px]" />
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[#eef1f5] pt-3">
          <div className="flex w-[150px] shrink-0 items-center gap-2 text-[12px] font-extrabold text-[#667085]">
            <KeyRound className="h-4 w-4 text-[#3388ff]" />
            豆包 Ark 配置
          </div>
          <div className="min-w-[260px] flex-[1_1_420px]">
            <FieldLabel>API Key {openAiSettings?.configured ? `（${openAiSettings.maskedKey}）` : "（未配置）"}</FieldLabel>
            <input
              value={openAiApiKey}
              onChange={(event) => setOpenAiApiKey(event.target.value)}
              type="password"
              className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
              placeholder={openAiSettings?.configured ? "留空则继续使用已保存的 key" : "填写 ark-..."}
            />
          </div>
          <div className="w-[150px] shrink-0">
            <FieldLabel>模型</FieldLabel>
            <input
              value={openAiModel}
              onChange={(event) => setOpenAiModel(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
            />
          </div>
          <button
            onClick={saveOpenAiConfig}
            disabled={savingOpenAi}
            className="flex h-10 w-[110px] shrink-0 items-center justify-center gap-2 rounded-lg border border-[#dce3ee] bg-white text-[13px] font-extrabold text-[#344054] disabled:cursor-not-allowed disabled:text-[#98A2B3]"
          >
            {savingOpenAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            保存
          </button>
        </div>

        {settingsMessage && (
          <div className="mt-3 rounded-lg border border-[#b7ebc6] bg-[#f0fff4] px-3 py-2 text-[13px] font-bold text-[#2e7d32]">
            {settingsMessage}
          </div>
        )}

        {reportJob && (
          <div className="mt-3 rounded-lg border border-[#d8ebff] bg-[#f4f9ff] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-extrabold text-[#0A1B39]">
                  {reportJob.progress?.message || (reportJob.status === "completed" ? "报告已生成" : "正在生成报告")}
                </div>
                <div className="mt-1 text-[12px] font-bold text-[#667085]">
                  {reportJob.progress?.imageCount ? `图片 ${formatCount(reportJob.progress.imageCount)} 张` : "后台任务运行中"}
                  {reportJob.progress?.total ? ` · 进度 ${formatCount(reportJob.progress.current || 0)}/${formatCount(reportJob.progress.total)}` : ""}
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12px] font-extrabold text-[#3388ff]">
                {reportJob.status === "failed" ? "失败" : reportJob.status === "completed" ? "完成" : "运行中"}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dbeafe]">
              <div
                className="h-full rounded-full bg-[#3388ff] transition-all"
                style={{
                  width: `${Math.max(8, Math.min(100, Math.round(((reportJob.progress?.current || 0) / Math.max(1, reportJob.progress?.total || 1)) * 100)))}%`,
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 flex gap-2 rounded-lg border border-[#ffd7d7] bg-[#fff5f5] p-3 text-[13px] font-semibold text-[#c03535]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      <section className="mb-5 grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="flex items-center gap-2 text-[12px] font-bold text-[#86909C]"><FileText className="h-4 w-4" />商品词</div>
          <div className="mt-3 truncate text-[22px] font-extrabold text-[#0A1B39]">{effectiveSummary.keyword || "-"}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="flex items-center gap-2 text-[12px] font-bold text-[#86909C]"><BarChart3 className="h-4 w-4" />竞品数</div>
          <div className="mt-3 text-[22px] font-extrabold text-[#0A1B39]">{formatCount(effectiveSummary.competitor_count)}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="flex items-center gap-2 text-[12px] font-bold text-[#86909C]"><TrendingUp className="h-4 w-4" />价格带</div>
          <div className="mt-3 text-[22px] font-extrabold text-[#0A1B39]">{formatCount(effectiveSummary.price_band_count)}</div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="flex items-center gap-2 text-[12px] font-bold text-[#86909C]"><Database className="h-4 w-4" />成本</div>
          <div className="mt-3 text-[22px] font-extrabold text-[#0A1B39]">{formatMoney(effectiveSummary.cost_price)}</div>
        </div>
      </section>

      {!hasDisplayData && (
        <div className="rounded-lg bg-white p-10 text-center shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <p className="text-[15px] font-bold text-[#667085]">数据库里还没有该商品的基础数据，先下载并入库后再生成报告。</p>
        </div>
      )}

      {hasDisplayData && (
        <>
          <section className="mb-5 rounded-lg bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-extrabold text-[#0A1B39]">简要报告</h2>
                <p className="mt-1 text-[13px] font-medium text-[#667085]">先看全局结论，再选择价格段查看详细证据。</p>
              </div>
              {selectedBand ? (
                <button onClick={() => setSelectedBandName("")} className="h-9 rounded-lg border border-[#dce3ee] px-3 text-[12px] font-bold text-[#344054] hover:border-[#3388ff] hover:text-[#3388ff]">
                  收起详情
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg bg-[#f8fafc] p-4">
                <div className="text-[12px] font-bold text-[#98A2B3]">销量最高价格段</div>
                <div className="mt-2 text-[17px] font-extrabold text-[#0A1B39]">{bestSalesBand?.price_band || "暂无"}</div>
                <div className="mt-1 text-[12px] font-bold text-[#667085]">销量 {formatCount(bestSalesBand?.sold_count_total)} · 均价 {formatMoney(bestSalesBand?.price_avg)}</div>
              </div>
              <div className="rounded-lg bg-[#f8fafc] p-4">
                <div className="text-[12px] font-bold text-[#98A2B3]">毛利较优价格段</div>
                <div className="mt-2 text-[17px] font-extrabold text-[#0A1B39]">{bestProfitBand?.price_band || "暂无"}</div>
                <div className="mt-1 text-[12px] font-bold text-[#667085]">毛利率 {bestProfitBand?.profit_simulation?.gross_margin == null ? "无数据" : `${(bestProfitBand.profit_simulation.gross_margin * 100).toFixed(1)}%`}</div>
              </div>
              <div className="rounded-lg bg-[#f8fafc] p-4">
                <div className="text-[12px] font-bold text-[#98A2B3]">全局共性卖点</div>
                <div className="mt-2 text-[15px] font-extrabold leading-6 text-[#0A1B39]">{metricText(overallSellingPoints, 5)}</div>
              </div>
              <div className="rounded-lg bg-[#f8fafc] p-4">
                <div className="text-[12px] font-bold text-[#98A2B3]">全局潜在需求</div>
                <div className="mt-2 text-[15px] font-extrabold leading-6 text-[#0A1B39]">{metricText(overallDemands, 5)}</div>
              </div>
            </div>
          </section>

          <section className="mb-5 rounded-lg bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-extrabold text-[#0A1B39]">价格段整体报告</h2>
                <p className="mt-1 text-[13px] font-medium text-[#667085]">点击一个价格段后，下方展示该价格段详细报告。</p>
              </div>
              <div className="rounded-lg bg-[#f8fafc] px-3 py-2 text-[12px] font-bold text-[#667085]">共 {formatCount(bands.length)} 个价格段</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {bands.map((band) => {
                const active = selectedBand?.price_band === band.price_band;
                const badge = analysisBadge(band.analysis_status);
                return (
                  <button
                    key={band.price_band}
                    onClick={() => {
                      shouldScrollDetailRef.current = true;
                      setSelectedBandName(band.price_band);
                    }}
                    className={`min-h-[156px] rounded-lg border p-4 text-left transition-colors ${
                      active ? "border-[#3388ff] bg-[#f0f7ff] shadow-[0_8px_24px_rgba(51,136,255,.12)]" : "border-[#eef1f5] bg-white hover:border-[#b8d7ff] hover:bg-[#f8fbff]"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-[16px] font-extrabold text-[#0A1B39]">{band.price_band}</h3>
                          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${badge.className}`}>
                            {badge.text}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] font-bold text-[#667085]">{formatMoney(band.price_min)} - {formatMoney(band.price_max)}</p>
                      </div>
                      <ChevronRight className={`h-5 w-5 shrink-0 ${active ? "text-[#3388ff]" : "text-[#98A2B3]"}`} />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="rounded-lg bg-white/80 p-2">
                        <div className="text-[11px] font-bold text-[#98A2B3]">竞品数</div>
                        <div className="mt-1 text-[16px] font-extrabold text-[#0A1B39]">{formatCount(band.competitor_count)}</div>
                      </div>
                      <div className="rounded-lg bg-white/80 p-2">
                        <div className="text-[11px] font-bold text-[#98A2B3]">均价</div>
                        <div className="mt-1 text-[16px] font-extrabold text-[#0A1B39]">{formatMoney(band.price_avg)}</div>
                      </div>
                      <div className="rounded-lg bg-white/80 p-2">
                        <div className="text-[11px] font-bold text-[#98A2B3]">总销量</div>
                        <div className="mt-1 text-[16px] font-extrabold text-[#0A1B39]">{formatCount(band.sold_count_total)}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <div className="mb-1 text-[11px] font-bold text-[#98A2B3]">核心卖点</div>
                        <div className="line-clamp-2 text-[13px] font-bold leading-5 text-[#344054]">
                          {band.analysis_status === "analyzed" ? metricText(band.extracted_selling_points) : pendingAnalysisText(band.analysis_status)}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] font-bold text-[#98A2B3]">潜在需求</div>
                        <div className="line-clamp-2 text-[13px] font-bold leading-5 text-[#344054]">
                          {band.analysis_status === "analyzed" ? metricText(band.extracted_demands) : pendingAnalysisText(band.analysis_status)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {selectedBand && (
        <article ref={detailRef} className="mb-5 scroll-mt-6 rounded-lg bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          {(() => {
            const badge = analysisBadge(selectedBand.analysis_status);
            return (
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#eef1f5] pb-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-lg bg-[#e4f3ff] px-2.5 py-1 text-[12px] font-extrabold text-[#3388ff]">价格段详细报告</span>
                <span className={`inline-flex rounded-lg px-2.5 py-1 text-[12px] font-extrabold ${badge.className}`}>
                  {badge.text}
                </span>
              </div>
              <h2 className="text-[19px] font-extrabold text-[#0A1B39]">{selectedBand.price_band}</h2>
              <p className="mt-1 text-[13px] font-medium text-[#667085]">
                {formatCount(selectedBand.competitor_count)} 个竞品 · 均价 {formatMoney(selectedBand.price_avg)} · 总销量 {formatCount(selectedBand.sold_count_total)} · 总销额 {formatMoney(selectedBand.sales_amount_total)}
              </p>
            </div>
            <div className="rounded-lg bg-[#f8fafc] px-3 py-2 text-right text-[12px] font-bold text-[#667085]">
              <div>{formatMoney(selectedBand.price_min)} - {formatMoney(selectedBand.price_max)}</div>
              <div className="mt-0.5 text-[#98A2B3]">价格范围</div>
            </div>
          </div>
            );
          })()}

          {selectedBand.analysis_status !== "analyzed" && (
            <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-[#d8ebff] bg-[#f4f9ff] p-3">
              <div className="text-[13px] font-semibold leading-6 text-[#344054]">
                {selectedBand.analysis_status === "partial"
                  ? "这个价格段有历史 AI 运行记录，但没有产出卖点/需求字段，通常是模型返回 JSON 不完整、超时或触发限额后用了兜底结果。当前先展示数据库基础数据，建议重新分析该价格段。"
                  : "这个价格段已经展示数据库里的竞品、图片和问大家基础数据；卖点、需求和作图提示词会在 AI 分析后补齐。"}
              </div>
              <button
                onClick={() => {
                  setTargetPriceBand(resolveTargetPriceBand(selectedBand.price_band));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="h-9 shrink-0 rounded-lg bg-[#3388ff] px-3 text-[12px] font-extrabold text-white"
              >
                分析这个价格段
              </button>
            </div>
          )}

          <div className="grid grid-cols-[1fr_320px] gap-5">
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">竞品链接</h3>
                <div className="space-y-2">
                  {(selectedBand.competitor_links || []).slice(0, 8).map((item) => (
                    <a key={item.product_id || item.link} href={item.link} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-[#eef1f5] px-3 py-2 hover:border-[#3388ff]">
                      <ExternalLink className="h-4 w-4 shrink-0 text-[#3388ff]" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#344054]">{item.title || item.product_id}</span>
                      <span className="shrink-0 text-[12px] font-bold text-[#ff5a1f]">{formatMoney(item.price)}</span>
                    </a>
                  ))}
                  {!(selectedBand.competitor_links || []).length && (
                    <div className="rounded-lg bg-[#f8fafc] p-3 text-[13px] font-medium text-[#98A2B3]">数据库里暂时没有该价格段的竞品链接。</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">提炼卖点</h3>
                  {chips(selectedBand.extracted_selling_points)}
                </div>
                <div>
                  <h3 className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">潜在需求</h3>
                  {chips(selectedBand.extracted_demands)}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">评价和问大家</h3>
                <div className="mb-3 flex gap-2 text-[12px] font-bold text-[#667085]">
                  <span className="rounded-lg bg-[#f2f4f7] px-2.5 py-1">评价数 {formatCount(selectedBand.qa_and_review?.review_count_total)}</span>
                  <span className="rounded-lg bg-[#f2f4f7] px-2.5 py-1">问大家 {formatCount(selectedBand.qa_and_review?.qa_count_total)}</span>
                </div>
                <div className="space-y-2">
                  {(selectedBand.qa_and_review?.qa_examples || []).slice(0, 5).map((qa, index) => (
                    <div key={index} className="rounded-lg bg-[#f8fafc] p-3 text-[13px] leading-6 text-[#344054]">
                      <div className="font-bold">问：{qa.question || "无"}</div>
                      <div className="mt-1 text-[#667085]">答：{qa.answer || "无"}</div>
                    </div>
                  ))}
                  {!(selectedBand.qa_and_review?.qa_examples || []).length && (
                    <div className="rounded-lg bg-[#f8fafc] p-3 text-[13px] font-medium text-[#98A2B3]">数据库里暂时没有可展示的问大家明细。</div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">作图提示词</h3>
                <div className="space-y-2 text-[13px] leading-6 text-[#344054]">
                  <div className="rounded-lg bg-[#f8fafc] p-3"><b>主图：</b>{selectedBand.image_prompts?.main_image_prompt || "待 AI 分析后生成"}</div>
                  <div className="rounded-lg bg-[#f8fafc] p-3"><b>详情：</b>{selectedBand.image_prompts?.detail_image_prompt || "待 AI 分析后生成"}</div>
                  <div className="rounded-lg bg-[#f8fafc] p-3"><b>买家秀：</b>{selectedBand.image_prompts?.buyer_show_prompt || "待 AI 分析后生成"}</div>
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[14px] font-extrabold text-[#0A1B39]"><Image className="h-4 w-4" />展示图</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(selectedBand.display_images?.available_images || []).slice(0, 9).map((item, index) => {
                    const src = imageUrl(item);
                    return src ? <img key={`${src}-${index}`} src={src} alt="" className="aspect-square w-full rounded-lg border border-[#eef1f5] object-cover" /> : null;
                  })}
                </div>
                {!(selectedBand.display_images?.available_images || []).length && (
                  <div className="rounded-lg bg-[#f8fafc] p-3 text-[13px] font-medium text-[#98A2B3]">数据库里暂时没有该价格段的图片链接。</div>
                )}
                {selectedBand.display_images?.note && <p className="mt-3 text-[12px] leading-5 text-[#98A2B3]">{selectedBand.display_images.note}</p>}
              </div>

              <div className="rounded-lg bg-[#f8fafc] p-4">
                <h3 className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">利润测算</h3>
                {selectedBand.profit_simulation ? (
                  <div className="space-y-2 text-[13px] font-semibold text-[#344054]">
                    <div className="flex justify-between"><span>测算售价</span><b>{formatMoney(selectedBand.profit_simulation.target_price)}</b></div>
                    <div className="flex justify-between"><span>预估总成本</span><b>{formatMoney(selectedBand.profit_simulation.total_cost)}</b></div>
                    <div className="flex justify-between"><span>单件毛利</span><b>{formatMoney(selectedBand.profit_simulation.gross_profit)}</b></div>
                    <div className="flex justify-between"><span>毛利率</span><b>{selectedBand.profit_simulation.gross_margin == null ? "无数据" : `${(selectedBand.profit_simulation.gross_margin * 100).toFixed(2)}%`}</b></div>
                    <div className="flex justify-between"><span>目标毛利售价</span><b>{formatMoney(selectedBand.profit_simulation.target_margin_price)}</b></div>
                  </div>
                ) : (
                  <p className="text-[13px] font-medium text-[#98A2B3]">未提供成本价，无法测算利润。</p>
                )}
              </div>
            </aside>
          </div>
        </article>
      )}

      {payload?.markdown && (
        <details className="rounded-lg bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <summary className="cursor-pointer text-[15px] font-extrabold text-[#0A1B39]">查看 Markdown 原始报告</summary>
          <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-[#0b1220] p-4 text-[12px] leading-6 text-[#d8e2f0]">{payload.markdown}</pre>
        </details>
      )}
    </div>
  );
}
