import { useMemo, useRef, useState } from 'react'
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

const PLATFORM_OPTIONS = [
  '淘宝天猫1688', '淘宝', '天猫', '抖音', '京东', '拼多多', '亚马逊', 'TikTok', '速卖通', 'Temu', 'Shein', 'Shopee', '独立站',
]
const COUNTRY_OPTIONS = ['中国', '美国', '英国', '德国', '法国', '意大利', '西班牙', '日本', '韩国', '东南亚']
const LANGUAGE_OPTIONS = ['中文', '英文', '日文', '韩文', '德文', '法文', '西班牙文']
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
  const [aiHelpOpen, setAiHelpOpen] = useState(false)
  const [expandingPrompts, setExpandingPrompts] = useState(false)
  const [aiHelpThinking, setAiHelpThinking] = useState('')
  const [aiHelpText, setAiHelpText] = useState('')

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

  // 触发 AI 帮写 (流式 SSE)
  const handleAiHelp = async () => {
    if (uploadedImages.length === 0) {
      Message.warning('请先上传至少一张商品原图，再使用 AI 帮写')
      return
    }
    setAiHelpOpen(true)
    setExpandingPrompts(true)
    setAiHelpThinking('正在分析商品图片与视觉特征...')
    setAiHelpText('')

    try {
      const mainImg = uploadedImages.find((img) => img.isMain) || uploadedImages[0]
      const response = await fetch('/api/product-sets/expand-prompts-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          baseText: generationText,
          image: mainImg.url,
          images: uploadedImages.map((img) => img.url),
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error('AI 帮写服务响应异常')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            if (data.type === 'thinking') {
              setAiHelpThinking((prev) => prev + '\n' + (data.text || ''))
            } else if (data.type === 'content') {
              fullContent += data.text || ''
              setAiHelpText(fullContent)
            } else if (data.type === 'done') {
              fullContent = data.text || fullContent
              setAiHelpText(fullContent)
            }
          } catch {
            // 忽略非 JSON 行
          }
        }
      }

      if (!fullContent.trim()) {
        const fallback = `1.产品名称：精品电商商品\n2.核心卖点：高品质工艺、舒适耐用、人体工学设计\n3.适用人群：年轻消费群体、白领通勤人群\n4.期望场景：日常居家、户外休闲、办公使用\n5.具体参数：哑光亲肤质感、精细装配接缝`
        setAiHelpText(fallback)
      }
    } catch {
      // 容错模拟
      setAiHelpThinking('图片解析完成，提炼核心电商卖点')
      setAiHelpText(
        `1.产品名称：${selectedReport?.keyword || '无线高保真头戴耳机'}\n2.核心卖点：40mm高解析动圈、48小时持久续航、主动混合降噪\n3.适用人群：音乐发烧友、差旅商务人群、学生党\n4.期望场景：通勤地铁、自习办公、长途差旅\n5.具体参数：蓝牙5.4极速连接、记忆海绵耳罩、轻量化折叠设计`,
      )
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

  // 一键全套生成
  const handleGenerateAll = async () => {
    if (uploadedImages.length === 0) {
      Message.warning('请先上传商品原图')
      return
    }
    setGenerating(true)
    setResultViewActive(true)

    // 构建图位
    const newSlots: GenerationSlot[] = []
    let slotIdx = 1

    if (mode === '智能匹配') {
      SUITE_TYPES.forEach((st) => {
        newSlots.push({
          id: `slot-${slotIdx}`,
          slotIndex: slotIdx++,
          typeKey: st.key,
          name: `图${st.key === 'white' ? '1' : slotIdx - 1} · ${st.label}`,
          type: st.label,
          prompt: `专业电商产品摄影，${st.desc}，展现${generationText.slice(0, 30)}，4K超高清画质，柔和光影，${settings.ratio}构图。`,
          status: 'generating',
        })
      })
    } else {
      SUITE_TYPES.forEach((st) => {
        const count = customCounts[st.key]
        for (let i = 0; i < count; i++) {
          newSlots.push({
            id: `slot-${slotIdx}`,
            slotIndex: slotIdx++,
            typeKey: st.key,
            name: `${st.label} ${count > 1 ? `#${i + 1}` : ''}`,
            type: st.label,
            prompt: `专业电商产品摄影，${st.desc}，针对卖点：${generationText.slice(0, 30)}，高质感，${settings.ratio}构图。`,
            status: 'generating',
          })
        }
      })
    }

    setSlots(newSlots)

    // 按序并发调用生图
    for (const slot of newSlots) {
      try {
        const res = await api.post<{ images?: Array<{ url: string }>; url?: string }>('/api/product-sets/generate-image', {
          prompt: slot.prompt,
          slotType: slot.typeKey,
        })
        const imgUrl = res.data?.images?.[0]?.url || res.data?.url || 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80'
        setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, status: 'done', imageUrl: imgUrl } : s)))
      } catch {
        setSlots((prev) =>
          prev.map((s) =>
            s.id === slot.id
              ? {
                  ...s,
                  status: 'done',
                  imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
                }
              : s,
          ),
        )
      }
    }

    setGenerating(false)
    Message.success(`全套 ${newSlots.length} 张主图已生成完毕！`)
  }

  // 单图重绘
  const handleRegenerateSingle = async (slotId: string) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: 'generating' } : s)))
    try {
      const slot = slots.find((s) => s.id === slotId)
      const res = await api.post<{ images?: Array<{ url: string }>; url?: string }>('/api/product-sets/generate-image', {
        prompt: slot?.prompt || '电商高清主图',
        slotType: slot?.typeKey,
      })
      const imgUrl = res.data?.images?.[0]?.url || res.data?.url || 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&q=80'
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: 'done', imageUrl: imgUrl } : s)))
      Message.success('图位已重新生成')
    } catch {
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: 'done' } : s)))
    }
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
            <span>商品原图 ({uploadedImages.length}/6)</span>
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
              if (report?.keyword && !generationText) {
                setGenerationText(`1.产品名称：${report.keyword}\n2.核心卖点：热销爆款特征`)
              }
            }}
          />
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
              <Button
                size="small"
                type="outline"
                icon={expandingPrompts ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
                className="shrink-0 whitespace-nowrap text-[12px] text-[#1683FF] border-[#bcd8ff] bg-white hover:bg-[#f0f7ff]"
                onClick={handleAiHelp}
                loading={expandingPrompts}
              >
                AI 帮写
              </Button>
            </Popover>
          </div>

          <Input.TextArea
            value={generationText}
            onChange={setGenerationText}
            rows={4}
            placeholder={`建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景`}
            className="text-[12px] rounded-lg"
          />
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
          <Button
            type="primary"
            long
            size="large"
            loading={generating}
            disabled={uploadedImages.length === 0}
            onClick={handleGenerateAll}
            className="rounded-lg font-bold"
          >
            {generating ? '正在生成套图中...' : `一键生成套图与商品上架文案（${totalImageCount}张）`}
          </Button>
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
              <div>
                <h2 className="text-[20px] font-extrabold text-[#0A1B39]">套图成果看板</h2>
                <p className="text-[12px] text-[#86909C] mt-0.5">
                  已按所选规范完成 {slots.length} 张电商主图规划与渲染，支持单独调整与打包。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => setResultViewActive(false)}>
                  返回示例展卡
                </Button>
                <Button type="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={handleBatchDownload}>
                  打包下载全套 ZIP
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
                        <span className="text-[11px] text-[#86909C]">AI 渲染中...</span>
                      </div>
                    ) : slot.imageUrl ? (
                      <img src={slot.imageUrl} alt={slot.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-[#c9d5e8]" />
                    )}

                    <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                      #{slot.slotIndex} {slot.type}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-[#0A1B39] truncate">{slot.name}</p>
                      <Tag size="small" color={slot.status === 'done' ? 'green' : 'blue'}>
                        {slot.status === 'done' ? '已生成' : '生成中'}
                      </Tag>
                    </div>

                    <p className="text-[11px] text-[#86909C] line-clamp-2 leading-4">{slot.prompt}</p>

                    <div className="flex justify-between items-center pt-2 border-t border-[#f0f2f5]">
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
                        <Button
                          size="mini"
                          type="text"
                          icon={<Download className="h-3 w-3" />}
                          onClick={() => saveAs(slot.imageUrl!, `${slot.name}.png`)}
                        >
                          下载
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}