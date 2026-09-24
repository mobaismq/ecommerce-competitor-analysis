import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Card,
  Grid,
  Input,
  InputNumber,
  Message,
  Modal,
  Popover,
  Progress,
  Radio,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
} from '@arco-design/web-react'
import {
  Check,
  ChevronDown,
  Download,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload as UploadIcon,
  X,
} from 'lucide-react'
import { AIReportSelector, SectionTitle, type SuiteProduct } from '../components/AIReportSelector'
import { ProductImageHelpTooltip } from '../components/ProductImageHelpTooltip'
import { api } from '../api/client'
import { saveAs } from 'file-saver'
import { nanoid } from 'nanoid'

// 静态展卡切片
import mainHeadphone from '../assets/main-headphone.png'
import sceneDisplay from '../assets/scene-display.png'
import sellingPoint from '../assets/selling-point.png'
import detailExplain from '../assets/detail-explain.png'
import modelScene from '../assets/model-scene.png'
import suiteArrow from '../assets/suite-arrow.svg'

const { Row, Col } = Grid
const Option = Select.Option

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

type SuiteTypeKey = 'white' | 'scene' | 'selling' | 'function' | 'detail'

const SUITE_TYPES: Array<{ key: SuiteTypeKey; label: string; desc: string }> = [
  { key: 'white', label: '白底图', desc: '纯白背景，单主体合规商品主图' },
  { key: 'scene', label: '场景图', desc: '单一真实使用场景，突出商品佩戴/使用效果' },
  { key: 'selling', label: '卖点图', desc: '聚焦单个核心卖点，配合短文案说明' },
  { key: 'function', label: '细节说明', desc: '展示商品可见细节、结构、使用方式和参数信息' },
  { key: 'detail', label: '卖点详解', desc: '拆解商品核心卖点、适用场景和购买理由' },
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

export function ProductImageSetsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 1. 商品原图 (<=6张)
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])

  // 2. 选报告
  const [selectedReportId, setSelectedReportId] = useState('')
  const [selectedReport, setSelectedReport] = useState<SuiteProduct | null>(null)

  // 3. 四维参数设置
  const [settings, setSettings] = useState({
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
  const [aiHelpThinking, setAiHelpThinking] = useState('')
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

  // 计算当前总张数
  const totalImageCount = useMemo(() => {
    if (mode === '智能匹配') return 5
    return Object.values(customCounts).reduce((sum, n) => sum + n, 0)
  }, [mode, customCounts])

  // 上传原图处理
  const handleUploadFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const remaining = 6 - uploadedImages.length
    if (remaining <= 0) {
      Message.warning('最多只能上传 6 张商品原图')
      return
    }
    const toAdd = Array.from(files).slice(0, remaining)
    toAdd.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        setUploadedImages((prev) => [
          ...prev,
          {
            id: `img-${nanoid(8)}`,
            name: file.name,
            url,
            isMain: prev.length === 0,
          },
        ])
      }
      reader.readAsDataURL(file)
    })
    Message.success(`已添加 ${toAdd.length} 张原图`)
  }

  const removeUploadedImage = (id: string) => {
    setUploadedImages((prev) => {
      const next = prev.filter((img) => img.id !== id)
      if (next.length > 0 && !next.some((img) => img.isMain)) {
        next[0].isMain = true
      }
      return next
    })
  }

  const setAsMainImage = (id: string) => {
    setUploadedImages((prev) =>
      prev.map((img) => ({
        ...img,
        isMain: img.id === id,
      })),
    )
    Message.info('已设为主视角商品图')
  }

  // 选择 AI 报告后回读主图描述，自动填充生图卖点（对齐旧版报告联动）
  useEffect(() => {
    if (!selectedReportId) {
      setReportSellingPoints([])
      return
    }
    let cancelled = false
    setLoadingDescriptions(true)
    api
      .get<{ ok?: boolean; promptText?: string; sellingPoints?: string[] }>(
        `/api/product-sets/main-image-descriptions?runId=${encodeURIComponent(selectedReportId)}`,
      )
      .then(({ data }) => {
        if (cancelled) return
        setReportSellingPoints(data?.sellingPoints ?? [])
        if (data?.promptText?.trim()) setGenerationText(data.promptText.trim())
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

  // 用真实落盘字节生成可展示 objectURL（raw 端点需鉴权，<img> 直接 src 会 401），失败回落 sourceUrl
  const loadAssetImg = useCallback(async (id: string): Promise<string> => {
    const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8787'
    const token = localStorage.getItem('eca.token')
    try {
      const res = await fetch(`${baseURL}/api/assets/${id}/raw`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
      if (!res.ok) return ''
      const blob = await res.blob()
      return URL.createObjectURL(new Blob([blob], { type: res.headers.get('content-type') || 'image/png' }))
    } catch {
      return ''
    }
  }, [])

  // 刷新后按最近一次生成批次回显真实结果，不再依赖本地 state
  useEffect(() => {
    const latestJobId = localStorage.getItem('eca.productImageSets.latestJobId')
    if (!latestJobId) return
    let cancelled = false
    api
      .get<{ generatedImages?: Array<{ id: string; sourceUrl?: string | null; originalName?: string | null; category?: string | null; prompt?: string | null }> }>(
        `/api/product-sets/generated-images?jobId=${encodeURIComponent(latestJobId)}`,
      )
      .then(async ({ data }) => {
        if (cancelled) return
        const rows = [...(data?.generatedImages ?? [])].sort((a, b) =>
          String(a.originalName || '').localeCompare(String(b.originalName || ''), 'zh-Hans-CN', { numeric: true }),
        )
        if (!rows.length) return
        setGenerationJobId(latestJobId)
        setResultViewActive(true)
        const withImg = await Promise.all(rows.map(async (row) => ({ row, img: await loadAssetImg(row.id) })))
        if (cancelled) return
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
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // 触发 AI 帮写 (流式 SSE)
  const handleAiHelp = async () => {
    if (uploadedImages.length === 0) {
      Message.warning('请先上传商品原图，再使用 AI 帮写')
      return
    }
    setAiHelpOpen(true)
    setExpandingPrompts(true)
    setAiHelpThinking('')
    setAiHelpText('')

    try {
      const response = await fetch('/api/product-sets/expand-prompts-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          baseText: generationText,
          // 对照旧版：AI 帮写透传商品原图，供视觉上下文参考
          image: uploadedImages[0]?.url || '',
          images: uploadedImages.map((item) => item.url),
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error('AI 帮写服务响应异常')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let finalText = ''

      const flushLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return
        let event: { type?: string; text?: string; data?: { content?: string; model?: string; message?: string } }
        try {
          event = JSON.parse(trimmed)
        } catch {
          return
        }
        if (event.type === 'thinking') {
          setAiHelpThinking((prev) => prev + '\n' + (event.data?.content || event.text || ''))
        } else if (event.type === 'content') {
          fullContent += event.data?.content || event.text || ''
          setAiHelpText(fullContent)
        } else if (event.type === 'done') {
          finalText = String(event.data?.content || event.text || fullContent)
          setAiHelpText(finalText)
        } else if (event.type === 'error') {
          throw new Error(event.data?.message || event.data?.content || 'AI 帮写失败')
        }
      }

      for (;;) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ''
        lines.forEach(flushLine)
        if (done) break
      }
      flushLine(buffer)
      if (!fullContent.trim()) throw new Error('AI 帮写没有返回可用商品信息，请稍后重试。')
      setAiHelpText(fullContent)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setAiHelpThinking('')
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
    setCustomCounts((prev) => {
      const current = prev[key]
      const nextVal = Math.max(0, current + delta)
      const currentTotal = Object.values(prev).reduce((s, n) => s + n, 0)
      if (delta < 0 && currentTotal <= 5) {
        Message.warning('套图总数量至少选择 5 张')
        return prev
      }
      return { ...prev, [key]: nextVal }
    })
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

    try {
      const reportText = [
        selectedReport ? `已选择AI报告：${selectedReport.label || selectedReport.keyword || ''}` : '',
        reportSellingPoints.length ? `报告主图卖点：${reportSellingPoints.join('、')}` : '',
      ].filter(Boolean).join('\n')
      const { data: promptData } = await api.post<{ ok?: boolean; prompts?: Array<{ id?: string; prompt?: string }> }>(
        '/api/product-sets/generate-prompts',
        {
          settings,
          baseText: generationText,
          reportText,
          information: generationText.trim() || '以用户上传商品原图中可见信息为准',
          promptSlots: newSlots.map((slot, index) => ({
            id: slot.id,
            name: slot.name,
            type: slot.type,
            typeKey: slot.typeKey,
            sequence: index + 1,
          })),
        },
      )
      const promptMap = new Map((promptData?.prompts ?? []).map((item) => [item.id, item.prompt ?? '']))
      const preparedSlots = newSlots.map((slot) => ({ ...slot, prompt: promptMap.get(slot.id) ?? '' }))
      if (preparedSlots.some((slot) => !slot.prompt.trim())) {
        throw new Error('生成主图提示词不完整，请重试。')
      }
      setSlots(preparedSlots)

      const jobId = `product-sets-${nanoid(12)}`
      setGenerationJobId(jobId)
      localStorage.setItem('eca.productImageSets.latestJobId', jobId)

      let failedCount = 0
      for (const slot of preparedSlots) {
        try {
          const res = await api.post<{ images?: Array<{ url: string }>; url?: string }>('/api/product-sets/generate-image', {
            prompt: slot.prompt,
            size: '2K',
            jobId,
            name: slot.name,
            slotType: slot.type,
            image: uploadedImages.find((i) => i.isMain)?.url || uploadedImages[0]?.url,
            images: uploadedImages.map((i) => i.url),
            ratio: settings.ratio,
            productName: productName.trim() || undefined,
          })
          const imgUrl = res.data?.images?.[0]?.url || res.data?.url
          if (!imgUrl) throw new Error('当前未接入真实图像服务，未返回可展示图片')
          setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, status: 'done', imageUrl: imgUrl } : s)))
        } catch (err) {
          failedCount += 1
          const message = err instanceof Error ? err.message : String(err)
          setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, status: 'failed', error: message } : s)))
        }
      }
      if (failedCount) setError(`${failedCount} 张图片生成失败，其余图片已保留在右侧。`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setSlots((prev) => prev.map((slot) => ({ ...slot, status: 'failed', error: message })))
    } finally {
      setGenerating(false)
    }
  }

  // 单图重绘
  const handleRegenerateSingle = async (slotId: string) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: 'generating' } : s)))
    try {
      const slot = slots.find((s) => s.id === slotId)
      const res = await api.post<{ images?: Array<{ url: string }>; url?: string }>('/api/product-sets/generate-image', {
        prompt: slot?.prompt || '电商高清主图',
        size: '2K',
        jobId: generationJobId || `product-sets-${nanoid(12)}`,
        name: slot?.name,
        slotType: slot?.type,
        image: uploadedImages.find((i) => i.isMain)?.url || uploadedImages[0]?.url,
        images: uploadedImages.map((i) => i.url),
        ratio: settings.ratio,
        productName: productName.trim() || undefined,
      })
      const imgUrl = res.data?.images?.[0]?.url || res.data?.url
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
      const { data } = await api.post<{ images?: Array<{ url: string }> }>('/api/product-sets/generate-image', {
        prompt,
        size: '2K',
        jobId: generationJobId || `product-sets-${nanoid(12)}`,
        name: slot.name,
        slotType: slot.type,
        image: referenceImages[0],
        images: referenceImages.slice(0, 4),
        ratio: settings.ratio,
        productName: productName.trim() || undefined,
      })
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
      const { data } = await api.post<{ text?: string }>('/api/product-sets/extract-image-text', { image: slot.imageUrl })
      setActionPanel((prev) => (prev ? { ...prev, text: data?.text ?? '', loading: false } : prev))
    } catch (err) {
      setActionPanel(null)
      Message.error(err instanceof Error ? err.message : '读取图片文字失败')
    }
  }

  const runTextEditor = async () => {
    if (!actionPanel || !actionPanel.text.trim()) return
    const slot = slots.find((item) => item.id === actionPanel.slotId)
    if (!slot?.imageUrl) return
    await generateSlotWithPrompt(
      actionPanel.slotId,
      `保留商品主体、构图和视觉风格，仅更新图片文字内容。新文字：${actionPanel.text.trim()}`,
      [slot.imageUrl],
    )
  }

  const runRetouchEditor = async () => {
    if (!actionPanel || !actionPanel.direction.trim()) return
    const slot = slots.find((item) => item.id === actionPanel.slotId)
    if (!slot?.imageUrl) return
    setActionPanel((prev) => (prev ? { ...prev, loading: true } : prev))
    try {
      const { data } = await api.post<{ prompt?: string }>('/api/product-sets/generate-retouch-prompt', {
        settings,
        slot: { id: slot.id, name: slot.name, type: slot.type },
        originalPrompt: slot.prompt,
        userDirection: actionPanel.direction.trim(),
      })
      const retouchPrompt = data?.prompt?.trim()
      if (!retouchPrompt) throw new Error('AI改图提示词为空，请重试')
      await generateSlotWithPrompt(actionPanel.slotId, retouchPrompt, [slot.imageUrl])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setActionPanel((prev) => (prev ? { ...prev, loading: false } : prev))
      Message.error(message)
    }
  }

  const runSmartResize = async (slot: GenerationSlot) => {
    if (!slot.imageUrl) {
      Message.warning('请先生成图片，再智能改尺寸')
      return
    }
    await generateSlotWithPrompt(
      slot.id,
      `智能调整电商图片尺寸到${settings.ratio}，保留商品主体、文字可读性和视觉层次，不裁切关键信息。`,
      [slot.imageUrl],
    )
  }

  // 打包下载
  const handleBatchDownload = () => {
    const done = slots.filter((s) => s.imageUrl)
    if (done.length === 0) {
      Message.warning('暂无已生成的图片可供下载')
      return
    }
    done.forEach((s, idx) => {
      setTimeout(() => {
        saveAs(s.imageUrl!, `${s.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.png`)
      }, idx * 300)
    })
    Message.success(`正在下载 ${done.length} 张套图`)
  }

  const aiHelpPopoverContent = (
    <div className="w-[380px] p-3 text-[13px] text-[#0A1B39]">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#f0f2f5]">
        <div className="flex items-center gap-1.5 font-bold text-[#1683FF]">
          <Sparkles className="h-4 w-4" />
          <span>AI 智能帮写商品卖点</span>
        </div>
        {expandingPrompts && <Loader2 className="h-4 w-4 animate-spin text-[#1683FF]" />}
      </div>

      {aiHelpThinking && (
        <div className="mb-2 p-2 bg-[#f8fafc] rounded text-[11px] text-[#86909C] max-h-24 overflow-y-auto whitespace-pre-wrap font-mono">
          {aiHelpThinking}
        </div>
      )}

      <div className="mb-3">
        <label className="block text-[11px] text-[#86909C] mb-1">提炼出的结构化要求（可编辑）：</label>
        <Input.TextArea
          value={aiHelpText}
          onChange={setAiHelpText}
          rows={5}
          placeholder="AI 正在分析并提取..."
          className="text-[12px]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button size="small" onClick={() => setAiHelpOpen(false)}>
          取消
        </Button>
        <Button size="small" type="primary" disabled={!aiHelpText.trim()} onClick={confirmAiHelp}>
          确认采纳
        </Button>
      </div>
    </div>
  )

  return (
    <div className="relative flex h-full bg-[#f4f7fb] overflow-hidden">
      {/* ===================== 左侧 360px 参数面板 ===================== */}
      <div className="w-[360px] shrink-0 h-full overflow-y-auto border-r border-[#e5e8ef] bg-white px-5 pt-5 pb-4 select-none">
        {/* 1. 商品原图 */}
        <div className="mb-5">
          <h2 className="mb-3 flex items-center justify-between text-[14px] font-bold text-[#0A1B39]">
            <span className="flex items-center gap-1">
              商品原图
              <ProductImageHelpTooltip />
              <span className="text-[#86909C]">({uploadedImages.length}/6)</span>
            </span>
            <span className="text-[12px] font-normal text-[#86909C]">最多 6 张</span>
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleUploadFiles(e.target.files)
              e.currentTarget.value = ''
            }}
          />

          {uploadedImages.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {uploadedImages.map((img) => (
                <div
                  key={img.id}
                  className={`relative h-[82px] rounded-lg overflow-hidden border ${
                    img.isMain ? 'border-[#1683FF] ring-1 ring-[#1683FF]' : 'border-[#e5e8ef]'
                  } group bg-[#f8fafc]`}
                >
                  <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                  {img.isMain && (
                    <span className="absolute top-1 left-1 rounded bg-[#1683FF] px-1 py-0.5 text-[9px] font-bold text-white leading-none">
                      主视角
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    {!img.isMain && (
                      <button
                        type="button"
                        onClick={() => setAsMainImage(img.id)}
                        className="h-6 w-6 rounded-full bg-white/90 text-[#0A1B39] hover:bg-white flex items-center justify-center text-[10px]"
                        title="设为主图"
                      >
                        主
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeUploadedImage(img.id)}
                      className="h-6 w-6 rounded-full bg-white/90 text-[#c62828] hover:bg-white flex items-center justify-center"
                      title="删除"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {uploadedImages.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-[82px] rounded-lg border border-dashed border-[#d8e0ea] bg-[#fbfcfe] hover:border-[#1683FF] hover:bg-[#f0f7ff] transition-colors flex flex-col items-center justify-center gap-1 text-[#86909C]"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[11px]">添加</span>
                </button>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex h-[94px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#c9d5e8] bg-[#fbfcfe] hover:bg-[#f5f9ff] hover:border-[#1683FF] transition-colors"
            >
              <Button size="small" type="secondary" icon={<UploadIcon className="h-3.5 w-3.5" />} className="mb-1.5">
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

        {/* 4. 商品卖点 & 要求 + AI帮写（grid 两列，标题列 min-w-0 防挤压按钮换行裁切） */}
        <div className="mb-5">
          <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <SectionTitle help>
              商品卖点&要求
            </SectionTitle>
            <Popover
              content={aiHelpPopoverContent}
              trigger="click"
              popupVisible={aiHelpOpen}
              onVisibleChange={setAiHelpOpen}
              position="right"
            >
              <button
                type="button"
                onClick={handleAiHelp}
                disabled={expandingPrompts}
                className="flex h-7 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {expandingPrompts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
                AI 帮写
              </button>
            </Popover>
          </div>

          <Input.TextArea
            value={generationText}
            onChange={setGenerationText}
            rows={4}
            placeholder={`建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景`}
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

        {/* 吸底生成条：sticky 于面板滚动容器内（对照旧版 fixed+侧栏联动的等价实现，折叠侧栏不错位） */}
        <div className="sticky bottom-0 -mx-5 mt-1 border-t border-[#eef1f5] bg-white p-3.5">
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

                {/* 05 卖点详解 */}
                <div className="relative overflow-hidden rounded-xl border border-[#f0f2f5] bg-[#fafbfc] group">
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#4e5969] shadow-sm">
                    05 卖点详解
                  </span>
                  <img src={modelScene} alt="05 卖点详解" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ===================== 成图工作台结果看板 ===================== */
          <div className="max-w-[1200px] mx-auto pb-12">
            {/* 顶栏操作 */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#e5e8ef]">
              <button
                type="button"
                onClick={() => setResultViewActive(false)}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-[8px] bg-white px-3 text-[13px] font-semibold text-[#171A1D] shadow-[0_1px_0_rgba(15,23,41,.06)] transition-colors hover:bg-[#F5F6F8]"
              >
                <span aria-hidden>←</span> 返回配置
              </button>
              <h2 className="text-[18px] font-bold text-[#171A1D]">生成结果：</h2>
              <div className="flex items-center gap-3">
                <Button type="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={handleBatchDownload}>
                  批量下载
                </Button>
              </div>
            </div>

            {/* 成图网格 */}
            <div className="grid grid-cols-3 gap-5">
              {slots.map((slot) => (
                <Card
                  key={slot.id}
                  className="rounded-xl border border-[#e5eaf2] bg-white shadow-sm overflow-hidden"
                  bodyStyle={{ padding: 14 }}
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-[#f4f7fb] mb-3 flex items-center justify-center">
                    {slot.status === 'generating' ? (
                      <div className="flex flex-col items-center gap-2">
                        <Spin />
                        <span className="text-[11px] text-[#86909C]">AI生成中...</span>
                      </div>
                    ) : slot.imageUrl ? (
                      <img src={slot.imageUrl} alt={slot.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-[#c9d5e8]" />
                    )}

                    <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                      #{slot.slotIndex} {slot.type}
                    </span>
                    {slot.status === 'failed' && (
                      <span className="absolute inset-x-2 bottom-2 rounded bg-[#ffEBEE]/95 px-2 py-1 text-[10px] font-bold text-[#c62828]">
                        {slot.error || '生成失败'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-[#0A1B39] truncate">{slot.name}</p>
                      <Tag size="small" color={slot.status === 'done' ? 'green' : 'blue'}>
                        {slot.status === 'done' ? '已生成' : '生成中'}
                      </Tag>
                    </div>

                    <p className="text-[11px] text-[#86909C] line-clamp-2 leading-4">{slot.prompt}</p>

                    <div className="flex flex-wrap gap-1 pt-2 border-t border-[#f0f2f5]">
                      <Button
                        size="mini"
                        type="text"
                        icon={<RefreshCw className="h-3 w-3" />}
                        loading={slot.status === 'generating'}
                        onClick={() => handleRegenerateSingle(slot.id)}
                      >
                        重新生成
                      </Button>
                      {slot.imageUrl && (
                        <>
                          <Button size="mini" type="text" onClick={() => void openTextEditor(slot)}>
                            编辑文字
                          </Button>
                          <Button
                            size="mini"
                            type="text"
                            onClick={() =>
                              setActionPanel({ mode: 'retouch', slotId: slot.id, title: slot.name, text: '', direction: '', loading: false })
                            }
                          >
                            AI改图
                          </Button>
                          <Button size="mini" type="text" onClick={() => void runSmartResize(slot)}>
                            智能改尺寸
                          </Button>
                          <Button
                            size="mini"
                            type="text"
                            icon={<Download className="h-3 w-3" />}
                            onClick={() => saveAs(slot.imageUrl!, `${slot.name}.png`)}
                          >
                            下载
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal
        title={actionPanel?.mode === 'text' ? `编辑文字 · ${actionPanel?.title ?? ''}` : `AI改图 · ${actionPanel?.title ?? ''}`}
        visible={Boolean(actionPanel)}
        onCancel={() => setActionPanel(null)}
        onOk={() => void (actionPanel?.mode === 'text' ? runTextEditor() : runRetouchEditor())}
        confirmLoading={actionPanel?.loading}
        okButtonProps={{ disabled: !actionPanel || (actionPanel.mode === 'text' ? !actionPanel.text.trim() : !actionPanel.direction.trim()) }}
      >
        {actionPanel?.mode === 'text' ? (
          <div className="space-y-2">
            <p className="m-0 text-[12px] text-[#86909C]">AI 已识别当前图片文字，可直接修改后重新生成。</p>
            <Input.TextArea
              value={actionPanel.text}
              onChange={(value) => setActionPanel((prev) => (prev ? { ...prev, text: value } : prev))}
              rows={5}
              placeholder="输入替换后的图片文字"
            />
          </div>
        ) : actionPanel?.mode === 'retouch' ? (
          <div className="space-y-2">
            <p className="m-0 text-[12px] text-[#86909C]">描述需要调整的画面、背景、文字或风格。</p>
            <Input.TextArea
              value={actionPanel.direction}
              onChange={(value) => setActionPanel((prev) => (prev ? { ...prev, direction: value } : prev))}
              rows={5}
              placeholder="例如：把背景换成浅灰工作室，保留商品和文字"
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}