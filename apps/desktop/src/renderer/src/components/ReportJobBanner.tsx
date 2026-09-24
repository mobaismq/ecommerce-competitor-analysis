import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react'

interface RunningJob {
  id: string
  status: string
  type: string
  stage?: string | null
  keyword?: string | null
  errorMessage?: string | null
  createdAt?: string
}

// 跨页面后台报告任务进度横幅，数据源是本地 worker 的 analysis Job。
export function ReportJobBanner() {
  const navigate = useNavigate()
  const [job, setJob] = useState<RunningJob | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [dismissedKey, setDismissedKey] = useState(() => sessionStorage.getItem('reportJobBannerDismissed') || '')

  const loadJob = useCallback(async () => {
    try {
      const data = await window.desktop?.capabilities.invoke('report.jobs', {
        tenantId: 'local',
        status: 'running',
        page: 1,
        pageSize: 1,
      }) as { rows?: RunningJob[] } | undefined
      const rows = Array.isArray(data) ? (data as unknown as RunningJob[]) : data?.rows ?? []
      const active = rows[0]
      if (active) setJob(active)
    } catch {
      // 横幅为辅助 UI，接口暂不可用时保持页面可用
    }
  }, [])

  useEffect(() => {
    void loadJob()
    const timer = window.setInterval(() => void loadJob(), 3000)
    return () => window.clearInterval(timer)
  }, [loadJob])

  // 任务结束后停止展示（轮询查不到 running 任务后 job 置空）
  const key = job?.id ? `${job.id}:${job.status}` : ''
  const isDismissed = key && key === dismissedKey
  if (!job || isDismissed) return null

  const stage = job.stage || 'running'
  const isFailed = job.status === 'failed'
  const isCompleted = job.status === 'completed'
  const title = isCompleted ? '整体报告分析完成' : isFailed ? '整体报告分析失败' : '整体报告后台生成中'
  const message = job.errorMessage || (isCompleted ? '报告已保存到数据库，可以进入分析报告页查看。' : `当前阶段：${stage}`)

  const dismiss = () => {
    setDismissedKey(key)
    if (key) sessionStorage.setItem('reportJobBannerDismissed', key)
  }

  const stageLabel = (() => {
    const map: Record<string, string> = { collecting: '数据采集中', analyzing: '数据分析中', reporting: '报告生成中', queued: '排队中', running: '处理中' }
    return map[stage] ?? stage
  })()

  return (
    <div className="mb-3 px-6 pt-4">
      <div className={`rounded-2xl border bg-white p-4 shadow-[0_8px_32px_rgba(29,38,52,.06)] ${isFailed ? 'border-[#ffd7d7]' : isCompleted ? 'border-[#bdeed0]' : 'border-[#cfe6ff]'}`}>
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${isFailed ? 'bg-[#ffEBEE] text-[#c62828]' : isCompleted ? 'bg-[#e8f5e9] text-[#16803a]' : 'bg-[#eaf4ff] text-[#3388ff]'}`}>
            {!isCompleted && !isFailed ? <Loader2 className="h-5 w-5 animate-spin" /> : isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-extrabold text-[#0A1B39]">{title}</p>
              {job.keyword && <span className="rounded-full bg-[#f5f7fa] px-2.5 py-1 text-[12px] font-bold text-[#667085]">{job.keyword}</span>}
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-extrabold ${isFailed ? 'bg-[#ffEBEE] text-[#c62828]' : isCompleted ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#f0f7ff] text-[#3388ff]'}`}>
                {isCompleted ? '已完成' : isFailed ? '失败' : stageLabel}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[12px] font-bold text-[#667085]">{message}</p>
            {!isCompleted && !isFailed && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef3fb]">
                <div className="h-full animate-pulse rounded-full bg-[#3388ff]" style={{ width: '100%' }} />
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isCompleted && (
              <button onClick={() => navigate('/market/competitive/report')} className="h-8 rounded-lg bg-[#3388ff] px-3 text-[12px] font-extrabold text-white hover:bg-[#1a6fe8]">
                查看报告
              </button>
            )}
            <button onClick={() => setExpanded((v) => !v)} className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#667085] hover:bg-[#eceff4]" aria-label="收起进度">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button onClick={dismiss} className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]" aria-label="关闭任务提醒">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}