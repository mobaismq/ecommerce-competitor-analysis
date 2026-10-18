import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Grid,
  Input,
  Message,
  Select,
  Switch,
  Trigger,
} from '@arco-design/web-react'
import {
  Check,
  Download,
  Image as ImageIcon,
  Loader2,
  Minus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Type,
  Upload as UploadIcon,
  Wand2,
  X,
} from 'lucide-react'
import { AIReportSelector, SectionTitle, type SuiteProduct } from '../components/AIReportSelector'
import { AiHelpPopover } from '../components/AiHelpPopover'
import { ProductImageHelpTooltip } from '../components/ProductImageHelpTooltip'
import { ResultActionDialog } from '../components/ResultActionDialog'
import { ImageResizeDialog } from '../components/ImageResizeDialog'
import { useAuth } from '../store/auth'
import { saveAs } from 'file-saver'
import { nanoid } from 'nanoid'
import { imageSourceToJpegBlob } from '../image-tools'
import mainHeadphone from '../assets/main-headphone.png'
import sceneDisplay from '../assets/scene-display.png'
import sellingPoint from '../assets/selling-point.png'
import detailExplain from '../assets/detail-explain.png'
import modelScene from '../assets/model-scene.png'
import suiteArrow from '../assets/suite-arrow.svg'

const { Row, Col } = Grid
const Option = Select.Option
const PRODUCT_SETS_DRAFT_DATABASE = 'ecommerce-competitor-analysis'
const PRODUCT_SETS_DRAFT_STORE = 'product-image-sets'
const PRODUCT_SETS_DRAFT_KEY = 'latest-form'
const PRODUCT_SETS_LATEST_JOB_KEY = 'eca.productImageSets.latestJobId'

// 生成设置三组 options 逐字对照旧版 ProductImageSets.tsx GENERATION_OPTIONS（平台 17 / 国家 17 / 语言 14 / 比例 5）
const PLATFORM_OPTIONS = [
  '淘宝天猫1688', '淘宝', '天猫', '抖音', '京东', '拼多多', '亚马逊', 'TikTok', '速卖通', 'Temu', 'Shein', 'Shopee', 'Lazada', 'eBay', 'Walmart', 'Shopify', '独立站',
]
const COUNTRY_OPTIONS = ['中国', '美国', '英国', '德国', '法国', '意大利', '西班牙', '日本', '韩国', '加拿大', '澳大利亚', '新加坡', '马来西亚', '泰国', '越南', '巴西', '墨西哥']
const LANGUAGE_OPTIONS = ['英文', '中文', '日文', '韩文', '德文', '法文', '意大利文', '西班牙文', '葡萄牙文', '荷兰文', '波兰文', '泰文', '越南文', '印尼文']
const RATIO_OPTIONS = ['1:1', '3:4', '4:3', '9:16', '16:9']

interface UploadedImage {
  id: string
  url: string
  name: string
  isMain?: boolean
}

interface GenerationSettings {
  platform: string
  country: string
  language: string
  ratio: string
}

type SuiteTypeKey = 'white' | 'scene' | 'selling' | 'function' | 'detail'

const SUITE_TYPES: Array<{ key: SuiteTypeKey; label: string; desc: string }> = [
  { key: 'white', label: '白底图', desc: '纯白背景，单主体合规商品主图' },
  { key: 'scene', label: '场景图', desc: '单一真实使用场景，突出商品佩戴/使用效果' },
  { key: 'selling', label: '卖点图', desc: '聚焦单个核心卖点，配合短文案说明' },
  { key: 'function', label: '细节说明', desc: '展示商品可见细节、结构、使用方式和参数信息' },
  { key: 'detail', label: '买点详解', desc: '拆解商品核心卖点、适用场景和购买理由' },
]

interface GenerationSlot {
  id: string
  slotIndex: number
  typeKey: SuiteTypeKey
  name: string
  type: string
  prompt: string
  imageUrl?: string
  status: 'idle' | 'generating' | 'done' | 'failed'
  error?: string
}

interface SlotActionPanel {
  mode: 'text' | 'retouch' | 'resize'
  slotId: string
  title: string
  text: string
  direction: string
  loading: boolean
}

interface ProductImageSetsDraft {
  uploadedImages: UploadedImage[]
  selectedReportId: string
  settings: GenerationSettings
  generationText: string
  productName: string
  reportSellingPoints: string[]
  mode: '智能匹配' | '自定义配置'
  customCounts: Record<SuiteTypeKey, number>
  styleAnalysis: boolean
  listingCopy: boolean
}

function openProductSetsDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PRODUCT_SETS_DRAFT_DATABASE, 1)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PRODUCT_SETS_DRAFT_STORE)) {
        request.result.createObjectStore(PRODUCT_SETS_DRAFT_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function readProductSetsDraft(): Promise<ProductImageSetsDraft | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null
  const database = await openProductSetsDraftDatabase()
  try {
    return await new Promise<ProductImageSetsDraft | null>((resolve, reject) => {
      const request = database.transaction(PRODUCT_SETS_DRAFT_STORE, 'readonly').objectStore(PRODUCT_SETS_DRAFT_STORE).get(PRODUCT_SETS_DRAFT_KEY)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve((request.result as ProductImageSetsDraft | undefined) ?? null)
    })
  } finally {
    database.close()
  }
}

async function writeProductSetsDraft(draft: ProductImageSetsDraft): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return
  const database = await openProductSetsDraftDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(PRODUCT_SETS_DRAFT_STORE, 'readwrite').objectStore(PRODUCT_SETS_DRAFT_STORE).put(draft, PRODUCT_SETS_DRAFT_KEY)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } finally {
    database.close()
  }
}

async function clearProductSetsDraft(): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return
  const database = await openProductSetsDraftDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(PRODUCT_SETS_DRAFT_STORE, 'readwrite').objectStore(PRODUCT_SETS_DRAFT_STORE).delete(PRODUCT_SETS_DRAFT_KEY)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } finally {
    database.close()
  }
}

export function ProductImageSetsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const currentUserId = useAuth((s) => s.user?.id ?? '')

  // 1. 商品原图 (<=6张)
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const uploadInProgressRef = useRef(false)

  // 2. 选报告
  const [selectedReportId, setSelectedReportId] = useState('')
  const [selectedReport, setSelectedReport] = useState<SuiteProduct | null>(null)

  // 3. 四维参数设置
  const [settings, setSettings] = useState<GenerationSettings>({
    platform: '淘宝天猫1688',
    country: '中国',
    language: '中文',
    ratio: '1:1',
  })

  // 4. 商品卖点 & AI帮写
  const [generationText, setGenerationText] = useState('')
  // 关联商品名（图库真源：选填，填入后随生图写入 GeneratedAsset）
  const [productName, setProductName] = useState('')
  const [reportSellingPoints, setReportSellingPoints] = useState<string[]>([])
  const [loadingDescriptions, setLoadingDescriptions] = useState(false)
  const [aiHelpOpen, setAiHelpOpen] = useState(false)
  const [expandingPrompts, setExpandingPrompts] = useState(false)
  const [aiHelpText, setAiHelpText] = useState('')
  const [error, setError] = useState('')

  // 5. 套图结构配置
  const [mode, setMode] = useState<'智能匹配' | '自定义配置'>('智能匹配')
  const [customCounts, setCustomCounts] = useState<Record<SuiteTypeKey, number>>({
    white: 1,
    scene: 1,
    selling: 1,
    function: 1,
    detail: 1,
  })

  // 6. 附加功能
  const [styleAnalysis, setStyleAnalysis] = useState(false)
  const [listingCopy, setListingCopy] = useState(true)

  // 7. 生成状态与图位结果
  const [slots, setSlots] = useState<GenerationSlot[]>([])
  const [resultViewActive, setResultViewActive] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationJobId, setGenerationJobId] = useState('')
  const [actionPanel, setActionPanel] = useState<SlotActionPanel | null>(null)
  // 结果看板：已勾选图位（M10 全选/批量操作）
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([])
  // 更多操作悬浮面板目标（M11）
  const [moreMenuSlotId, setMoreMenuSlotId] = useState<string | null>(null)
  useEffect(() => {
    if (!moreMenuSlotId) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreMenuSlotId(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [moreMenuSlotId])
  // 智能改尺寸面板目标：null=关闭；'batch'=批量；slotId=单张（M14/M15）
  const [resizeTargets, setResizeTargets] = useState<string[] | null>(null)
  const [resizeRatio, setResizeRatio] = useState(settings.ratio)
  const [batchResizeSlotIds, setBatchResizeSlotIds] = useState<string[]>([])
  const [previewSlotId, setPreviewSlotId] = useState<string | null>(null)
  const activeGenerationJobRef = useRef('')
  const preserveGenerationTextFromDraftRef = useRef(false)

  const previewSlot = previewSlotId ? slots.find((slot) => slot.id === previewSlotId && slot.imageUrl) : undefined
  const generatedSlotIds = slots.filter((slot) => slot.imageUrl).map((slot) => slot.id)
  const allGeneratedSelected = generatedSlotIds.length > 0 && generatedSlotIds.every((id) => selectedSlotIds.includes(id))
  const partiallyGeneratedSelected = !allGeneratedSelected && generatedSlotIds.some((id) => selectedSlotIds.includes(id))
  const editableTextLines = actionPanel?.mode === 'text' ? actionPanel.text.split('\n') : []

  useEffect(() => {
    if (previewSlotId && !previewSlot) setPreviewSlotId(null)
  }, [previewSlot, previewSlotId])

  // 计算当前总张数
  const totalImageCount = useMemo(() => {
    if (mode === '智能匹配') return 5
    return Object.values(customCounts).reduce((sum, n) => sum + n, 0)
  }, [mode, customCounts])

  const persistCurrentForm = async () => {
    await writeProductSetsDraft({
      uploadedImages,
      selectedReportId,
      settings,
      generationText,
      productName,
      reportSellingPoints,
      mode,
      customCounts,
      styleAnalysis,
      listingCopy,
    })
  }

  const clearGeneratedResults = () => {
    activeGenerationJobRef.current = ''
    setResultViewActive(false)
    setSlots([])
    setSelectedSlotIds([])
    setGenerationJobId('')
    setGenerating(false)
    setError('')
    setActionPanel(null)
    setMoreMenuSlotId(null)
    setResizeTargets(null)
    setBatchResizeSlotIds([])
    setPreviewSlotId(null)
    localStorage.removeItem(PRODUCT_SETS_LATEST_JOB_KEY)
    void clearProductSetsDraft()
  }

  // 上传原图处理
  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (uploadInProgressRef.current) {
      Message.info('图片正在读取，请稍后再添加')
      return
    }
    const remaining = 6 - uploadedImages.length
    const exceedsLimit = files.length > remaining
    if (remaining <= 0) {
      Message.warning('同一产品最多上传 6 张图片，已保留前 6 张')
      return
    }
    const toAdd = Array.from(files).slice(0, remaining)
    uploadInProgressRef.current = true
    try {
      // Promise.all 保留选择顺序，避免 FileReader 完成顺序改变前 6 张及首张原图。
      const images = await Promise.all(toAdd.map((file) => new Promise<UploadedImage>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({
          id: `img-${nanoid(8)}`,
          name: file.name,
          url: reader.result as string,
        })
        reader.onerror = () => reject(new Error('图片读取失败，请重新上传'))
        reader.onabort = () => reject(new Error('图片读取已取消，请重新上传'))
        reader.readAsDataURL(file)
      })))
      setUploadedImages((prev) => [
        ...prev,
        ...images.map((image, index) => ({ ...image, isMain: prev.length === 0 && index === 0 })),
      ].slice(0, 6))
      if (exceedsLimit) {
        Message.warning('同一产品最多上传 6 张图片，已保留前 6 张')
      } else {
        Message.success(`已添加 ${images.length} 张原图`)
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : '图片读取失败，请重新上传')
    } finally {
      uploadInProgressRef.current = false
    }
  }

  const removeUploadedImage = (id: string) => {
    setUploadedImages((prev) => {
      const next = prev.filter((img) => img.id !== id)
      if (next.length > 0 && !next.some((img) => img.isMain)) {
        next[0].isMain = true
      }
      return next
    })
    if (resultViewActive || generationJobId || localStorage.getItem(PRODUCT_SETS_LATEST_JOB_KEY)) {
      clearGeneratedResults()
    }
  }

  // 选择 AI 报告后回读主图描述，自动填充生图卖点（对齐旧版报告联动）
  useEffect(() => {
    if (!selectedReportId) {
      setReportSellingPoints([])
      return
    }
    const preserveGenerationText = preserveGenerationTextFromDraftRef.current
    preserveGenerationTextFromDraftRef.current = false
    let cancelled = false
    setLoadingDescriptions(true)
    window.desktop?.capabilities
      .invoke('productSets.mainImageDescriptions', { runId: selectedReportId })
      .then((data) => {
        if (cancelled) return
        const result = data as { ok?: boolean; promptText?: string; sellingPoints?: string[] } | undefined
        setReportSellingPoints(result?.sellingPoints ?? [])
        if (!preserveGenerationText && result?.promptText?.trim()) setGenerationText(result.promptText.trim())
      })
      .catch(() => {
        if (!cancelled) setReportSellingPoints([])
      })
      .finally(() => {
        if (!cancelled) setLoadingDescriptions(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedReportId])

  // 将浏览器临时 blob: 转为 base64 dataUrl，避免向后台或 AI 服务传递未落盘的 blob: 协议地址
  const resolveImageRefForAi = useCallback(async (url: string): Promise<string> => {
    if (!url || !url.startsWith('blob:')) return url
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string) || url)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch {
      return url
    }
  }, [])

  // 用真实落盘字节生成可展示 base64 dataUrl（直接返回真实图片数据，避免生成 blob: 导致后端/AI 视觉识别失败）
  const loadAssetImg = useCallback(async (id: string): Promise<string> => {
    try {
      const dataUrl = await window.desktop?.capabilities.invoke('asset.raw', { id }) as { dataUrl: string; mimeType: string } | undefined
      if (!dataUrl?.dataUrl) return ''
      return dataUrl.dataUrl
    } catch {
      return ''
    }
  }, [])

  // 刷新后按最近一次生成批次回显真实结果，同时恢复生成时的左侧表单快照。
  useEffect(() => {
    const latestJobId = localStorage.getItem(PRODUCT_SETS_LATEST_JOB_KEY)
    if (!latestJobId) return
    let cancelled = false
    void (async () => {
      try {
        const draft = await readProductSetsDraft()
        if (cancelled || localStorage.getItem(PRODUCT_SETS_LATEST_JOB_KEY) !== latestJobId || !draft?.uploadedImages.length) return

        preserveGenerationTextFromDraftRef.current = Boolean(draft.selectedReportId)
        setUploadedImages(draft.uploadedImages)
        setSelectedReportId(draft.selectedReportId)
        setSettings(draft.settings)
        setGenerationText(draft.generationText)
        setProductName(draft.productName)
        setReportSellingPoints(draft.reportSellingPoints)
        setMode(draft.mode)
        setCustomCounts(draft.customCounts)
        setStyleAnalysis(draft.styleAnalysis)
        setListingCopy(draft.listingCopy)
        setResizeRatio(draft.settings.ratio)

        const data = await window.desktop?.capabilities.invoke('asset.list', { jobId: latestJobId })
        if (cancelled || localStorage.getItem(PRODUCT_SETS_LATEST_JOB_KEY) !== latestJobId) return
        const seenSlots = new Set<string>()
        const rows = ((data as { id: string; sourceUrl?: string | null; originalName?: string | null; category?: string | null; prompt?: string | null }[]) ?? [])
          .filter((item) => {
            const key = item.originalName ? `${item.category ?? ''}\0${item.originalName}` : item.id
            if (seenSlots.has(key)) return false
            seenSlots.add(key)
            return true
          })
          .sort((a, b) =>
            String(a.originalName || '').localeCompare(String(b.originalName || ''), 'zh-Hans-CN', { numeric: true }),
          )
        if (!rows.length) return
        activeGenerationJobRef.current = latestJobId
        setGenerationJobId(latestJobId)
        setResultViewActive(true)
        const withImg = await Promise.all(rows.map(async (row) => ({ row, img: await loadAssetImg(row.id) })))
        if (cancelled || localStorage.getItem(PRODUCT_SETS_LATEST_JOB_KEY) !== latestJobId) return
        setSlots(
          withImg.map(({ row, img }, index) => ({
            id: row.id,
            slotIndex: index + 1,
            typeKey: (SUITE_TYPES.find((item) => item.label === row.category)?.key ?? 'white') as SuiteTypeKey,
            name: row.originalName || `图${index + 1}`,
            type: row.category || '生成图片',
            prompt: row.prompt || '',
            imageUrl: img || row.sourceUrl || undefined,
            status: 'done' as const,
          })),
        )
      } catch {
        // 结果资产或表单快照读取失败时，保持新的作图状态。
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadAssetImg])

  // 触发 AI 帮写 (流式 SSE)
  const handleAiHelp = async () => {
    if (uploadedImages.length === 0) {
      Message.warning('请先上传商品原图，再使用 AI 帮写')
      return
    }
    setAiHelpOpen(true)
    setExpandingPrompts(true)
    setAiHelpText('')

    try {
      let fullContent = ''
      // 流式经本地 IPC 事件通道（worker→主进程→渲染层），替代原 SSE HTTP 传输
      const unsub = window.desktop?.capabilities.onStream((event) => {
        if (event.type === 'content') {
          fullContent += event.text || ''
          setAiHelpText(fullContent)
        } else if (event.type === 'done') {
          fullContent = String(event.text ?? fullContent)
          setAiHelpText(fullContent)
        } else if (event.type === 'error') {
          throw new Error(String(event.data?.message || event.data?.content || 'AI 帮写失败'))
        }
      })
      await window.desktop?.capabilities.invoke('productSets.expandPrompts', {
        userId: currentUserId,
        settings,
        baseText: generationText,
        information: generationText.trim() || '以用户上传商品原图中可见信息为准',
        // 对照旧版：AI 帮写透传商品原图，供视觉上下文参考
        image: uploadedImages[0]?.url || '',
        images: uploadedImages.map((item) => item.url),
      })
      unsub?.()
      if (!fullContent.trim()) throw new Error('AI 帮写没有返回可用商品信息，请稍后重试。')
      setAiHelpText(fullContent)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setAiHelpText('')
      Message.error(message)
    } finally {
      setExpandingPrompts(false)
    }
  }

  const confirmAiHelp = () => {
    if (aiHelpText) {
      setGenerationText(aiHelpText)
      Message.success('已采纳 AI 提炼的商品卖点要求')
    }
    setAiHelpOpen(false)
  }

  // 步进器调整自定义数量
  const updateCustomCount = (key: SuiteTypeKey, delta: number) => {
    const currentTotal = Object.values(customCounts).reduce((s, n) => s + n, 0)
    if (delta < 0 && currentTotal <= 5) {
      Message.warning('套图总数量至少选择 5 张')
      return
    }
    setCustomCounts((prev) => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }))
  }

  // 一键全套生成：先 AI 策划每个图位提示词，再按图位图生图
  const handleGenerateAll = async () => {
    if (uploadedImages.length === 0) {
      Message.warning('请先上传商品原图')
      return
    }
    setGenerating(true)
    setResultViewActive(true)
    setError('')

    // 构建图位
    const newSlots: GenerationSlot[] = []
    let slotIdx = 1
    if (mode === '智能匹配') {
      SUITE_TYPES.forEach((st) => {
        newSlots.push({
          id: `slot-${nanoid(8)}`,
          slotIndex: slotIdx++,
          typeKey: st.key,
          name: `${String(slotIdx - 1).padStart(2, '0')} ${st.label}`,
          type: st.label,
          prompt: '',
          status: 'generating',
        })
      })
    } else {
      SUITE_TYPES.forEach((st) => {
        const count = customCounts[st.key]
        for (let i = 0; i < count; i += 1) {
          newSlots.push({
            id: `slot-${nanoid(8)}`,
            slotIndex: slotIdx++,
            typeKey: st.key,
            name: `${String(slotIdx - 1).padStart(2, '0')} ${st.label}${count > 1 ? ` #${i + 1}` : ''}`,
            type: st.label,
            prompt: '',
            status: 'generating',
          })
        }
      })
    }
    setSlots(newSlots)

    let jobId = ''
    try {
      const reportText = [
        selectedReport ? `已选择AI报告：${selectedReport.label || selectedReport.keyword || ''}` : '',
        reportSellingPoints.length ? `报告主图卖点：${reportSellingPoints.join('、')}` : '',
      ].filter(Boolean).join('\n')
      jobId = `product-sets-${nanoid(12)}`
      activeGenerationJobRef.current = jobId
      setGenerationJobId(jobId)
      localStorage.setItem(PRODUCT_SETS_LATEST_JOB_KEY, jobId)
      try {
        await persistCurrentForm()
      } catch {
        // 生成不依赖快照；快照失败时仍继续完成当前任务。
      }
      if (activeGenerationJobRef.current !== jobId) return

      // LangGraph 编排：planPrompts → 逐图 generateOne（worker 内 Send 扇出 + checkpoint 落本地 SQLite）。
      // 每张图位的进度经 IPC 流式节点事件回显；jobId 即 thread_id，崩溃后可同 jobId 续跑。
      const unsub = window.desktop?.capabilities.onStream((event) => {
        if (event.type === 'node' && event.data?.node === 'generateImage') {
          if (activeGenerationJobRef.current !== jobId) return
          const d = event.data as { slotId?: string; status?: GenerationSlot['status']; imageUrl?: string; error?: string }
          if (!d.slotId) return
          setSlots((prev) =>
            prev.map((s) => (s.id === d.slotId ? { ...s, status: d.status ?? s.status, imageUrl: d.imageUrl, error: d.error } : s)),
          )
        }
      })
      let failedCount = 0
      try {
        const res = (await window.desktop?.capabilities.invoke('productSets.graph.run', {
          userId: currentUserId,
          tenantId: 'local',
          settings,
          baseText: generationText,
          reportText,
          information: generationText.trim() || '以用户上传商品原图中可见信息为准',
          productName: productName.trim() || undefined,
          mainImage: uploadedImages.find((i) => i.isMain)?.url || uploadedImages[0]?.url,
          images: uploadedImages.map((i) => i.url),
          slots: newSlots.map((slot) => ({
            id: slot.id,
            name: slot.name,
            type: slot.type,
            typeKey: slot.typeKey,
            sequence: slot.slotIndex,
            prompt: '',
          })),
          jobId,
        })) as { ok?: boolean; failedCount?: number } | undefined
        failedCount = res?.failedCount ?? 0
      } finally {
        unsub?.()
      }
      if (activeGenerationJobRef.current === jobId && failedCount) {
        setError(`${failedCount} 张图片生成失败，其余图片已保留在右侧。`)
      }
    } catch (err) {
      if (!jobId || activeGenerationJobRef.current !== jobId) return
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setSlots((prev) => prev.map((slot) => ({ ...slot, status: 'failed', error: message })))
    } finally {
      if (activeGenerationJobRef.current === jobId) setGenerating(false)
    }
  }

  // 单图重绘
  const handleRegenerateSingle = async (slotId: string) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: 'generating' } : s)))
    try {
      const slot = slots.find((s) => s.id === slotId)
      const res = await window.desktop?.capabilities.invoke('image.generate', {
        userId: currentUserId,
        tenantId: 'local',
        prompt: slot?.prompt || '电商高清主图',
        size: '2K',
        jobId: generationJobId || `product-sets-${nanoid(12)}`,
        name: slot?.name,
        slotType: slot?.type,
        image: uploadedImages.find((i) => i.isMain)?.url || uploadedImages[0]?.url,
        images: uploadedImages.map((i) => i.url),
        ratio: settings.ratio,
        productName: productName.trim() || undefined,
      }) as { images?: Array<{ url: string }>; url?: string } | undefined
      const imgUrl = res?.images?.[0]?.url || res?.url
      if (!imgUrl) throw new Error('生成成功但没有返回图片 URL')
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: 'done', imageUrl: imgUrl } : s)))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: 'failed', error: message } : s)))
      setError(message)
    }
  }

  const generateSlotWithPrompt = async (slotId: string, prompt: string, referenceImages: string[]) => {
    const slot = slots.find((item) => item.id === slotId)
    if (!slot) return
    setActionPanel(null)
    setSlots((prev) => prev.map((item) => (item.id === slotId ? { ...item, status: 'generating', error: undefined } : item)))
    try {
      const resolvedRefs = await Promise.all(referenceImages.map(resolveImageRefForAi))
      const data = await window.desktop?.capabilities.invoke('image.generate', {
        userId: currentUserId,
        tenantId: 'local',
        prompt,
        size: '2K',
        jobId: generationJobId || `product-sets-${nanoid(12)}`,
        name: slot.name,
        slotType: slot.type,
        image: resolvedRefs[0],
        images: resolvedRefs.slice(0, 4),
        ratio: settings.ratio,
        productName: productName.trim() || undefined,
      }) as { images?: Array<{ url: string }> } | undefined
      const url = data?.images?.[0]?.url
      if (!url) throw new Error('当前未接入真实图像服务，未返回可展示图片')
      setSlots((prev) => prev.map((item) => (item.id === slotId ? { ...item, status: 'done', imageUrl: url } : item)))
      Message.success('图片处理完成')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSlots((prev) => prev.map((item) => (item.id === slotId ? { ...item, status: 'failed', error: message } : item)))
      Message.error(message)
    }
  }

  // 带目标比例的图位生成（智能改尺寸用，M14）
  const generateSlotWithPromptWithRatio = async (slotId: string, prompt: string, referenceImages: string[], ratio: string) => {
    const slot = slots.find((item) => item.id === slotId)
    if (!slot) return
    setActionPanel(null)
    setSlots((prev) => prev.map((item) => (item.id === slotId ? { ...item, status: 'generating', error: undefined } : item)))
    try {
      const resolvedRefs = await Promise.all(referenceImages.map(resolveImageRefForAi))
      const data = await window.desktop?.capabilities.invoke('image.generate', {
        userId: currentUserId,
        tenantId: 'local',
        prompt,
        size: '2K',
        jobId: generationJobId || `product-sets-${nanoid(12)}`,
        name: slot.name,
        slotType: slot.type,
        image: resolvedRefs[0],
        images: resolvedRefs.slice(0, 4),
        ratio,
        productName: productName.trim() || undefined,
        replaceExisting: true,
      }) as { images?: Array<{ url: string }> } | undefined
      const url = data?.images?.[0]?.url
      if (!url) throw new Error('当前未接入真实图像服务，未返回可展示图片')
      setSlots((prev) => prev.map((item) => (item.id === slotId ? { ...item, status: 'done', imageUrl: url } : item)))
      Message.success('图片处理完成')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSlots((prev) => prev.map((item) => (item.id === slotId ? { ...item, status: 'failed', error: message } : item)))
      Message.error(message)
    }
  }

  const openTextEditor = async (slot: GenerationSlot) => {
    if (!slot.imageUrl) {
      Message.warning('请先生成图片，再编辑文字')
      return
    }
    setActionPanel({ mode: 'text', slotId: slot.id, title: slot.name, text: '', direction: '', loading: true })
    try {
      const resolvedUrl = await resolveImageRefForAi(slot.imageUrl)
      const data = await window.desktop?.capabilities.invoke('productSets.extractImageText', {
        userId: currentUserId,
        imageUrl: resolvedUrl,
        assetId: slot.id,
      }) as { text?: string; texts?: string[] } | undefined
      const extractedText = (data?.texts && data.texts.length > 0 ? data.texts.join('\n') : data?.text) ?? ''
      setActionPanel((prev) => (prev ? { ...prev, text: extractedText, loading: false } : prev))
    } catch (err) {
      setActionPanel(null)
      Message.error(err instanceof Error ? err.message : '读取图片文字失败')
    }
  }

  const updateTextLine = (index: number, value: string) => {
    setActionPanel((prev) => {
      if (!prev || prev.mode !== 'text') return prev
      const lines = prev.text.split('\n')
      if (!lines.length) lines.push('')
      lines[index] = value
      return { ...prev, text: lines.join('\n') }
    })
  }

  const removeTextLine = (index: number) => {
    setActionPanel((prev) => {
      if (!prev || prev.mode !== 'text') return prev
      const lines = prev.text.split('\n')
      lines.splice(index, 1)
      return { ...prev, text: lines.join('\n') }
    })
  }

  const runTextEditor = async () => {
    if (!actionPanel || !actionPanel.text.trim()) return
    const slot = slots.find((item) => item.id === actionPanel.slotId)
    if (!slot?.imageUrl) return
    const resolvedUrl = await resolveImageRefForAi(slot.imageUrl)
    await generateSlotWithPrompt(
      actionPanel.slotId,
      `保留商品主体、构图和视觉风格，仅更新图片文字内容。新文字：${actionPanel.text.trim()}`,
      [resolvedUrl],
    )
  }

  // AI 改图双逻辑（M12）：描述提到商品错误 → 以商品原图为主重新生成；未提及 → 以已生成图为原图微调
  const PRODUCT_ERROR_KEYWORDS = ['变形', '颜色错', '外观错', '结构错', '不像', '错误', '出错', '错位', '比例错', '商品坏了', '瑕疵']

  const runRetouchEditor = async () => {
    if (!actionPanel || actionPanel.mode !== 'retouch') return
    const slot = slots.find((item) => item.id === actionPanel.slotId)
    if (!slot?.imageUrl) return
    setActionPanel((prev) => (prev ? { ...prev, loading: true } : prev))
    try {
      const direction = actionPanel.direction.trim() || '保持商品主体、构图和视觉风格，重新生成此图片。'
      const mentionsProductError = PRODUCT_ERROR_KEYWORDS.some((kw) => direction.includes(kw))
      // 参考图组合：商品出错 → [商品原图, 已生成图]（product_fix 语义）；未出错 → [已生成图]（retouch 语义）
      const rawRefs = mentionsProductError
        ? [uploadedImages.find((i) => i.isMain)?.url || uploadedImages[0]?.url, slot.imageUrl].filter(Boolean) as string[]
        : [slot.imageUrl]
      const referenceImages = await Promise.all(rawRefs.map(resolveImageRefForAi))
      const data = await window.desktop?.capabilities.invoke('productSets.generateRetouchPrompt', {
        userId: currentUserId,
        settings,
        slot: { id: slot.id, name: slot.name, type: slot.type },
        originalPrompt: slot.prompt,
        userDirection: direction,
      }) as { prompt?: string } | undefined
      const retouchPrompt = data?.prompt?.trim()
      if (!retouchPrompt) throw new Error('AI改图提示词为空，请重试')
      await generateSlotWithPrompt(actionPanel.slotId, retouchPrompt, referenceImages)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setActionPanel((prev) => (prev ? { ...prev, loading: false } : prev))
      Message.error(message)
    }
  }

  // 单图智能改尺寸：按指定目标比例扩图/缩图，已生成图作原图，不改变样式布局（M14）
  const runSmartResize = async (slot: GenerationSlot, targetRatio: string) => {
    if (!slot.imageUrl) {
      Message.warning('请先生成图片，再智能改尺寸')
      return
    }
    setActionPanel(null)
    setResizeTargets(null)
    const resolvedUrl = await resolveImageRefForAi(slot.imageUrl)
    // 透传目标比例而非 settings.ratio，改图按所选尺寸生成
    await generateSlotWithPromptWithRatio(slot.id, `智能调整电商图片尺寸到${targetRatio}，保留商品主体、文字可读性和视觉层次，不裁切关键信息。`, [resolvedUrl], targetRatio)
  }

  // 批量改尺寸先占住所有目标图位，再逐张替换为生成结果。
  const runBatchResize = async () => {
    if (!resizeTargets?.length) {
      Message.warning('请先选择要改尺寸的图片')
      return
    }
    const targets = slots.filter((s) => resizeTargets.includes(s.id) && s.imageUrl)
    if (!targets.length) {
      Message.warning('所选图片尚未生成，无法改尺寸')
      setResizeTargets(null)
      return
    }
    const targetIds = targets.map((slot) => slot.id)
    const targetIdSet = new Set(targetIds)
    const targetRatio = resizeRatio
    setResizeTargets(null)
    setSelectedSlotIds([])
    setBatchResizeSlotIds(targetIds)
    setSlots((prev) => prev.map((slot) => (
      targetIdSet.has(slot.id) ? { ...slot, status: 'generating', error: undefined } : slot
    )))
    try {
      for (const slot of targets) {
        await generateSlotWithPromptWithRatio(
          slot.id,
          `智能调整电商图片尺寸到${targetRatio}，保留商品主体、文字可读性和视觉层次，不裁切关键信息。`,
          [slot.imageUrl!],
          targetRatio,
        )
      }
    } finally {
      setBatchResizeSlotIds([])
    }
  }

  const confirmResize = () => {
    if (!resizeTargets?.length) return
    if (resizeTargets.length > 1) {
      void runBatchResize()
      return
    }
    const target = slots.find((slot) => slot.id === resizeTargets[0])
    if (target) void runSmartResize(target, resizeRatio)
  }

  // 单张下载 jpg（M16）
  const downloadSingleJpg = async (slot: GenerationSlot) => {
    if (!slot.imageUrl) return
    try {
      const blob = await imageSourceToJpegBlob(slot.imageUrl)
      saveAs(blob, `${slot.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`)
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '下载失败')
    }
  }

  // 批量下载：真实落盘到桌面文件夹（M16 批量=文件夹到桌面，主进程 files.saveImageBatch）
  const handleBatchDownload = async () => {
    const scope = selectedSlotIds.length ? selectedSlotIds : slots.map((s) => s.id)
    const done = slots.filter((s) => s.imageUrl && scope.includes(s.id))
    if (done.length === 0) {
      Message.warning('暂无已生成的图片可供下载')
      return
    }
    if (!window.desktop?.files) {
      Message.error('当前环境未接入桌面文件能力，无法批量保存')
      return
    }
    try {
      const files: Array<{ name: string; data: Uint8Array }> = []
      for (const s of done) {
        const blob = await imageSourceToJpegBlob(s.imageUrl!)
        const bytes = new Uint8Array(await blob.arrayBuffer())
        files.push({ name: `${s.slotIndex}_${s.type.replace(/[^\w\u4e00-\u9fa5]/g, '')}_${s.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`, data: bytes })
      }
      const result = await window.desktop.files.saveImageBatch({ folderName: '商品主图', kind: 'main', files })
      Message.success(`已保存 ${result.count} 张图片到桌面：${result.folderPath}`)
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '批量保存失败')
    }
  }

  // 全选/取消全选（M10：勾选全部已生成图片）
  const toggleSelectAll = () => {
    if (!generatedSlotIds.length) {
      Message.warning('暂无已生成的图片可供选择')
      return
    }
    setSelectedSlotIds((prev) => (generatedSlotIds.every((id) => prev.includes(id)) ? [] : generatedSlotIds))
  }

  // 批量删除（M10：删除勾选图位及其落盘资产）
  const handleBatchDelete = async () => {
    const targets = slots.filter((s) => selectedSlotIds.includes(s.id))
    if (!targets.length) {
      Message.warning('请先勾选要删除的图片')
      return
    }
    await Promise.all(
      targets.map((s) =>
        window.desktop?.capabilities
          .invoke('asset.delete', { id: s.id })
          .catch(() => undefined),
      ),
    )
    setSlots((prev) => prev.filter((s) => !selectedSlotIds.includes(s.id)))
    setSelectedSlotIds([])
    Message.success(`已删除 ${targets.length} 张图片`)
  }

  // 单图删除（更多操作面板内）
  const handleDeleteSingle = async (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    await window.desktop?.capabilities.invoke('asset.delete', { id: slot.id }).catch(() => undefined)
    setSlots((prev) => prev.filter((s) => s.id !== slotId))
    setSelectedSlotIds((prev) => prev.filter((id) => id !== slotId))
    setMoreMenuSlotId(null)
    Message.success('已删除该图片')
  }

  return (
    <div className="product-image-sets-page relative flex h-full bg-[#f4f7fb] overflow-hidden">
      {/* ===================== 左侧 360px 参数面板 ===================== */}
      <div className="flex w-[360px] shrink-0 h-full flex-col overflow-hidden border-r border-[#e5e8ef] bg-white select-none">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-4">
        {/* 1. 商品原图 */}
        <div className="mb-5">
          <h2 className="mb-3 flex items-center justify-between text-[14px] font-bold text-[#0A1B39]">
            <span className="flex items-center gap-1">
              商品原图
              <ProductImageHelpTooltip />
            </span>
            <span className="text-[12px] font-normal text-[#86909C]"></span>
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleUploadFiles(e.target.files)
              e.currentTarget.value = ''
            }}
          />

          {uploadedImages.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {uploadedImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative aspect-square overflow-hidden rounded-[8px] border border-[#e5e8ef] bg-white transition-shadow hover:shadow-md"
                >
                  <img src={img.url} alt={img.name} className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => removeUploadedImage(img.id)}
                    className="absolute right-1.5 top-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded-[4px] border-0 bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/65"
                    title="删除"
                    aria-label={`删除原图 ${img.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {uploadedImages.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="grid aspect-square cursor-pointer place-items-center rounded-[8px] border-0 bg-[#f5f6f8] text-[#171A1D] transition-colors hover:bg-[#eef0f3]"
                  aria-label="添加商品原图"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex h-[94px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#c9d5e8] bg-[#fbfcfe] hover:bg-[#f5f9ff] hover:border-[#1683FF] transition-colors"
            >
              <Button size="small" type="secondary" icon={<UploadIcon className="h-3.5 w-3.5" />} className="mb-1.5 rounded-[8px]">
                上传图片
              </Button>
              <p className="text-[11px] text-[#86909C]">同一产品，最多 6 张</p>
            </div>
          )}
        </div>

        {/* 2. 选择 AI 报告 */}
        <div className="mb-5">
          <AIReportSelector
            value={selectedReportId}
            onChange={(runId, report) => {
              setSelectedReportId(runId)
              setSelectedReport(report)
            }}
          />
          {loadingDescriptions && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#86909C]">
              <Loader2 className="h-3 w-3 animate-spin" />
              正在读取报告主图卖点...
            </div>
          )}
          {!loadingDescriptions && reportSellingPoints.length > 0 && (
            <div className="mt-2 rounded-lg border border-[#e8f2ff] bg-[#f7fbff] p-2.5">
              <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-[#1683FF]">
                <Sparkles className="h-3 w-3" />
                已回传主图卖点
                <span className="rounded-full bg-[#e8f2ff] px-1.5 text-[10px]">{reportSellingPoints.length} 条</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {reportSellingPoints.slice(0, 6).map((point) => (
                  <span key={point} className="max-w-full truncate rounded bg-white px-2 py-1 text-[11px] text-[#4e5969]">
                    {point}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. 生成设置 (2x2 紧凑四维选择器) */}
        <div className="mb-5">
          <SectionTitle>生成设置</SectionTitle>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Select
              size="small"
              style={{ borderRadius: 8 }}
              value={settings.platform}
              onChange={(val) => setSettings((s) => ({ ...s, platform: val }))}
            >
              {PLATFORM_OPTIONS.map((p) => (
                <Option key={p} value={p}>
                  {p}
                </Option>
              ))}
            </Select>

            <Select
              size="small"
              style={{ borderRadius: 8 }}
              value={settings.country}
              onChange={(val) => setSettings((s) => ({ ...s, country: val }))}
            >
              {COUNTRY_OPTIONS.map((c) => (
                <Option key={c} value={c}>
                  {c}
                </Option>
              ))}
            </Select>

            <Select
              size="small"
              style={{ borderRadius: 8 }}
              value={settings.language}
              onChange={(val) => setSettings((s) => ({ ...s, language: val }))}
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <Option key={l} value={l}>
                  {l}
                </Option>
              ))}
            </Select>

            <Select
              size="small"
              style={{ borderRadius: 8 }}
              value={settings.ratio}
              onChange={(val) => setSettings((s) => ({ ...s, ratio: val }))}
            >
              {RATIO_OPTIONS.map((r) => (
                <Option key={r} value={r}>
                  {r}
                </Option>
              ))}
            </Select>
          </div>
        </div>

        {/* 4. 商品卖点 & 要求 + AI帮写（标题与按钮同行垂直居中，M4） */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-1 text-[14px] font-semibold text-[#171A1D]">
              商品卖点&要求
            </h2>
            <AiHelpPopover
              visible={aiHelpOpen}
              onVisibleChange={setAiHelpOpen}
              busy={expandingPrompts}
              text={aiHelpText}
              onTextChange={setAiHelpText}
              onStart={handleAiHelp}
              onRetry={handleAiHelp}
              onConfirm={confirmAiHelp}
              triggerDisabled={uploadedImages.length === 0}
              onDisabledClick={() => Message.warning('请先上传商品原图，再使用 AI 帮写')}
            />
          </div>

          <Input.TextArea
            value={generationText}
            onChange={setGenerationText}
            rows={4}
            placeholder={`建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.具体参数`}
            className="text-[12px] rounded-lg"
          />

          <div className="mt-2">
            <div className="mb-1 text-[12px] font-medium text-[#4E5969]">关联商品名（选填，写入图库方便归组与查找）</div>
            <Input
              value={productName}
              onChange={setProductName}
              size="small"
              placeholder="如：智能手表 Pro"
              className="text-[12px] rounded-lg"
            />
          </div>
        </div>

        {/* 5. 套图结构配置 */}
        <div className="mb-5">
          <SectionTitle>套图结构配置</SectionTitle>
          <div className="mt-2 space-y-2">
            {/* 智能匹配 */}
            <div
              onClick={() => setMode('智能匹配')}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                mode === '智能匹配' ? 'border-[#1683FF] bg-[#f0f7ff]' : 'border-[#e5e8ef] bg-[#f8fafc]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-4 w-4 place-items-center rounded ${
                    mode === '智能匹配' ? 'bg-[#1683FF] text-white' : 'border border-[#d0d5dd] bg-white text-transparent'
                  }`}
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-[13px] font-bold text-[#0A1B39]">智能匹配</span>
              </div>
              <p className="mt-1 text-[11px] text-[#86909C] pl-6">AI智能分析商品图，匹配最佳Listing套图 (固定5张)</p>
            </div>

            {/* 自定义配置 */}
            <div
              onClick={() => setMode('自定义配置')}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                mode === '自定义配置' ? 'border-[#1683FF] bg-[#f0f7ff]' : 'border-[#e5e8ef] bg-[#f8fafc]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-4 w-4 place-items-center rounded ${
                    mode === '自定义配置' ? 'bg-[#1683FF] text-white' : 'border border-[#d0d5dd] bg-white text-transparent'
                  }`}
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-[13px] font-bold text-[#0A1B39]">自定义配置</span>
              </div>
              <p className="mt-1 text-[11px] text-[#86909C] pl-6">可自由调整各类型图片数量，至少选择5张。</p>

              {/* 展开的 5 组步进器 */}
              {mode === '自定义配置' && (
                <div className="mt-3 space-y-2 pt-2 border-t border-[#d8e5f8]">
                  {SUITE_TYPES.map((st) => (
                    <div
                      key={st.key}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-between bg-white rounded-lg p-2 border border-[#eef2f8]"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-[12px] font-bold text-[#0A1B39]">{st.label}</p>
                        <p className="text-[10px] text-[#86909C] truncate">{st.desc}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 bg-[#f4f7fb] rounded p-0.5">
                        <button
                          type="button"
                          onClick={() => updateCustomCount(st.key, -1)}
                          className="h-6 w-6 rounded grid place-items-center hover:bg-white text-[#0A1B39]"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-[12px] font-bold">{customCounts[st.key]}</span>
                        <button
                          type="button"
                          onClick={() => updateCustomCount(st.key, 1)}
                          className="h-6 w-6 rounded grid place-items-center hover:bg-white text-[#0A1B39]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6. 附加功能 */}
        <div className="mb-5 space-y-2">
          <SectionTitle>附加功能</SectionTitle>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#f8fafc] border border-[#eef2f8]">
            <span className="text-[12px] text-[#0A1B39]">爆款风格分析</span>
            <Switch size="small" checked={styleAnalysis} onChange={setStyleAnalysis} />
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#f8fafc] border border-[#eef2f8]">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[#0A1B39]">商品上架文案生成</span>
              <span className="rounded bg-[#ffe8d8] px-1 py-0.2 text-[9px] font-bold text-[#c35a22]">限免</span>
            </div>
            <Switch size="small" checked={listingCopy} onChange={setListingCopy} />
          </div>
        </div>

        </div>

        {/* 独立底部生成条：表单单独滚动，白色背景始终覆盖到面板底边。 */}
        <div className="shrink-0 border-t border-[#eef1f5] bg-white p-3.5">
          <button
            type="button"
            disabled={generating || uploadedImages.length === 0}
            onClick={handleGenerateAll}
            className={`h-10 w-full cursor-pointer rounded-[8px] text-[13px] font-semibold text-white disabled:cursor-not-allowed ${
              generating || uploadedImages.length === 0 ? 'bg-[#C4C6CA]' : 'bg-[#171A1D] hover:bg-[#2A2F36]'
            }`}
          >
            {generating ? '正在生成...' : `一键生成套图与商品上架文案（${totalImageCount}张）`}
          </button>
        </div>
      </div>

      {/* ===================== 右侧自适应画布区 ===================== */}
      <div className="flex-1 h-full overflow-y-auto p-6 custom-scrollbar">
        {!resultViewActive ? (
          /* ===================== 初始未生成态：橙色耳机套图样板展卡 ===================== */
          <div className="flex min-h-full flex-col items-center justify-center text-center max-w-[1000px] mx-auto py-8">
            <h1 className="text-[32px] font-extrabold text-[#0A1B39] tracking-tight">商品主图</h1>
            <p className="mt-2 text-[14px] text-[#86909C]">
              上传商品图，AI 即刻生成 <span className="font-bold text-[#1683FF]">符合多电商平台规范</span> 的高转化率商品主图。
            </p>

            {/* 核心样板卡片（对照旧版 h-[384px] w-[792px]：左336主图 + 箭头 + 右2x2 162px） */}
            <div className="mt-8 flex h-[384px] w-[792px] items-center justify-center gap-5 rounded-2xl border border-[#eef2f8] bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,0.06)]">
              {/* 01 白底大图 */}
              <div className="relative h-[336px] w-[336px] shrink-0 overflow-hidden rounded-xl border border-[#f0f2f5] bg-[#fafbfc] p-4 flex items-center justify-center group">
                <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#4e5969] shadow-sm">
                  01 白底图
                </span>
                <img
                  src={mainHeadphone}
                  alt="01 白底图"
                  className="max-h-full max-w-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
                />
              </div>

              {/* 箭头指示 */}
              <div className="w-10 shrink-0">
                <img src={suiteArrow} alt="流向" className="h-6 w-6 opacity-60" />
              </div>

              {/* 右侧 2x2 四宫格（162px 每格） */}
              <div className="grid h-[336px] w-[336px] grid-cols-2 gap-3">
                {/* 02 场景图 */}
                <div className="relative overflow-hidden rounded-xl border border-[#f0f2f5] bg-[#fafbfc] group">
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#4e5969] shadow-sm">
                    02 场景图
                  </span>
                  <img src={sceneDisplay} alt="02 场景图" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                </div>

                {/* 03 卖点图 */}
                <div className="relative overflow-hidden rounded-xl border border-[#f0f2f5] bg-[#fafbfc] group">
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#4e5969] shadow-sm">
                    03 卖点图
                  </span>
                  <img src={sellingPoint} alt="03 卖点图" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                </div>

                {/* 04 细节说明 */}
                <div className="relative overflow-hidden rounded-xl border border-[#f0f2f5] bg-[#fafbfc] group">
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#4e5969] shadow-sm">
                    04 细节说明
                  </span>
                  <img src={detailExplain} alt="04 细节说明" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                </div>

                {/* 05 买点详解 */}
                <div className="relative overflow-hidden rounded-xl border border-[#f0f2f5] bg-[#fafbfc] group">
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#4e5969] shadow-sm">
                    05 买点详解
                  </span>
                  <img src={modelScene} alt="05 买点详解" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ===================== 成图工作台结果看板 ===================== */
          <div className="max-w-[1200px] mx-auto pb-12">
            {/* 顶栏操作（M10：全选 → 顶部批量改尺寸/批量下载/批量删除） */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#171A1D]">生成结果：</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={batchResizeSlotIds.length > 0}
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[14px] font-semibold text-[#4E5969] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-[5px] border ${
                      allGeneratedSelected || partiallyGeneratedSelected
                        ? 'border-[#171A1D] bg-[#171A1D] text-white'
                        : 'border-[#86909C] bg-white text-transparent'
                    }`}
                  >
                    {allGeneratedSelected ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : partiallyGeneratedSelected ? (
                      <Minus className="h-3.5 w-3.5" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </span>
                  全选
                </button>
                {selectedSlotIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setResizeTargets(selectedSlotIds)}
                      className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border-0 bg-white px-4 text-[14px] font-semibold text-[#171A1D] shadow-[0_1px_3px_rgba(15,23,41,.08)] transition-colors hover:bg-[#F5F6F8]"
                    >
                      <Sparkles className="h-4 w-4" />
                      批量改尺寸
                    </button>
                    <button
                      type="button"
                      onClick={handleBatchDownload}
                      className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border-0 bg-white px-4 text-[14px] font-semibold text-[#171A1D] shadow-[0_1px_3px_rgba(15,23,41,.08)] transition-colors hover:bg-[#F5F6F8]"
                    >
                      <Download className="h-4 w-4" />
                      批量下载
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleBatchDelete()}
                      className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border-0 bg-white px-4 text-[14px] font-semibold text-[#171A1D] shadow-[0_1px_3px_rgba(15,23,41,.08)] transition-colors hover:bg-[#F5F6F8]"
                    >
                      <Trash2 className="h-4 w-4" />
                      批量删除
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 成图网格（M8：首个格显示上传商品图，区域 1:1，左下角类型标签） */}
            <div className="grid grid-cols-3 gap-5">
              {/* 首位原图格：展示用户上传的商品图 */}
              {uploadedImages[0] && (
                <div className="relative aspect-square overflow-hidden rounded-[8px] bg-white">
                  <img src={uploadedImages[0].url} alt="商品原图" className="h-full w-full object-contain" />
                  <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                    原图
                  </span>
                </div>
              )}

              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className={`group relative aspect-square overflow-hidden rounded-[8px] bg-white ${
                    selectedSlotIds.includes(slot.id) || batchResizeSlotIds.includes(slot.id) ? 'ring-2 ring-[#171A1D]' : ''
                  }`}
                >
                  <div className="flex h-full w-full items-center justify-center">
                    {slot.status === 'generating' ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1.5" aria-hidden="true">
                          {[0, 1, 2].map((index) => (
                            <span key={index} className="h-2 w-2 rounded-full bg-[#C9CDD4]" />
                          ))}
                        </div>
                        <span className="text-[11px] text-[#86909C]">AI生成中...</span>
                      </div>
                    ) : slot.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreviewSlotId(slot.id)}
                        className="h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
                        title={`预览${slot.name}`}
                      >
                        <img src={slot.imageUrl} alt={slot.name} className="h-full w-full object-contain" />
                      </button>
                    ) : (
                      <ImageIcon className="h-8 w-8 text-[#c9d5e8]" />
                    )}
                  </div>

                  {/* 左下角唯一类型标签 */}
                  <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                    {slot.type}
                  </span>

                  {slot.imageUrl && slot.status !== 'generating' && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedSlotIds((prev) =>
                          prev.includes(slot.id) ? prev.filter((id) => id !== slot.id) : [...prev, slot.id],
                        )
                      }
                      className={`absolute left-3 top-3 z-20 grid h-7 w-7 place-items-center rounded-[6px] border-0 transition-opacity ${
                        selectedSlotIds.includes(slot.id)
                          ? 'bg-[#171A1D] text-white opacity-100'
                          : 'border border-[#86909C] bg-white/90 text-transparent opacity-0 group-hover:opacity-100'
                      }`}
                      title={selectedSlotIds.includes(slot.id) ? '取消选择' : '选择'}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}

                  {/* 悬浮操作层（M11：左上选择；右上下载+更多；底部 AI改图+编辑文字） */}
                  {slot.imageUrl && slot.status !== 'generating' && (
                    <div className={`pointer-events-none absolute inset-0 rounded-[8px] bg-black/35 transition-opacity ${moreMenuSlotId === slot.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
                        <div className="pointer-events-auto absolute right-3 top-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void downloadSingleJpg(slot)}
                            className="grid h-7 w-7 place-items-center rounded bg-white text-[#171A1D] shadow-sm hover:bg-[#F5F6F8]"
                            title="下载"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <Trigger
                            trigger={['hover', 'click']}
                            position="br"
                            popupVisible={moreMenuSlotId === slot.id}
                            onVisibleChange={(visible) => setMoreMenuSlotId((current) => visible ? slot.id : current === slot.id ? null : current)}
                            getPopupContainer={() => document.body}
                            autoFitPosition
                            popupHoverStay
                            clickToClose={false}
                            containerScrollToClose
                            popupAlign={{ bottom: 8 }}
                            style={{ zIndex: 70 }}
                            popup={() => (
                              <div role="menu" aria-label={`${slot.name} 更多操作`} className="w-[180px] overflow-hidden rounded-[8px] bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,41,.18)]">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setMoreMenuSlotId(null)
                                    setResizeTargets([slot.id])
                                  }}
                                  className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[6px] border-0 bg-transparent px-3 text-left text-[14px] font-semibold text-[#171A1D] hover:bg-[#F5F6F8]"
                                >
                                  <Sparkles className="h-4 w-4 shrink-0" />
                                  智能改尺寸
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => void handleDeleteSingle(slot.id)}
                                  className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[6px] border-0 bg-transparent px-3 text-left text-[14px] font-semibold text-[#F04438] hover:bg-[#FFF5F5]"
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" />
                                  删除
                                </button>
                              </div>
                            )}
                          >
                            <button
                              type="button"
                              onFocus={() => setMoreMenuSlotId(slot.id)}
                              aria-haspopup="menu"
                              aria-expanded={moreMenuSlotId === slot.id}
                              className={`grid h-7 w-7 place-items-center rounded-[6px] shadow-sm ${
                                moreMenuSlotId === slot.id
                                  ? 'bg-[#171A1D] text-white'
                                  : 'bg-white text-[#171A1D] hover:bg-[#171A1D] hover:text-white'
                              }`}
                              title="更多操作"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </Trigger>
                        </div>
                        <div className="pointer-events-auto absolute bottom-3 left-3 right-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setActionPanel({ mode: 'retouch', slotId: slot.id, title: slot.name, text: '', direction: '', loading: false })
                            }
                            className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#171A1D]/90 text-[12px] font-semibold text-white hover:bg-[#2A2F36]"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                            AI改图
                          </button>
                          <button
                            type="button"
                            onClick={() => void openTextEditor(slot)}
                            className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#171A1D]/90 text-[12px] font-semibold text-white hover:bg-[#2A2F36]"
                          >
                            <Type className="h-3.5 w-3.5" />
                            编辑文字
                          </button>
                        </div>

                    </div>
                  )}

                  {slot.status === 'failed' && (
                    <span className="absolute inset-x-2 bottom-2 rounded bg-[#ffEBEE]/95 px-2 py-1 text-[10px] font-bold text-[#c62828]">
                      {slot.error || '生成失败'}
                    </span>
                  )}

                  {/* 失败/生成中保留重新生成入口，避免能力丢失（走查成功态悬浮操作不含重试） */}
                  {!slot.imageUrl && slot.status !== 'generating' && (
                    <button
                      type="button"
                      onClick={() => void handleRegenerateSingle(slot.id)}
                      className="absolute right-2 top-2 z-10 grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-white text-[#171A1D] shadow-sm hover:bg-[#F5F6F8]"
                      title="重新生成"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {previewSlot?.imageUrl && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center bg-black/75 p-6" onClick={() => setPreviewSlotId(null)}>
          <div className="flex w-full max-w-[920px] items-center justify-between pb-4 text-white" onClick={(event) => event.stopPropagation()}>
            <h2 className="m-0 text-[16px] font-bold">{previewSlot.name}</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void downloadSingleJpg(previewSlot)}
                className="flex h-11 items-center gap-2 rounded-full border-0 bg-white px-5 text-[13px] font-semibold text-[#0A1B39] hover:bg-[#F5F6F8]"
              >
                <Download className="h-4 w-4" />
                保存到本地
              </button>
              <button
                type="button"
                onClick={() => setPreviewSlotId(null)}
                className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/20 text-white hover:bg-white/30"
                title="关闭预览"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 w-full flex-1 items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <img src={previewSlot.imageUrl} alt={previewSlot.name} className="max-h-full max-w-[920px] rounded-[8px] object-contain" />
          </div>
        </div>
      )}

      <ResultActionDialog
        visible={Boolean(actionPanel)}
        title={actionPanel?.mode === 'text' ? '编辑文字' : '输入微调方向（选填）'}
        onClose={() => setActionPanel(null)}
        widthClassName="max-w-[420px]"
        footer={
          actionPanel?.mode === 'text' ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActionPanel(null)}
                className="h-11 cursor-pointer rounded-[8px] border-0 bg-[#F2F3F5] text-[14px] font-semibold text-[#171A1D] transition-colors hover:bg-[#E5E6EB]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void runTextEditor()}
                disabled={actionPanel.loading || !actionPanel.text.trim()}
                className="flex h-11 items-center justify-center gap-2 rounded-[8px] border-0 bg-[#8AB6F6] text-[14px] font-semibold text-white transition-colors hover:bg-[#6EA4F4] disabled:cursor-not-allowed disabled:bg-[#C9CDD4]"
              >
                {actionPanel.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                确认改字 · 15
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void runRetouchEditor()}
              disabled={Boolean(actionPanel?.loading)}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] border-0 bg-[#171A1D] text-[14px] font-semibold text-white transition-colors hover:bg-[#2A2F36] disabled:cursor-not-allowed disabled:bg-[#86909C]"
            >
              {actionPanel?.loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {actionPanel?.loading ? '正在重新生成...' : '重新生成 · 15'}
            </button>
          )
        }
      >
        {actionPanel?.mode === 'text' ? (
          actionPanel.loading ? (
            <div className="flex h-[190px] flex-col items-center justify-center gap-3 rounded-[8px] border border-[#E5E8EF] bg-white">
              <Loader2 className="h-6 w-6 animate-spin text-[#98A1AF]" />
              <p className="m-0 text-[14px] font-medium text-[#86909C]">正在识别图片文字...</p>
            </div>
          ) : (
            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {(editableTextLines.length ? editableTextLines : ['']).map((line, index) => (
                <div key={index} className="flex items-center gap-2 rounded-[8px] border border-[#E5E8EF] bg-[#F7F8FA] px-3">
                  <input
                    value={line}
                    onChange={(event) => updateTextLine(index, event.target.value)}
                    placeholder="输入图片文字"
                    className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#171A1D] outline-none placeholder:text-[#AAB2BF]"
                  />
                  <button
                    type="button"
                    onClick={() => removeTextLine(index)}
                    className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-[#98A1AF] transition-colors hover:bg-white hover:text-[#4E5969]"
                    title="删除文字"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <div>
            <textarea
              value={actionPanel?.direction ?? ''}
              onChange={(event) => setActionPanel((prev) => (prev ? { ...prev, direction: event.target.value } : prev))}
              placeholder={'输入调整要求（选填，空着将默认重绘）。\n如：商品向左移动一点，换成浅灰色背景...'}
              className="h-[175px] w-full resize-none rounded-[8px] border border-[#E5E8EF] bg-white p-3 text-[14px] leading-[22px] text-[#171A1D] outline-none placeholder:text-[#AAB2BF] focus:border-[#86909C]"
            />
            <p className="mb-0 mt-3 text-[12px] text-[#86909C]">重新生成将消耗 15 点。</p>
          </div>
        )}
      </ResultActionDialog>

      <ImageResizeDialog
        visible={Boolean(resizeTargets)}
        batch={Boolean(resizeTargets && resizeTargets.length > 1)}
        ratio={resizeRatio}
        onRatioChange={setResizeRatio}
        onClose={() => setResizeTargets(null)}
        onConfirm={confirmResize}
      />
    </div>
  )
}
