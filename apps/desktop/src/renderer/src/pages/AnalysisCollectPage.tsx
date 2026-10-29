import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Drawer, Message, Switch, Tooltip } from '@arco-design/web-react'
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  QrCode,
  ShieldCheck,
  Square,
  Terminal,
  X,
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

  // 状态控制：驱动主进程真实店透视 RPA（collection:start / collection:status）
  const [status, setStatus] = useState<CollectionStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string>('')
  const [logs, setLogs] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [authDrawerVisible, setAuthDrawerVisible] = useState(false)

  // ─── 方案 B：内置画面投射（无头容器 + CDP Screencast）───
  const [screencastConnected, setScreencastConnected] = useState(false)
  const [screencastError, setScreencastError] = useState('')
  const [frameVisible, setFrameVisible] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [hoverCursor, setHoverCursor] = useState('')
  // CDP Input 坐标是 CSS viewport；不能用 Retina 帧的物理像素尺寸覆盖它。
  const viewportRef = useRef<{ width: number; height: number }>({ width: 1280, height: 800 })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameImgRef = useRef<HTMLImageElement | null>(null)
  const dragSeqRef = useRef(0)
  const cursorQueryAtRef = useRef(0)

  // 抽屉宽度拖拽与全屏控制
  const MIN_DRAWER_WIDTH = 540
  const DEFAULT_DRAWER_WIDTH = 720
  const [drawerWidth, setDrawerWidth] = useState<number>(DEFAULT_DRAWER_WIDTH)
  const [isDrawerFullscreen, setIsDrawerFullscreen] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const isResizingRef = useRef(false)
  const lastNormalWidthRef = useRef<number>(DEFAULT_DRAWER_WIDTH)

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

  // ─── 方案 B：帧流订阅（红色划线：投射到右侧抽屉的内置浏览器画面）───
  useEffect(() => {
    if (!window.desktop?.collection) return
    const offFrame = window.desktop.collection.onScreencastFrame((frame) => {
      if (!canvasRef.current) return
      // frame 尺寸为 Retina 物理像素（2560×1600），仅作为 canvas backing store；
      // CSS viewport（1280×800）由 openLoginView 返回，坐标映射必须用它，不能被物理像素覆盖。
      setFrameVisible(true)
      const img = frameImgRef.current ?? new Image()
      frameImgRef.current = img
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = frame.width
        canvas.height = frame.height
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.drawImage(img, 0, 0)
      }
      // PNG（Retina 高清）或 JPEG 前缀自适应
      const prefix = frame.data.startsWith('/9j/') ? 'data:image/jpeg;base64,' : 'data:image/png;base64,'
      img.src = `${prefix}${frame.data}`
    })
    const offStatus = window.desktop.collection.onScreencastStatus((status) => {
      if (status.status === 'connected') {
        setScreencastConnected(true)
        setScreencastError('')
      } else if (status.status === 'closed') {
        setScreencastConnected(false)
        setScreencastError(status.error || '登录画面连接已断开')
      }
    })
    return () => {
      offFrame()
      offStatus()
      void window.desktop?.collection?.stopLoginView?.()
    }
  }, [])

  // 滑块检测：从进度流日志中识别「滑块/滑动验证/人机验证」
  const guardDetected = useMemo(() => {
    return /滑块|滑动验证|人机验证|安全验证|拖动.*(滑块|解锁)|请.*手动.*解锁/i.test(logs)
  }, [logs])

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

    const nowStr = new Date().toLocaleTimeString()
    const initLog = `[${nowStr}] 🚀 正在启动店透视采集任务...\n[${nowStr}] 目标关键词: ${newParams.keyword} | 计划采集数: ${count} | 价格区间: ${newParams.minPrice ?? '不限'} ~ ${newParams.maxPrice ?? '不限'}\n`
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
        speedProfile: 'fast',
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

  // ─── 方案 B：唤起内置投射登录视图 ───
  const handleOpenLoginView = async () => {
    try {
      Message.info('正在连接内置浏览器画面...')
      setAuthDrawerVisible(true)
      setScreencastConnected(false)
      setScreencastError('')
      setFrameVisible(false)
      const res = await window.desktop?.collection.openLoginView?.()
      if (res?.viewport) viewportRef.current = res.viewport
    } catch (err) {
      setScreencastError(String(err instanceof Error ? err.message : err))
      Message.error('打开登录画面失败: ' + String(err))
    }
  }

  const handleStopLoginView = async () => {
    await window.desktop?.collection.stopLoginView?.()
    setScreencastConnected(false)
    setAuthDrawerVisible(false)
    setIsDrawerFullscreen(false)
  }

  // 计算画布内点击坐标 → CDP 视口坐标（canvas 显示尺寸 ↔ viewport 比例换算）
  const canvasPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const vp = viewportRef.current
    const x = ((clientX - rect.left) / rect.width) * vp.width
    const y = ((clientY - rect.top) / rect.height) * vp.height
    return { x: Math.round(x), y: Math.round(y) }
  }

  const handleLoginPointerDown = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!screencastConnected) return
    e.preventDefault()
    canvasRef.current?.focus()
    const p = canvasPoint(e.clientX, e.clientY)
    dragSeqRef.current = 1
    setDragActive(true)
    await window.desktop?.collection.sendLoginInput?.({ type: 'mousePressed', x: p.x, y: p.y })
  }

  const handleLoginPointerMove = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!screencastConnected) return
    if (dragActive) {
      const p = canvasPoint(e.clientX, e.clientY)
      dragSeqRef.current += 1
      await window.desktop?.collection.sendLoginInput?.({ type: 'mouseMoved', x: p.x, y: p.y })
      return
    }
    // 悬停而非拖拽：节流查询页面真实 cursor（text/pointer/…），降低 IPC 频率
    const now = Date.now()
    if (now - cursorQueryAtRef.current < 100) return
    cursorQueryAtRef.current = now
    const p = canvasPoint(e.clientX, e.clientY)
    const cursor = await window.desktop?.collection.sendLoginCursor?.({ x: p.x, y: p.y })
    if (typeof cursor === 'string') setHoverCursor(cursor)
  }

  const handleLoginPointerUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragActive || !screencastConnected) return
    const p = canvasPoint(e.clientX, e.clientY)
    dragSeqRef.current = 0
    setDragActive(false)
    await window.desktop?.collection.sendLoginInput?.({ type: 'mouseReleased', x: p.x, y: p.y })
  }

  const handleLoginKeyDown = async (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!screencastConnected) return
    // 阻止页面整体按键滚动等默认行为（如按空格或方向键滚屏）
    if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) {
      e.preventDefault()
    }
    // 处理 Cmd+V / Ctrl+V 快捷粘贴
    if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault()
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          await window.desktop?.collection.sendLoginInsertText?.(text)
          Message.success('已将剪贴板内容填入当前输入框')
        }
      } catch {}
      return
    }
    // 处理 Cmd+A / Ctrl+A 全选
    if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
      await window.desktop?.collection.sendLoginKey?.({
        type: 'keyDown',
        key: 'a',
        code: 'KeyA',
        modifiers: 2,
      })
      return
    }
    // 普通单一字符直接插入文本（确保字母/数字/符号输入稳定）
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      await window.desktop?.collection.sendLoginInsertText?.(e.key)
      return
    }
    // 控制键（Backspace, Enter, Tab, Arrow 等）发送按键事件
    await window.desktop?.collection.sendLoginKey?.({
      type: 'keyDown',
      key: e.key,
      code: e.code,
      windowsVirtualKeyCode: e.keyCode,
    })
  }

  const handleLoginKeyUp = async (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!screencastConnected) return
    await window.desktop?.collection.sendLoginKey?.({
      type: 'keyUp',
      key: e.key,
      code: e.code,
      windowsVirtualKeyCode: e.keyCode,
    })
  }

  const handleToggleDrawerFullscreen = () => {
    if (!isDrawerFullscreen) {
      lastNormalWidthRef.current = drawerWidth
      setDrawerWidth(window.innerWidth)
      setIsDrawerFullscreen(true)
    } else {
      setDrawerWidth(Math.max(MIN_DRAWER_WIDTH, Math.min(lastNormalWidthRef.current, window.innerWidth - 60)))
      setIsDrawerFullscreen(false)
    }
  }

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    isResizingRef.current = true
    setIsResizing(true)
    const startX = e.clientX
    const startW = drawerWidth

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return
      const deltaX = startX - moveEvent.clientX
      const nextW = Math.max(MIN_DRAWER_WIDTH, Math.min(startW + deltaX, window.innerWidth))
      setDrawerWidth(nextW)
      if (nextW >= window.innerWidth - 20) {
        setIsDrawerFullscreen(true)
      } else {
        setIsDrawerFullscreen(false)
        lastNormalWidthRef.current = nextW
      }
    }

    const onMouseUp = () => {
      isResizingRef.current = false
      setIsResizing(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { void handleOpenLoginView() }}
                className="flex items-center gap-1.5 rounded-lg border border-[#d0e2ff] bg-[#f0f5ff] px-2.5 py-1 text-[12px] font-bold text-[#3388ff] hover:bg-[#e0edff] transition-colors cursor-pointer"
              >
                <QrCode className="h-3.5 w-3.5" />
                账号登录助手
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isRunning}
                className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-bold text-[#86909C] hover:text-[#344054]"
              >
                重置
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <p className="text-[12px] leading-5 text-[#86909C]">
              已内置专属绿色 Chromium 容器与官方店透视插件。全流程<strong>后台无感静默采集</strong>，绝不弹出外部浏览器；如需更新登录态可点击上方「账号登录助手」完成扫码，会话终身持久化。
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
                        淘宝对未登录访问限制了搜索结果展示（返回空白拦截页）。请点击下方按钮唤起右侧登录画面，使用手机淘宝扫码登录一次即可永久生效。
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
                    在右侧打开登录画面
                  </button>
                </div>
              )}
            </div>
          )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleStart}
                disabled={loading || isRunning}
                className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#3388ff] text-[14px] font-extrabold text-white transition-all hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:bg-[#b8d7ff]"
              >
                {loading || isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                开始采集
              </button>
              <button
                type="button"
                onClick={handleStop}
                disabled={loading || !isRunning}
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

      {/* ─── 方案 B：无头 Chromium 画面投射登录抽屉 ─── */}
      <Drawer
        width={isDrawerFullscreen ? '100%' : drawerWidth}
        className={`login-screencast-drawer ${isResizing ? 'is-resizing' : ''}`}
        unmountOnExit
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#3388ff]" />
            <span className="font-extrabold text-[16px] text-[#0A1B39]">店透视 & 淘宝登录授权</span>
          </div>
        }
        visible={authDrawerVisible}
        onOk={() => { void handleStopLoginView() }}
        onCancel={() => { void handleStopLoginView() }}
        footer={
          <div className="flex w-full items-center justify-between">
            <span className="text-[12px] text-[#86909C]">扫码或输入密码登录成功后，关闭此画面即可</span>
            <Button type="primary" onClick={() => { void handleStopLoginView() }}>
              完成并关闭
            </Button>
          </div>
        }
      >
        {/* 左边缘拖拽调整宽度把手（支持左右拉伸，设有限定最小宽度） */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-[#3388ff]/30 active:bg-[#3388ff]/60 transition-colors z-50 group flex items-center justify-center select-none"
          title="左右拖拽调整宽度"
        >
          <div className="h-12 w-1 rounded-full bg-[#cbd5e1] group-hover:bg-[#3388ff] transition-colors" />
        </div>

        <div className="space-y-4 text-[#344054]">
          <div className="flex items-center justify-between rounded-lg border border-[#e5e8ef] bg-[#f8fafc] px-3 py-2">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <span className={`h-2 w-2 rounded-full ${screencastConnected ? 'bg-[#10b981]' : 'bg-[#f59e0b] animate-pulse'}`} />
              {screencastConnected ? '内置浏览器画面已连接' : '正在连接内置浏览器画面...'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleDrawerFullscreen}
                title={isDrawerFullscreen ? '还原窗口宽度' : '全屏展开窗口'}
                className="flex items-center gap-1.5 rounded-md border border-[#dce3ee] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054] hover:bg-[#f1f5f9] hover:text-[#0A1B39] transition-all cursor-pointer shadow-xs active:scale-95"
              >
                {isDrawerFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 text-[#3388ff]" />
                    <span>还原窗口</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-[#3388ff]" />
                    <span>全屏拉满</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { void handleStopLoginView() }}
                className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[12px] font-semibold text-[#86909C] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>关闭画面</span>
              </button>
            </div>
          </div>

          <div className={`relative overflow-hidden rounded-xl border border-[#dce3ee] bg-[#111827] shadow-inner transition-all duration-300 flex items-center justify-center ${isDrawerFullscreen ? 'min-h-[75vh]' : ''}`}>
            {/* 淘宝网页画面右上角悬浮全屏/还原按钮 */}
            <div className="absolute right-3.5 top-3.5 z-30">
              <button
                type="button"
                onClick={handleToggleDrawerFullscreen}
                title={isDrawerFullscreen ? '还原窗口宽度' : '全屏展开窗口'}
                className="group flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/60 px-3 py-1.5 text-[12px] font-medium text-white/90 backdrop-blur-md hover:bg-black/80 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95"
              >
                {isDrawerFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 text-[#60a5fa] group-hover:scale-110 transition-transform" />
                    <span>还原</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-[#60a5fa] group-hover:scale-110 transition-transform" />
                    <span>全屏</span>
                  </>
                )}
              </button>
            </div>

            {!frameVisible && (
              <div className="flex h-[420px] items-center justify-center text-[13px] text-white/70">
                {screencastError || '等待淘宝登录画面...'}
              </div>
            )}
            <canvas
              ref={canvasRef}
              tabIndex={0}
              className={`block select-none outline-none focus:ring-2 focus:ring-[#3388ff] ${frameVisible ? '' : 'hidden'} ${dragActive ? 'cursor-grabbing' : ''} ${isDrawerFullscreen ? 'max-h-[82vh] w-auto max-w-full' : 'h-auto w-full'}`}
              style={{ cursor: dragActive ? 'grabbing' : (hoverCursor || 'default') }}
              onMouseDown={(event) => { void handleLoginPointerDown(event) }}
              onMouseMove={(event) => { void handleLoginPointerMove(event) }}
              onMouseUp={(event) => { void handleLoginPointerUp(event) }}
              onKeyDown={(event) => { void handleLoginKeyDown(event) }}
              onKeyUp={(event) => { void handleLoginKeyUp(event) }}
              onMouseLeave={(event) => {
                if (dragActive) void handleLoginPointerUp(event)
              }}
              onContextMenu={(event) => event.preventDefault()}
            />
            {guardDetected && frameVisible && (
              <div className="pointer-events-none absolute inset-x-3 top-3 rounded-lg border border-[#fbbf24] bg-[#78350f]/90 px-3 py-2 text-center text-[12px] font-bold text-[#fef3c7]">
                检测到安全验证，请在上方画面中拖动滑块完成解锁
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3 text-[12px] leading-5 text-[#3b82f6]">
            <p className="m-0 font-bold">登录方式指引</p>
            <p className="m-0 mt-1">
              • <strong>手机扫码</strong>：使用手机淘宝 App 扫描画面左侧二维码，一键完成授权，终身免登。<br />
              • <strong>账号密码</strong>：直接用鼠标点击画面输入框，即可在物理键盘敲击打字输入（支持退格与粘贴）。
            </p>
          </div>
          {screencastError && (
            <button
              type="button"
              onClick={() => { void handleOpenLoginView() }}
              className="w-full rounded-lg border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-[12px] font-bold text-[#b91c1c]"
            >
              连接已断开，点击重试
            </button>
          )}
        </div>
      </Drawer>
    </div>
  )
}
