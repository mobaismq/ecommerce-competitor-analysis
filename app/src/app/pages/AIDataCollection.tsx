import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronRight, Cpu, Loader2, Play, Square, Terminal } from "lucide-react";
import { parseRpaProgress } from "../utils/rpaProgress";

type CollectionStatus = "idle" | "collecting" | "stopped" | "completed" | "failed";

interface RunInfo {
  pid?: number;
  run_dir?: string;
  log_file?: string;
  productName?: string;
  topN?: number;
  searchPages?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  importMysql?: boolean;
  startedAt?: string;
}

interface StatusPayload {
  ok: boolean;
  hasRun?: boolean;
  running?: boolean;
  status?: "running" | "completed" | "failed" | "stopped";
  run?: RunInfo;
  logTail?: string;
  error?: string;
}

interface CollectionParams {
  keyword: string;
  minPrice: string;
  maxPrice: string;
  competitorCount: string;
  autoParse: boolean;
}

function normalizeNumberText(value: string) {
  return value.trim().replace(/[^\d.]/g, "");
}

function statusFromPayload(payload: StatusPayload | null): CollectionStatus {
  if (!payload?.hasRun) return "idle";
  if (payload.running) return "collecting";
  if (payload.status === "completed") return "completed";
  if (payload.status === "failed") return "failed";
  return "stopped";
}

export function AIDataCollection() {
  const [keyword, setKeyword] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [competitorCount, setCompetitorCount] = useState("");
  const [autoParse, setAutoParse] = useState(true);

  const [statusPayload, setStatusPayload] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeParams, setActiveParams] = useState<CollectionParams | null>(null);

  const logEndRef = useRef<HTMLPreElement | null>(null);
  const status = statusFromPayload(statusPayload);
  const run = statusPayload?.run;
  const isRunning = status === "collecting";
  const progress = useMemo(() => parseRpaProgress(statusPayload?.logTail, run?.topN), [statusPayload?.logTail, run?.topN]);
  const total = progress.total || Number(run?.topN || competitorCount || 0) || 0;
  const collected = progress.current || (status === "completed" ? total : 0);
  const progressPercent = progress.percent ?? (total > 0 ? Math.round((collected / total) * 100) : 0);
  const logs = statusPayload?.logTail?.trim() || "";

  async function refreshStatus() {
    const response = await fetch("/api/rpa/status");
    const payload = await response.json();
    setStatusPayload(payload);
    if (!payload.ok && payload.error) setError(payload.error);
    if (payload.run) {
      setActiveParams({
        keyword: payload.run.productName || "",
        minPrice: payload.run.minPrice == null ? "" : String(payload.run.minPrice),
        maxPrice: payload.run.maxPrice == null ? "" : String(payload.run.maxPrice),
        competitorCount: payload.run.topN == null ? "" : String(payload.run.topN),
        autoParse: Boolean(payload.run.importMysql),
      });
    }
  }

  async function startCollection() {
    setError("");

    const cleanKeyword = keyword.trim();
    const count = Number(normalizeNumberText(competitorCount));
    const cleanMinPrice = normalizeNumberText(minPrice);
    const cleanMaxPrice = normalizeNumberText(maxPrice);

    if (!cleanKeyword) {
      setError("请输入采集竞品关键词");
      return;
    }
    if (!competitorCount.trim() || Number.isNaN(count) || count < 1 || count > 100) {
      setError("竞品数量需为 1-100 之间的整数");
      return;
    }

    const params: CollectionParams = {
      keyword: cleanKeyword,
      minPrice: cleanMinPrice,
      maxPrice: cleanMaxPrice,
      competitorCount: String(count),
      autoParse,
    };

    setActiveParams(params);
    setLoading(true);
    try {
      const response = await fetch("/api/rpa/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: params.keyword,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          topN: count,
          searchPages: 8,
          speedProfile: "fast",
          importMysql: params.autoParse,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "启动采集脚本失败");
      setStatusPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function stopCollection() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/rpa/stop", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "停止采集脚本失败");
      setStatusPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, isRunning ? 3000 : 8000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  const statusConfig: Record<CollectionStatus, { text: string; className: string; dot: string }> = {
    idle: { text: "待开始", className: "bg-[#f2f4f7] text-[#86909C]", dot: "bg-[#d0d5dd]" },
    collecting: { text: "采集中", className: "bg-[#fff3e0] text-[#f57c00]", dot: "bg-[#f57c00] animate-pulse" },
    stopped: { text: "已停止", className: "bg-[#ffEBEE] text-[#c62828]", dot: "bg-[#c62828]" },
    completed: { text: "已完成", className: "bg-[#e8f5e9] text-[#2e7d32]", dot: "bg-[#2e7d32]" },
    failed: { text: "采集失败", className: "bg-[#ffEBEE] text-[#c62828]", dot: "bg-[#c62828]" },
  };

  const displayParams = activeParams || {
    keyword,
    minPrice,
    maxPrice,
    competitorCount,
    autoParse,
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="mb-4 flex items-center gap-1.5 text-[13px] font-medium text-[#86909C]">
        <span>市场</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>竞品分析</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-bold text-[#0A1B39]">AI数据采集</span>
      </div>

      <div className="grid grid-cols-[minmax(420px,1fr)_1fr] gap-5">
        <section className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e4f3ff] text-[#3388ff]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold text-[#0A1B39]">采集条件</h2>
              <p className="text-[12px] font-medium text-[#86909C]">设置采集参数后点击「开始采集」</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-[13px] font-bold text-[#344054]">关键词</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                disabled={isRunning}
                placeholder="请输入采集竞品关键词"
                className="h-11 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 text-[14px] font-semibold text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-bold text-[#344054]">价格区间</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  disabled={isRunning}
                  placeholder="请输入最低价"
                  inputMode="decimal"
                  className="h-11 flex-1 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 text-[14px] font-semibold text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className="text-[14px] font-bold text-[#86909C]">—</span>
                <input
                  type="text"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  disabled={isRunning}
                  placeholder="请输入最高价"
                  inputMode="decimal"
                  className="h-11 flex-1 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 text-[14px] font-semibold text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-bold text-[#344054]">竞品数量</label>
              <input
                type="text"
                value={competitorCount}
                onChange={(e) => setCompetitorCount(e.target.value)}
                disabled={isRunning}
                placeholder="请输入采集竞品数量，1-100之间"
                inputMode="numeric"
                className="h-11 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 text-[14px] font-semibold text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              type="button"
              onClick={() => setAutoParse(!autoParse)}
              disabled={isRunning}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-[#dce3ee] bg-[#f8fafc] px-4 py-3 text-left transition-colors hover:border-[#b8d7ff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 transition-colors ${autoParse ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"}`}>
                {autoParse && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-[14px] font-bold text-[#344054]">
                竞品数据采集后自动入库并保存图片
              </span>
            </button>

            {error && (
              <div className="flex gap-2 rounded-lg border border-[#ffd7d7] bg-[#fff5f5] p-3 text-[13px] font-semibold text-[#c03535]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={startCollection}
                disabled={loading || isRunning}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3388ff] text-[14px] font-extrabold text-white transition-all hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:bg-[#b8d7ff]"
              >
                {loading || isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                开始采集
              </button>
              <button
                onClick={stopCollection}
                disabled={loading || !isRunning}
                className="flex h-11 w-[120px] items-center justify-center gap-2 rounded-lg border border-[#ffd7d7] bg-white text-[14px] font-extrabold text-[#c03535] transition-colors hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:border-[#eef1f5] disabled:text-[#b0b7c3]"
              >
                <Square className="h-4 w-4" />
                停止
              </button>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-extrabold text-[#0A1B39]">采集进度</h2>
              <p className="text-[12px] font-medium text-[#86909C]">实时展示真实店透视 RPA 采集状态与输出</p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${statusConfig[status].className}`}>
              <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${statusConfig[status].dot}`} />
              {statusConfig[status].text}
            </span>
          </div>

          <div className="mb-4 rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-4">
            <p className="mb-3 text-[12px] font-bold text-[#86909C]">参数</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#86909C]">关键词</span>
                <span className={`rounded-md px-2 py-0.5 text-[13px] font-bold ${displayParams.keyword ? "bg-[#e4f3ff] text-[#3388ff]" : "bg-[#f2f4f7] text-[#98A2B3]"}`}>
                  {displayParams.keyword || "未设置"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#86909C]">价格区间</span>
                <span className={`text-[13px] font-bold ${displayParams.minPrice || displayParams.maxPrice ? "text-[#0A1B39]" : "text-[#98A2B3]"}`}>
                  {displayParams.minPrice || displayParams.maxPrice ? `${displayParams.minPrice || "不限"} — ${displayParams.maxPrice || "不限"}` : "未设置"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#86909C]">竞品数量</span>
                <span className={`text-[13px] font-bold ${displayParams.competitorCount ? "text-[#0A1B39]" : "text-[#98A2B3]"}`}>
                  {displayParams.competitorCount ? `${displayParams.competitorCount} 个` : "未设置"}
                </span>
              </div>
              {run?.pid && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-[#86909C]">PID</span>
                  <span className="text-[13px] font-bold text-[#0A1B39]">{run.pid}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="mb-1 text-[12px] font-bold text-[#86909C]">已采集数量</p>
                <p className="text-[20px] font-extrabold text-[#0A1B39]">
                  {collected}
                  <span className="text-[14px] font-bold text-[#86909C]"> / {total || "-"}</span>
                </p>
              </div>
              <span className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-extrabold text-[#3388ff]">
                {progressPercent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]">
              <div
                className="h-full rounded-full bg-[#3388ff] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#edf1f6] bg-[#f8fafc]">
            <div className="flex items-center justify-between border-b border-[#edf1f6] px-4 py-3">
              <span className="flex items-center gap-2 text-[13px] font-extrabold text-[#0A1B39]">
                <Terminal className="h-4 w-4" />
                进度流
              </span>
              <button onClick={() => refreshStatus().catch(() => undefined)} className="text-[12px] font-bold text-[#3388ff] hover:text-[#1a6fe8]">刷新</button>
            </div>
            <pre
              ref={logEndRef}
              className="h-[340px] overflow-auto whitespace-pre-wrap p-4 text-[12px] leading-5 text-[#344054] custom-scrollbar"
            >
              {logs || "暂无输出。设置采集条件后点击「开始采集」，这里会显示真实 run.log 的最新内容。"}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
