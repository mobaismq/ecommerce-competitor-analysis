import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";

interface GenerateStep {
  key?: string;
  label?: string;
  status?: "pending" | "running" | "completed" | "failed" | "skipped";
  current?: number;
  total?: number;
  message?: string;
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
    steps?: GenerateStep[];
  };
  result?: {
    report?: {
      runId?: number;
      collectionId?: string;
      keyword?: string;
      sourceProductReportCount?: number;
      sourceProductCount?: number;
      priceBandCount?: number;
    };
    reportJson?: {
      summary?: {
        ai_usage?: {
          total_tokens?: number;
        };
      };
    };
  };
  error?: string;
}

function jobKey(job: GenerateJob | null) {
  if (!job?.id) return "";
  return `${job.id}:${job.status || "unknown"}`;
}

function progressPercent(job: GenerateJob | null) {
  if (!job) return 0;
  if (job.status === "completed") return 100;
  if (job.status === "failed") return 100;
  const current = job.progress?.current || 0;
  const total = job.progress?.total || 0;
  if (!total) return 10;
  return Math.max(8, Math.min(98, Math.round((current / Math.max(1, total)) * 100)));
}

function stepPercent(step: GenerateStep) {
  if (step.status === "completed") return 100;
  if (step.status === "failed") return 100;
  const total = step.total || 0;
  if (!total) return step.status === "running" ? 18 : 0;
  return Math.max(step.status === "running" ? 8 : 0, Math.min(98, Math.round(((step.current || 0) / Math.max(1, total)) * 100)));
}

function stepStatusText(status?: GenerateStep["status"]) {
  if (status === "completed") return "完成";
  if (status === "running") return "进行中";
  if (status === "failed") return "失败";
  if (status === "skipped") return "跳过";
  return "等待";
}

export function ReportJobBanner() {
  const navigate = useNavigate();
  const [job, setJob] = useState<GenerateJob | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [dismissedKey, setDismissedKey] = useState(() => sessionStorage.getItem("reportJobBannerDismissed") || "");

  const loadJob = useCallback(async () => {
    try {
      const response = await fetch("/api/report/generate-status");
      const data = await response.json();
      if (!response.ok || !data.ok || !data.hasJob || !data.job) return;
      setJob(data.job);
    } catch {
      // The banner is auxiliary UI; if the dev API is temporarily unavailable, keep the page usable.
    }
  }, []);

  useEffect(() => {
    loadJob();
    const timer = window.setInterval(loadJob, 2000);
    window.addEventListener("report-job-started", loadJob);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("report-job-started", loadJob);
    };
  }, [loadJob]);

  useEffect(() => {
    if (job?.status === "completed" || job?.status === "failed") {
      setExpanded(true);
    }
  }, [job?.status]);

  const visible = job && jobKey(job) !== dismissedKey;
  const percent = progressPercent(job);
  const steps = useMemo(() => job?.progress?.steps || [], [job?.progress?.steps]);
  const activeStep = steps.find((step) => step.status === "running")
    || steps.find((step) => step.status === "failed")
    || steps.find((step) => step.status === "pending")
    || steps[steps.length - 1];

  if (!visible) return null;

  const isFailed = job.status === "failed";
  const isCompleted = job.status === "completed";
  const title = isCompleted ? "整体报告分析完成" : isFailed ? "整体报告分析失败" : "整体报告后台生成中";
  const message = job.progress?.message || job.error || activeStep?.message || (isCompleted ? "报告已经保存到数据库，可以进入分析报告页查看。" : "正在处理入库和整体图片报告。");

  const dismiss = () => {
    const key = jobKey(job);
    setDismissedKey(key);
    sessionStorage.setItem("reportJobBannerDismissed", key);
  };

  const openReportList = () => {
    navigate("/market/competitive/report");
  };

  return (
    <div className="mb-5">
      <div
        className={`rounded-2xl border bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)] ${
          isFailed ? "border-[#ffd7d7]" : isCompleted ? "border-[#bdeed0]" : "border-[#cfe6ff]"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
              isFailed ? "bg-[#ffEBEE] text-[#c62828]" : isCompleted ? "bg-[#e8f5e9] text-[#16803a]" : "bg-[#eaf4ff] text-[#3388ff]"
            }`}
          >
            {job.status === "running" ? <Loader2 className="h-5 w-5 animate-spin" /> : isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-extrabold text-[#0A1B39]">{title}</p>
              {job.keyword && <span className="rounded-full bg-[#f5f7fa] px-2.5 py-1 text-[12px] font-bold text-[#667085]">{job.keyword}</span>}
              <span
                className={`rounded-full px-2.5 py-1 text-[12px] font-extrabold ${
                  isFailed ? "bg-[#ffEBEE] text-[#c62828]" : isCompleted ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#f0f7ff] text-[#3388ff]"
                }`}
              >
                {isCompleted ? "已完成" : isFailed ? "失败" : `${percent}%`}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[12px] font-bold text-[#667085]">{message}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef3fb]">
              <div
                className={`h-full rounded-full transition-all ${isFailed ? "bg-[#e53935]" : isCompleted ? "bg-[#22c55e]" : "bg-[#3388ff]"}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isCompleted && (
              <button
                onClick={openReportList}
                className="h-8 rounded-lg bg-[#3388ff] px-3 text-[12px] font-extrabold text-white hover:bg-[#1a6fe8]"
              >
                查看报告
              </button>
            )}
            <button
              onClick={() => setExpanded((value) => !value)}
              className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#667085] hover:bg-[#eceff4]"
              aria-label={expanded ? "收起进度" : "展开进度"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={dismiss}
              className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]"
              aria-label="关闭任务提醒"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {expanded && steps.length > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.key || step.label} className="rounded-xl border border-[#eef1f5] bg-[#fbfcff] px-3 py-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="line-clamp-1 text-[12px] font-extrabold text-[#0A1B39]">{step.label}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      step.status === "completed"
                        ? "bg-[#e8f5e9] text-[#2e7d32]"
                        : step.status === "failed"
                          ? "bg-[#ffEBEE] text-[#c62828]"
                          : step.status === "running"
                            ? "bg-[#f0f7ff] text-[#3388ff]"
                            : "bg-[#f2f4f7] text-[#86909C]"
                    }`}
                  >
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
                <p className="mt-1 line-clamp-1 text-[11px] font-bold text-[#98A2B3]">
                  {step.message || `${step.current || 0}/${step.total || 0}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
