import { useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, Download, Link2, Loader2, Play, Plus, Sparkles, Upload, X } from 'lucide-react'
import { Button, Message, Modal, Select } from '@arco-design/web-react'
import { SectionTitle } from '../components/AIReportSelector'
import { api } from '../api/client'
import { nanoid } from 'nanoid'

// 8 种类型封面图
import imgUgc from '../assets/video-types/image-11.png'
import imgDrama from '../assets/video-types/image-26.png'
import imgOral from '../assets/video-types/image-27.png'
import imgDemo from '../assets/video-types/image-13.png'
import imgUnbox from '../assets/video-types/image-9.png'
import imgScene from '../assets/video-types/image-10.png'
import imgCompare from '../assets/video-types/image-12.png'
import imgTutorial from '../assets/video-types/image-1.png'

const Option = Select.Option

interface VideoTypeCard {
  id: string
  label: string
  desc: string
  image: string
}

const VIDEO_TYPES: VideoTypeCard[] = [
  { id: 'ugc', label: 'UGC 种草', desc: '用户视角真实分享', image: imgUgc },
  { id: 'drama', label: '带货短剧', desc: '微短剧反转剧情', image: imgDrama },
  { id: 'oral', label: '产品口播', desc: '达人正脸讲解', image: imgOral },
  { id: 'demo', label: '产品演示', desc: '核心功能实操', image: imgDemo },
  { id: 'unbox', label: '开箱测评', desc: '真实拆箱仪式感', image: imgUnbox },
  { id: 'scene', label: '场景种草', desc: '生活场景融入', image: imgScene },
  { id: 'compare', label: '对比评测', desc: '竞品实测对比', image: imgCompare },
  { id: 'tutorial', label: '教程视频', desc: '新手上手攻略', image: imgTutorial },
]

const MARKETS = ['北美市场', '欧洲市场', '东南亚市场', '日韩市场', '中东市场', '拉美市场', '澳洲市场', '全球通用']
const LANGUAGES = ['英语', '中文', '日语', '韩语', '德语', '法语', '西班牙语', '葡萄牙语', '阿拉伯语', '泰语', '越南语']
const RATIOS = [
  { label: 'TikTok / Reels · 9:16', value: '9:16' },
  { label: '小红书笔记 · 3:4', value: '3:4' },
  { label: '淘宝/天猫主图 · 1:1', value: '1:1' },
  { label: 'YouTube / 亚马逊 · 16:9', value: '16:9' },
]
const GEN_STEPS = ['卖点分析', '脚本生成', '画面渲染', '音频对齐']

interface GeneratedVideoItem {
  id: string
  title: string
  type: string
  ratio: string
  duration: string
  coverUrl: string
  videoUrl: string
  fissionIndex: number
  scriptSummary: string
  createTime: string
}

export function ViralVideoReplicationPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'replicate'>('generate')

  // 表单状态（业务逻辑保持桌面端现状）
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['ugc'])
  const [market, setMarket] = useState('北美市场')
  const [language, setLanguage] = useState('英语')
  const [ratio, setRatio] = useState('9:16')
  const [sellingPoints, setSellingPoints] = useState(
    '1. 航空铝合金高刚性机身，轻薄亲肤佩戴\n2. 智能 AI 睡眠与心率全天候精准追踪\n3. 5ATM 深度防水，强劲续航达 14 天',
  )
  const [replicateUrl, setReplicateUrl] = useState('')
  const [fissionCount, setFissionCount] = useState(2)
  const [productImage, setProductImage] = useState<string>(
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
  )
  const [mode, setMode] = useState<'type' | 'script'>('type')
  const [authorized, setAuthorized] = useState(false)
  const [scriptText, setScriptText] = useState('')
  const [aiWriting, setAiWriting] = useState(false)

  // 生成状态
  const [generating, setGenerating] = useState(false)
  const [generateStep, setGenerateStep] = useState(0)
  const [results, setResults] = useState<GeneratedVideoItem[]>([])
  const [previewVideo, setPreviewVideo] = useState<GeneratedVideoItem | null>(null)

  const productInputRef = useRef<HTMLInputElement | null>(null)

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((t) => t !== id) : prev) : [...prev, id],
    )
  }

  // AI 帮写（旧版胶囊按钮；桌面端本地模板起步）
  const handleAiHelp = async () => {
    setAiWriting(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (!sellingPoints.trim()) setSellingPoints('1.\n2.\n3.')
    } finally {
      setAiWriting(false)
    }
  }

  // 上传产品图（真实文件选择 + FileReader 预览）
  const handleProductUpload = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) setProductImage(e.target.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 启动生成/复刻（数据流保持桌面端现状：/api/videos/replicate + 步骤动画）
  const handleStart = async () => {
    setGenerating(true)
    setGenerateStep(0)

    try {
      await api
        .post('/api/videos/replicate', {
          sourceUrl: replicateUrl || 'https://www.tiktok.com/demo-hot-video',
          title: activeTab === 'generate' ? `原创爆款视频 (${selectedTypes.join(',')})` : '竞品爆款复刻视频',
        })
        .catch(() => undefined)
    } catch {
      // ignore
    }

    const s1 = setTimeout(() => setGenerateStep(1), 1000)
    const s2 = setTimeout(() => setGenerateStep(2), 2200)
    const s3 = setTimeout(() => setGenerateStep(3), 3600)
    const s4 = setTimeout(() => {
      setGenerateStep(4)
      setGenerating(false)

      const activeTypeName = VIDEO_TYPES.find((t) => t.id === selectedTypes[0])?.label || 'UGC 种草'
      const generatedList: GeneratedVideoItem[] = Array.from({ length: fissionCount }).map((_, i) => ({
        id: `vid_${nanoid(8)}_${i + 1}`,
        title: `${activeTypeName} · 变体裂变 #${i + 1} (${market}定制)`,
        type: activeTypeName,
        ratio,
        duration: ratio === '9:16' ? '0:35' : '1:00',
        coverUrl: VIDEO_TYPES.find((t) => t.id === selectedTypes[i % selectedTypes.length])?.image || imgUgc,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        fissionIndex: i + 1,
        scriptSummary: `【分镜1】前3秒视觉冲突：痛点暴击与特写展示\n【分镜2】核心功能演示：${sellingPoints.split('\n')[0] || '核心卖点'}\n【分镜3】行动号召 CTA：限时折扣抢购`,
        createTime: new Date().toLocaleTimeString(),
      }))

      setResults(generatedList)
      Message.success(`视频${activeTab === 'generate' ? '生成' : '复刻'}完成！成功输出 ${fissionCount} 条高画质成品`)
    }, 4800)
    void [s1, s2, s3, s4]
  }

  const handleCopyScript = (txt: string) => {
    navigator.clipboard.writeText(txt)
    Message.success('分镜脚本已复制')
  }

  return (
    <div className="relative flex h-full bg-[#F2F4F7]">
      {/* ─── 左侧 360px 配置面板（顶部双 tab，对照旧版 SectionTitle 体系） ─── */}
      <div className="h-full w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pt-5 pb-4 custom-scrollbar">
        <div className="mb-4 grid grid-cols-2 rounded-lg bg-[#F2F3F5] p-0.5">
          {(['generate', 'replicate'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-9 cursor-pointer rounded-lg border-0 transition-all ${
                activeTab === tab ? 'bg-white font-semibold text-[#171A1D] shadow-sm' : 'bg-transparent text-[#8B949E]'
              }`}
            >
              {tab === 'generate' ? '生成爆款' : '爆款复刻'}
            </button>
          ))}
        </div>

        {activeTab === 'generate' ? (
          <>
            {/* 上传产品图（对照旧版：蓝虚线 + 灰钮 + 两行文案） */}
            <div className="mb-4">
              <SectionTitle help>上传产品图</SectionTitle>
              <input
                ref={productInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleProductUpload(e.target.files)
                  e.currentTarget.value = ''
                }}
              />
              <div
                className="flex h-[94px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#8CC4FF] bg-white"
                onClick={() => productInputRef.current?.click()}
              >
                <button type="button" className="mb-3 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]">
                  <Upload className="h-4 w-4" />
                  上传产品图
                </button>
                <p className="m-0 text-[12px] text-[#8B949E]">点击或拖拽上传</p>
                <p className="m-0 text-[12px] text-[#8B949E]">建议上传多张不同角度的白底图</p>
              </div>
            </div>

            {/* 目标市场与语言（对照旧版 space-y-3） */}
            <div className="mb-4 space-y-3">
              <SectionTitle>目标市场与语言</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Select size="small" value={market} onChange={setMarket}>
                  {MARKETS.map((m) => (
                    <Option key={m} value={m}>{m}</Option>
                  ))}
                </Select>
                <Select size="small" value={language} onChange={setLanguage}>
                  {LANGUAGES.map((l) => (
                    <Option key={l} value={l}>{l}</Option>
                  ))}
                </Select>
              </div>
              <Select size="small" value={ratio} onChange={setRatio} className="w-full">
                {RATIOS.map((r) => (
                  <Option key={r.value + r.label} value={r.value}>{r.label}</Option>
                ))}
              </Select>
            </div>

            {/* 商品卖点 + AI 帮写胶囊（对照旧版） */}
            <div className="mb-0 flex items-center justify-between">
              <SectionTitle help>商品卖点</SectionTitle>
              <button
                type="button"
                onClick={() => void handleAiHelp()}
                disabled={aiWriting}
                className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiWriting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI 帮写
              </button>
            </div>
            <textarea
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              className="mb-4 h-[80px] w-full resize-none rounded-lg border border-[#DDE3EC] bg-white p-3 text-[12px] leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]"
              placeholder="输入商品核心卖点、适用人群、使用场景等信息..."
            />

            {/* 视频类型：双 tab + 类型钮/脚本（对照旧版） */}
            <div className="mb-3">
              <SectionTitle>视频类型</SectionTitle>
              <div className="mb-3 grid grid-cols-2 rounded-lg bg-[#F2F3F5] p-0.5">
                {(['type', 'script'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`h-9 cursor-pointer rounded-lg border-0 transition-all ${
                      mode === m ? 'bg-white font-semibold text-[#171A1D] shadow-sm' : 'bg-transparent text-[#8B949E]'
                    }`}
                  >
                    {m === 'type' ? '视频类型' : '自定义脚本'}
                  </button>
                ))}
              </div>
              {mode === 'type' ? (
                <div className="grid grid-cols-2 gap-2">
                  {VIDEO_TYPES.map((t) => {
                    const active = selectedTypes.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleType(t.id)}
                        className={`cursor-pointer rounded-lg border p-2 text-left transition-colors ${
                          active ? 'border-[#3388FF] bg-[#EEF5FF] ring-1 ring-[#3388FF]' : 'border-[#e5e8ef] bg-white hover:border-[#b8d7ff]'
                        }`}
                      >
                        <p className={`m-0 text-[12px] font-bold ${active ? 'text-[#3388ff]' : 'text-[#171A1D]'}`}>{t.label}</p>
                        <p className="m-0 mt-0.5 text-[10px] leading-3.5 text-[#86909C]">{t.desc}</p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  className="h-[100px] w-full resize-none rounded-lg border border-[#DDE3EC] bg-white p-3 text-[12px] leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]"
                  placeholder="输入自定义脚本，AI 将按脚本生成视频..."
                />
              )}
            </div>
          </>
        ) : (
          <>
            {/* 爆款复刻 tab（对照旧版：上传素材/参考视频/链接/授权/市场语言/卖点/裂变） */}
            <div className="mb-4">
              <SectionTitle help>上传素材</SectionTitle>
              <div className="flex h-[94px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#8CC4FF] bg-white" onClick={() => productInputRef.current?.click()}>
                <button type="button" className="mb-2 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]">
                  <Upload className="h-4 w-4" />
                  上传产品图
                </button>
                <p className="m-0 text-[12px] text-[#8B949E]">建议上传多张不同角度的白底图</p>
              </div>
            </div>

            <div className="mb-4">
              <SectionTitle>上传参考视频</SectionTitle>
              <div className="flex h-[94px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E3E7EF] bg-white">
                <button type="button" className="mb-2 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]">
                  <Upload className="h-4 w-4" />
                  上传参考视频
                </button>
                <p className="m-0 px-4 text-center text-[11px] text-[#8B949E]">AI会深度复刻原片结构、情绪与风格。</p>
              </div>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8B949E]">
                  <Link2 className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={replicateUrl}
                  onChange={(e) => setReplicateUrl(e.target.value)}
                  placeholder="支持导入TikTok、抖音、小红书链接。"
                  className="h-10 w-full rounded-lg border border-[#DDE3EC] bg-[#F9FAFB] pl-9 pr-3 text-[12px] text-[#171A1D] outline-none focus:border-[#4690FF] focus:bg-white"
                />
              </div>
              <button type="button" className="h-10 shrink-0 cursor-pointer rounded-lg border-0 bg-[#F2F3F5] px-4 text-[13px] font-semibold text-[#171A1D]">
                导入
              </button>
            </div>
            <label className="mb-4 flex items-start gap-2 text-[12px] text-[#8B949E]">
              <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-[#D0D5DD] accent-[#3388FF]" />
              <span>我已获得使用该链接内容的必要授权，且依法有权对其进行使用。</span>
            </label>

            <div className="mb-4 space-y-3">
              <SectionTitle>目标市场与语言</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Select size="small" value={market} onChange={setMarket}>
                  {MARKETS.map((m) => (
                    <Option key={m} value={m}>{m}</Option>
                  ))}
                </Select>
                <Select size="small" value={language} onChange={setLanguage}>
                  {LANGUAGES.map((l) => (
                    <Option key={l} value={l}>{l}</Option>
                  ))}
                </Select>
              </div>
              <Select size="small" value={ratio} onChange={setRatio} className="w-full">
                {RATIOS.map((r) => (
                  <Option key={r.value + r.label} value={r.value}>{r.label}</Option>
                ))}
              </Select>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <SectionTitle help>商品卖点（可选）</SectionTitle>
              <button
                type="button"
                onClick={() => void handleAiHelp()}
                disabled={aiWriting}
                className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {aiWriting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI 帮写
              </button>
            </div>
            <textarea
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              className="mb-4 h-[80px] w-full resize-none rounded-lg border border-[#DDE3EC] bg-white p-3 text-[12px] leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]"
              placeholder="输入商品核心卖点，或重点复刻的内容。"
            />

            {/* 爆款裂变（对照旧版灰卡 + 步进器） */}
            <div className="mb-2">
              <SectionTitle>爆款裂变</SectionTitle>
              <div className="rounded-lg bg-[#F2F3F5] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="m-0 text-[13px] font-semibold text-[#171A1D]">爆款裂变</h3>
                    <p className="m-0 mt-1 text-[12px] text-[#8B949E]">基于参考视频生成多版本差异化内容</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFissionCount((n) => Math.max(1, n - 1))}
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-[#dce3ee] bg-white text-[#0A1B39] hover:border-[#3388ff]"
                    >
                      −
                    </button>
                    <span className="text-[14px] font-bold text-[#0A1B39]">{fissionCount}</span>
                    <button
                      type="button"
                      onClick={() => setFissionCount((n) => Math.min(10, n + 1))}
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-[#dce3ee] bg-white text-[#0A1B39] hover:border-[#3388ff]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 吸底生成条（对照旧版双文案） */}
        <div className="sticky bottom-0 -mx-5 mt-4 border-t border-[#EEF1F5] bg-white p-4">
          <Button
            type="primary"
            long
            size="large"
            loading={generating}
            onClick={handleStart}
            className="rounded-lg font-bold"
          >
            {activeTab === 'generate' ? '生成 15s 爆款视频' : `复制 15s 爆款视频（共 ${fissionCount} 条）`}
          </Button>
        </div>
      </div>

      {/* ─── 右侧画布区（对照旧版：标题 + 白卡 w-864 grid-cols-4 视频类型卡矩阵） ─── */}
      <div className="h-full min-w-0 flex-1 overflow-y-auto p-6 custom-scrollbar">
        {generating ? (
          <div className="grid h-full place-items-center">
            <div className="w-[640px] rounded-2xl bg-white p-8 text-center shadow-[0_8px_32px_rgba(29,38,52,.06)]">
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#3388ff]" />
              <div className="mb-5 flex items-center justify-between">
                {GEN_STEPS.map((label, i) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold ${
                        i <= generateStep ? 'bg-[#3388ff] text-white' : 'bg-[#f2f4f7] text-[#98A2B3]'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <span className={`text-[12px] font-bold ${i <= generateStep ? 'text-[#0A1B39]' : 'text-[#98A2B3]'}`}>{label}</span>
                  </div>
                ))}
              </div>
              <p className="m-0 text-[13px] text-[#86909C]">Sora / Hunyuan 多模态视频大模型渲染中，请稍候...</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex min-h-full max-w-[1040px] flex-col items-center justify-center py-8 text-center">
            <h1 className="m-0 text-[32px] font-bold leading-tight text-[#171A1D]">爆款视频复刻</h1>
            <p className="m-0 mt-3 text-[14px] leading-6 text-[#5F6B7A]">选择视频类型与目标市场，AI 生成多语言带货短视频与裂变变体</p>

            <div className="mt-12 grid w-[864px] grid-cols-4 gap-4 rounded-[18px] bg-white p-8 shadow-[0_18px_40px_rgba(31,37,45,.06)]">
              {VIDEO_TYPES.map((t) => {
                const active = selectedTypes.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleType(t.id)}
                    className={`relative h-[290px] w-[180px] cursor-pointer overflow-hidden rounded-xl border-0 bg-[#fafbfc] p-0 text-left transition-shadow ${
                      active ? 'ring-2 ring-[#3388FF]' : 'hover:shadow-md'
                    }`}
                  >
                    <div className="relative h-[220px] w-full overflow-hidden">
                      <img src={t.image} alt={t.label} className="h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
                      <div className="absolute inset-0 grid place-items-center">
                        <div className="grid h-11 w-11 place-items-center rounded-full bg-white/85 text-[#3388ff] shadow">
                          <Play className="ml-0.5 h-5 w-5 fill-[#3388ff]" />
                        </div>
                      </div>
                      {active && (
                        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#3388FF] text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="h-[70px] px-2.5 py-2 text-left">
                      <p className={`m-0 text-[12px] font-bold ${active ? 'text-[#3388ff]' : 'text-[#171A1D]'}`}>{t.label}</p>
                      <p className="m-0 mt-0.5 line-clamp-2 text-[10px] leading-3.5 text-[#86909C]">{t.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {results.length > 0 && (
              <div className="mt-8 w-full text-left">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="m-0 text-[18px] font-extrabold text-[#171A1D]">生成成果列表（{results.length} 条成品）</h2>
                  <Button size="small" icon={<Download className="h-3.5 w-3.5" />} className="rounded-lg">
                    打包下载全部 MP4
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {results.map((vid) => (
                    <div key={vid.id} className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
                      <div
                        className="relative h-[200px] cursor-pointer bg-black"
                        onClick={() => setPreviewVideo(vid)}
                      >
                        <img src={vid.coverUrl} alt={vid.title} className="h-full w-full object-cover opacity-85" />
                        <div className="absolute inset-0 grid place-items-center bg-black/25">
                          <div className="grid h-12 w-12 place-items-center rounded-full bg-[#3388ff]/90 text-white">
                            <Play className="ml-0.5 h-5 w-5 fill-white" />
                          </div>
                        </div>
                        <span className="absolute left-2 top-2 rounded bg-[#3388ff] px-1.5 py-0.5 text-[11px] font-bold text-white">{vid.type}</span>
                        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{vid.duration}</span>
                      </div>
                      <div className="p-3">
                        <p className="m-0 truncate text-[14px] font-bold text-[#171A1D]">{vid.title}</p>
                        <p className="m-0 mt-1.5 rounded bg-[#f8fafc] p-2 text-[12px] leading-5 text-[#4e5969]">{vid.scriptSummary}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-[#86909C]">
                            画幅: {vid.ratio} ｜ {vid.createTime}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyScript(vid.scriptSummary)}
                            className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[12px] font-semibold text-[#3388ff] hover:text-[#1a6fe8]"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            脚本
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 视频播放 Modal */}
      <Modal
        title={previewVideo?.title || '视频播放预览'}
        visible={Boolean(previewVideo)}
        onCancel={() => setPreviewVideo(null)}
        footer={
          <Button type="primary" onClick={() => setPreviewVideo(null)} className="rounded-lg">
            关闭预览
          </Button>
        }
        style={{ width: 640 }}
      >
        {previewVideo && (
          <div>
            <video src={previewVideo.videoUrl} controls autoPlay className="max-h-[60vh] w-full rounded-lg bg-black" />
            <p className="m-0 mt-3 whitespace-pre-wrap rounded-lg bg-[#f8fafc] p-3 text-[12px] leading-5 text-[#4e5969]">
              {previewVideo.scriptSummary}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
