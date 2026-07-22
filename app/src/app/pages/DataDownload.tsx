import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Database, Download, ExternalLink, FolderOpen, Loader2, Play, RefreshCw, Square, Terminal } from "lucide-react";
import { parseRpaProgress } from "../utils/rpaProgress";

type RunInfo = {
  pid: number;
  run_dir: string;
  log_file: string;
  productName?: string;
  topN?: number;
  searchPages?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  importMysql?: boolean;
  analyzeAfterImport?: boolean;
  analysisCostPrice?: number | null;
  speedProfile?: string;
  startedAt?: string;
};

type StatusPayload = {
  ok: boolean;
  hasRun?: boolean;
  running?: boolean;
  run?: RunInfo;
  logTail?: string;
  error?: string;
};

const presets = [
  { label: "手表 300-500", productName: "手表", minPrice: "300", maxPrice: "500" },
  { label: "水平仪", productName: "水平仪", minPrice: "", maxPrice: "" },
  { label: "猫粮", productName: "猫粮", minPrice: "", maxPrice: "" },
  { label: "电脑", productName: "电脑", minPrice: "", maxPrice: "" },
];

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-[13px] font-bold text-[#344054]">{children}</label>;
}

export function DataDownload() {
  const [productName, setProductName] = useState("手表");
  const [minPrice, setMinPrice] = useState("300");
  const [maxPrice, setMaxPrice] = useState("500");
  const [topN, setTopN] = useState("100");
  const [searchPages, setSearchPages] = useState("8");
  const [speedProfile, setSpeedProfile] = useState("fast");
  const [importMysql, setImportMysql] = useState(true);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const running = Boolean(status?.running);
  const run = status?.run;
  const progress = useMemo(() => parseRpaProgress(status?.logTail, run?.topN), [status?.logTail, run?.topN]);

  const statusText = useMemo(() => {
    if (!status?.hasRun) return "未启动";
    return running ? "运行中" : "已停止";
  }, [running, status?.hasRun]);

  async function refreshStatus() {
    const response = await fetch("/api/rpa/status");
    const payload = await response.json();
    setStatus(payload);
    if (!payload.ok && payload.error) setError(payload.error);
  }

  async function startRun() {
    setLoading(true);
    setError("");
    const runWindow = window.open("/data-download/run", "_blank", "noopener,noreferrer");
    try {
      const response = await fetch("/api/rpa/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          minPrice,
          maxPrice,
          topN: Number(topN || 100),
          searchPages: Number(searchPages || 8),
          speedProfile,
          importMysql,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "启动失败");
      setStatus(payload);
      if (runWindow) runWindow.location.href = "/data-download/run";
    } catch (err) {
      if (runWindow) runWindow.close();
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function stopRun() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/rpa/stop", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "停止失败");
      setStatus(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus().catch(() => undefined);
    const timer = window.setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, running ? 4000 : 8000);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold text-[#0A1B39]">商品数据下载</h1>
          <p className="mt-2 text-[14px] font-medium text-[#667085]">输入商品和价格区间，启动店透视 RPA 下载，并可选择下载后自动入库。</p>
        </div>
        <button
          onClick={refreshStatus}
          className="flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[13px] font-bold text-[#344054] shadow-[0_4px_16px_rgba(29,38,52,.06)] hover:bg-[#f8fafc]"
        >
          <RefreshCw className="h-4 w-4" />
          刷新状态
        </button>
      </div>

      <div className="grid grid-cols-[minmax(420px,520px)_1fr] gap-5">
        <section className="rounded-lg bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e4f3ff] text-[#3388ff]">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold text-[#0A1B39]">启动下载任务</h2>
              <p className="text-[12px] font-medium text-[#86909C]">脚本会在后台运行，不占用页面。</p>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setProductName(preset.productName);
                  setMinPrice(preset.minPrice);
                  setMaxPrice(preset.maxPrice);
                }}
                className="h-8 rounded-lg border border-[#dce3ee] px-3 text-[12px] font-bold text-[#344054] hover:border-[#3388ff] hover:text-[#3388ff]"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <FieldLabel>商品名称</FieldLabel>
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                className="h-11 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
                placeholder="例如：手表、猫粮、水平仪"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>最低价</FieldLabel>
                <input
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#3388ff]"
                  placeholder="可为空"
                  inputMode="decimal"
                />
              </div>
              <div>
                <FieldLabel>最高价</FieldLabel>
                <input
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#3388ff]"
                  placeholder="可为空"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>{running ? "下载 TopN（下次启动）" : "下载 TopN"}</FieldLabel>
                <input
                  value={topN}
                  onChange={(event) => setTopN(event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#3388ff]"
                  inputMode="numeric"
                />
                {running && (
                  <p className="mt-1 text-[11px] font-semibold text-[#86909C]">
                    当前任务实际 TopN：{run?.topN ?? "-"}
                  </p>
                )}
              </div>
              <div>
                <FieldLabel>搜索页数</FieldLabel>
                <input
                  value={searchPages}
                  onChange={(event) => setSearchPages(event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#3388ff]"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div>
              <FieldLabel>下载速度</FieldLabel>
              <select
                value={speedProfile}
                onChange={(event) => setSpeedProfile(event.target.value)}
                className="h-11 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[14px] font-semibold outline-none focus:border-[#3388ff]"
              >
                <option value="fast">快速：更少等待，仍保留 20 秒导出冷却</option>
                <option value="balanced">均衡：默认加速，保留安全冷却</option>
                <option value="conservative">保守：更慢，风控更稳</option>
              </select>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#dce3ee] bg-[#f8fafc] px-4 py-3">
              <span className="flex items-center gap-2 text-[14px] font-bold text-[#344054]">
                <Database className="h-4 w-4 text-[#3388ff]" />
                下载完成后自动入库
              </span>
              <input
                checked={importMysql}
                onChange={(event) => setImportMysql(event.target.checked)}
                type="checkbox"
                className="h-4 w-4 accent-[#3388ff]"
              />
            </label>

            <div className="rounded-lg border border-[#dce3ee] bg-[#f8fafc] px-4 py-3 text-[13px] font-semibold leading-6 text-[#667085]">
              下载入库完成后，到「竞品报告」页点击「AI生成报告」，系统会调用视觉模型分析图片并把报告存入数据库。
            </div>
          </div>

          {error && (
            <div className="mt-4 flex gap-2 rounded-lg border border-[#ffd7d7] bg-[#fff5f5] p-3 text-[13px] font-semibold text-[#c03535]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={startRun}
              disabled={loading || running}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#3388ff] text-[14px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#b8d7ff]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
              启动脚本
            </button>
            <button
              onClick={() => window.open("/data-download/run", "_blank", "noopener,noreferrer")}
              className="flex h-11 w-[130px] items-center justify-center gap-2 rounded-lg border border-[#dce3ee] bg-white text-[14px] font-extrabold text-[#344054]"
            >
              <ExternalLink className="h-4 w-4" />
              运行页
            </button>
            <button
              onClick={stopRun}
              disabled={loading || !running}
              className="flex h-11 w-[120px] items-center justify-center gap-2 rounded-lg border border-[#dce3ee] bg-white text-[14px] font-extrabold text-[#344054] disabled:cursor-not-allowed disabled:text-[#b0b7c3]"
            >
              <Square className="h-4 w-4" />
              停止
            </button>
          </div>
        </section>

        <section className="min-w-0 rounded-lg bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-lg ${running ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#f2f4f7] text-[#667085]"}`}>
                {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-[17px] font-extrabold text-[#0A1B39]">任务状态：{statusText}</h2>
                <p className="text-[12px] font-medium text-[#86909C]">{run?.startedAt ? `启动时间：${new Date(run.startedAt).toLocaleString()}` : "暂无任务"}</p>
              </div>
            </div>
            {run?.pid && <span className="rounded-lg bg-[#f2f4f7] px-3 py-1.5 text-[12px] font-bold text-[#344054]">PID {run.pid}</span>}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-3">
              <p className="mb-1 text-[12px] font-bold text-[#86909C]">当前商品</p>
              <p className="truncate text-[14px] font-extrabold text-[#0A1B39]">{run?.productName || "-"}</p>
            </div>
            <div className="rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-3">
              <p className="mb-1 text-[12px] font-bold text-[#86909C]">参数</p>
              <p className="truncate text-[14px] font-extrabold text-[#0A1B39]">Top {run?.topN || "-"} / {run?.searchPages || "-"} 页 / {run?.minPrice ?? "-"}-{run?.maxPrice ?? "-"}</p>
            </div>
            <div className="col-span-2 rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="mb-1 text-[12px] font-bold text-[#86909C]">当前进度</p>
                  <p className="text-[14px] font-extrabold text-[#0A1B39]">{progress.detail}</p>
                </div>
                <span className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-[#3388ff]">
                  {progress.label}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]">
                <div
                  className="h-full rounded-full bg-[#3388ff] transition-all"
                  style={{ width: `${progress.percent ?? 0}%` }}
                />
              </div>
            </div>
            <div className="col-span-2 rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-[#86909C]"><FolderOpen className="h-3.5 w-3.5" />运行目录</p>
              <p className="break-all text-[13px] font-semibold text-[#344054]">{run?.run_dir || "-"}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#202938] bg-[#0b1220]">
            <div className="flex items-center justify-between border-b border-[#202938] px-4 py-3">
              <span className="flex items-center gap-2 text-[13px] font-extrabold text-white">
                <Terminal className="h-4 w-4" />
                运行日志
              </span>
              <button onClick={refreshStatus} className="text-[12px] font-bold text-[#93c5fd] hover:text-white">刷新</button>
            </div>
            <pre className="h-[420px] overflow-auto whitespace-pre-wrap p-4 text-[12px] leading-5 text-[#d7e1f2]">
              {status?.logTail || "暂无日志。启动脚本后这里会显示 run.log 的最新内容。"}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
