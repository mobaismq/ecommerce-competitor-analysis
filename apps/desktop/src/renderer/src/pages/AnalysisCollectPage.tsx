import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Drawer, InputNumber, Message, Modal, Switch, Tooltip } from '@arco-design/web-react'
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Play,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Square,
  Terminal,
} from 'lucide-react'
import { parseRpaProgress } from '../utils/rpaProgress'
import { PageHeader } from '../components/PageHeader'
import { XInput } from '../components/XInput'

type CollectionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped'

interface PresetItem {
  label: string
  keyword: string
  minPrice?: number
  maxPrice?: number
  count: number
}

const PRESETS: PresetItem[] = [
  { label: '智能手表', keyword: '智能手表', minPrice: 300, maxPrice: 500, count: 20 },
  { label: '蓝牙耳机', keyword: '蓝牙耳机', minPrice: 50, maxPrice: 300, count: 30 },
  { label: '猫粮', keyword: '猫粮', minPrice: 80, maxPrice: 300, count: 20 },
  { label: '冲锋衣', keyword: '冲锋衣', minPrice: 200, maxPrice: 800, count: 20 },
]

// 状态徽章配色对照旧版 AIDataCollection.tsx statusConfig
const STATUS_CONFIG: Record<CollectionStatus, { text: string; className: string; dot: string }> = {
  idle: { text: '待开始', className: 'bg-[#f2f4f7] text-[#86909C]', dot: 'bg-[#d0d5dd]' },
  running: { text: '采集中', className: 'bg-[#fff3e0] text-[#f57c00]', dot: 'bg-[#f57c00] animate-pulse' },
  stopped: { text: '已停止', className: 'bg-[#ffEBEE] text-[#c62828]', dot: 'bg-[#c62828]' },
  completed: { text: '已完成', className: 'bg-[#e8f5e9] text-[#2e7d32]', dot: 'bg-[#2e7d32]' },
  failed: { text: '采集失败', className: 'bg-[#ffEBEE] text-[#c62828]', dot: 'bg-[#c62828]' },
}

const INPUT_CLASS =
  'h-11 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 text-[14px] font-semibold text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60'

const FIELD_LABEL_CLASS = 'mb-2 block text-[13px] font-bold text-[#344054]'

export function AnalysisCollectPage() {
  const navigate = useNavigate()

  // 表单状态（对照旧版受控字段）
  const [keyword, setKeyword] = useState('')
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [competitorCount, setCompetitorCount] = useState('')
  const [searchPages, setSearchPages] = useState('8')
  const [speedProfile, setSpeedProfile] = useState<'conservative' | 'balanced' | 'fast'>('conservative')

  // 状态控制：驱动主进程真实店透视 RPA（collection:start / collection:status）
  const [status, setStatus] = useState<CollectionStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string>('')
  const [logs, setLogs] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [authDrawerVisible, setAuthDrawerVisible] = useState(false)

  // ─── 方案 A：登录态引导面板（真实 Chrome 窗口直登，桌面端仅展示状态）───
  /** 登录授权状态：idle/opening/waiting-sso/verified（主进程权威状态，renderer 仅展示） */
  const [loginAuthState, setLoginAuthState] = useState<'idle' | 'opening' | 'waiting-sso' | 'verified'>('idle')
  /** 引导面板提示：need-reopen 为「未检测到弹出窗口」时的重唤入口。 */
  const [loginStateHint, setLoginStateHint] = useState<'idle' | 'need-reopen'>('idle')

  // 淘宝登录态感知与守门
  const [loginStatus, setLoginStatus] = useState<{
    checking: boolean
    isLoggedIn: boolean
    taobaoNick?: string
    taobaoUid?: string
  }>({
    checking: true,
    isLoggedIn: false,
  })

  const maskNick = (nick?: string) => {
    if (!nick) return ''
    if (nick.length <= 2) return nick[0] + '*'
    return nick[0] + '***' + nick[nick.length - 1]
  }

  const refreshLoginStatus = async () => {
    try {
      setLoginStatus((prev) => ({ ...prev, checking: true }))
      const res = await window.desktop?.collection?.checkLoginStatus?.()
      if (res) {
        setLoginStatus({
          checking: false,
          isLoggedIn: Boolean(res.isLoggedIn),
          taobaoNick: res.taobaoNick,
          taobaoUid: res.taobaoUid,
        })
      }
    } catch {
      setLoginStatus((prev) => ({ ...prev, checking: false }))
    }
  }

  // 系统真实 Chrome 环境感知与模态弹窗引导
  const [chromeModalVisible, setChromeModalVisible] = useState(false)
  const [chromeProbeResult, setChromeProbeResult] = useState<{
    installed: boolean
    path?: string
    version?: string
    downloadUrl: string
  } | null>(null)
  const [probingChrome, setProbingChrome] = useState(false)

  const checkChrome = async (silent = false): Promise<boolean> => {
    if (!window.desktop?.collection?.probeChrome) return true
    setProbingChrome(true)
    try {
      const res = await window.desktop.collection.probeChrome()
      setChromeProbeResult(res)
      if (!res.installed) {
        if (!silent) setChromeModalVisible(true)
        return false
      } else {
        if (!silent) {
          Message.success(`已成功检测到 Google Chrome (版本: ${res.version || '最新'})`)
          setChromeModalVisible(false)
        }
        return true
      }
    } catch (err) {
      console.error('探测 Chrome 失败', err)
      return false
    } finally {
      setProbingChrome(false)
    }
  }

  // 防风控节奏参数配置
  const DEFAULT_RECOMMENDED_SPEED = useMemo(() => ({
    batch_delay: 60.0,
    export_cooldown: 35.0,
    search_input_settle_wait: 5.0,
    search_filter_wait: 8.0,
    before_item_open_wait: 10.0,
    detail_settle_wait: 18.0,
    search_scroll_wait: 5.0,
    detail_scroll_top: 320,
    ask_ready_timeout: 60.0,
    xlsx_first_timeout: 90.0,
  }), [])

  const [speedModalVisible, setSpeedModalVisible] = useState(false)
  const [speedConfig, setSpeedConfig] = useState(DEFAULT_RECOMMENDED_SPEED)
  const [speedFormValues, setSpeedFormValues] = useState(DEFAULT_RECOMMENDED_SPEED)
  const [savingSpeedConfig, setSavingSpeedConfig] = useState(false)

  const loadSpeedConfig = async () => {
    try {
      const res = await window.desktop?.collection?.getSpeedConfig?.()
      if (res?.ok && res.profile) {
        const p = res.profile as Record<string, number>
        const updated = {
          batch_delay: typeof p.batch_delay === 'number' ? p.batch_delay : 60.0,
          export_cooldown: typeof p.export_cooldown === 'number' ? p.export_cooldown : 35.0,
          search_input_settle_wait: typeof p.search_input_settle_wait === 'number' ? p.search_input_settle_wait : 5.0,
          search_filter_wait: typeof p.search_filter_wait === 'number' ? p.search_filter_wait : 8.0,
          before_item_open_wait: typeof p.before_item_open_wait === 'number' ? p.before_item_open_wait : 10.0,
          detail_settle_wait: typeof p.detail_settle_wait === 'number' ? p.detail_settle_wait : 18.0,
          search_scroll_wait: typeof p.search_scroll_wait === 'number' ? p.search_scroll_wait : 5.0,
          detail_scroll_top: typeof p.detail_scroll_top === 'number' ? p.detail_scroll_top : 320,
          ask_ready_timeout: typeof p.ask_ready_timeout === 'number' ? p.ask_ready_timeout : 60.0,
          xlsx_first_timeout: typeof p.xlsx_first_timeout === 'number' ? p.xlsx_first_timeout : 90.0,
        }
        setSpeedConfig(updated)
        setSpeedFormValues(updated)
      }
    } catch (err) {
      console.warn('获取 RPA 速度配置失败', err)
    }
  }

  const handleSaveSpeedConfig = async () => {
    setSavingSpeedConfig(true)
    try {
      const res = await window.desktop?.collection?.saveSpeedConfig?.({ profile: speedFormValues })
      if (res?.ok) {
        setSpeedConfig({ ...speedFormValues })
        Message.success('防风控参数配置已保存，下次采集自动生效')
        setSpeedModalVisible(false)
      } else {
        Message.error(`保存配置失败: ${res?.error || '未知错误'}`)
      }
    } catch (err) {
      Message.error(`保存配置失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingSpeedConfig(false)
    }
  }

  const handleResetSpeedConfig = () => {
    setSpeedFormValues({ ...DEFAULT_RECOMMENDED_SPEED })
    Message.info('已恢复为官方推荐默认防风控参数')
  }

  useEffect(() => {
    void refreshLoginStatus()
    void checkChrome(true)
    void loadSpeedConfig()
  }, [])

  const [activeParams, setActiveParams] = useState<{
    keyword: string
    minPrice?: number
    maxPrice?: number
    competitorCount: number
  } | null>(null)

  const logContainerRef = useRef<HTMLPreElement | null>(null)

  const parsedProgress = useMemo(() => {
    return parseRpaProgress(logs, activeParams?.competitorCount || 20)
  }, [logs, activeParams?.competitorCount])

  const total = activeParams?.competitorCount || 0
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const collected = importedCount ?? parsedProgress.current ?? 0
  const percent = status === 'completed' ? 100 : parsedProgress.percent ?? (total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0)
  const isRunning = status === 'running'

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // ─── 方案 A：登录授权状态订阅（主进程轮询 unb cookie 后推送，renderer 仅展示）───
  useEffect(() => {
    if (!window.desktop?.collection) return
    const offLoginState = window.desktop.collection.onLoginState?.((state) => {
      setLoginAuthState(state.state)
    })
    return () => {
      offLoginState?.()
      void window.desktop?.collection?.stopLoginView?.()
    }
  }, [])

  // 轮询真实采集状态：本地 job 会真实推进，进度由 run.log 的 === batch item 标记解析
  useEffect(() => {
    if (status !== 'running' || !jobId) return

    const timer = setInterval(async () => {
      try {
        const s = await window.desktop?.collection.status(jobId)
        if (!s) return
        if (s.logTail) setLogs(s.logTail)
        if (s.status === 'success') {
          const result = s.resultJson as { counts?: { productCount?: number } } | null
          setImportedCount(result?.counts?.productCount ?? null)
          setStatus('completed')
          setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ✅ 采集任务已成功完成并入库！`)
        } else if (s.status === 'failure' || s.status === 'failed') {
          setStatus('failed')
          setErrorMessage(s.errorMessage || '采集任务执行失败')
          setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ❌ 任务执行失败: ${s.errorMessage || '未知错误'}`)
        } else if (s.status === 'cancelled' || s.status === 'stopped') {
          setStatus('stopped')
          setErrorMessage('')
        }
      } catch {
        // 忽略轮询偶发报错
      }
    }, 3000)

    return () => clearInterval(timer)
  }, [status, jobId])

  const applyPreset = (preset: PresetItem) => {
    setKeyword(preset.keyword)
    setMinPrice(preset.minPrice != null ? String(preset.minPrice) : '')
    setMaxPrice(preset.maxPrice != null ? String(preset.maxPrice) : '')
    setCompetitorCount(String(preset.count))
    Message.info(`已套用预设「${preset.label}」`)
  }

  const handleStart = async () => {
    setErrorMessage('')

    if (loginStatus.checking) {
      Message.info('正在检测登录态，请稍候...')
      return
    }

    // 1. Chrome 浏览器安装前置守门拦截：未安装官方 Chrome 时坚决阻断并弹出引导对话框
    const hasChrome = await checkChrome(true)
    if (!hasChrome) {
      setChromeModalVisible(true)
      return
    }

    // 2. 登录态前置守门拦截：未登录时温馨提示并自动滑出右侧登录授权画面
    if (!loginStatus.isLoggedIn) {
      Message.warning({
        content: '检测到当前尚未登录淘宝账号，已为您在右侧展开登录画面，请先完成授权',
        duration: 4000,
      })
      void handleOpenLoginView()
      return
    }

    const cleanKeyword = keyword.trim()
    const count = Number(competitorCount)
    if (!cleanKeyword) {
      setErrorMessage('请输入采集竞品关键词')
      return
    }
    if (!competitorCount.trim() || !Number.isInteger(count) || count < 1 || count > 100) {
      setErrorMessage('竞品数量需为 1-100 之间的整数')
      return
    }
    if (!window.desktop?.collection) {
      setErrorMessage('采集能力未就绪，请重启应用后重试')
      return
    }

    const newParams = {
      keyword: cleanKeyword,
      minPrice: minPrice.trim() === '' ? undefined : Number(minPrice),
      maxPrice: maxPrice.trim() === '' ? undefined : Number(maxPrice),
      competitorCount: count,
    }
    if ([newParams.minPrice, newParams.maxPrice].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) {
      setErrorMessage('价格必须是大于等于 0 的数字')
      return
    }
    if (newParams.minPrice !== undefined && newParams.maxPrice !== undefined && newParams.minPrice > newParams.maxPrice) {
      setErrorMessage('最低价不能高于最高价')
      return
    }
    const pages = Number(searchPages)
    if (!Number.isInteger(pages) || pages < 1 || pages > 100) {
      setErrorMessage('翻页深度需为 1-100 之间的整数')
      return
    }
    setImportedCount(null)
    setActiveParams(newParams)
    setLoading(true)

    const pacingText = '极稳防风控(单件间隔45s+/冷却30s)'
    const nowStr = new Date().toLocaleTimeString()
    const initLog = `[${nowStr}] 🚀 正在启动店透视采集任务...\n[${nowStr}] 目标关键词: ${newParams.keyword} | 计划采集数: ${count} | 价格区间: ${newParams.minPrice ?? '不限'} ~ ${newParams.maxPrice ?? '不限'}\n[${nowStr}] 采集节奏: ${pacingText}\n`
    setLogs(initLog)
    setStatus('running')

    try {
      const res = await window.desktop.collection.start({
        productName: newParams.keyword,
        keyword: newParams.keyword,
        tenantId: 'local',
        minPrice: newParams.minPrice,
        maxPrice: newParams.maxPrice,
        topN: count,
        searchPages: pages,
        speedProfile,
        mode: 'download-and-import',
        importMysql: false,
        // 生产业务界面固定为真实采集；fake 仿真仅保留在底层的 vitest 自动化测试中
        fake: false,
      })
      if (!res?.jobId) throw new Error('未能启动采集任务')
      setJobId(res.jobId)
      setLogs((prev) => prev + `[${new Date().toLocaleTimeString()}] 店透视采集任务已启动，日志将实时刷新。\n`)
      Message.success('店透视采集任务已启动')
      const s = await window.desktop.collection.status(res.jobId).catch(() => null)
      if (s?.logTail) setLogs(s.logTail)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '启动采集失败'
      setErrorMessage(msg)
      setStatus('failed')
      setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ❌ 启动采集失败: ${msg}\n`)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async () => {
    if (jobId) {
      try {
        const res = await window.desktop?.collection.cancel()
        if (res?.cancelled) {
          setStatus('stopped')
          setErrorMessage('')
          setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ⚠️ 采集任务已停止。`)
        } else {
          setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ⚠️ ${res?.reason || '取消请求未生效，任务可能仍在运行。'}`)
        }
        Message.warning(res?.cancelled ? '采集任务已停止' : '取消请求未生效')
      } catch {
        Message.error('停止请求失败，任务状态将继续刷新')
      }
      return
    }
    setStatus('stopped')
    setErrorMessage('')
    setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ⚠️ 用户手动停止了当前采集任务。`)
    Message.warning('采集任务已停止')
  }

  const handleReset = () => {
    setKeyword('')
    setMinPrice('')
    setMaxPrice('')
    setCompetitorCount('')
    setSearchPages('8')
    setStatus('idle')
    setLogs('')
    setActiveParams(null)
    setErrorMessage('')
    setJobId('')
    setImportedCount(null)
  }

  // ─── 方案 A：唤起真实 Chrome 窗口直登（桌面端仅展示状态引导）───
  const handleOpenLoginView = async () => {
    try {
      Message.info('正在唤起真实 Chrome 窗口，请在弹出浏览器中完成扫码登录...')
      setAuthDrawerVisible(true)
      setLoginAuthState('opening')
      setLoginStateHint('idle')
      const res = await window.desktop?.collection.openLoginView?.()
      if (!res?.ok) throw new Error('未能打开登录页')
    } catch (err) {
      setLoginStateHint('need-reopen')
      Message.error('打开登录页失败: ' + String(err))
    }
  }

  const handleStopLoginView = async () => {
    const res = await window.desktop?.collection.stopLoginView?.()
    // SSO 同步中主动关闭被主进程拦截：提醒用户等待授权完成，不关闭抽屉
    if (res && res.ok === false && res.reason) {
      Message.warning(res.reason)
      return
    }
    setLoginAuthState('idle')
    setAuthDrawerVisible(false)
    void refreshLoginStatus()
  }

  const displayParams = activeParams || {
    keyword,
    minPrice: minPrice.trim() === '' ? undefined : Number(minPrice),
    maxPrice: maxPrice.trim() === '' ? undefined : Number(maxPrice),
    competitorCount: Number(competitorCount) || 0,
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader breadcrumbs={[{ label: '市场' }, { label: '竞品分析' }, { label: 'AI数据采集' }]} />

      <div className="grid grid-cols-[minmax(420px,1fr)_1fr] gap-5">
        {/* ─── 左卡片：采集条件 ─── */}
        <section className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-extrabold text-[#0A1B39]">采集条件</h2>
            <div className="flex items-center gap-2.5">
              {loginStatus.checking ? (
                <div className="flex items-center gap-1.5 rounded-full border border-[#e5e8ef] bg-[#f8fafc] px-2.5 py-1 text-[12px] text-[#86909C]">
                  <Loader2 className="h-3 w-3 animate-spin text-[#3388ff]" />
                  <span>探测登录态...</span>
                </div>
              ) : loginStatus.isLoggedIn ? (
                <div className="flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-[12px] font-semibold text-[#16a34a] shadow-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#16a34a]"></span>
                  </span>
                  <span>淘宝已授权{loginStatus.taobaoNick ? ` (${maskNick(loginStatus.taobaoNick)})` : ''}</span>
                  <button
                    type="button"
                    onClick={() => { void handleOpenLoginView() }}
                    className="ml-1 border-0 bg-transparent p-0 text-[11px] font-normal text-[#15803d] underline hover:text-[#0A1B39] cursor-pointer"
                    title="点击重新登录或切换账号"
                  >
                    切换/续期
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { void handleOpenLoginView() }}
                  className="group relative flex items-center gap-1.5 rounded-lg border border-[#f59e0b] bg-[#fffbeb] px-3.5 py-1.5 text-[12px] font-bold text-[#b45309] hover:bg-[#fef3c7] hover:shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f59e0b] opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d97706]"></span>
                  </span>
                  <QrCode className="h-3.5 w-3.5 text-[#d97706]" />
                  <span>淘宝未登录 · 立即授权</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                disabled={isRunning || loginStatus.checking}
                className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-bold text-[#86909C] hover:text-[#344054] disabled:cursor-not-allowed disabled:opacity-40"
              >
                重置
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {!loginStatus.checking && !loginStatus.isLoggedIn && (
              <div className="flex items-center justify-between rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-3 shadow-xs">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-[#c2410c]">
                  <AlertCircle className="h-4 w-4 text-[#ea580c] shrink-0" />
                  <span>当前尚未登录淘宝账号，采集前请先完成账号授权，避免被平台拦截。</span>
                </div>
                <button
                  type="button"
                  onClick={() => { void handleOpenLoginView() }}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-[#ea580c] px-3 py-1 text-[12px] font-bold text-white hover:bg-[#c2410c] transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  立即登录
                </button>
              </div>
            )}
            <p className="text-[12px] leading-5 text-[#86909C]">
              采集由宿主系统真实 Google Chrome 驱动（独立专用 Profile 目录，与日常浏览器互不干扰），并已加载官方店透视插件。采集时会弹出 Chrome 窗口展示操作过程；如需更新登录态可点击上方「账号登录助手」唤起真实 Chrome 完成扫码，会话长期保存。
            </p>
            {/* 桌面端业务保留：快捷热门行业关键词 */}
            <div>
              <label className={FIELD_LABEL_CLASS}>快捷热门行业关键词</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    disabled={isRunning}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="cursor-pointer rounded border border-[#e5e8ef] bg-[#f8fafc] px-2.5 py-1 text-[12px] font-semibold text-[#4e5969] transition-colors hover:border-[#b8d7ff] hover:text-[#3388ff]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={FIELD_LABEL_CLASS}>关键词</label>
              <XInput value={keyword} onChange={setKeyword} disabled={isRunning} placeholder="请输入采集竞品关键词" />
            </div>

            <div>
              <label className={FIELD_LABEL_CLASS}>价格区间</label>
              <div className="flex items-center gap-3">
                <XInput value={minPrice} onChange={setMinPrice} disabled={isRunning} placeholder="请输入最低价" inputMode="decimal" className="flex-1" />
                <span className="text-[14px] font-bold text-[#86909C]">—</span>
                <XInput value={maxPrice} onChange={setMaxPrice} disabled={isRunning} placeholder="请输入最高价" inputMode="decimal" className="flex-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={FIELD_LABEL_CLASS}>竞品数量</label>
                <XInput value={competitorCount} onChange={setCompetitorCount} disabled={isRunning} placeholder="请输入采集竞品数量，1-100之间" inputMode="numeric" />
                <p className="m-0 mt-1 text-[12px] text-[#86909C]">限制 1 ~ 100 件商品</p>
              </div>
              <div>
                <label className={FIELD_LABEL_CLASS}>翻页深度 (页数)</label>
                <XInput value={searchPages} onChange={setSearchPages} disabled={isRunning} placeholder="默认检索前 8 页" inputMode="numeric" />
                <p className="m-0 mt-1 text-[12px] text-[#86909C]">默认检索前 8 页</p>
              </div>
            </div>

            {/* 采集节奏与防风控策略：固定保留极稳防风控模式 */}
            <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-[12px] text-[#166534]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-[#16a34a]"></span>
                  <span className="font-bold text-[#15803d]">已启用：🛡️ 极稳防风控模式 (推荐)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#dcfce7] px-2 py-0.5 text-[11px] font-semibold text-[#166534]">
                    单件间隔 {speedConfig.batch_delay}s+ · 导出冷却 {speedConfig.export_cooldown}s
                  </span>
                  <Button
                    type="text"
                    size="mini"
                    className="!h-6 !px-2 !text-[#15803d] hover:!bg-[#dcfce7] !font-medium flex items-center gap-1 border border-[#86efac] rounded"
                    icon={<Sliders className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setSpeedFormValues({ ...speedConfig })
                      setSpeedModalVisible(true)
                    }}
                  >
                    配置参数
                  </Button>
                </div>
              </div>
              <p className="m-0 mt-1.5 text-[11px] text-[#4b7a5a] leading-relaxed">
                已自动开启拟人化首屏平滑微滚动与真人浏览停顿，抗拦截与防封号能力最强；点击右侧「配置参数」可按需微调各项延时秒数。
              </p>
            </div>

          {errorMessage && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4 text-[13px] text-[#991b1b]">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" />
                <div className="flex-1">
                  {errorMessage.includes('Search page did not become ready') ? (
                    <div>
                      <p className="m-0 font-extrabold text-[13px] text-[#991b1b]">
                        ⚠️ 采集受阻：淘宝账号尚未登录或需扫码验证
                      </p>
                      <p className="m-0 mt-1 text-[12px] text-[#b91c1c] leading-relaxed">
                        淘宝对未登录访问限制了搜索结果展示（返回空白拦截页）。请点击下方按钮唤起真实 Chrome 登录窗口，使用手机淘宝扫码完成授权。
                      </p>
                    </div>
                  ) : (
                    <span className="font-semibold">{errorMessage}</span>
                  )}
                </div>
              </div>
              {errorMessage.includes('Search page did not become ready') && (
                <div className="flex items-center gap-2 pl-6 pt-1">
                  <button
                    type="button"
                    onClick={() => { void handleOpenLoginView() }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-[#1d4ed8] transition-colors border-0 cursor-pointer shadow-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    唤起 Chrome 登录窗口
                  </button>
                </div>
              )}
            </div>
          )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleStart}
                disabled={loading || isRunning || loginStatus.checking}
                className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#3388ff] text-[14px] font-extrabold text-white transition-all hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:bg-[#b8d7ff]"
              >
                {loginStatus.checking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>检测登录态中...</span>
                  </>
                ) : loading || isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>开始采集</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    <span>开始采集</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleStop}
                disabled={loading || !isRunning || loginStatus.checking}
                className="flex h-11 w-[120px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ffd7d7] bg-white text-[14px] font-extrabold text-[#c03535] transition-colors hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:border-[#eef1f5] disabled:bg-white disabled:text-[#b0b7c3]"
              >
                <Square className="h-4 w-4" />
                停止
              </button>
            </div>
          </div>
        </section>

        {/* ─── 右卡片：采集进度 ─── */}
        <section className="min-w-0 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-extrabold text-[#0A1B39]">采集进度</h2>
            <span className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${STATUS_CONFIG[status].className}`}>
              <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${STATUS_CONFIG[status].dot}`} />
              {STATUS_CONFIG[status].text}
            </span>
          </div>

          <div className="mb-4 rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-4">
            <p className="mb-3 text-[12px] font-bold text-[#86909C]">参数</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#86909C]">关键词</span>
                <span className={`rounded-md px-2 py-0.5 text-[13px] font-bold ${displayParams.keyword ? 'bg-[#e4f3ff] text-[#3388ff]' : 'bg-[#f2f4f7] text-[#98A2B3]'}`}>
                  {displayParams.keyword || '未设置'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#86909C]">价格区间</span>
                <span className={`text-[13px] font-bold ${displayParams.minPrice != null || displayParams.maxPrice != null ? 'text-[#0A1B39]' : 'text-[#98A2B3]'}`}>
                  {displayParams.minPrice != null || displayParams.maxPrice != null
                    ? `${displayParams.minPrice ?? '不限'} — ${displayParams.maxPrice ?? '不限'}`
                    : '未设置'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#86909C]">竞品数量</span>
                <span className={`text-[13px] font-bold ${displayParams.competitorCount ? 'text-[#0A1B39]' : 'text-[#98A2B3]'}`}>
                  {displayParams.competitorCount ? `${displayParams.competitorCount} 个` : '未设置'}
                </span>
              </div>
              {jobId && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-[#86909C]">任务ID</span>
                  <span className="truncate text-[13px] font-bold text-[#0A1B39]">{jobId.slice(0, 32)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="mb-1 text-[12px] font-bold text-[#86909C]">已采集数量</p>
                <p className="m-0 text-[20px] font-extrabold text-[#0A1B39]">
                  {collected}
                  <span className="text-[14px] font-bold text-[#86909C]"> / {total || '-'}</span>
                </p>
              </div>
              <span className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-extrabold text-[#3388ff]">{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e8edf5]">
              <div className="h-full rounded-full bg-[#3388ff] transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px] text-[#98A2B3]">
              <span>{parsedProgress.label || (isRunning ? '正在连接平台并解析商品流水...' : '空闲中')}</span>
              <span>{jobId ? `任务ID: ${jobId.slice(0, 10)}` : ''}</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#edf1f6] bg-[#f8fafc]">
            <div className="flex items-center justify-between border-b border-[#edf1f6] px-4 py-3">
              <span className="flex items-center gap-2 text-[13px] font-extrabold text-[#0A1B39]">
                <Terminal className="h-4 w-4" />
                进度流
              </span>
              <div className="flex items-center gap-3">
                <Tooltip content={autoScroll ? '滚屏：日志自动滚动到底部' : '固定：日志不自动滚动'}>
                  <span className="flex items-center gap-1.5">
                    <Switch size="small" checked={autoScroll} onChange={setAutoScroll} />
                  </span>
                </Tooltip>
                <button
                  type="button"
                  onClick={() => {
                    if (!logs) return
                    void navigator.clipboard.writeText(logs)
                    Message.success('日志已复制到剪贴板')
                  }}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-bold text-[#3388ff] hover:text-[#1a6fe8]"
                >
                  复制
                </button>
                <button
                  type="button"
                  onClick={() => setLogs('')}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-bold text-[#3388ff] hover:text-[#1a6fe8]"
                >
                  清空
                </button>
              </div>
            </div>
            <pre
              ref={logContainerRef}
              className="m-0 h-[340px] overflow-auto whitespace-pre-wrap p-4 text-[12px] leading-5 text-[#344054] custom-scrollbar"
            >
              {logs || '暂无输出。设置采集条件后点击「开始采集」，这里会显示真实 run.log 的最新内容。'}
            </pre>
          </div>

          {/* 任务完成引导条（桌面端业务保留） */}
          {status === 'completed' && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-[#c8e6c9] bg-[#f0fff4] p-3">
              <span className="text-[12px] font-semibold text-[#2e7d32]">已成功抓取并入库 {collected} 件竞品数据！</span>
              <button
                type="button"
                onClick={() => {
                  const kw = activeParams?.keyword || ''
                  navigate(`/market/competitive/report?keyword=${encodeURIComponent(kw)}`)
                }}
                className="cursor-pointer rounded-lg border-0 bg-[#3388ff] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#1a6fe8]"
              >
                生成市场报告
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ─── 方案 A：真实 Chrome 窗口直登的状态引导抽屉 ─── */}
      <Drawer
        width={460}
        className="login-screencast-drawer"
        unmountOnExit
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#3388ff]" />
            <span className="font-extrabold text-[16px] text-[#0A1B39]">淘宝账号登录授权</span>
          </div>
        }
        visible={authDrawerVisible}
        onCancel={() => { void handleStopLoginView() }}
        footer={
          <div className="flex w-full items-center justify-between">
            <span className="text-[12px] text-[#86909C]">真实 Chrome 窗口弹出后完成扫码，登录态将自动同步</span>
            <Button type="primary" onClick={() => { void handleStopLoginView() }}>
              完成并关闭
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-[#344054]">
          {/* 引导横幅：提示用户去真实 Chrome 窗口扫码（方案 A） */}
          <div className="flex items-start gap-2.5 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[12px] leading-5 text-[#1d4ed8]">
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
            <div>
              <p className="m-0 font-bold">登录已切换至真实 Google Chrome 窗口</p>
              <p className="m-0 mt-1">
                请在弹出的 Chrome 窗口中完成淘宝扫码或账号密码登录；桌面端会自动感知登录成功并展示下方状态。
              </p>
            </div>
          </div>
          {loginStateHint === 'need-reopen' && (
            <div className="flex items-center justify-between rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-[12px] font-semibold text-[#b45309]">
              <span>未检测到弹出窗口？点击重新唤起。</span>
              <button
                type="button"
                onClick={() => { void handleOpenLoginView() }}
                className="cursor-pointer rounded-md border-0 bg-[#f59e0b] px-3 py-1 text-[12px] font-bold text-white hover:bg-[#d97706]"
              >
                重新唤起 Chrome
              </button>
            </div>
          )}

          {/* 登录授权状态指示：扫码中 → 授权同步中（SSO 等待）→ 已完成 */}
          <div className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
            loginAuthState === 'verified'
              ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
              : loginAuthState === 'waiting-sso'
                ? 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]'
                : loginAuthState === 'opening'
                  ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]'
                  : 'border-[#e5e8ef] bg-[#f8fafc] text-[#64748b]'
          }`}>
            {loginAuthState === 'opening' && '📱 请在真实 Chrome 窗口中使用手机淘宝扫码或输入密码登录'}
            {loginAuthState === 'waiting-sso' && '⏳ 登录成功，正在同步全域授权（跨域 Cookie 写入中），请稍候…'}
            {loginAuthState === 'verified' && `✅ 授权已完成，登录状态已生效（${maskNick(loginStatus.taobaoNick)}），可关闭此面板开始采集`}
            {loginAuthState === 'idle' && '未检测到登录授权'}
          </div>

          {/* 登录方式指引 */}
          <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3 text-[12px] leading-5 text-[#3b82f6]">
            <p className="m-0 font-bold">登录方式指引</p>
            <p className="m-0 mt-1">
              • <strong>手机扫码</strong>：使用手机淘宝 App 扫描 Chrome 窗口中的二维码，一键完成授权，会话长期保存。<br />
              • <strong>账号密码</strong>：直接在 Chrome 窗口输入框里敲击账号密码登录（登录成功后关闭 Chrome 窗口即可）。
            </p>
            <p className="m-0 mt-2 border-t border-[#dbeafe] pt-2">
              ⚠️ 若 Chrome 提示「滑块/安全验证」，请在窗口里用鼠标拖动完成，桌面端会同步识别登录成功。
            </p>
          </div>
        </div>
      </Drawer>

      {/* 未安装 Google Chrome 浏览器时的阻断式引导弹窗 */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-[#d97706] font-bold text-[16px]">
            <AlertCircle className="w-5 h-5" />
            <span>未检测到 Google Chrome 浏览器</span>
          </div>
        }
        visible={chromeModalVisible}
        onCancel={() => setChromeModalVisible(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              loading={probingChrome}
              onClick={() => { void checkChrome(false) }}
            >
              我已安装，重新检测
            </Button>
            <Button
              type="primary"
              className="!bg-[#3388ff]"
              icon={<ExternalLink className="w-4 h-4" />}
              onClick={async () => {
                const url = chromeProbeResult?.downloadUrl || 'https://www.google.cn/chrome/'
                await window.desktop?.collection?.openExternalUrl?.(url)
              }}
            >
              前往官网下载 Chrome
            </Button>
          </div>
        }
        autoFocus={false}
        focusLock={true}
      >
        <div className="py-2 text-[14px] text-[#4e5969] leading-relaxed">
          <p className="mb-3 text-[#1d2129] font-medium">
            店透视自动化采集需要依赖本机的官方 <strong className="text-[#165dff]">Google Chrome 浏览器</strong> 以获得最高数据稳定性并杜绝阿里安全风控拦截。
          </p>
          <div className="rounded-lg bg-[#fff7e8] border border-[#ffe4ba] p-3 text-[13px] text-[#d46b08] space-y-1">
            <div>• 请先安装官方 Google Chrome 浏览器后再启动采集。</div>
            <div>• 安装完成后，点击右下方「我已安装，重新检测」即可立即开启自动化任务。</div>
          </div>
        </div>
      </Modal>

      {/* 防风控采集节奏参数微调弹窗 */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-[#15803d] font-bold text-[16px]">
            <Sliders className="w-5 h-5 text-[#16a34a]" />
            <span>防风控采集节奏参数设置</span>
          </div>
        }
        visible={speedModalVisible}
        onCancel={() => setSpeedModalVisible(false)}
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              type="secondary"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={handleResetSpeedConfig}
              className="!text-[#4e5969]"
            >
              恢复默认推荐
            </Button>
            <div className="flex items-center gap-2">
              <Button onClick={() => setSpeedModalVisible(false)}>
                取消
              </Button>
              <Button
                type="primary"
                loading={savingSpeedConfig}
                className="!bg-[#16a34a] hover:!bg-[#15803d]"
                onClick={handleSaveSpeedConfig}
              >
                保存并生效
              </Button>
            </div>
          </div>
        }
        autoFocus={false}
        focusLock={true}
        style={{ width: 640 }}
      >
        <div className="py-1 text-[13px] text-[#4e5969]">
          <div className="mb-4 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] p-3 text-[12px] text-[#166534] leading-relaxed">
            <p className="m-0 font-bold mb-1">🛡️ 极稳防风控策略配置说明</p>
            <p className="m-0">
              各参数单位为秒（或像素）。延时越充裕，真人拟人化效果越逼真、防封号与抗拦截能力越强；修改保存后下一次自动化采集即刻生效。
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-[#e5e6eb] p-3.5 bg-[#fafafa]">
              <div className="text-[13px] font-bold text-[#1d2129] mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#16a34a]"></span>
                核心防风控延时（核心判定，推荐保持推荐值）
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">跨商品等待间隔 (秒)</span>
                    <span className="text-[11px] text-[#86909c]">推荐: 60~90s</span>
                  </div>
                  <InputNumber
                    min={10}
                    max={300}
                    step={5}
                    value={speedFormValues.batch_delay}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, batch_delay: v || 60 }))}
                    style={{ width: '100%' }}
                    suffix="秒"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">一个商品抓完后切入下一商品的缓冲等待</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">插件导出冷却 (秒)</span>
                    <span className="text-[11px] text-[#86909c]">推荐: 35~45s</span>
                  </div>
                  <InputNumber
                    min={5}
                    max={120}
                    step={5}
                    value={speedFormValues.export_cooldown}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, export_cooldown: v || 35 }))}
                    style={{ width: '100%' }}
                    suffix="秒"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">商品图/商品数据/SKU/问大家/评价各模块间冷却</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#e5e6eb] p-3.5 bg-[#fafafa]">
              <div className="text-[13px] font-bold text-[#1d2129] mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span>
                搜索筛选与进店拟人化停顿
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">搜索页输入前静置</span>
                  </div>
                  <InputNumber
                    min={2}
                    max={30}
                    step={1}
                    value={speedFormValues.search_input_settle_wait}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, search_input_settle_wait: v || 5 }))}
                    style={{ width: '100%' }}
                    suffix="秒"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">等待淘宝埋点就绪防拦截</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">筛选与排序间隔</span>
                  </div>
                  <InputNumber
                    min={2}
                    max={30}
                    step={1}
                    value={speedFormValues.search_filter_wait}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, search_filter_wait: v || 8 }))}
                    style={{ width: '100%' }}
                    suffix="秒"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">价格区间与销量排序间隔</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">进详情页前停顿</span>
                  </div>
                  <InputNumber
                    min={3}
                    max={60}
                    step={1}
                    value={speedFormValues.before_item_open_wait}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, before_item_open_wait: v || 10 }))}
                    style={{ width: '100%' }}
                    suffix="秒"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">选定商品后进店前停顿</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">详情首屏静置</span>
                  </div>
                  <InputNumber
                    min={5}
                    max={60}
                    step={1}
                    value={speedFormValues.detail_settle_wait}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, detail_settle_wait: v || 18 }))}
                    style={{ width: '100%' }}
                    suffix="秒"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">进店后模拟真人看主图</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">搜索扫视停顿</span>
                  </div>
                  <InputNumber
                    min={1}
                    max={30}
                    step={0.5}
                    precision={1}
                    value={speedFormValues.search_scroll_wait}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, search_scroll_wait: v || 5.0 }))}
                    style={{ width: '100%' }}
                    suffix="秒"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">搜索结果加载后扫视</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">详情微滚动</span>
                  </div>
                  <InputNumber
                    min={0}
                    max={1200}
                    step={50}
                    value={speedFormValues.detail_scroll_top}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, detail_scroll_top: v || 320 }))}
                    style={{ width: '100%' }}
                    suffix="px"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">进详情后拟人下滑距离</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#e5e6eb] p-3.5 bg-[#fafafa]">
              <div className="text-[13px] font-bold text-[#1d2129] mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                超时保护（防止卡死）
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">弹窗渲染等待上限</span>
                  </div>
                  <InputNumber
                    min={15}
                    max={300}
                    step={10}
                    value={speedFormValues.ask_ready_timeout}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, ask_ready_timeout: v || 60 }))}
                    style={{ width: '100%' }}
                    suffix="秒"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">等待店透视弹窗加载超时</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#1d2129]">表格下载等待上限</span>
                  </div>
                  <InputNumber
                    min={20}
                    max={300}
                    step={10}
                    value={speedFormValues.xlsx_first_timeout}
                    onChange={(v) => setSpeedFormValues((prev) => ({ ...prev, xlsx_first_timeout: v || 90 }))}
                    style={{ width: '100%' }}
                    suffix="秒"
                  />
                  <p className="m-0 mt-1 text-[11px] text-[#86909c]">Excel 数据生成与落盘超时</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
