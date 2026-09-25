import { useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Download, Eye, Loader2, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { Button, Input, Message, Modal, Select } from '@arco-design/web-react'
import { saveAs } from 'file-saver'
import { nanoid } from 'nanoid'
import { useAuth } from '../store/auth'
import { AIReportSelector, type SuiteProduct } from '../components/AIReportSelector'
import { ProductImageHelpTooltip } from '../components/ProductImageHelpTooltip'
import mainHeadphone from '../assets/main-headphone.png'
import sceneDisplay from '../assets/scene-display.png'
import sellingPoint from '../assets/selling-point.png'
import detailExplain from '../assets/detail-explain.png'
import modelScene from '../assets/model-scene.png'

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
  const [uploadedImages, setUploadedImages] = useState<UploadedProductImage[]>([])
  const [error, setError] = useState('')

  // 联动报告
  const [selectedReportId, setSelectedReportId] = useState('')
  const [currentReport, setCurrentReport] = useState<SuiteProduct | null>(null)

  // 生成设置（对照旧版 settings 四项）
  const [settings, setSettings] = useState({ platform: '淘宝天猫1688', country: '中国', language: '中文', ratio: '1:1' })

  // 商品卖点 & 要求 + AI 帮写
  const [detailGenerationText, setDetailGenerationText] = useState('')
  const [aiWriting, setAiWriting] = useState(false)

  // 双步工作流
  const [step, setStep] = useState<'form' | 'strategy'>('form')
  const [strategyExpanded, setStrategyExpanded] = useState(false)

  // 模块（勾选集合对照旧版 checked 初始值）
  const [checked, setChecked] = useState<string[]>([...DEFAULT_CHECKED])
  const [selectedModules, setSelectedModules] = useState<SelectedModuleItem[]>([])
  const [orderedTitles, setOrderedTitles] = useState<string[]>([])

  const [batchGenerating, setBatchGenerating] = useState(false)
  const [strategyStatus, setStrategyStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle')
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null)
  const [composingLongImage, setComposingLongImage] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [actionPanel, setActionPanel] = useState<ModuleActionPanel | null>(null)

  const checkedModules = MODULES.filter((m) => checked.includes(m.title))
  const strategyModuleCount = checkedModules.length

  const handleUploadFiles = (files: FileList | null) => {
    const selectedFiles = Array.from(files || [])
    if (!selectedFiles.length) return
    const availableSlots = 6 - uploadedImages.length
    if (availableSlots <= 0) {
      setError('同一产品最多上传 6 张图片')
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
    filesToRead.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          setUploadedImages((prev) => [...prev, { id: nanoid(8), url: e.target!.result as string }].slice(0, 6))
        }
      }
      reader.readAsDataURL(file)
    })
    // 上传后重置生成结果与规划（对照旧版联动）
    setError(selectedFiles.length > availableSlots ? '同一产品最多上传 6 张图片，已保留前 6 张。' : '')
    setSelectedModules([])
    setOrderedTitles([])
    setStrategyStatus('idle')
    setStep('form')
  }

  const removeUploadedImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id))
    // 删图后重置生成结果与规划（对照旧版联动）
    setSelectedModules([])
    setOrderedTitles([])
    setStrategyStatus('idle')
    setStep('form')
    setError('')
  }

  const handleReportChange = (reportId: string, report: SuiteProduct | null) => {
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
    setAiWriting(true)
    try {
      let fullText = ''
      const unsub = window.desktop?.capabilities.onStream((event) => {
        if (event.type === 'content') {
          fullText += event.text || event.data?.content || ''
          setDetailGenerationText(fullText)
        } else if (event.type === 'done') {
          fullText = String(event.text ?? fullText)
          setDetailGenerationText(fullText)
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
      setDetailGenerationText(fullText)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setAiWriting(false)
    }
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
    setError('')
    setStrategyStatus('generating')
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
        // 后端 normalizeDetailModuleType 仅识别中文模块名（DETAIL_MODULE_ORDER），故传 title 而非英文 key
        promptSlots: checkedModules.map((m) => m.title),
      }) as { data?: Array<{ type: string; prompt: string; name?: string }> } | undefined

      const returnedItems = data?.data || []
      const prompts = returnedItems.filter((p) => p.type && p.prompt)
      if (prompts.length < checkedModules.length) throw new Error('详情图提示词返回不完整，请重试。')
      const byTitle = new Map(prompts.map((p) => [p.type, p.prompt]))
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
      setStep('strategy')
      setStrategyExpanded(true)
    } catch (err) {
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

  const generateModuleWithPrompt = async (instanceId: string, prompt: string, referenceImages: string[]) => {
    const target = selectedModules.find((item) => item.instanceId === instanceId)
    if (!target) return
    setActionPanel(null)
    setSelectedModules((prev) =>
      prev.map((item) => (item.instanceId === instanceId ? { ...item, status: 'generating', error: undefined } : item)),
    )
    try {
      const data = await desktopInvoke('image.generate', {
        userId: currentUserId,
        tenantId: 'local',
        prompt,
        size: '2K',
        name: target.title,
        slotType: target.title,
        image: referenceImages[0],
        images: referenceImages.slice(0, 4),
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

  const openTextEditor = async (moduleId: string) => {
    const target = selectedModules.find((item) => item.instanceId === moduleId)
    if (!target?.imageUrl) {
      Message.warning('请先生成图片，再编辑文字')
      return
    }
    setActionPanel({ mode: 'text', moduleId, title: target.title, text: '', direction: '', loading: true })
    try {
      const data = await desktopInvoke('productSets.extractImageText', { userId: currentUserId, imageUrl: target.imageUrl }) as { text?: string } | undefined
      setActionPanel((prev) => (prev ? { ...prev, text: data?.text ?? '', loading: false } : prev))
    } catch (err) {
      setActionPanel(null)
      Message.error(err instanceof Error ? err.message : '读取图片文字失败')
    }
  }

  const runTextEditor = async () => {
    if (!actionPanel?.text.trim()) return
    const target = selectedModules.find((item) => item.instanceId === actionPanel.moduleId)
    if (!target?.imageUrl) return
    await generateModuleWithPrompt(
      actionPanel.moduleId,
      `保留详情图版式和商品主体，仅更新图片文字内容。新文字：${actionPanel.text.trim()}`,
      [target.imageUrl],
    )
  }

  const runRetouchEditor = async () => {
    if (!actionPanel?.direction.trim()) return
    const target = selectedModules.find((item) => item.instanceId === actionPanel.moduleId)
    if (!target?.imageUrl) return
    setActionPanel((prev) => (prev ? { ...prev, loading: true } : prev))
    try {
      const data = await desktopInvoke('productSets.generateRetouchPrompt', {
        userId: currentUserId,
        settings,
        slot: { id: target.instanceId, name: target.title, type: target.title },
        originalPrompt: target.prompt,
        userDirection: actionPanel.direction.trim(),
      }) as { prompt?: string } | undefined
      const retouchPrompt = data?.prompt?.trim()
      if (!retouchPrompt) throw new Error('AI改图提示词为空，请重试')
      await generateModuleWithPrompt(actionPanel.moduleId, retouchPrompt, [target.imageUrl])
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

  const handleDownloadImage = (url: string, filename = 'detail-image.png') => {
    saveAs(url, filename)
    Message.success('已下载')
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
      setPreviewModalUrl(dataUrl)
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '长图合成失败')
    } finally {
      setComposingLongImage(false)
    }
  }

  const strategyModules = orderedTitles.length
    ? (orderedTitles.map((title) => selectedModules.find((m) => m.title === title)).filter(Boolean) as SelectedModuleItem[])
    : selectedModules

  const hasResults = selectedModules.some((m) => m.status !== 'idle')

  return (
    <div className="relative flex h-full bg-[#F2F4F7]">
      {/* ===================== 左侧 360px 配置面板（对照旧版 form/strategy 双步） ===================== */}
      <div className="h-full w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pt-5 pb-4 custom-scrollbar">
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
                <div className="grid grid-cols-3 gap-3">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="group relative h-[82px] overflow-hidden rounded-lg bg-[#F2F3F5]">
                      <img src={img.url} alt="" className="h-full w-full object-contain p-1" />
                      <button
                        type="button"
                        onClick={() => removeUploadedImage(img.id)}
                        className="absolute right-1 top-1 grid h-5 w-5 cursor-pointer place-items-center rounded-full border-0 bg-white/90 text-[#c62828] opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="删除图片"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {uploadedImages.length < 6 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="grid h-[82px] cursor-pointer place-items-center rounded-lg bg-[#F2F3F5] text-[#171A1D] transition-colors hover:bg-[#ECEFF4]"
                      aria-label="继续上传商品图"
                    >
                      <Plus className="h-6 w-6" />
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

            {/* 商品卖点&要求 + AI 帮写胶囊（对照旧版） */}
            <div className="mb-2 flex items-center justify-between">
              <h2 className="m-0 text-[14px] font-bold text-[#171A1D]">
                商品卖点&要求 <span className="cursor-help text-[13px] text-[#86909C]" title="填写产品名、卖点、人群和场景，AI 生图更精准">?</span>
              </h2>
              <button
                type="button"
                onClick={() => void handleAiHelp()}
                disabled={aiWriting || !uploadedImages.length}
                className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiWriting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiWriting ? '帮写中' : 'AI 帮写'}
              </button>
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
        ) : (
          <>
            {/* 详情页规划（对照旧版折叠卡） */}
            <div className="mb-4 rounded-xl border border-[#e5e8ef] bg-white p-3">
              <h2 className="m-0 mb-2 text-[14px] font-bold text-[#171A1D]">详情页规划</h2>
              <div className={`overflow-hidden text-[12px] leading-5 text-[#5F6B7A] transition-all ${strategyExpanded ? '' : 'max-h-[112px]'}`}>
                {strategyModules.map((m) => `${m.title}：${m.prompt}`).join('\n')}
              </div>
              <button
                type="button"
                onClick={() => setStrategyExpanded((v) => !v)}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 border-0 bg-transparent p-0 text-[12px] font-bold text-[#3388ff]"
              >
                {strategyExpanded ? '收起' : '展开全部'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${strategyExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* 模块提示词（对照旧版列表，支持排序） */}
            <div className="mb-2 flex items-center justify-between">
              <h2 className="m-0 text-[14px] font-bold text-[#171A1D]">模块提示词</h2>
              <span className="text-[12px] text-[#86909C]">{strategyModules.length} 个模块</span>
            </div>
            <div className="space-y-3">
              {strategyModules.map((mod, index) => (
                <div key={mod.instanceId} className="rounded-lg bg-[#F5F6F8] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-bold text-[#171A1D]">
                      #{index + 1} {mod.title}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOrderedTitles((prev) => {
                            const titles = prev.length ? [...prev] : strategyModules.map((m) => m.title)
                            const i = titles.indexOf(mod.title)
                            if (i <= 0) return prev
                            ;[titles[i - 1], titles[i]] = [titles[i], titles[i - 1]]
                            return titles
                          })
                        }}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-[#86909C] hover:bg-white"
                        title="上移"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrderedTitles((prev) => {
                            const titles = prev.length ? [...prev] : strategyModules.map((m) => m.title)
                            const i = titles.indexOf(mod.title)
                            if (i < 0 || i >= titles.length - 1) return prev
                            ;[titles[i + 1], titles[i]] = [titles[i], titles[i + 1]]
                            return titles
                          })
                        }}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-[#86909C] hover:bg-white"
                        title="下移"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModules((prev) => prev.filter((m) => m.instanceId !== mod.instanceId))
                          setOrderedTitles((prev) => prev.filter((t) => t !== mod.title))
                        }}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-[#c62828] hover:bg-white"
                        title="移除"
                      >
                        <X className="h-3.5 w-3.5" />
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
                    rows={3}
                    placeholder="暂无提示词，请返回上一步重新生成。"
                    className="w-full resize-none rounded-lg border border-[#e5e8ef] bg-white p-2 text-[12px] leading-5 text-[#344054] outline-none focus:border-[#3388ff]"
                  />
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

        {/* 吸底操作条（对照旧版：form 步深色全宽三态文案 / strategy 步上一步+生成详情图） */}
        <div className="sticky bottom-0 -mx-5 mt-4 border-t border-[#EEF1F5] bg-white p-4">
          {step === 'strategy' ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={batchGenerating}
                className="h-10 w-[96px] shrink-0 cursor-pointer rounded-lg border-0 bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#E8EAED] disabled:opacity-60"
              >
                上一步
              </button>
              <button
                type="button"
                onClick={handleBatchGenerateAll}
                disabled={batchGenerating || strategyStatus !== 'ready' || !uploadedImages.length}
                className={`h-10 flex-1 cursor-pointer rounded-lg border-0 text-[13px] font-semibold text-white transition-colors ${
                  strategyStatus === 'ready' && uploadedImages.length && !batchGenerating
                    ? 'bg-[#171A1D] hover:bg-[#2A2F36]'
                    : 'bg-[#C4C6CA]'
                } disabled:cursor-not-allowed`}
              >
                {batchGenerating ? '正在生成...' : `生成详情图（${strategyModuleCount}张）`}
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
                <div className="text-left">
                  <div className="mb-5 flex items-center justify-between border-b border-[#e5e8ef] pb-4">
                    <h2 className="m-0 text-[20px] font-extrabold text-[#171A1D]">生成结果：</h2>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const selectable = selectedModules.filter((m) => m.imageUrl)
                          setSelectedImageIds((prev) =>
                            selectable.length && prev.length === selectable.length ? [] : selectable.map((m) => m.instanceId),
                          )
                        }}
                        className="flex items-center gap-2 text-[13px] font-medium text-[#5F6B7A] transition-colors hover:text-[#171A1D]"
                      >
                        <span
                          className={`grid h-4 w-4 place-items-center rounded-[4px] border ${
                            selectedImageIds.length === selectedModules.filter((m) => m.imageUrl).length && selectedImageIds.length
                              ? 'border-[#171A1D] bg-[#171A1D] text-white'
                              : 'border-[#171A1D] bg-white text-transparent'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        全选
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePreviewLongImage()}
                        disabled={!strategyModules.some((m) => m.imageUrl) || composingLongImage}
                        className="flex h-9 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-[#171A1D] shadow-[0_1px_0_rgba(15,23,41,.06)] transition-colors hover:bg-[#F5F6F8] disabled:cursor-not-allowed disabled:text-[#A0A7B2]"
                      >
                        {composingLongImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        预览长图
                      </button>
                      {selectedImageIds.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const done = selectedModules.filter((m) => selectedImageIds.includes(m.instanceId) && m.imageUrl)
                              if (!done.length) return
                              done.forEach((m, idx) =>
                                setTimeout(() => handleDownloadImage(m.imageUrl!, `${idx + 1}_${m.title}.png`), idx * 300),
                              )
                            }}
                            className="flex h-9 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-[#171A1D] shadow-[0_1px_0_rgba(15,23,41,.06)] transition-colors hover:bg-[#F5F6F8]"
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
                            className="flex h-9 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-[#171A1D] shadow-[0_1px_0_rgba(15,23,41,.06)] transition-colors hover:bg-[#F5F6F8]"
                          >
                            <Trash2 className="h-4 w-4" />
                            批量删除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {/* 首位原图格（对照旧版） */}
                    <div className="relative aspect-square overflow-hidden rounded-[8px] bg-white">
                      <img src={uploadedImages[0]?.url || ''} alt="原图" className="h-full w-full object-contain" />
                      <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-[6px] bg-black/35 px-2 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-[2px]">
                        原图
                      </span>
                    </div>
                    {selectedModules.map((mod, index) => (
                      <div key={mod.instanceId} className="overflow-hidden rounded-xl border border-[#e5eaf2] bg-white shadow-sm">
                        <div className="relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[#f4f7fb]">
                          {mod.status === 'generating' ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-6 w-6 animate-spin text-[#3388ff]" />
                              <span className="text-[11px] text-[#86909C]">AI生成中...</span>
                            </div>
                          ) : mod.imageUrl ? (
                            <img src={mod.imageUrl} alt={mod.title} className="h-full w-full cursor-zoom-in object-cover" onClick={() => setPreviewModalUrl(mod.imageUrl!)} />
                          ) : (
                            <div className="text-center">
                              <Eye className="mx-auto mb-1 h-8 w-8 text-[#c9d5e8]" />
                              <span className="text-[11px] text-[#86909C]">等待生成</span>
                            </div>
                          )}
                          <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                            #{index + 1} {mod.title}
                          </span>
                          {mod.status === 'failed' && (
                            <span className="absolute inset-x-2 bottom-2 rounded bg-[#ffEBEE]/95 px-2 py-1 text-[10px] font-bold text-[#c62828]">
                              {mod.error || '生成失败'}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2 p-3.5 pt-0">
                          <p className="m-0 line-clamp-2 text-[11px] leading-4 text-[#86909C]">{mod.prompt}</p>
                          <div className="flex flex-wrap gap-1 border-t border-[#f0f2f5] pt-2">
                            <Button size="mini" type="text" loading={mod.status === 'generating'} onClick={() => generateSingleModuleImage(mod.instanceId)}>
                              单独渲染
                            </Button>
                            {mod.imageUrl && (
                              <>
                                <Button size="mini" type="text" onClick={() => void openTextEditor(mod.instanceId)}>
                                  编辑文字
                                </Button>
                                <Button
                                  size="mini"
                                  type="text"
                                  onClick={() =>
                                    setActionPanel({ mode: 'retouch', moduleId: mod.instanceId, title: mod.title, text: '', direction: '', loading: false })
                                  }
                                >
                                  AI改图
                                </Button>
                                <Button size="mini" type="text" icon={<Download className="h-3 w-3" />} onClick={() => handleDownloadImage(mod.imageUrl!, `${index + 1}_${mod.title}.png`)}>
                                  下载
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* 默认态：示例卡（对照旧版 h-444 w-792 rounded-20 + 三产品图/长图/六宫格浮层） */
                <div className="mx-auto flex h-[444px] w-[792px] items-center gap-4 rounded-[20px] bg-white p-6 shadow-[0_18px_40px_rgba(31,37,45,.06)]">
                  <div className="grid h-[396px] w-[123px] shrink-0 grid-rows-3 gap-1.5">
                    {[mainHeadphone, sceneDisplay, sellingPoint].map((src, i) => (
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
                    <img src={modelScene} alt="电商详情长图" className="h-full w-full object-contain" />
                    <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/45 py-1.5 text-center text-[12px] font-semibold text-white">生成电商长图</span>
                  </div>

                  <div className="grid h-[396px] w-[420px] shrink-0 grid-cols-2 grid-rows-3 gap-1.5 overflow-hidden rounded-[18px]">
                    {[detailExplain, sellingPoint, sceneDisplay, modelScene, mainHeadphone, detailExplain].map((src, i) => (
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

      <Modal
        title={actionPanel?.mode === 'text' ? `编辑文字 · ${actionPanel?.title ?? ''}` : `AI改图 · ${actionPanel?.title ?? ''}`}
        visible={Boolean(actionPanel)}
        onCancel={() => setActionPanel(null)}
        onOk={() => void (actionPanel?.mode === 'text' ? runTextEditor() : runRetouchEditor())}
        confirmLoading={actionPanel?.loading}
        okButtonProps={{ disabled: !actionPanel || (actionPanel.mode === 'text' ? !actionPanel.text.trim() : !actionPanel.direction.trim()) }}
      >
        {actionPanel?.mode === 'text' ? (
          <Input.TextArea
            value={actionPanel.text}
            onChange={(value) => setActionPanel((prev) => (prev ? { ...prev, text: value } : prev))}
            rows={5}
            placeholder="输入替换后的详情图文字"
          />
        ) : (
          <Input.TextArea
            value={actionPanel?.direction ?? ''}
            onChange={(value) => setActionPanel((prev) => (prev ? { ...prev, direction: value } : prev))}
            rows={5}
            placeholder="描述需要调整的画面、背景、文字或风格"
          />
        )}
      </Modal>

      {/* 大图预览 */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70" onClick={() => setPreviewModalUrl(null)}>
          <div className="relative max-h-[88vh] max-w-[88vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex max-h-[88vh] max-w-[88vw] flex-col items-end gap-2">
              <img src={previewModalUrl} alt="预览" className="max-h-[82vh] max-w-[88vw] rounded-lg object-contain" />
              <div className="flex items-center gap-2">
                <Button
                  type="primary"
                  size="small"
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={() => handleDownloadImage(previewModalUrl, 'detail-long-image.png')}
                >
                  下载长图
                </Button>
                <Button size="small" onClick={() => setPreviewModalUrl(null)}>
                  关闭
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
              className="absolute -right-10 top-0 grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-white/90 text-[#0A1B39]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
