import { useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Download, Link2, Loader2, Lock, Play, Plus, Sparkles, Upload } from 'lucide-react'
import { Button, Message, Modal, Select } from '@arco-design/web-react'
import { SectionTitle } from '../components/AIReportSelector'
import { api } from '../api/client'
import { nanoid } from 'nanoid'

// 8 种类型封面图（本地 assets，禁止外链）
import imgUgc from '../assets/video-types/image-11.png'
import imgDrama from '../assets/video-types/image-26.png'
import imgOral from '../assets/video-types/image-27.png'
import imgDemo from '../assets/video-types/image-13.png'
import imgUnbox from '../assets/video-types/image-9.png'
import imgScene from '../assets/video-types/image-10.png'
import imgCompare from '../assets/video-types/image-12.png'
import imgTutorial from '../assets/video-types/image-1.png'

// TODO(演示数据登记)：本页结果列表/封面/视频源均为前端本地演示数据，
// 未对接真实后端。接入真实接口（POST /api/videos/replicate 的权威响应）
// 后，应将 GeneratedVideoItem 的 coverUrl/videoUrl/scriptSummary 整体替换为
// 服务端返回的字段，标题与文案不得再编造外链。

const Option = Select.Option

interface VideoTypeCard {
  id: string
  label: string
  desc: string
  image: string
}

// 右画布类型卡矩阵：desc 逐字对齐旧版 VIDEO_TYPE_CARDS（legacy:14-21）
const VIDEO_TYPES: VideoTypeCard[] = [
  { id: 'ugc', label: 'UGC 种草', desc: '用户视角真实分享体验', image: imgUgc },
  { id: 'drama', label: '带货短剧', desc: '短剧带货情节植入', image: imgDrama },
  { id: 'oral', label: '产品口播', desc: '面对镜头讲解产品卖点', image: imgOral },
  { id: 'demo', label: '产品演示', desc: '多角度展示 + 使用演示', image: imgDemo },
  { id: 'unbox', label: '开箱测评', desc: '真实开箱 + 功能体验', image: imgUnbox },
  { id: 'scene', label: '场景种草', desc: '生活场景自然融入产品', image: imgScene },
  { id: 'compare', label: '对比评测', desc: '竞品对比突出优势', image: imgCompare },
  { id: 'tutorial', label: '教程视频', desc: '使用教程 + 技巧分享', image: imgTutorial },
]

// 目标市场（旧版 legacy:24，无「市场」后缀）
const MARKETS = ['北美', '欧洲', '东南亚', '日韩', '中东', '拉美', '澳洲', '全球']
// 语言（旧版 legacy:25，共 13 项，含 日文/韩文/意大利文/印尼文）
const LANGUAGES = ['英语', '中文', '日文', '韩文', '德文', '法文', '意大利文', '西班牙文', '葡萄牙文', '阿拉伯文', '泰文', '越南文', '印尼文']
// 比例（旧版 legacy:26，共 6 项，含 抖音 · 9:16）
const RATIOS = ['TikTok/Reels · 9:16', '抖音 · 9:16', '小红书 · 9:16', '淘宝主图 · 1:1', 'YouTube · 16:9', '亚马逊 · 16:9']
// 左面板「视频类型」钮 options（旧版 legacy:27，含 TVC广告/痛点解决/开箱种草/反应展示）
const VIDEO_TYPE_OPTIONS = ['UGC 种草', '带货短剧', '产品演示', '产品口播', 'TVC广告', '痛点解决', '开箱种草', '反应展示']
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

  // 表单状态（对齐旧版默认值）
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['ugc']) // 右画布卡片
  const [selectedTypeOptions, setSelectedTypeOptions] = useState<string[]>(['UGC 种草']) // 左面板类型钮
  const [market, setMarket] = useState('北美')
  const [language, setLanguage] = useState('英语')
  const [ratio, setRatio] = useState('TikTok/Reels · 9:16')
  const [sellingPoints, setSellingPoints] = useState('')
  const [replicateUrl, setReplicateUrl] = useState('')
  const [fissionCount, setFissionCount] = useState(1)
  const [productImage, setProductImage] = useState<string>('')
  const [mode, setMode] = useState<'type' | 'script'>('type')
  const [authorized, setAuthorized] = useState(false)
  const [scriptText, setScriptText] = useState('')

  // 生成状态
  const [generating, setGenerating] = useState(false)
  const [generateStep, setGenerateStep] = useState(0)
  const [results, setResults] = useState<GeneratedVideoItem[]>([])
  const [previewVideo, setPreviewVideo] = useState<GeneratedVideoItem | null>(null)

  const productInputRef = useRef<HTMLInputElement | null>(null)

  // 右画布类型卡：可取消至 0 个（旧版可空）
  const toggleType = (id: string) => {
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  // 左面板类型钮：可取消至 0 个（旧版可空）
  const toggleTypeOption = (label: string) => {
    setSelectedTypeOptions((prev) => (prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]))
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

  // 本地演示生成流（按钮视觉为旧版灰禁三态，不可点击时不得触发生成）
  const handleStart = async () => {
    setGenerating(true)
    setGenerateStep(0)

    try {
      await api
        .post('/api/videos/replicate', {
          sourceUrl: replicateUrl || '',
          title: activeTab === 'generate' ? `原创爆款视频 (${selectedTypeOptions.join(',')})` : '竞品爆款复刻视频',
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
        duration: ratio.includes('9:16') ? '0:35' : '1:00',
        coverUrl: VIDEO_TYPES.find((t) => t.id === selectedTypes[i % selectedTypes.length])?.image || imgUgc,
        videoUrl: VIDEO_TYPES.find((t) => t.id === selectedTypes[i % selectedTypes.length])?.image || imgUgc,
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
            {/* 上传产品图 */}
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

            {/* 目标市场与语言 */}
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
                  <Option key={r} value={r}>{r}</Option>
                ))}
              </Select>
            </div>

            {/* 商品卖点 + AI 帮写胶囊（旧版为静态钮，无假填充行为） */}
            <div className="mb-0 flex items-center justify-between">
              <SectionTitle help>商品卖点</SectionTitle>
              <button
                type="button"
                className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI 帮写
              </button>
            </div>
            <textarea
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              className="mb-4 h-[80px] w-full resize-none rounded-lg border border-[#DDE3EC] bg-white p-3 text-[12px] leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]"
              placeholder="输入商品核心卖点、适用人群、使用场景等信息..."
            />

            {/* 视频类型：双 tab + 类型钮（VIDEO_TYPE_OPTIONS）/脚本 */}
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
                  {VIDEO_TYPE_OPTIONS.map((label) => {
                    const active = selectedTypeOptions.includes(label)
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleTypeOption(label)}
                        className={`cursor-pointer rounded-lg border p-2 text-left transition-colors ${
                          active ? 'border-[#3388FF] bg-[#EEF5FF] ring-1 ring-[#3388FF]' : 'border-[#e5e8ef] bg-white hover:border-[#b8d7ff]'
                        }`}
                      >
                        <p className={`m-0 text-[12px] font-bold ${active ? 'text-[#3388ff]' : 'text-[#171A1D]'}`}>{label}</p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  className="h-[100px] w-full resize-none rounded-lg border border-[#DDE3EC] bg-white p-3 text-[12px] leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]"
                  placeholder="输入你的视频脚本内容..."
                />
              )}
            </div>
          </>
        ) : (
          <>
            {/* 上传素材 */}
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
                  <Option key={r} value={r}>{r}</Option>
                ))}
              </Select>
            </div>

            {/* 商品卖点（可选）：旧版无 AI 帮写钮 */}
            <div className="mb-2">
              <SectionTitle help>商品卖点（可选）</SectionTitle>
            </div>
            <textarea
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              className="mb-4 h-[80px] w-full resize-none rounded-lg border border-[#DDE3EC] bg-white p-3 text-[12px] leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]"
              placeholder="输入商品核心卖点，或重点复刻的内容。"
            />

            {/* 爆款裂变（旧版无上限） */}
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
                      onClick={() => setFissionCount((n) => n + 1)}
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

        {/* 吸底生成条：还原旧版灰禁三态 + Lock + 徽标，未授权不可点（legacy:244-248） */}
        <div className="sticky bottom-0 -mx-5 mt-4 border-t border-[#EEF1F5] bg-white p-4">
          <button
            type="button"
            disabled
            onClick={() => void handleStart()}
            className="flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[8px] bg-[#C4C6CA] text-[13px] font-semibold text-white"
          >
            <Lock className="h-4 w-4" />
            {activeTab === 'generate' ? '生成 15s 爆款视频' : `复制 15s 爆款视频（共 ${fissionCount} 条）`}
            <span className="rounded bg-white/20 px-2 py-0.5 text-[11px]">
              {activeTab === 'generate' ? '解锁权益' : '首条折扣'}
            </span>
          </button>
        </div>
      </div>

      {/* ─── 右侧画布区 ─── */}
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
            <p className="m-0 mt-3 text-[14px] leading-6 text-[#5F6B7A]">上传商品图，AI 一键批量生成多类型高转化视频。</p>

            <div className="mt-12 grid w-[864px] grid-cols-4 gap-4 rounded-[20px] bg-white p-8 shadow-[0_18px_40px_rgba(31,37,45,.06)]">
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

      {/* 帮助浮钮「?」（旧版 legacy:275） */}
      <button type="button" className="absolute bottom-6 right-8 h-14 w-14 cursor-pointer rounded-full bg-white text-xl shadow-md">
        ?
      </button>

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
