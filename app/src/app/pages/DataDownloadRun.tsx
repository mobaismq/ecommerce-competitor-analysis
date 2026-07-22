import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FolderOpen, Loader2, RefreshCw, Square, Terminal } from "lucide-react";
import { Link } from "react-router";
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

export function DataDownloadRun() {
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
    }, running ? 3000 : 7000);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link to="/data-download" className="mb-3 inline-flex items-center gap-2 text-[13px] font-bold text-[#3388ff]">
            <ArrowLeft className="h-4 w-4" />
            返回下载参数
          </Link>
          <h1 className="text-[28px] font-extrabold text-[#0A1B39]">脚本运行状态</h1>
          <p className="mt-2 text-[14px] font-medium text-[#667085]">这里会自动刷新后台 RPA 的状态和最新日志。</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refreshStatus}
            className="flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-[13px] font-bold text-[#344054] shadow-[0_4px_16px_rgba(29,38,52,.06)] hover:bg-[#f8fafc]"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
          <button
            onClick={stopRun}
            disabled={loading || !running}
            className="flex h-10 items-center gap-2 rounded-lg border border-[#ffd7d7] bg-white px-4 text-[13px] font-bold text-[#c03535] disabled:cursor-not-allowed disabled:text-[#c9cdd4]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            停止脚本
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-[#ffd7d7] bg-[#fff5f5] p-3 text-[13px] font-semibold text-[#c03535]">
          {error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-5 gap-4">
        <div className="rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <p className="mb-2 text-[12px] font-bold text-[#86909C]">状态</p>
          <div className="flex items-center gap-2 text-[18px] font-extrabold text-[#0A1B39]">
            {running ? <Loader2 className="h-5 w-5 animate-spin text-[#2e7d32]" /> : <CheckCircle2 className="h-5 w-5 text-[#667085]" />}
            {statusText}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <p className="mb-2 text-[12px] font-bold text-[#86909C]">PID</p>
          <p className="text-[18px] font-extrabold text-[#0A1B39]">{run?.pid || "-"}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <p className="mb-2 text-[12px] font-bold text-[#86909C]">商品</p>
          <p className="truncate text-[18px] font-extrabold text-[#0A1B39]">{run?.productName || "-"}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <p className="mb-2 text-[12px] font-bold text-[#86909C]">参数</p>
          <p className="truncate text-[15px] font-extrabold text-[#0A1B39]">Top {run?.topN || "-"} / {run?.searchPages || "-"} 页 / {run?.minPrice ?? "-"}-{run?.maxPrice ?? "-"}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold text-[#86909C]">进度</p>
            <span className="rounded-md bg-[#eef6ff] px-2 py-1 text-[11px] font-bold text-[#3388ff]">{progress.label}</span>
          </div>
          <p className="truncate text-[14px] font-extrabold text-[#0A1B39]">{progress.detail}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8edf5]">
            <div
              className="h-full rounded-full bg-[#3388ff] transition-all"
              style={{ width: `${progress.percent ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-[#edf1f6] bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-[#86909C]">
          <FolderOpen className="h-3.5 w-3.5" />
          运行目录
        </p>
        <p className="break-all text-[13px] font-semibold text-[#344054]">{run?.run_dir || "-"}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#202938] bg-[#0b1220] shadow-[0_8px_32px_rgba(29,38,52,.08)]">
        <div className="flex items-center justify-between border-b border-[#202938] px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-extrabold text-white">
            <Terminal className="h-4 w-4" />
            运行日志
          </span>
          <span className="text-[12px] font-semibold text-[#8ea4c7]">{run?.log_file || ""}</span>
        </div>
        <pre className="h-[560px] overflow-auto whitespace-pre-wrap p-4 text-[12px] leading-5 text-[#d7e1f2]">
          {status?.logTail || "暂无日志。"}
        </pre>
      </div>
    </div>
  );
}
