import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AlertCircle, Boxes, CheckCircle2, ChevronLeft, ChevronRight, Eye, FileBarChart, Loader2, Search, Sparkles, Trash2, X } from "lucide-react";
import { ReportJobBanner } from "../components/ReportJobBanner";

type ReportStatus = "not_generated" | "generating" | "failed" | "generated";
type PriceGroupingMode = "manual" | "ai";

interface ReportRow {
  id: string;
  source?: string;
  runId?: number;
  keyword: string;
  priceRange: string;
  competitorCount: number;
  collectTime: string;
  status: ReportStatus;
  reportTitle: string;
}

interface ProductPreview {
  productId: string;
  title: string;
  priceRange?: string;
  soldCount?: number;
  mainImageAnalysisId?: number | null;
  mainImageAnalyzedAt?: string;
}

interface ManualPriceBand {
  label: string;
  price_min: number;
  price_max: number;
}

interface GenerateJob {
  id?: string;
  status?: "running" | "completed" | "failed";
  keyword?: string;
  progress?: {
    stage?: string;
    message?: string;
    current?: number;
    total?: number;
    steps?: Array<{
      key?: string;
      label?: string;
      status?: "pending" | "running" | "completed" | "failed" | "skipped";
      current?: number;
      total?: number;
      message?: string;
    }>;
  };
  result?: {
    report?: {
      model?: string;
      sourceProductReportCount?: number;
      sourceProductCount?: number;
      autoImportedProductReports?: number;
      priceBandCount?: number;
      priceGroupingMode?: string;
    };
    reportJson?: {
      summary?: {
        ai_usage?: {
          total_tokens?: number;
          input_tokens?: number;
          output_tokens?: number;
        };
        ark_response_id?: string;
      };
    };
  };
  error?: string;
}

const STATUS_CONFIG: Record<ReportStatus, { text: string; className: string }> = {
  not_generated: { text: "未生成", className: "bg-[#f2f4f7] text-[#86909C]" },
  generating: { text: "生成中", className: "bg-[#fff3e0] text-[#f57c00]" },
  failed: { text: "生成失败", className: "bg-[#ffEBEE] text-[#c62828]" },
  generated: { text: "已生成", className: "bg-[#e8f5e9] text-[#2e7d32]" },
};

const PAGE_SIZE = 10;

function parseManualPriceBands(text: string): ManualPriceBand[] {
  return text
    .split(/[\n,，;；]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/(\d+(?:\.\d+)?)\s*[-–—－−~～至到]\s*(\d+(?:\.\d+)?)/);
      if (!match) return null;
      const first = Number(match[1]);
      const second = Number(match[2]);
      if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
      const min = Math.min(first, second);
      const max = Math.max(first, second);
      return {
        label: part.includes("元") ? part : `${min}-${max}元`,
        price_min: min,
        price_max: max,
      };
    })
    .filter((band): band is ManualPriceBand => Boolean(band))
    .sort((a, b) => a.price_min - b.price_min);
}

export function AnalysisReport() {
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [appliedStartTime, setAppliedStartTime] = useState("");
  const [appliedEndTime, setAppliedEndTime] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState("");

  // AI生成报告弹窗
  const [generateModal, setGenerateModal] = useState<ReportRow | null>(null);
  const [confirmingGenerate, setConfirmingGenerate] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<ProductPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [generateJob, setGenerateJob] = useState<GenerateJob | null>(null);
  const [priceGroupingMode, setPriceGroupingMode] = useState<PriceGroupingMode>("manual");
  const [manualPriceBandText, setManualPriceBandText] = useState("");
  const [aiPriceBandCount, setAiPriceBandCount] = useState(3);

  const parsedManualPriceBands = useMemo(() => parseManualPriceBands(manualPriceBandText), [manualPriceBandText]);

  // 删除确认弹窗
  const [deleteRow, setDeleteRow] = useState<ReportRow | null>(null);

  async function loadRows(filters?: { keyword?: string; startTime?: string; endTime?: string; status?: string }) {
    setRowsLoading(true);
    setRowsError("");
    try {
      const params = new URLSearchParams();
      if (filters?.keyword) params.set("keyword", filters.keyword);
      if (filters?.startTime) params.set("startTime", filters.startTime);
      if (filters?.endTime) params.set("endTime", filters.endTime);
      if (filters?.status) params.set("status", filters.status);
      const response = await fetch(`/api/report/analysis-list${params.toString() ? `?${params.toString()}` : ""}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取分析报告列表失败");
      setRows(data.rows || []);
    } catch (error) {
      setRowsError(error instanceof Error ? error.message : String(error));
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }

  useEffect(() => {
    loadRows().catch(() => undefined);
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchKeyword = !appliedKeyword.trim() || row.keyword.toLowerCase().includes(appliedKeyword.trim().toLowerCase());
      const matchStart = !appliedStartTime || row.collectTime >= appliedStartTime;
      const matchEnd = !appliedEndTime || row.collectTime <= appliedEndTime + " 23:59:59";
      const matchStatus = !appliedStatus || row.status === appliedStatus;
      return matchKeyword && matchStart && matchEnd && matchStatus;
    });
  }, [rows, appliedKeyword, appliedStartTime, appliedEndTime, appliedStatus]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const loadGeneratePreview = async (row: ReportRow) => {
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewProducts([]);
    try {
      const query = new URLSearchParams();
      query.set("id", row.id);
      query.set("keyword", row.keyword);
      const response = await fetch(`/api/report/products-view?${query.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取入库数据失败");
      setPreviewProducts(data.products || []);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerate = (row: ReportRow) => {
    setGenerateModal(row);
    setConfirmingGenerate(false);
    setGenerateJob(null);
    setPriceGroupingMode("manual");
    setManualPriceBandText(row.priceRange && row.priceRange !== "-" ? row.priceRange : "");
    setAiPriceBandCount(3);
    loadGeneratePreview(row).catch(() => undefined);
  };

  const applySearch = () => {
    setAppliedKeyword(searchKeyword);
    setAppliedStartTime(startTime);
    setAppliedEndTime(endTime);
    setAppliedStatus(reportStatus);
    setCurrentPage(1);
    loadRows({
      keyword: searchKeyword.trim(),
      startTime,
      endTime,
      status: reportStatus,
    }).catch(() => undefined);
  };

  const resetSearch = () => {
    setSearchKeyword("");
    setStartTime("");
    setEndTime("");
    setReportStatus("");
    setAppliedKeyword("");
    setAppliedStartTime("");
    setAppliedEndTime("");
    setAppliedStatus("");
    setCurrentPage(1);
    loadRows().catch(() => undefined);
  };

  const confirmGenerate = async () => {
    if (!generateModal) return;
    const target = generateModal;
    setGenerateModal(null);
    setConfirmingGenerate(true);
    setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, status: "generating" } : r)));
    setGenerateJob({
      status: "running",
      keyword: target.keyword,
      progress: {
        stage: "queued",
        message: "任务已创建，准备自动补齐入库并生成整体报告",
        current: 0,
        total: 3,
        steps: [
          { key: "product_main_image_import", label: "单品主图分析入库", status: "pending", current: importedPreviewProducts.length, total: previewProducts.length },
          {
            key: "price_grouping",
            label: "价格区间划分",
            status: "pending",
            current: 0,
            total: 1,
            message: priceGroupingMode === "ai"
              ? `AI 将辅助划分约 ${aiPriceBandCount} 个价格区间`
              : parsedManualPriceBands.length
                ? `按 ${parsedManualPriceBands.length} 个手动价格区间汇总`
                : "未填写价格段时按全量集合汇总",
          },
          { key: "overall_image_report", label: "整体图片报告生成", status: "pending", current: 0, total: 1 },
        ],
      },
    });
    try {
      const response = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationMode: "product_main_image_summary",
          collectionId: target.id,
          keyword: target.keyword,
          limit: target.competitorCount || 120,
          costPrice: 100,
          saveToDb: true,
          priceGroupingMode,
          manualPriceBands: priceGroupingMode === "manual" ? parsedManualPriceBands : [],
          aiPriceBandCount: priceGroupingMode === "ai" ? aiPriceBandCount : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "创建 AI 报告任务失败");
      setGenerateJob(data.job || { status: "running", keyword: target.keyword, progress: { message: "整体报告任务已创建" } });
      window.dispatchEvent(new CustomEvent("report-job-started"));
      setConfirmingGenerate(false);
      pollGenerateJob(target).catch(() => undefined);
    } catch (error) {
      setConfirmingGenerate(false);
      setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, status: "failed" } : r)));
      setRowsError(error instanceof Error ? error.message : String(error));
      return;
    }
  };

  const reloadCurrentRows = () => {
    return loadRows({
      keyword: appliedKeyword.trim(),
      startTime: appliedStartTime,
      endTime: appliedEndTime,
      status: appliedStatus,
    });
  };

  const pollGenerateJob = async (target: ReportRow) => {
    let attempts = 0;
    while (attempts < 180) {
      attempts += 1;
      await new Promise((resolve) => window.setTimeout(resolve, attempts === 1 ? 900 : 1800));
      const response = await fetch("/api/report/generate-status");
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取报告生成状态失败");
      const job = data.job as GenerateJob | undefined;
      if (job) setGenerateJob(job);
      if (job?.status === "completed") {
        setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, status: "generated" } : r)));
        await reloadCurrentRows().catch(() => undefined);
        await loadGeneratePreview(target).catch(() => undefined);
        return;
      }
      if (job?.status === "failed") {
        setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, status: "failed" } : r)));
        setRowsError(job.error || job.progress?.message || "整体报告生成失败");
        await reloadCurrentRows().catch(() => undefined);
        return;
      }
    }
    setRowsError("整体报告仍在后台生成，稍后点击查询刷新结果。");
    await reloadCurrentRows().catch(() => undefined);
  };

  const dismissGenerateJob = () => {
    setGenerateJob(null);
  };

  const handleDelete = (row: ReportRow) => {
    setDeleteRow(row);
  };

  const confirmDelete = () => {
    if (!deleteRow) return;
    setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
    setDeleteRow(null);
  };

  const handleViewReport = (row: ReportRow) => {
    const reportId = row.runId ? String(row.runId) : row.id;
    navigate(`/market/competitive/report/view?id=${encodeURIComponent(reportId)}&keyword=${encodeURIComponent(row.keyword)}`);
  };

  const handleViewProducts = (row: ReportRow) => {
    navigate(`/market/competitive/report/products?id=${encodeURIComponent(row.id)}&keyword=${encodeURIComponent(row.keyword)}`);
  };

  const renderPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const importedPreviewProducts = previewProducts.filter((product) => product.mainImageAnalysisId);
  const pendingPreviewProducts = previewProducts.filter((product) => !product.mainImageAnalysisId);
  const generateProgressPercent = generateJob?.status === "completed"
    ? 100
    : generateJob?.progress?.total
      ? Math.max(8, Math.min(98, Math.round(((generateJob.progress.current || 0) / Math.max(1, generateJob.progress.total)) * 100)))
      : generateJob?.status === "failed"
        ? 100
        : 12;
  const activeGenerateSteps = generateJob?.progress?.steps || [];
  const stepPercent = (step: NonNullable<NonNullable<GenerateJob["progress"]>["steps"]>[number]) => {
    if (step.status === "completed") return 100;
    if (step.status === "failed") return 100;
    if (!step.total) return step.status === "running" ? 18 : 0;
    return Math.max(step.status === "running" ? 8 : 0, Math.min(98, Math.round(((step.current || 0) / Math.max(1, step.total)) * 100)));
  };
  const stepStatusText = (status?: string) => {
    if (status === "completed") return "完成";
    if (status === "running") return "进行中";
    if (status === "failed") return "失败";
    if (status === "skipped") return "跳过";
    return "等待";
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5 text-[13px] font-medium text-[#86909C]">
        <span>市场</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>竞品分析</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-bold text-[#0A1B39]">分析报告</span>
      </div>

      <ReportJobBanner />

      {false && generateJob && (
        <div className={`mb-5 rounded-2xl border p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)] ${
          generateJob.status === "failed"
            ? "border-[#ffd7d7] bg-[#fff5f5]"
            : generateJob.status === "completed"
              ? "border-[#d9f4e5] bg-[#f7fffb]"
              : "border-[#d8ebff] bg-[#f5faff]"
        }`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {generateJob.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#3388ff]" />
                ) : generateJob.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-[#16803a]" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-[#c62828]" />
                )}
                <p className="text-[14px] font-extrabold text-[#0A1B39]">
                  {generateJob.status === "completed" ? "整体报告已生成并保存" : generateJob.status === "failed" ? "整体报告生成失败" : "整体报告生成中"}
                </p>
                {generateJob.keyword && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-[#667085]">{generateJob.keyword}</span>
                )}
              </div>
              <p className="mt-1 text-[12px] font-bold text-[#667085]">
                {generateJob.progress?.message || (generateJob.status === "running" ? "正在调用 AI 汇总单品报告" : "")}
              </p>
            </div>
            <button
              onClick={dismissGenerateJob}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/80 text-[#86909C] hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div
              className={`h-full rounded-full transition-all ${
                generateJob.status === "failed" ? "bg-[#e53935]" : generateJob.status === "completed" ? "bg-[#22c55e]" : "bg-[#3388ff]"
              }`}
              style={{ width: `${generateProgressPercent}%` }}
            />
          </div>
          {activeGenerateSteps.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {activeGenerateSteps.map((step) => (
                <div key={step.key || step.label} className="rounded-xl bg-white/80 px-3 py-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-extrabold text-[#0A1B39]">{step.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      step.status === "completed"
                        ? "bg-[#e8f5e9] text-[#2e7d32]"
                        : step.status === "failed"
                          ? "bg-[#ffEBEE] text-[#c62828]"
                          : step.status === "running"
                            ? "bg-[#f0f7ff] text-[#3388ff]"
                            : "bg-[#f2f4f7] text-[#86909C]"
                    }`}>
                      {stepStatusText(step.status)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#eef3fb]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        step.status === "failed" ? "bg-[#e53935]" : step.status === "completed" ? "bg-[#22c55e]" : "bg-[#3388ff]"
                      }`}
                      style={{ width: `${stepPercent(step)}%` }}
                    />
                  </div>
                  <p className="mt-1 line-clamp-1 text-[11px] font-bold text-[#86909C]">
                    {step.message || `${step.current || 0}/${step.total || 0}`}
                  </p>
                </div>
              ))}
            </div>
          )}
          {(generateJob.result?.report || generateJob.result?.reportJson?.summary?.ai_usage || generateJob.error) && (
            <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-bold text-[#667085]">
              {generateJob.result?.report?.model && <span className="rounded-lg bg-white px-2.5 py-1">模型 {generateJob.result.report.model}</span>}
              {generateJob.result?.report?.sourceProductReportCount != null && (
                <span className="rounded-lg bg-white px-2.5 py-1">
                  单品报告 {generateJob.result.report.sourceProductReportCount}/{generateJob.result.report.sourceProductCount || generateJob.result.report.sourceProductReportCount}
                </span>
              )}
              {generateJob.result?.reportJson?.summary?.ai_usage?.total_tokens != null && (
                <span className="rounded-lg bg-white px-2.5 py-1">
                  Tokens {generateJob.result.reportJson.summary.ai_usage.total_tokens}
                </span>
              )}
              {generateJob.result?.reportJson?.summary?.ark_response_id && (
                <span className="max-w-full truncate rounded-lg bg-white px-2.5 py-1">
                  Response {generateJob.result.reportJson.summary.ark_response_id}
                </span>
              )}
              {generateJob.error && <span className="rounded-lg bg-white px-2.5 py-1 text-[#c62828]">{generateJob.error}</span>}
            </div>
          )}
        </div>
      )}

      {/* Query Conditions */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-[12px] font-bold text-[#667085]">关键词</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="请输入"
                className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white pl-9 pr-3 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
              />
            </div>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-[12px] font-bold text-[#667085]">采集时间</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
              />
              <span className="text-[13px] font-bold text-[#86909C]">至</span>
              <input
                type="date"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
              />
            </div>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-[12px] font-bold text-[#667085]">报告状态</label>
            <select
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff] appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2398A2B3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
            >
              <option value="">请选择</option>
              <option value="not_generated">未生成</option>
              <option value="generating">生成中</option>
              <option value="generated">已生成</option>
              <option value="failed">生成失败</option>
            </select>
          </div>
          <button
            onClick={applySearch}
            className="h-10 rounded-lg bg-[#3388ff] px-6 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(51,136,255,.25)] transition-all hover:bg-[#1a6fe8]"
          >
            查询
          </button>
          <button
            onClick={resetSearch}
            className="h-10 rounded-lg border border-[#dce3ee] bg-white px-4 text-[13px] font-bold text-[#344054] hover:border-[#3388ff] hover:text-[#3388ff]"
          >
            重置
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        {rowsError && (
          <div className="mb-3 rounded-lg border border-[#ffd7d7] bg-[#fff5f5] px-3 py-2 text-[13px] font-bold text-[#c62828]">
            {rowsError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                <th className="px-4 py-3.5 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">关键词</th>
                <th className="px-4 py-3.5 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">价格区间</th>
                <th className="px-4 py-3.5 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">竞品数量</th>
                <th className="px-4 py-3.5 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">采集时间</th>
                <th className="px-4 py-3.5 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">报告状态</th>
                <th className="px-4 py-3.5 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">报告标题</th>
                <th className="px-4 py-3.5 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {rowsLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[14px] font-bold text-[#86909C]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在读取数据库数据...
                    </span>
                  </td>
                </tr>
              )}
              {!rowsLoading && pageRows.map((row) => (
                <tr key={row.id} className="border-b border-[#eef1f5] transition-colors hover:bg-[#f9fafb]">
                  <td className="px-4 py-4 text-[14px] font-bold text-[#0A1B39] whitespace-nowrap">{row.keyword}</td>
                  <td className="px-4 py-4 text-[14px] font-medium text-[#344054] whitespace-nowrap">{row.priceRange}</td>
                  <td className="px-4 py-4 text-[14px] font-medium text-[#344054] whitespace-nowrap">{row.competitorCount}</td>
                  <td className="px-4 py-4 text-[14px] font-medium text-[#86909C] whitespace-nowrap">{row.collectTime}</td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${STATUS_CONFIG[row.status].className}`}>
                      {STATUS_CONFIG[row.status].text}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[14px] font-medium text-[#0A1B39] whitespace-nowrap">
                    {row.reportTitle || <span className="text-[#d0d5dd]">—</span>}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewProducts(row)}
                        className="flex items-center gap-1 text-[13px] font-bold text-[#0A1B39] hover:text-[#3388ff]"
                      >
                        <Boxes className="h-3.5 w-3.5" />
                        查看全部商品
                      </button>
                      <span className="text-[#d0d5dd]">|</span>
                      {/* AI生成整体报告 */}
                      {row.status === "generating" ? (
                        <button disabled className="flex items-center gap-1 text-[13px] font-bold text-[#b0b7c3] cursor-not-allowed">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          生成中
                        </button>
                      ) : (
                        <button
                          onClick={() => handleGenerate(row)}
                          className="flex items-center gap-1 text-[13px] font-bold text-[#3388ff] hover:text-[#1a6fe8]"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          AI生成整体报告
                        </button>
                      )}
                      <span className="text-[#d0d5dd]">|</span>
                      {/* 查看报告 */}
                      <button
                        onClick={() => handleViewReport(row)}
                        disabled={row.status !== "generated"}
                        className="flex items-center gap-1 text-[13px] font-bold text-[#2e7d32] hover:text-[#1b5e20] disabled:cursor-not-allowed disabled:text-[#b0b7c3]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        查看报告
                      </button>
                      <span className="text-[#d0d5dd]">|</span>
                      {/* 删除 */}
                      <button
                        onClick={() => handleDelete(row)}
                        className="flex items-center gap-1 text-[13px] font-bold text-[#e53935] hover:text-[#c62828]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rowsLoading && pageRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <FileBarChart className="mb-4 h-16 w-16 text-[#d0d5dd]" />
            <p className="text-[16px] font-bold text-[#86909C]">暂无数据</p>
            <p className="mt-2 text-[14px] text-[#86909C]">前往「AI数据采集」页面采集竞品数据后查看报告</p>
          </div>
        )}

        {/* Pagination */}
        {filteredRows.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#eef1f5] px-6 py-4">
            <span className="text-[13px] font-bold text-[#86909C]">
              共 {filteredRows.length} 条
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#eef1f5] text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {renderPageNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-[13px] font-bold transition-colors ${
                    currentPage === page
                      ? "bg-[#3388ff] text-white"
                      : "border border-[#eef1f5] text-[#344054] hover:bg-[#f9fafb]"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#eef1f5] text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI生成整体报告弹窗 */}
      {generateModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => !confirmingGenerate && setGenerateModal(null)}>
          <div className="max-h-[88vh] w-[min(760px,92vw)] overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(29,38,52,.2)] sm:p-8 custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[20px] font-extrabold text-[#0A1B39]">AI生成整体报告</h2>
              {!confirmingGenerate && (
                <button onClick={() => setGenerateModal(null)} className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {!confirmingGenerate ? (
              <>
                <div className="mb-5 rounded-lg bg-[#f8fafc] p-4">
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <span className="font-bold text-[#86909C]">关键词：</span>
                      <span className="font-bold text-[#0A1B39]">{generateModal.keyword}</span>
                    </div>
                    <div>
                      <span className="font-bold text-[#86909C]">价格区间：</span>
                      <span className="font-bold text-[#0A1B39]">{generateModal.priceRange}</span>
                    </div>
                    <div>
                      <span className="font-bold text-[#86909C]">竞品数量：</span>
                      <span className="font-bold text-[#0A1B39]">{generateModal.competitorCount}</span>
                    </div>
                    <div>
                      <span className="font-bold text-[#86909C]">采集时间：</span>
                      <span className="font-bold text-[#0A1B39]">{generateModal.collectTime}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-5 rounded-xl border border-[#d8ebff] bg-[#f5faff] p-4">
                  <p className="text-[13px] font-extrabold text-[#0A1B39]">生成逻辑</p>
                  <p className="mt-2 text-[13px] font-medium leading-6 text-[#667085]">
                    系统会先把未入库商品自动执行「单品主图分析入库」，再汇总该集合下所有单品报告生成整体竞品报告，包含共性卖点、图片规律、问大家需求、铺货建议和作图方向。
                  </p>
                  <p className="mt-2 text-[12px] font-bold text-[#3388ff]">
                    运行过程中会实时显示「入库进度」「价格区间划分」和「整体图片报告生成进度」。
                  </p>
                </div>

                <div className="mb-5 rounded-xl border border-[#eef1f5] bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-extrabold text-[#0A1B39]">价格区间划分</p>
                      <p className="mt-1 text-[12px] font-bold text-[#86909C]">整体报告会按这里的价格段汇总，后续页面按这些区间展示。</p>
                    </div>
                    <div className="flex rounded-lg bg-[#f2f4f7] p-1">
                      <button
                        type="button"
                        onClick={() => setPriceGroupingMode("manual")}
                        className={`h-8 rounded-md px-3 text-[12px] font-extrabold transition-colors ${
                          priceGroupingMode === "manual" ? "bg-white text-[#3388ff] shadow-sm" : "text-[#667085] hover:text-[#0A1B39]"
                        }`}
                      >
                        手动划分
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceGroupingMode("ai")}
                        className={`h-8 rounded-md px-3 text-[12px] font-extrabold transition-colors ${
                          priceGroupingMode === "ai" ? "bg-white text-[#3388ff] shadow-sm" : "text-[#667085] hover:text-[#0A1B39]"
                        }`}
                      >
                        AI 帮忙划分
                      </button>
                    </div>
                  </div>

                  {priceGroupingMode === "manual" ? (
                    <div>
                      <textarea
                        value={manualPriceBandText}
                        onChange={(event) => setManualPriceBandText(event.target.value)}
                        placeholder={"例如：\n0-30\n30-60\n60-100\n100-180"}
                        className="min-h-24 w-full resize-none rounded-lg border border-[#d8e0ec] bg-[#fbfcff] px-3 py-2 text-[13px] font-bold leading-6 text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {parsedManualPriceBands.length ? parsedManualPriceBands.map((band) => (
                          <span key={`${band.price_min}-${band.price_max}`} className="rounded-full bg-[#f0f7ff] px-3 py-1 text-[12px] font-extrabold text-[#3388ff]">
                            {band.label}
                          </span>
                        )) : (
                          <span className="text-[12px] font-bold text-[#98A2B3]">未识别到价格段，将按全量竞品集合生成。</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                      <div className="rounded-lg bg-[#f8fafc] px-3 py-3 text-[12px] font-bold leading-6 text-[#667085]">
                        AI 会根据商品代表价格、销量、标题和单品主图报告先划分价格区间，再按这些区间生成整体报告。适合商品价格跨度较大时使用。
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-extrabold text-[#667085]">期望区间数</span>
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={aiPriceBandCount}
                          onChange={(event) => setAiPriceBandCount(Math.max(1, Math.min(6, Number(event.target.value) || 3)))}
                          className="h-11 w-full rounded-lg border border-[#d8e0ec] bg-[#fbfcff] px-3 text-[13px] font-bold text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="mb-5 rounded-xl border border-[#eef1f5] bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-extrabold text-[#0A1B39]">当前入库数据</p>
                      <p className="mt-1 text-[12px] font-bold text-[#86909C]">这里展示本次整体报告会用到的单品主图分析报告。</p>
                    </div>
                    {previewLoading ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f7] px-3 py-1 text-[12px] font-bold text-[#667085]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        读取中
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#f0f7ff] px-3 py-1 text-[12px] font-extrabold text-[#3388ff]">
                        已入库 {importedPreviewProducts.length}/{previewProducts.length}
                      </span>
                    )}
                  </div>

                  {previewError && (
                    <div className="rounded-lg border border-[#ffd7d7] bg-[#fff5f5] px-3 py-2 text-[12px] font-bold text-[#c62828]">
                      {previewError}
                    </div>
                  )}

                  {!previewLoading && !previewError && (
                    <>
                      <div className="mb-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-[#f8fafc] px-3 py-2">
                          <p className="text-[11px] font-bold text-[#98A2B3]">集合商品</p>
                          <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">{previewProducts.length}</p>
                        </div>
                        <div className="rounded-lg bg-[#f0fff6] px-3 py-2">
                          <p className="text-[11px] font-bold text-[#38a169]">已主图分析入库</p>
                          <p className="mt-1 text-[18px] font-extrabold text-[#16803a]">{importedPreviewProducts.length}</p>
                        </div>
                        <div className="rounded-lg bg-[#fff8ed] px-3 py-2">
                          <p className="text-[11px] font-bold text-[#d97706]">待自动补齐</p>
                          <p className="mt-1 text-[18px] font-extrabold text-[#b45309]">{pendingPreviewProducts.length}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-[#d9f4e5] bg-[#fbfffd] p-3">
                          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold text-[#16803a]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            已入库单品报告
                          </div>
                          <div className="max-h-48 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                            {importedPreviewProducts.length ? importedPreviewProducts.map((product) => (
                              <div key={product.productId || product.title} className="rounded-lg bg-white px-3 py-2 shadow-[0_1px_3px_rgba(29,38,52,.04)]">
                                <p className="line-clamp-1 text-[12px] font-extrabold text-[#0A1B39]">{product.title}</p>
                                <p className="mt-1 text-[11px] font-bold text-[#98A2B3]">
                                  ID {product.productId || "-"} · 报告 {product.mainImageAnalysisId}
                                </p>
                                {product.mainImageAnalyzedAt && (
                                  <p className="mt-0.5 text-[11px] font-medium text-[#98A2B3]">{product.mainImageAnalyzedAt}</p>
                                )}
                              </div>
                            )) : (
                              <div className="rounded-lg bg-white px-3 py-6 text-center text-[12px] font-bold text-[#98A2B3]">
                                暂无已入库单品报告
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-[#ffead5] bg-[#fffdf8] p-3">
                          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-extrabold text-[#b45309]">
                            <AlertCircle className="h-3.5 w-3.5" />
                            待自动补齐商品
                          </div>
                          <div className="max-h-48 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                            {pendingPreviewProducts.length ? pendingPreviewProducts.map((product) => (
                              <div key={product.productId || product.title} className="rounded-lg bg-white px-3 py-2 shadow-[0_1px_3px_rgba(29,38,52,.04)]">
                                <p className="line-clamp-1 text-[12px] font-extrabold text-[#0A1B39]">{product.title}</p>
                                <p className="mt-1 text-[11px] font-bold text-[#98A2B3]">
                                  ID {product.productId || "-"} · 价格 {product.priceRange || "-"} · 销量 {product.soldCount ?? 0}
                                </p>
                              </div>
                            )) : (
                              <div className="rounded-lg bg-white px-3 py-6 text-center text-[12px] font-bold text-[#98A2B3]">
                                全部商品都已入库
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setGenerateModal(null)}
                    className="h-11 flex-1 rounded-lg bg-[#f2f4f7] text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#eceff4]"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmGenerate}
                    disabled={previewLoading || previewProducts.length === 0}
                    className="h-11 flex-1 rounded-lg bg-[#3388ff] text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:bg-[#c9d2df] disabled:shadow-none"
                  >
                    入库并生成整体报告
                  </button>
                </div>
              </>
            ) : (
              <div className="py-2">
                <div className={`mb-4 rounded-xl border p-4 ${
                  generateJob?.status === "failed"
                    ? "border-[#ffd7d7] bg-[#fff5f5]"
                    : generateJob?.status === "completed"
                      ? "border-[#d9f4e5] bg-[#f7fffb]"
                      : "border-[#d8ebff] bg-[#f5faff]"
                }`}>
                  <div className="mb-3 flex items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                      generateJob?.status === "failed"
                        ? "bg-[#ffEBEE] text-[#c62828]"
                        : generateJob?.status === "completed"
                          ? "bg-[#e8f5e9] text-[#16803a]"
                          : "bg-[#eaf4ff] text-[#3388ff]"
                    }`}>
                      {generateJob?.status === "running" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : generateJob?.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <AlertCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-extrabold text-[#0A1B39]">
                        {generateJob?.status === "completed" ? "入库和整体报告已完成" : generateJob?.status === "failed" ? "任务失败" : "正在入库并生成整体报告"}
                      </p>
                      <p className="mt-1 text-[12px] font-bold leading-5 text-[#667085]">
                        {generateJob?.progress?.message || "正在准备任务"}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full transition-all ${
                        generateJob?.status === "failed" ? "bg-[#e53935]" : generateJob?.status === "completed" ? "bg-[#22c55e]" : "bg-[#3388ff]"
                      }`}
                      style={{ width: `${generateProgressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  {activeGenerateSteps.map((step) => (
                    <div key={step.key || step.label} className="rounded-xl border border-[#eef1f5] bg-white p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[13px] font-extrabold text-[#0A1B39]">{step.label}</p>
                          <p className="mt-1 text-[12px] font-bold text-[#86909C]">{step.message || `${step.current || 0}/${step.total || 0}`}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[12px] font-extrabold ${
                          step.status === "completed"
                            ? "bg-[#e8f5e9] text-[#2e7d32]"
                            : step.status === "failed"
                              ? "bg-[#ffEBEE] text-[#c62828]"
                              : step.status === "running"
                                ? "bg-[#f0f7ff] text-[#3388ff]"
                                : "bg-[#f2f4f7] text-[#86909C]"
                        }`}>
                          {stepStatusText(step.status)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#eef3fb]">
                        <div
                          className={`h-full rounded-full transition-all ${
                            step.status === "failed" ? "bg-[#e53935]" : step.status === "completed" ? "bg-[#22c55e]" : "bg-[#3388ff]"
                          }`}
                          style={{ width: `${stepPercent(step)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {(generateJob?.result?.report || generateJob?.error) && (
                  <div className="mt-4 rounded-xl bg-[#f8fafc] p-4 text-[12px] font-bold text-[#667085]">
                    {generateJob.result?.report?.autoImportedProductReports != null && (
                      <p>本次自动补齐入库：{generateJob.result.report.autoImportedProductReports} 个商品</p>
                    )}
                    {generateJob.result?.report?.sourceProductReportCount != null && (
                      <p className="mt-1">整体报告使用单品报告：{generateJob.result.report.sourceProductReportCount}/{generateJob.result.report.sourceProductCount || generateJob.result.report.sourceProductReportCount}</p>
                    )}
                    {generateJob.result?.report?.priceBandCount != null && (
                      <p className="mt-1">
                        价格区间：{generateJob.result.report.priceBandCount} 个
                        {generateJob.result.report.priceGroupingMode === "ai" ? "（AI 划分）" : generateJob.result.report.priceGroupingMode === "manual" ? "（手动划分）" : "（全量集合）"}
                      </p>
                    )}
                    {generateJob.error && <p className="text-[#c62828]">{generateJob.error}</p>}
                  </div>
                )}

                <div className="mt-5 flex w-full gap-3">
                  <button
                    onClick={() => {
                      if (generateJob?.status === "running") return;
                      setConfirmingGenerate(false);
                      setGenerateModal(null);
                    }}
                    disabled={generateJob?.status === "running"}
                    className="h-11 flex-1 rounded-lg bg-[#f2f4f7] text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#eceff4] disabled:cursor-not-allowed disabled:text-[#98A2B3]"
                  >
                    {generateJob?.status === "running" ? "运行中" : "关闭"}
                  </button>
                  <button
                    onClick={() => generateModal && handleViewReport(generateModal)}
                    disabled={generateJob?.status !== "completed"}
                    className="h-11 flex-1 rounded-lg bg-[#3388ff] text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:bg-[#c9d2df] disabled:shadow-none"
                  >
                    查看整体报告
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteRow && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setDeleteRow(null)}>
          <div className="w-[min(440px,90vw)] rounded-2xl bg-white p-6 sm:p-8 shadow-[0_24px_64px_rgba(29,38,52,.2)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold text-[#0A1B39]">提示</h2>
              <button onClick={() => setDeleteRow(null)} className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-6 text-[15px] font-bold text-[#344054]">
              删除后不可恢复，确认删除采集数据及分析报告？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteRow(null)}
                className="h-11 flex-1 rounded-lg bg-[#f2f4f7] text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#eceff4]"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="h-11 flex-1 rounded-lg bg-[#e53935] text-[14px] font-bold text-white transition-all hover:bg-[#c62828]"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
