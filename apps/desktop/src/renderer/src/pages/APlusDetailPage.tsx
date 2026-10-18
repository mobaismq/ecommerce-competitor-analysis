import { useCallback, useRef, useState } from 'react'
import { Check, ChevronDown, Download, Eye, GripVertical, Loader2, Minus, MoreHorizontal, Plus, Sparkles, Trash2, Type, Upload, Wand2, X } from 'lucide-react'
import { Message, Select, Trigger } from '@arco-design/web-react'
import { saveAs } from 'file-saver'
import { nanoid } from 'nanoid'
import { useAuth } from '../store/auth'
import { AIReportSelector, type SuiteProduct } from '../components/AIReportSelector'
import { AiHelpPopover } from '../components/AiHelpPopover'
import { ProductImageHelpTooltip } from '../components/ProductImageHelpTooltip'
import { ResultActionDialog } from '../components/ResultActionDialog'
import { ImageResizeDialog } from '../components/ImageResizeDialog'
import { imageSourceToJpegBlob } from '../image-tools'
import previewProductFront from '../assets/detail-preview/image-15.png'
import previewProductCase from '../assets/detail-preview/image-16.png'
import previewProductEarbud from '../assets/detail-preview/image-17.png'
import previewLongImage from '../assets/detail-preview/image-18.png'
import previewDetailOne from '../assets/detail-preview/image-19.png'
import previewDetailTwo from '../assets/detail-preview/image-20.png'
import previewDetailThree from '../assets/detail-preview/image-21.png'
import previewDetailFour from '../assets/detail-preview/image-23.png'
import previewDetailFive from '../assets/detail-preview/image-24.png'
import previewDetailSix from '../assets/detail-preview/image-25.png'

const Option = Select.Option

// 模块名与描述逐字对照旧版 APlusDetail.tsx MODULES（key 为桌面端生图 slotType）
const MODULES: Array<{ title: string; desc: string; key: string }> = [
  { title: '首屏主视觉', desc: '传递核心价值', key: 'hero_banner' },
  { title: '核心卖点图', desc: '突出差异优势', key: 'core_selling_point' },
  { title: '使用场景图', desc: '呈现真实使用场景', key: 'usage_scene' },
  { title: '多角度图', desc: '多角度呈现外观', key: 'multi_angles' },
  { title: '场景氛围图', desc: '展示使用场景', key: 'scene_atmosphere' },
  { title: '商品细节图', desc: '放大材质与工艺', key: 'detail_close_up' },
  { title: '品牌故事图', desc: '传达品牌理念', key: 'brand_story' },
  { title: '尺寸/容量/尺码图', desc: '展示规格信息', key: 'dimension_size' },
  { title: '效果对比图', desc: '使用前后效果对比', key: 'effect_compare' },
  { title: '详细规格/参数表', desc: '展示详细商品数据', key: 'spec_table' },
  { title: '工艺制作图', desc: '展示工艺制作过程', key: 'craft_process' },
  { title: '配件/赠品图', desc: '明确收货的所有物品', key: 'accessories_list' },
  { title: '系列展示图', desc: '多色或多SKU展示', key: 'series_display' },
  { title: '商品成分图', desc: '展示配方/材质/成分', key: 'ingredients_material' },
  { title: '售后保障图', desc: '说明质保退换政策', key: 'after_sales' },
  { title: '使用建议图', desc: '商品使用的注意事项', key: 'usage_guide' },
]

// 默认勾选对照旧版 checked 初始值
const DEFAULT_CHECKED = ['首屏主视觉', '核心卖点图', '使用场景图', '多角度图', '场景氛围图', '商品细节图']

// 生成设置三组 options 逐字对照旧版 APlusDetail.tsx GENERATION_OPTIONS（平台 17 / 国家 17 / 语言 14 / 比例 5）
const PLATFORM_OPTIONS = ['淘宝天猫1688', '淘宝', '天猫', '抖音', '京东', '拼多多', '亚马逊', 'TikTok', '速卖通', 'Temu', 'Shein', 'Shopee', 'Lazada', 'eBay', 'Walmart', 'Shopify', '独立站']
const COUNTRY_OPTIONS = ['中国', '美国', '英国', '德国', '法国', '意大利', '西班牙', '日本', '韩国', '加拿大', '澳大利亚', '新加坡', '马来西亚', '泰国', '越南', '巴西', '墨西哥']
const LANGUAGE_OPTIONS = ['英文', '中文', '日文', '韩文', '德文', '法文', '意大利文', '西班牙文', '葡萄牙文', '荷兰文', '波兰文', '泰文', '越南文', '印尼文']
const RATIO_OPTIONS = ['1:1', '3:4', '4:3', '9:16', '16:9']

interface SelectedModuleItem {
  instanceId: string
  title: string
  key: string
  prompt: string
  status: 'idle' | 'generating' | 'done' | 'failed'
  imageUrl?: string
  error?: string
}

interface UploadedProductImage {
  id: string
  url: string
}

interface ModuleActionPanel {
  mode: 'text' | 'retouch'
  moduleId: string
  title: string
  text: string
  direction: string
  loading: boolean
}

/** worker 本地能力调用：桌面端必需；window.desktop 缺失时诚实报错，不伪造成功。 */
function desktopInvoke(capability: string, payload?: unknown): Promise<unknown> {
  if (!window.desktop?.capabilities) throw new Error('当前环境未接入本地能力（window.desktop 缺失），无法调用该能力')
  return window.desktop.capabilities.invoke(capability, payload)
}

export function APlusDetailPage() {
  const currentUserId = useAuth((s) => s.user?.id ?? '')
  // 上传商品原图（对照旧版：uploadedImages，生成入口依赖它）
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadInProgressRef = useRef(false)
  const planRequestIdRef = useRef(0)
  const [uploadedImages, setUploadedImages] = useState<UploadedProductImage[]>([])
  const [uploadNotice, setUploadNotice] = useState('')
  const [error, setError] = useState('')

  // 联动报告
  const [selectedReportId, setSelectedReportId] = useState('')
  const [currentReport, setCurrentReport] = useState<SuiteProduct | null>(null)

  // 生成设置（对照旧版 settings 四项）
  const [settings, setSettings] = useState({ platform: '淘宝天猫1688', country: '中国', language: '中文', ratio: '1:1' })

  // 商品卖点 & 要求 + AI 帮写（弹窗态：流式到 aiHelpText，确认后回填 detailGenerationText）
  const [detailGenerationText, setDetailGenerationText] = useState('')
  const [aiHelpOpen, setAiHelpOpen] = useState(false)
  const [aiHelpText, setAiHelpText] = useState('')
  const [aiWriting, setAiWriting] = useState(false)

  // 双步工作流
  const [step, setStep] = useState<'form' | 'strategy'>('form')
  const [strategyExpanded, setStrategyExpanded] = useState(false)
  const [strategyPlanText, setStrategyPlanText] = useState('')
  const [expandedPromptIds, setExpandedPromptIds] = useState<string[]>([])

  // 模块（勾选集合对照旧版 checked 初始值）
  const [checked, setChecked] = useState<string[]>([...DEFAULT_CHECKED])
  const [selectedModules, setSelectedModules] = useState<SelectedModuleItem[]>([])
  const [orderedTitles, setOrderedTitles] = useState<string[]>([])
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null)

  const [batchGenerating, setBatchGenerating] = useState(false)
  const [strategyStatus, setStrategyStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle')
  const [previewImage, setPreviewImage] = useState<{ url: string; kind: 'single' | 'long'; title: string; openedAt: Date } | null>(null)
  const [composingLongImage, setComposingLongImage] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [actionPanel, setActionPanel] = useState<ModuleActionPanel | null>(null)
  // 更多操作悬浮面板目标（D7/M11）
  const [moreMenuModuleId, setMoreMenuModuleId] = useState<string | null>(null)
  // 单张或批量智能改尺寸目标模块（D7/M14）
  const [resizeTargets, setResizeTargets] = useState<string[] | null>(null)
  const [batchResizeModuleIds, setBatchResizeModuleIds] = useState<string[]>([])
  const [resizeRatio, setResizeRatio] = useState(settings.ratio)

  const editableTextLines = actionPanel?.mode === 'text' ? actionPanel.text.split('\n') : []
  const updateTextLine = (index: number, value: string) => setActionPanel((prev) => {
    if (!prev) return prev
    const lines = prev.text.split('\n')
    lines[index] = value
    return { ...prev, text: lines.join('\n') }
  })
  const removeTextLine = (index: number) => setActionPanel((prev) => {
    if (!prev) return prev
    return { ...prev, text: prev.text.split('\n').filter((_, lineIndex) => lineIndex !== index).join('\n') }
  })

  const checkedModules = MODULES.filter((m) => checked.includes(m.title))
  const strategyModuleCount = checkedModules.length

  const handleUploadFiles = async (files: FileList | null) => {
    const selectedFiles = Array.from(files || [])
    if (!selectedFiles.length) return
    if (uploadInProgressRef.current) {
      Message.info('图片正在读取，请稍后再添加')
      return
    }
    const availableSlots = 6 - uploadedImages.length
    if (availableSlots <= 0) {
      setUploadNotice('同一产品最多上传 6 张图片，已保留前 6 张')
      return
    }
    const filesToRead = selectedFiles.slice(0, availableSlots)
    const invalidFile = filesToRead.find((file) => !file.type.startsWith('image/'))
    if (invalidFile) {
      setError('请上传图片文件')
      return
    }
    const oversizedFile = filesToRead.find((file) => file.size > 12 * 1024 * 1024)
    if (oversizedFile) {
      setError('图片太大，请上传 12MB 以内的图片')
      return
    }
    uploadInProgressRef.current = true
    try {
      // 保留选择顺序，避免异步读取时首张原图或“前 6 张”发生变化。
      const images = await Promise.all(filesToRead.map((file) => new Promise<UploadedProductImage>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ id: nanoid(8), url: String(reader.result || '') })
        reader.onerror = () => reject(new Error('图片读取失败，请重新上传'))
        reader.onabort = () => reject(new Error('图片读取已取消，请重新上传'))
        reader.readAsDataURL(file)
      })))
      setUploadedImages((prev) => [...prev, ...images].slice(0, 6))
      setUploadNotice(selectedFiles.length > availableSlots ? '同一产品最多上传 6 张图片，已保留前 6 张' : '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '图片读取失败，请重新上传')
      return
    } finally {
      uploadInProgressRef.current = false
    }
    // 上传后重置生成结果与规划（对照旧版联动）
    planRequestIdRef.current += 1
    setError('')
    setSelectedModules([])
    setOrderedTitles([])
    setStrategyPlanText('')
    setStrategyStatus('idle')
    setStep('form')
  }

  const removeUploadedImage = (id: string) => {
    planRequestIdRef.current += 1
    setUploadedImages((prev) => prev.filter((img) => img.id !== id))
    // 删图后重置生成结果与规划（对照旧版联动）
    setSelectedModules([])
    setOrderedTitles([])
    setStrategyStatus('idle')
    setStep('form')
    setError('')
    setUploadNotice('')
    setStrategyPlanText('')
  }

  const handleReportChange = (reportId: string, report: SuiteProduct | null) => {
    planRequestIdRef.current += 1
    setSelectedReportId(reportId)
    setCurrentReport(report)
    setError('')
    setStrategyStatus('idle')
  }

  // AI 帮写：真实流式调用 expandPrompts（经本地 IPC 事件通道流式下发，替代原 SSE HTTP）
  const handleAiHelp = async () => {
    if (aiWriting) return
    if (!uploadedImages.length) {
      setError('请先上传商品原图，再使用 AI 帮写')
      return
    }
    setError('')
    setAiHelpOpen(true)
    setAiWriting(true)
    setAiHelpText('')
    try {
      let fullText = ''
      const unsub = window.desktop?.capabilities.onStream((event) => {
        if (event.type === 'content') {
          fullText += event.text || event.data?.content || ''
          setAiHelpText(fullText)
        } else if (event.type === 'done') {
          fullText = String(event.text ?? fullText)
          setAiHelpText(fullText)
        } else if (event.type === 'error') {
          throw new Error(String(event.data?.message || event.data?.content || 'AI 帮写失败'))
        }
      })
      await desktopInvoke('productSets.expandPrompts', {
        userId: currentUserId,
        settings,
        baseText: detailGenerationText,
        information: detailGenerationText.trim() || '以用户上传商品原图中可见信息为准',
        image: uploadedImages[0]?.url || '',
        images: uploadedImages.map((item) => item.url),
      })
      unsub?.()
      if (!fullText.trim()) throw new Error('AI 帮写没有返回可用商品信息，请稍后重试。')
      setAiHelpText(fullText)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setAiWriting(false)
    }
  }

  const confirmAiHelp = () => {
    if (aiHelpText.trim()) setDetailGenerationText(aiHelpText)
    setAiHelpOpen(false)
  }

  const toggleModule = (title: string) => {
    setChecked((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]))
  }

  // 生成详情页规划和提示词（对照旧版 APlusDetail.tsx generateDetailStrategyPlan：真实返回，失败走错误横幅，不造假兜底）
  const handlePlanWorkflow = async () => {
    if (!uploadedImages.length) {
      setError('请先上传商品原图')
      return
    }
    if (!checkedModules.length) {
      setError('请至少选择一个详情图模块')
      return
    }
    const requestId = ++planRequestIdRef.current
    setError('')
    setStep('strategy')
    setStrategyStatus('generating')
    setStrategyPlanText('')
    setStrategyExpanded(false)
    setExpandedPromptIds([])
    setSelectedModules([])
    setOrderedTitles([])
    try {
      const reportText = [
        `商品名称: ${currentReport?.keyword || currentReport?.label || ''}`,
        `目标平台: ${settings.platform}`,
        `目标国家: ${settings.country}`,
        `目标语言: ${settings.language}`,
        `输出比例: ${settings.ratio}`,
        '【商品卖点与要求】',
        detailGenerationText || '（未填写，按通用电商详情规范）',
      ]
        .filter(Boolean)
        .join('\n')

      const data = await desktopInvoke('productSets.generateDetailWorkflow', {
        userId: currentUserId,
        settings,
        // 透传商品卖点作为 information，避免 worker 端【信息整理补全】为空
        baseText: detailGenerationText,
        reportText,
        image: uploadedImages[0]?.url || '',
        images: uploadedImages.map((item) => item.url),
        // 后端 normalizeDetailModuleType 仅识别中文模块名（DETAIL_MODULE_ORDER），故传 title 而非英文 key
        promptSlots: checkedModules.map((m) => m.title),
      }) as { data?: Array<{ type: string; prompt: string; name?: string }>; designPlan?: string; detailStrategyPlan?: unknown } | undefined
      if (requestId !== planRequestIdRef.current) return

      // 开发时页面可热更新，但已启动的能力 Worker 不会随构建文件自动换成新版本。
      if (data && 'detailStrategyPlan' in data && !('designPlan' in data)) {
        throw new Error('详情图能力服务仍在运行旧版本，请重启客户端后重试。')
      }
      const returnedItems = data?.data || []
      const prompts = returnedItems.filter((p) => p.type && p.prompt)
      if (prompts.length < checkedModules.length) throw new Error('详情图提示词返回不完整，请重试。')
      const planText = String(data?.designPlan || '').trim()
      if (!planText) throw new Error('详情页规划返回为空，请重试。')
      const byTitle = new Map(prompts.map((p) => [p.type, p.prompt]))
      setStrategyPlanText(planText)
      setSelectedModules(
        checkedModules.map((m) => ({
          instanceId: nanoid(8),
          title: m.title,
          key: m.key,
          prompt: byTitle.get(m.title) || '',
          status: 'idle' as const,
        })),
      )
      setStrategyStatus('ready')
    } catch (err) {
      if (requestId !== planRequestIdRef.current) return
      const message = err instanceof Error ? err.message : String(err)
      setStrategyStatus('error')
      setError(message)
    }
  }

  // 单图生成（数据流保持桌面端现状）
  const generateSingleModuleImage = async (instanceId: string) => {
    const target = selectedModules.find((m) => m.instanceId === instanceId)
    if (!target) return
    setSelectedModules((prev) =>
      prev.map((m) => (m.instanceId === instanceId ? { ...m, status: 'generating', error: undefined } : m)),
    )
    try {
      const data = await desktopInvoke('image.generate', {
        userId: currentUserId,
        tenantId: 'local',
        prompt: target.prompt,
        size: '2K',
        // 对照旧版：透传商品主图/全部上传图/宽高比，供图生图参考
        image: uploadedImages[0]?.url || '',
        images: uploadedImages.map((item) => item.url),
        ratio: settings.ratio,
      }) as { images?: Array<{ url?: string; dataUrl?: string }> } | undefined
      const generatedUrl = data?.images?.[0]?.url || data?.images?.[0]?.dataUrl
      if (!generatedUrl) throw new Error('生成成功但没有返回图片 URL')
      setSelectedModules((prev) =>
        prev.map((m) => (m.instanceId === instanceId ? { ...m, status: 'done', imageUrl: generatedUrl } : m)),
      )
    } catch (err) {
      setSelectedModules((prev) =>
        prev.map((m) =>
          m.instanceId === instanceId
            ? { ...m, status: 'failed', error: err instanceof Error ? err.message : '生成失败' }
            : m,
        ),
      )
      Message.error(`${target.title} 生成失败`)
    }
  }

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

  const generateModuleWithPrompt = async (instanceId: string, prompt: string, referenceImages: string[]) => {
    const target = selectedModules.find((item) => item.instanceId === instanceId)
    if (!target) return
    setActionPanel(null)
    setSelectedModules((prev) =>
      prev.map((item) => (item.instanceId === instanceId ? { ...item, status: 'generating', error: undefined } : item)),
    )
    try {
      const resolvedRefs = await Promise.all(referenceImages.map(resolveImageRefForAi))
      const data = await desktopInvoke('image.generate', {
        userId: currentUserId,
        tenantId: 'local',
        prompt,
        size: '2K',
        name: target.title,
        slotType: target.title,
        image: resolvedRefs[0],
        images: resolvedRefs.slice(0, 4),
        ratio: settings.ratio,
      }) as { images?: Array<{ url?: string; dataUrl?: string }> } | undefined
      const generatedUrl = data?.images?.[0]?.url || data?.images?.[0]?.dataUrl
      if (!generatedUrl) throw new Error('当前未接入真实图像服务，未返回可展示图片')
      setSelectedModules((prev) =>
        prev.map((item) => (item.instanceId === instanceId ? { ...item, status: 'done', imageUrl: generatedUrl } : item)),
      )
      Message.success('图片处理完成')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSelectedModules((prev) =>
        prev.map((item) => (item.instanceId === instanceId ? { ...item, status: 'failed', error: message } : item)),
      )
      Message.error(message)
    }
  }

  // 带目标比例的模块生成（智能改尺寸用，D7/M14：已生成图作原图扩/缩）
  const generateModuleWithPromptRatio = async (instanceId: string, prompt: string, referenceImages: string[], ratio: string) => {
    const target = selectedModules.find((item) => item.instanceId === instanceId)
    if (!target) return
    setActionPanel(null)
    setSelectedModules((prev) =>
      prev.map((item) => (item.instanceId === instanceId ? { ...item, status: 'generating', error: undefined } : item)),
    )
    try {
      const resolvedRefs = await Promise.all(referenceImages.map(resolveImageRefForAi))
      const data = await desktopInvoke('image.generate', {
        userId: currentUserId,
        tenantId: 'local',
        prompt,
        size: '2K',
        name: target.title,
        slotType: target.title,
        image: resolvedRefs[0],
        images: resolvedRefs.slice(0, 4),
        ratio,
      }) as { images?: Array<{ url?: string; dataUrl?: string }> } | undefined
      const generatedUrl = data?.images?.[0]?.url || data?.images?.[0]?.dataUrl
      if (!generatedUrl) throw new Error('当前未接入真实图像服务，未返回可展示图片')
      setSelectedModules((prev) =>
        prev.map((item) => (item.instanceId === instanceId ? { ...item, status: 'done', imageUrl: generatedUrl } : item)),
      )
      Message.success('图片处理完成')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSelectedModules((prev) =>
        prev.map((item) => (item.instanceId === instanceId ? { ...item, status: 'failed', error: message } : item)),
      )
      Message.error(message)
    }
  }

  // 单模块智能改尺寸（更多操作面板内，D7/M11）
  const runModuleSmartResize = async (mod: SelectedModuleItem, targetRatio: string) => {
    if (!mod.imageUrl) {
      Message.warning('请先生成图片，再智能改尺寸')
      return
    }
    setMoreMenuModuleId(null)
    setResizeTargets(null)
    setResizeRatio(targetRatio)
    const resolvedUrl = await resolveImageRefForAi(mod.imageUrl)
    await generateModuleWithPromptRatio(
      mod.instanceId,
      `智能调整电商图片尺寸到${targetRatio}，保留商品主体、文字可读性和视觉层次，不裁切关键信息。`,
      [resolvedUrl],
      targetRatio,
    )
  }

  // 与商品主图一致：确认后先占住所有已生成目标图位，再逐张按目标尺寸重新生成。
  const runBatchSmartResize = async (targetIds: string[], targetRatio: string) => {
    const targets = selectedModules.filter((mod) => targetIds.includes(mod.instanceId) && mod.imageUrl)
    if (!targets.length) {
      Message.warning('所选图片尚未生成，无法改尺寸')
      setResizeTargets(null)
      return
    }
    const ids = targets.map((mod) => mod.instanceId)
    const idSet = new Set(ids)
    setResizeTargets(null)
    setSelectedImageIds([])
    setBatchResizeModuleIds(ids)
    setSelectedModules((prev) => prev.map((mod) => idSet.has(mod.instanceId) ? { ...mod, status: 'generating', error: undefined } : mod))
    try {
      for (const mod of targets) {
        await generateModuleWithPromptRatio(
          mod.instanceId,
          `智能调整电商图片尺寸到${targetRatio}，保留商品主体、文字可读性和视觉层次，不裁切关键信息。`,
          [mod.imageUrl!],
          targetRatio,
        )
      }
    } finally {
      setBatchResizeModuleIds([])
    }
  }

  const confirmResize = () => {
    if (!resizeTargets?.length) return
    if (resizeTargets.length > 1) {
      void runBatchSmartResize(resizeTargets, resizeRatio)
      return
    }
    const target = selectedModules.find((mod) => mod.instanceId === resizeTargets[0])
    if (target) void runModuleSmartResize(target, resizeRatio)
  }

  // 单模块删除（更多操作面板内，从列表移除）
  const handleDeleteSingleModule = (instanceId: string) => {
    setSelectedModules((prev) => prev.filter((m) => m.instanceId !== instanceId))
    setSelectedImageIds((prev) => prev.filter((id) => id !== instanceId))
    setMoreMenuModuleId(null)
    Message.success('已移除该模块')
  }

  const openTextEditor = async (moduleId: string) => {
    const target = selectedModules.find((item) => item.instanceId === moduleId)
    if (!target?.imageUrl) {
      Message.warning('请先生成图片，再编辑文字')
      return
    }
    setActionPanel({ mode: 'text', moduleId, title: target.title, text: '', direction: '', loading: true })
    try {
      const resolvedUrl = await resolveImageRefForAi(target.imageUrl)
      const data = await desktopInvoke('productSets.extractImageText', {
        userId: currentUserId,
        imageUrl: resolvedUrl,
        assetId: target.instanceId,
      }) as { text?: string; texts?: string[] } | undefined
      const extractedText = (data?.texts && data.texts.length > 0 ? data.texts.join('\n') : data?.text) ?? ''
      setActionPanel((prev) => (prev ? { ...prev, text: extractedText, loading: false } : prev))
    } catch (err) {
      setActionPanel(null)
      Message.error(err instanceof Error ? err.message : '读取图片文字失败')
    }
  }

  const runTextEditor = async () => {
    if (!actionPanel?.text.trim()) return
    const target = selectedModules.find((item) => item.instanceId === actionPanel.moduleId)
    if (!target?.imageUrl) return
    const resolvedUrl = await resolveImageRefForAi(target.imageUrl)
    await generateModuleWithPrompt(
      actionPanel.moduleId,
      `保留详情图版式和商品主体，仅更新图片文字内容。新文字：${actionPanel.text.trim()}`,
      [resolvedUrl],
    )
  }

  const runRetouchEditor = async () => {
    if (!actionPanel) return
    const target = selectedModules.find((item) => item.instanceId === actionPanel.moduleId)
    if (!target?.imageUrl) return
    setActionPanel((prev) => (prev ? { ...prev, loading: true } : prev))
    try {
      const data = await desktopInvoke('productSets.generateRetouchPrompt', {
        userId: currentUserId,
        settings,
        slot: { id: target.instanceId, name: target.title, type: target.title },
        originalPrompt: target.prompt,
        userDirection: actionPanel.direction.trim() || '保持商品主体、构图和视觉风格，重新生成此图片。',
      }) as { prompt?: string } | undefined
      const retouchPrompt = data?.prompt?.trim()
      if (!retouchPrompt) throw new Error('AI改图提示词为空，请重试')
      const resolvedUrl = await resolveImageRefForAi(target.imageUrl)
      await generateModuleWithPrompt(actionPanel.moduleId, retouchPrompt, [resolvedUrl])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setActionPanel((prev) => (prev ? { ...prev, loading: false } : prev))
      Message.error(message)
    }
  }

  const handleBatchGenerateAll = async () => {
    if (!selectedModules.length) return
    setBatchGenerating(true)
    const jobId = `detail-${nanoid(12)}`
    // LangGraph 编排：dispatch → Send 扇出逐模块 generateOne；每模块进度经 IPC 节点事件回显。
    const unsub = window.desktop?.capabilities.onStream((event) => {
      if (event.type === 'node' && event.data?.node === 'generateImage') {
        const d = event.data as { instanceId?: string; status?: SelectedModuleItem['status']; imageUrl?: string; error?: string }
        if (!d.instanceId) return
        setSelectedModules((prev) =>
          prev.map((m) => (m.instanceId === d.instanceId ? { ...m, status: d.status ?? m.status, imageUrl: d.imageUrl, error: d.error } : m)),
        )
      }
    })
    try {
      setSelectedModules((prev) => prev.map((m) => ({ ...m, status: 'generating' as const })))
      const res = (await desktopInvoke('productSets.detailGraph.run', {
        userId: currentUserId,
        tenantId: 'local',
        settings,
        images: uploadedImages.map((i) => i.url),
        modules: selectedModules.map((m, i) => ({ instanceId: m.instanceId, title: m.title, key: m.key, prompt: m.prompt, sequence: i + 1 })),
        jobId,
      })) as { ok?: boolean; failedCount?: number } | undefined
      if (res?.failedCount) Message.error(`${res.failedCount} 个模块生成失败，其余已保留。`)
      else Message.success('全部详情切片图已生成完毕！')
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '批量生成失败')
    } finally {
      unsub?.()
      setBatchGenerating(false)
    }
  }

  const handleDownloadImage = async (url: string, filename = 'detail-image.jpg') => {
    try {
      // 统一转 jpg（M16 单张下载 jpg；长图/切片同路径）
      const blob = await imageSourceToJpegBlob(url)
      saveAs(blob, filename.replace(/\.png$/, '.jpg'))
      Message.success('已下载')
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '下载失败')
    }
  }

  // 批量下载到桌面文件夹（M16 批量=文件夹；主进程 files.saveImageBatch）
  const handleBatchDownloadToDesktop = async (targets: SelectedModuleItem[]) => {
    const done = targets.filter((m) => m.imageUrl)
    if (!done.length) {
      Message.warning('暂无已生成的模块图片可下载')
      return
    }
    if (!window.desktop?.files) {
      Message.error('当前环境未接入桌面文件能力，无法批量保存')
      return
    }
    try {
      const files: Array<{ name: string; data: Uint8Array }> = []
      for (const m of done) {
        const blob = await imageSourceToJpegBlob(m.imageUrl!)
        files.push({ name: `${m.title.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.jpg`, data: new Uint8Array(await blob.arrayBuffer()) })
      }
      const result = await window.desktop.files.saveImageBatch({ folderName: '详情图', kind: 'detail', files })
      Message.success(`已保存 ${result.count} 张图片到桌面：${result.folderPath}`)
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '批量保存失败')
    }
  }

  // 预览弹窗「下载全部图片」：全部已生成模块落桌面文件夹（D6）
  const handleDownloadAllFromPreview = () => {
    if (previewImage) void handleBatchDownloadToDesktop(strategyModules)
  }

  const loadImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('详情切片图加载失败，无法合成长图'))
      image.src = url
    })

  // 真实长图合成：按当前模块顺序等比拼接已生成切片，不再把第一张切片伪装成长图。
  const buildDetailLongImage = async () => {
    const done = strategyModules.filter((item) => item.imageUrl)
    if (!done.length) throw new Error('请先生成详情切片图')
    const images = await Promise.all(done.map((item) => loadImage(item.imageUrl!)))
    const width = Math.max(800, ...images.map((image) => image.naturalWidth || image.width))
    const heights = images.map((image) => Math.round(((image.naturalHeight || image.height) / (image.naturalWidth || image.width)) * width))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = heights.reduce((sum, height) => sum + height, 0)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前环境不支持长图合成')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    let y = 0
    images.forEach((image, index) => {
      context.drawImage(image, 0, y, width, heights[index])
      y += heights[index]
    })
    return canvas.toDataURL('image/png')
  }

  const handlePreviewLongImage = async () => {
    setComposingLongImage(true)
    try {
      const dataUrl = await buildDetailLongImage()
      setPreviewImage({ url: dataUrl, kind: 'long', title: '详情长图', openedAt: new Date() })
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '长图合成失败')
    } finally {
      setComposingLongImage(false)
    }
  }

  const handleDownloadLongImageFromPreview = async () => {
    try {
      const url = previewImage?.kind === 'long' ? previewImage.url : await buildDetailLongImage()
      await handleDownloadImage(url, 'detail-long-image.jpg')
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '长图合成失败')
    }
  }

  const strategyModules = orderedTitles.length
    ? (orderedTitles.map((title) => selectedModules.find((m) => m.title === title)).filter(Boolean) as SelectedModuleItem[])
    : selectedModules

  const hasResults = selectedModules.some((m) => m.status !== 'idle')

  return (
    <div className="aplus-detail-page relative flex h-full bg-[#F2F4F7]">
      {/* ===================== 左侧 360px 配置面板（对照旧版 form/strategy 双步） ===================== */}
      <div className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-r border-[#E5E8EF] bg-white">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-4 custom-scrollbar">
        {step === 'form' ? (
          <>
            {/* 商品原图上传（对照旧版：空态白底虚线+灰钮 / 已传 grid-cols-3 + 继续上传灰块） */}
            <h2 className="mb-3 flex items-center gap-1 text-[14px] font-bold text-[#171A1D]">
              商品原图
              <ProductImageHelpTooltip />
            </h2>
            <div className="mb-4">
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
                <div className="grid grid-cols-3 gap-2">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="group relative aspect-square overflow-hidden rounded-[8px] border border-[#e5e8ef] bg-white transition-shadow hover:shadow-md">
                      <img src={img.url} alt="商品原图" className="h-full w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => removeUploadedImage(img.id)}
                        className="absolute right-1.5 top-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded-[4px] border-0 bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/65"
                        aria-label="删除图片"
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
                      aria-label="继续上传商品图"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="mb-4 flex h-[94px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E3E7EF] bg-white">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-3 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]"
                  >
                    <Upload className="h-4 w-4" />
                    上传图片
                  </button>
                  <p className="m-0 text-[12px] text-[#8B949E]">同一产品，最多6张。</p>
                </div>
              )}
              {uploadNotice && (
                <div role="alert" className="mt-3 rounded-[8px] border border-[#FFD7D7] bg-[#FFF5F5] px-3 py-2 text-[12px] font-semibold text-[#C03535]">
                  {uploadNotice}
                </div>
              )}
            </div>

            {error && (
              <div className="mb-5 flex gap-2 rounded-lg border border-[#FFD7D7] bg-[#FFF5F5] p-3 text-[13px] font-semibold text-[#C03535]">
                <span>{error}</span>
              </div>
            )}

            {/* AI 报告联动 */}
            <div className="mb-4">
              <AIReportSelector value={selectedReportId} onChange={handleReportChange} />
              {selectedReportId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReportId('')
                    setCurrentReport(null)
                  }}
                  className="-mt-2 mb-4 h-8 w-full cursor-pointer rounded-lg border-0 bg-[#F2F3F5] text-[12px] font-semibold text-[#5F6B7A] transition-colors hover:bg-[#E8EAED]"
                >
                  不引用AI报告
                </button>
              )}
            </div>

            {/* 生成设置（对照旧版四项 grid-cols-2） */}
            <div className="mb-4">
              <h2 className="mb-2 text-[14px] font-bold text-[#171A1D]">生成设置</h2>
              <div className="grid grid-cols-2 gap-3">
                <Select size="small" value={settings.platform} onChange={(v) => setSettings((s) => ({ ...s, platform: v }))}>
                  {PLATFORM_OPTIONS.map((o) => (
                    <Option key={o} value={o}>{o}</Option>
                  ))}
                </Select>
                <Select size="small" value={settings.country} onChange={(v) => setSettings((s) => ({ ...s, country: v }))}>
                  {COUNTRY_OPTIONS.map((o) => (
                    <Option key={o} value={o}>{o}</Option>
                  ))}
                </Select>
                <Select size="small" value={settings.language} onChange={(v) => setSettings((s) => ({ ...s, language: v }))}>
                  {LANGUAGE_OPTIONS.map((o) => (
                    <Option key={o} value={o}>{o}</Option>
                  ))}
                </Select>
                <Select size="small" value={settings.ratio} onChange={(v) => setSettings((s) => ({ ...s, ratio: v }))}>
                  {RATIO_OPTIONS.map((o) => (
                    <Option key={o} value={o}>{o}</Option>
                  ))}
                </Select>
              </div>
            </div>

            {/* 商品卖点&要求 + AI 帮写（与主图共用 AiHelpPopover 组件） */}
            <div className="mb-2 flex items-center justify-between">
              <h2 className="m-0 text-[14px] font-bold text-[#171A1D]">
                商品卖点&要求 <span className="cursor-help text-[13px] text-[#86909C]" title="填写产品名、卖点、人群和场景，AI 生图更精准">?</span>
              </h2>
              <AiHelpPopover
                visible={aiHelpOpen}
                onVisibleChange={setAiHelpOpen}
                busy={aiWriting}
                text={aiHelpText}
                onTextChange={setAiHelpText}
                onStart={() => void handleAiHelp()}
                onRetry={() => void handleAiHelp()}
                onConfirm={confirmAiHelp}
                triggerDisabled={!uploadedImages.length}
                onDisabledClick={() => Message.warning('请先上传商品原图，再使用 AI 帮写')}
              />
            </div>
            <textarea
              className="mb-4 h-[114px] w-full resize-none rounded-lg border border-[#DDE3EC] bg-white p-3 text-[12px] leading-[20px] text-[#5F6B7A] outline-none focus:border-[#4690FF]"
              value={detailGenerationText}
              onChange={(event) => setDetailGenerationText(event.target.value)}
              placeholder={'建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.具体参数'}
            />

            {/* 包含模块（多选）：对照旧版灰卡 + 勾选框样式 */}
            <div className="mb-4">
              <h2 className="m-0 mb-2 text-[14px] font-bold text-[#171A1D]">
                包含模块（多选） <span className="cursor-help text-[13px] text-[#86909C]" title="勾选需要生成的详情图模块">?</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {MODULES.map((m) => {
                  const isChecked = checked.includes(m.title)
                  return (
                    <button
                      key={m.title}
                      type="button"
                      onClick={() => toggleModule(m.title)}
                      className="cursor-pointer rounded-lg bg-[#F2F3F5] p-3 text-left"
                    >
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#171A1D]">
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] ${
                            isChecked ? 'bg-[#1683FF] text-white' : 'border border-[#D7DCE3] bg-white text-transparent'
                          }`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span className="truncate">{m.title}</span>
                      </div>
                      <p className="m-0 mt-1 text-[12px] text-[#8B949E]">{m.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>

          </>
        ) : strategyStatus === 'generating' ? (
          <div className="flex min-h-[520px] flex-col">
            <h2 className="m-0 mb-4 text-[14px] font-bold text-[#171A1D]">详情图工作流</h2>
            <div className="grid min-h-[360px] flex-1 place-items-center rounded-[10px] bg-[#F2F3F5] text-[#A0A7B2]">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex gap-2" aria-hidden="true">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#A0A7B2]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#A0A7B2] [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#A0A7B2] [animation-delay:240ms]" />
                </div>
                <span className="text-[12px] font-medium">正在整理信息、规划详情页并生成提示词...</span>
              </div>
            </div>
          </div>
        ) : strategyStatus === 'error' ? (
          <>
            <h2 className="m-0 mb-4 text-[14px] font-bold text-[#171A1D]">详情图工作流</h2>
            <div role="alert" className="rounded-[8px] border border-[#FFD7D7] bg-[#FFF5F5] p-4 text-[12px] font-semibold leading-5 text-[#C03535]">
              {error || '详情图工作流生成失败，请返回上一步重新生成。'}
            </div>
          </>
        ) : (
          <>
            {/* 详情页规划（对照旧版折叠卡） */}
            <h2 className="m-0 mb-3 text-[14px] font-bold text-[#171A1D]">详情页规划</h2>
            <div className="mb-6 rounded-[10px] border border-[#e5e8ef] bg-white px-4 py-5">
              <div className={`whitespace-pre-line text-[13px] leading-7 text-[#171A1D] ${strategyExpanded ? '' : 'max-h-[112px] overflow-hidden'}`}>
                {strategyPlanText || '暂无详情页规划，请返回上一步重新生成。'}
              </div>
              <button
                type="button"
                onClick={() => setStrategyExpanded((v) => !v)}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1 border-0 bg-transparent p-0 text-[12px] font-semibold text-[#171A1D]"
              >
                {strategyExpanded ? '收起' : '展开全部'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${strategyExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* 模块提示词（对照旧版列表，支持排序） */}
            <div className="mb-3">
              <h2 className="m-0 text-[14px] font-bold text-[#171A1D]">模块提示词</h2>
            </div>
            <div className="space-y-4">
              {strategyModules.map((mod) => (
                <div
                  key={mod.instanceId}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (!draggingModuleId || draggingModuleId === mod.instanceId) return
                    const titles = strategyModules.map((item) => item.title)
                    const from = strategyModules.findIndex((item) => item.instanceId === draggingModuleId)
                    const to = strategyModules.findIndex((item) => item.instanceId === mod.instanceId)
                    if (from < 0 || to < 0) return
                    const [moved] = titles.splice(from, 1)
                    titles.splice(to, 0, moved)
                    setOrderedTitles(titles)
                    setDraggingModuleId(null)
                  }}
                  className={`rounded-[12px] bg-[#F5F6F8] p-4 ${draggingModuleId === mod.instanceId ? 'opacity-60' : ''}`}
                >
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-bold text-[#171A1D]">{mod.title}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModules((prev) => prev.filter((m) => m.instanceId !== mod.instanceId))
                          setSelectedImageIds((prev) => prev.filter((id) => id !== mod.instanceId))
                          setOrderedTitles((prev) => prev.filter((t) => t !== mod.title))
                        }}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-[#98A2B3] hover:bg-white hover:text-[#C03535]"
                        aria-label={`删除${mod.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', mod.instanceId)
                          setDraggingModuleId(mod.instanceId)
                        }}
                        onDragEnd={() => setDraggingModuleId(null)}
                        onKeyDown={(event) => {
                          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                          event.preventDefault()
                          const titles = strategyModules.map((item) => item.title)
                          const from = titles.indexOf(mod.title)
                          const to = from + (event.key === 'ArrowUp' ? -1 : 1)
                          if (to < 0 || to >= titles.length) return
                          ;[titles[from], titles[to]] = [titles[to], titles[from]]
                          setOrderedTitles(titles)
                        }}
                        className="grid h-6 w-6 cursor-grab place-items-center rounded-[6px] border-0 bg-transparent text-[#98A2B3] hover:bg-white active:cursor-grabbing"
                        aria-label={`拖动调整${mod.title}顺序`}
                        title="拖动或按上下方向键调整顺序"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={mod.prompt}
                    onChange={(e) =>
                      setSelectedModules((prev) =>
                        prev.map((m) => (m.instanceId === mod.instanceId ? { ...m, prompt: e.target.value } : m)),
                      )
                    }
                    rows={expandedPromptIds.includes(mod.instanceId) ? 10 : 4}
                    placeholder="暂无提示词，请返回上一步重新生成。"
                    className="block w-full resize-none rounded-[8px] border border-[#e5e8ef] bg-white p-3 text-[12px] leading-6 text-[#344054] outline-none focus:border-[#3388ff]"
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedPromptIds((prev) => prev.includes(mod.instanceId) ? prev.filter((id) => id !== mod.instanceId) : [...prev, mod.instanceId])}
                    className="mt-7 flex min-h-9 w-full cursor-pointer items-center justify-center gap-1 border-0 bg-transparent py-2 text-[12px] font-semibold text-[#171A1D]"
                  >
                    {expandedPromptIds.includes(mod.instanceId) ? '收起' : '展开'}
                    <ChevronDown className={`h-3.5 w-3.5 ${expandedPromptIds.includes(mod.instanceId) ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              ))}
              {strategyModules.length === 0 && (
                <div className="rounded-lg bg-[#F5F6F8] px-3 py-6 text-center text-[12px] text-[#8B949E]">
                  暂无模块提示词，请返回上一步重新生成。
                </div>
              )}
            </div>
          </>
        )}
        </div>

        {/* 吸底操作条（对照旧版：form 步深色全宽三态文案 / strategy 步上一步+生成详情图） */}
        <div className="shrink-0 border-t border-[#EEF1F5] bg-white p-4">
          {step === 'strategy' ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  planRequestIdRef.current += 1
                  setStrategyStatus('idle')
                  setStep('form')
                }}
                disabled={batchGenerating}
                className="h-10 w-[96px] shrink-0 cursor-pointer rounded-lg border-0 bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#E8EAED] disabled:opacity-60"
              >
                上一步
              </button>
              <button
                type="button"
                onClick={handleBatchGenerateAll}
                disabled={batchGenerating || strategyStatus !== 'ready' || !uploadedImages.length || !strategyModules.length}
                className={`h-10 flex-1 cursor-pointer rounded-lg border-0 text-[13px] font-semibold text-white transition-colors ${
                  strategyStatus === 'ready' && uploadedImages.length && strategyModules.length && !batchGenerating
                    ? 'bg-[#171A1D] hover:bg-[#2A2F36]'
                    : 'bg-[#C4C6CA]'
                } disabled:cursor-not-allowed`}
              >
                {batchGenerating ? '正在生成...' : `生成详情图（${strategyStatus === 'ready' ? strategyModules.length : strategyModuleCount}张）`}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePlanWorkflow}
              disabled={!uploadedImages.length || strategyStatus === 'generating' || batchGenerating}
              className={`h-10 w-full cursor-pointer rounded-lg border-0 text-[13px] font-semibold text-white transition-colors ${
                uploadedImages.length && strategyStatus !== 'generating' && !batchGenerating
                  ? 'bg-[#171A1D] hover:bg-[#2A2F36]'
                  : 'bg-[#505154]'
              } disabled:cursor-not-allowed`}
            >
              {strategyStatus === 'generating' ? '生成中...' : uploadedImages.length ? '生成详情页规划和提示词' : '请上传产品图'}
            </button>
          )}
        </div>
      </div>

      {/* ===================== 右侧画布区（对照旧版示例卡 + 结果视图） ===================== */}
      <div className="h-full min-w-0 flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className={`flex min-h-full ${hasResults ? 'items-start justify-start' : 'items-center justify-center'}`}>
          <div className={`w-full pb-10 text-center ${hasResults ? 'max-w-none' : 'max-w-[980px]'}`}>
            {!hasResults && (
              <>
                <h1 className="m-0 text-[32px] font-bold leading-tight text-[#171A1D]">详情图</h1>
                <p className="m-0 mt-3 text-[14px] leading-6 text-[#5F6B7A]">
                  上传商品图，AI 即刻生成 <span className="font-semibold text-[#1683FF]">符合多电商平台规范</span> 的专业详情图。
                </p>
              </>
            )}

            <div className={hasResults ? 'mt-0' : 'mt-12'}>
              {hasResults ? (
                /* 结果视图 */
                <div className="mx-auto max-w-[1200px] text-left">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="m-0 text-[20px] font-extrabold text-[#171A1D]">生成结果：</h2>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const selectable = strategyModules.filter((m) => m.imageUrl).map((m) => m.instanceId)
                          setSelectedImageIds((prev) => selectable.length && selectable.every((id) => prev.includes(id)) ? [] : selectable)
                        }}
                        className="flex h-11 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[14px] font-semibold text-[#4E5969] transition-colors hover:bg-white"
                      >
                        {(() => {
                          const selectable = strategyModules.filter((m) => m.imageUrl).map((m) => m.instanceId)
                          const all = selectable.length > 0 && selectable.every((id) => selectedImageIds.includes(id))
                          const partial = !all && selectable.some((id) => selectedImageIds.includes(id))
                          return <span className={`grid h-5 w-5 place-items-center rounded-[5px] border ${all || partial ? 'border-[#171A1D] bg-[#171A1D] text-white' : 'border-[#86909C] bg-white text-transparent'}`}>
                            {partial ? <Minus className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          </span>
                        })()}
                        全选
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePreviewLongImage()}
                        disabled={!strategyModules.some((m) => m.imageUrl) || composingLongImage}
                        className="flex h-11 items-center gap-2 rounded-[12px] bg-white px-4 text-[14px] font-semibold text-[#171A1D] shadow-[0_1px_3px_rgba(15,23,41,.08)] transition-colors hover:bg-[#F5F6F8] disabled:cursor-not-allowed disabled:text-[#A0A7B2]"
                      >
                        {composingLongImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        预览长图
                      </button>
                      {selectedImageIds.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setResizeTargets(selectedImageIds.filter((id) => strategyModules.some((mod) => mod.instanceId === id && mod.imageUrl)))}
                            className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border-0 bg-white px-4 text-[14px] font-semibold text-[#171A1D] shadow-[0_1px_3px_rgba(15,23,41,.08)] transition-colors hover:bg-[#F5F6F8]"
                          >
                            <Sparkles className="h-4 w-4" />
                            批量改尺寸
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const done = selectedModules.filter((m) => selectedImageIds.includes(m.instanceId) && m.imageUrl)
                              if (!done.length) return
                              void handleBatchDownloadToDesktop(done)
                            }}
                            className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border-0 bg-white px-4 text-[14px] font-semibold text-[#171A1D] shadow-[0_1px_3px_rgba(15,23,41,.08)] transition-colors hover:bg-[#F5F6F8]"
                          >
                            <Download className="h-4 w-4" />
                            批量下载
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedModules((prev) => prev.filter((m) => !selectedImageIds.includes(m.instanceId)))
                              setSelectedImageIds([])
                            }}
                            className="flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border-0 bg-white px-4 text-[14px] font-semibold text-[#171A1D] shadow-[0_1px_3px_rgba(15,23,41,.08)] transition-colors hover:bg-[#F5F6F8]"
                          >
                            <Trash2 className="h-4 w-4" />
                            批量删除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-5">
                    {/* 首位原图格（对照旧版） */}
                    <div className="relative aspect-square overflow-hidden rounded-[8px] bg-white">
                      <img src={uploadedImages[0]?.url || ''} alt="原图" className="h-full w-full object-contain" />
                      <span className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-[4px] bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                        原图
                      </span>
                    </div>
                    {strategyModules.map((mod) => (
                      <div
                        key={mod.instanceId}
                        className={`group relative aspect-square overflow-hidden rounded-[8px] bg-white ${selectedImageIds.includes(mod.instanceId) || batchResizeModuleIds.includes(mod.instanceId) ? 'ring-2 ring-[#171A1D]' : ''}`}
                      >
                        <div className="flex h-full w-full items-center justify-center">
                          {mod.status === 'generating' ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="flex items-center gap-1.5" aria-hidden="true">
                                {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 rounded-full bg-[#C9CDD4]" />)}
                              </div>
                              <span className="text-[11px] text-[#86909C]">AI生成中...</span>
                            </div>
                          ) : mod.imageUrl ? (
                            <button type="button" onClick={() => setPreviewImage({ url: mod.imageUrl!, kind: 'single', title: mod.title, openedAt: new Date() })} className="h-full w-full cursor-zoom-in border-0 bg-transparent p-0" title={`预览${mod.title}`}>
                              <img src={mod.imageUrl} alt={mod.title} className="h-full w-full object-contain" />
                            </button>
                          ) : (
                            <div className="text-center">
                              <Eye className="mx-auto mb-1 h-8 w-8 text-[#c9d5e8]" />
                              <span className="text-[11px] text-[#86909C]">等待生成</span>
                            </div>
                          )}
                        </div>
                        <span className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-[4px] bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                          {mod.title}
                        </span>

                        {mod.status !== 'generating' && !mod.imageUrl && (
                          <button
                            type="button"
                            onClick={() => void generateSingleModuleImage(mod.instanceId)}
                            className="absolute right-2 top-2 rounded-[6px] border-0 bg-[#F2F3F5] px-2 py-1 text-[11px] font-semibold text-[#4E5969] hover:bg-[#E8EAED]"
                          >
                            单独渲染
                          </button>
                        )}

                          {/* 悬浮操作层（D7/M11，与主图一致）：左上选择；右上下载+更多；底部 AI改图+编辑文字 */}
                          {mod.imageUrl && mod.status !== 'generating' && (
                            <button
                              type="button"
                              onClick={() => setSelectedImageIds((prev) => prev.includes(mod.instanceId) ? prev.filter((id) => id !== mod.instanceId) : [...prev, mod.instanceId])}
                              className={`absolute left-3 top-3 z-30 grid h-7 w-7 place-items-center rounded-[6px] border-0 transition-opacity ${
                                selectedImageIds.includes(mod.instanceId)
                                  ? 'bg-[#171A1D] text-white opacity-100'
                                  : 'border border-[#86909C] bg-white/90 text-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                              }`}
                              title={selectedImageIds.includes(mod.instanceId) ? '取消选择' : '选择'}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          {mod.imageUrl && mod.status !== 'generating' && (
                            <div className={`pointer-events-none absolute inset-0 z-20 rounded-[8px] bg-black/35 transition-opacity ${moreMenuModuleId === mod.instanceId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
                              <div className="pointer-events-auto absolute right-3 top-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleDownloadImage(mod.imageUrl!, `${mod.title}.jpg`)}
                                  className="grid h-7 w-7 place-items-center rounded bg-white text-[#171A1D] shadow-sm hover:bg-[#F5F6F8]"
                                  title="下载"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                                <Trigger
                                  trigger={['hover', 'click']}
                                  position="br"
                                  popupVisible={moreMenuModuleId === mod.instanceId}
                                  onVisibleChange={(visible) => setMoreMenuModuleId((current) => visible ? mod.instanceId : current === mod.instanceId ? null : current)}
                                  getPopupContainer={() => document.body}
                                  autoFitPosition
                                  popupHoverStay
                                  clickToClose={false}
                                  containerScrollToClose
                                  popupAlign={{ bottom: 8 }}
                                  style={{ zIndex: 70 }}
                                  popup={() => (
                                    <div role="menu" aria-label={`${mod.title} 更多操作`} className="w-[180px] overflow-hidden rounded-[8px] bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,41,.18)]">
                                      <button type="button" role="menuitem" onClick={() => { setMoreMenuModuleId(null); setResizeTargets([mod.instanceId]) }} className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[6px] border-0 bg-transparent px-3 text-left text-[14px] font-semibold text-[#171A1D] hover:bg-[#F5F6F8]">
                                        <Sparkles className="h-4 w-4 shrink-0" />智能改尺寸
                                      </button>
                                      <button type="button" role="menuitem" onClick={() => handleDeleteSingleModule(mod.instanceId)} className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[6px] border-0 bg-transparent px-3 text-left text-[14px] font-semibold text-[#F04438] hover:bg-[#FFF5F5]">
                                        <Trash2 className="h-4 w-4 shrink-0" />删除
                                      </button>
                                    </div>
                                  )}
                                >
                                  <button type="button" onFocus={() => setMoreMenuModuleId(mod.instanceId)} aria-haspopup="menu" aria-expanded={moreMenuModuleId === mod.instanceId} className={`grid h-7 w-7 place-items-center rounded-[6px] shadow-sm ${moreMenuModuleId === mod.instanceId ? 'bg-[#171A1D] text-white' : 'bg-white text-[#171A1D] hover:bg-[#171A1D] hover:text-white'}`} title="更多操作">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </Trigger>
                              </div>
                              <div className="pointer-events-auto absolute bottom-3 left-3 right-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActionPanel({ mode: 'retouch', moduleId: mod.instanceId, title: mod.title, text: '', direction: '', loading: false })
                                  }
                                  className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#171A1D]/90 text-[12px] font-semibold text-white hover:bg-[#2A2F36]"
                                >
                                  <Wand2 className="h-3.5 w-3.5" />
                                  AI改图
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void openTextEditor(mod.instanceId)}
                                  className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#171A1D]/90 text-[12px] font-semibold text-white hover:bg-[#2A2F36]"
                                >
                                  <Type className="h-3.5 w-3.5" />
                                  编辑文字
                                </button>
                              </div>

                            </div>
                          )}

                          {mod.status === 'failed' && (
                            <span className="absolute inset-x-2 bottom-9 rounded-[4px] bg-[#ffEBEE]/95 px-2 py-1 text-[10px] font-bold text-[#c62828]">
                              {mod.error || '生成失败'}
                            </span>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* 默认态：示例卡（对照旧版 h-444 w-792 rounded-20 + 三产品图/长图/六宫格浮层） */
                <div className="mx-auto flex h-[444px] w-[792px] items-center gap-4 rounded-[20px] bg-white p-6 shadow-[0_18px_40px_rgba(31,37,45,.06)]">
                  <div className="grid h-[396px] w-[123px] shrink-0 grid-rows-3 gap-1.5">
                    {[previewProductFront, previewProductCase, previewProductEarbud].map((src, i) => (
                      <div key={i} className="relative overflow-hidden rounded-[14px] bg-[#dbe4f0]">
                        <img src={src} alt={`产品图 ${i + 1}`} className="h-full w-full object-contain" />
                        {i === 2 && (
                          <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/35 py-1.5 text-center text-[12px] font-semibold text-white">上传产品图</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex h-[396px] w-10 shrink-0 items-center justify-center">
                    <svg className="w-[40px] text-[#c0c4cc]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                  </div>

                  <div className="relative h-[396px] w-[111px] shrink-0 overflow-hidden rounded-[18px] bg-[#dbe4f0]">
                    <img src={previewLongImage} alt="电商详情长图" className="h-full w-full object-contain" />
                    <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/45 py-1.5 text-center text-[12px] font-semibold text-white">生成电商长图</span>
                  </div>

                  <div className="grid h-[396px] w-[420px] shrink-0 grid-cols-2 grid-rows-3 gap-1.5 overflow-hidden rounded-[18px]">
                    {[previewDetailOne, previewDetailFour, previewDetailTwo, previewDetailFive, previewDetailThree, previewDetailSix].map((src, i) => (
                      <div key={i} className="relative overflow-hidden bg-[#dbe4f0]">
                        <img src={src} alt={`详情横幅 ${i + 1}`} className="h-full w-full object-contain" />
                        {i === 5 && (
                          <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/50 py-1.5 text-center text-[12px] font-semibold text-white">符合多电商平台规范</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 右下帮助钮（对照旧版） */}
      <button
        type="button"
        className="absolute bottom-6 right-8 grid h-14 w-14 cursor-pointer place-items-center rounded-full border-0 bg-white text-xl text-[#4e5969] shadow-md"
        title="帮助"
      >
        ?
      </button>

      <ResultActionDialog
        visible={Boolean(actionPanel)}
        title={actionPanel?.mode === 'text' ? '编辑文字' : '输入微调方向（选填）'}
        onClose={() => setActionPanel(null)}
        footer={actionPanel?.mode === 'text' ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setActionPanel(null)} className="h-11 cursor-pointer rounded-[8px] border-0 bg-[#F2F3F5] text-[14px] font-semibold text-[#171A1D] hover:bg-[#E5E6EB]">取消</button>
            <button type="button" onClick={() => void runTextEditor()} disabled={actionPanel.loading || !actionPanel.text.trim()} className="flex h-11 items-center justify-center gap-2 rounded-[8px] border-0 bg-[#8AB6F6] text-[14px] font-semibold text-white hover:bg-[#6EA4F4] disabled:cursor-not-allowed disabled:bg-[#C9CDD4]">
              {actionPanel.loading && <Loader2 className="h-4 w-4 animate-spin" />}确认改字 · 15
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => void runRetouchEditor()} disabled={Boolean(actionPanel?.loading)} className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] border-0 bg-[#171A1D] text-[14px] font-semibold text-white hover:bg-[#2A2F36] disabled:cursor-not-allowed disabled:bg-[#86909C]">
            {actionPanel?.loading && <Loader2 className="h-5 w-5 animate-spin" />}{actionPanel?.loading ? '正在重新生成...' : '重新生成 · 15'}
          </button>
        )}
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
                  <input value={line} onChange={(event) => updateTextLine(index, event.target.value)} placeholder="输入图片文字" className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#171A1D] outline-none placeholder:text-[#AAB2BF]" />
                  <button type="button" onClick={() => removeTextLine(index)} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-[#98A1AF] hover:bg-white hover:text-[#4E5969]" title="删除文字"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )
        ) : (
          <div>
            <textarea value={actionPanel?.direction ?? ''} onChange={(event) => setActionPanel((prev) => prev ? { ...prev, direction: event.target.value } : prev)} placeholder={'输入调整要求（选填，空着将默认重绘）。\n如：商品向左移动一点，换成浅灰色背景...'} className="h-[175px] w-full resize-none rounded-[8px] border border-[#E5E8EF] bg-white p-3 text-[14px] leading-[22px] text-[#171A1D] outline-none placeholder:text-[#AAB2BF] focus:border-[#86909C]" />
            <p className="mb-0 mt-3 text-[12px] text-[#86909C]">重新生成将消耗 15 点。</p>
          </div>
        )}
      </ResultActionDialog>

      {/* 智能改尺寸选项面板（D7/M14：选尺寸 → AI生成中 → 完成） */}
      <ImageResizeDialog
        visible={Boolean(resizeTargets)}
        batch={Boolean(resizeTargets && resizeTargets.length > 1)}
        ratio={resizeRatio}
        onRatioChange={setResizeRatio}
        onClose={() => setResizeTargets(null)}
        onConfirm={confirmResize}
      />

      {/* 单张图片与商品主图使用相同的深色预览；长图保留白底滚动预览。 */}
      {previewImage?.kind === 'single' && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center bg-black/75 p-6" onClick={() => setPreviewImage(null)}>
          <div className="flex w-full max-w-[920px] items-center justify-between pb-4 text-white" onClick={(event) => event.stopPropagation()}>
            <h2 className="m-0 text-[16px] font-bold">{previewImage.title}</h2>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => void handleDownloadImage(previewImage.url, `${previewImage.title}.jpg`)} className="flex h-11 items-center gap-2 rounded-full border-0 bg-white px-5 text-[13px] font-semibold text-[#0A1B39] hover:bg-[#F5F6F8]">
                <Download className="h-4 w-4" />保存到本地
              </button>
              <button type="button" onClick={() => setPreviewImage(null)} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/20 text-white hover:bg-white/30" title="关闭预览">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 w-full flex-1 items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <img src={previewImage.url} alt={previewImage.title} className="max-h-full max-w-[920px] rounded-[8px] object-contain" />
          </div>
        </div>
      )}
      {previewImage?.kind === 'long' && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 sm:p-8" onClick={() => setPreviewImage(null)}>
          <section role="dialog" aria-modal="true" aria-label={`预览${previewImage.title}`} className="flex h-[88vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[12px] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-[#EEF0F3] px-6">
              <h2 className="m-0 truncate text-[18px] font-semibold text-[#171A1D]">生成结果 {previewImage.openedAt.toLocaleString('zh-CN', { hour12: false })}</h2>
              <div className="flex shrink-0 items-center gap-3">
                <button type="button" onClick={() => void handleDownloadLongImageFromPreview()} className="flex h-10 items-center gap-2 rounded-[8px] bg-[#F5F6F8] px-4 text-[13px] font-semibold text-[#171A1D] hover:bg-[#E9EBEF]"><Download className="h-4 w-4" />下载长图</button>
                <button type="button" onClick={handleDownloadAllFromPreview} className="flex h-10 items-center gap-2 rounded-[8px] bg-[#F5F6F8] px-4 text-[13px] font-semibold text-[#171A1D] hover:bg-[#E9EBEF]"><Download className="h-4 w-4" />下载全部图片</button>
                <button type="button" onClick={() => setPreviewImage(null)} className="grid h-10 w-10 place-items-center rounded-[8px] text-[#98A2B3] hover:bg-[#F5F6F8]" title="关闭预览"><X className="h-5 w-5" /></button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-auto bg-white p-6 text-center">
              <img src={previewImage.url} alt={previewImage.title} className="mx-auto block max-w-full object-contain" />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
