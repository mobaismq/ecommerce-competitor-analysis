import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  GripVertical,
  Loader2,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { Button, Input, Message, Select } from '@arco-design/web-react'
import { api } from '../api/client'
import { saveAs } from 'file-saver'
import { nanoid } from 'nanoid'
import { AIReportSelector, type SuiteProduct } from '../components/AIReportSelector'
import mainHeadphone from '../assets/main-headphone.png'
import sceneDisplay from '../assets/scene-display.png'
import sellingPoint from '../assets/selling-point.png'
import detailExplain from '../assets/detail-explain.png'
import modelScene from '../assets/model-scene.png'

const Option = Select.Option

interface DetailModuleDef {
  key: string
  title: string
  desc: string
  defaultPrompt: string
}

const ALL_MODULES: DetailModuleDef[] = [
  { key: 'hero_banner', title: '首屏主视觉', desc: '传递核心品牌价值', defaultPrompt: '电商详情页首屏大Banner，宽幅现代轻奢科技构图，主体高清居中，极具张力的氛围光效，标杆质感。' },
  { key: 'core_selling_point', title: '核心卖点图', desc: '突出差异化优势', defaultPrompt: '图解核心功能与差异化卖点，虚实结合展现强劲性能或精工材质，色彩鲜明有条理。' },
  { key: 'usage_scene', title: '使用场景图', desc: '呈现真实使用场景', defaultPrompt: '自然温馨的高品质居家或现代办公日常场景，商品融入其中，光线柔和，极具真实代入感。' },
  { key: 'multi_angles', title: '多角度图', desc: '多角度呈现外观', defaultPrompt: '前视图、45度立体侧视图与顶视图三联排布，多视角展示整体结构与比例线条。' },
  { key: 'scene_atmosphere', title: '场景氛围图', desc: '营造品质格调', defaultPrompt: '电影级景深虚化与自然暖光侧照，商品置于优雅静谧空间中，展现尊贵生活美学。' },
  { key: 'detail_close_up', title: '商品细节特写', desc: '微距放大材质工艺', defaultPrompt: '超近微距微光特写，极尽展现表面精美纹理、圆润倒角与接缝做工，金属质感细腻。' },
  { key: 'brand_story', title: '品牌故事图', desc: '传达品牌理念', defaultPrompt: '品牌视觉沉淀，极简留白风格，手稿线条与实物交叠，传递专业研发精神。' },
  { key: 'dimension_size', title: '尺寸/容量/尺码图', desc: '标明精确规格', defaultPrompt: '干净纯色背景，清晰直观的微标尺与数字标注，直观呈现长宽高尺寸与容量比例。' },
  { key: 'effect_compare', title: '效果对比图', desc: '使用前后对比', defaultPrompt: '左右分屏强烈对比，左侧普通传统痛点，右侧使用本商品后的惊艳体验，视觉冲击力显著。' },
  { key: 'spec_table', title: '详细参数/规格表', desc: '专业详尽参数', defaultPrompt: '规整高级的参数排版底图，搭配清晰的指标区域划分，专业严谨有说服力。' },
  { key: 'craft_process', title: '工艺制作图', desc: '展示制造工艺', defaultPrompt: '分层爆炸图或工匠精细打磨视觉，展示内部核心部件结构与尖端工艺组合。' },
  { key: 'accessories_list', title: '配件/赠品全家福', desc: '收货清单明了', defaultPrompt: '全套开箱全家福俯视平铺陈列，主机、配件、连接线、说明书及赠品规整摆放。' },
  { key: 'series_display', title: '系列/多色展示图', desc: '多色彩组合可选', defaultPrompt: '多种经典配色商品一字排开或阶梯式陈列，展现丰富多选的色彩质感与潮流风格。' },
  { key: 'ingredients_material', title: '材质/成分安全图', desc: '用料与认证展示', defaultPrompt: '环保材质、母婴级安全或国际认证标章展示，绿色自然轻奢调性，令人安心信赖。' },
  { key: 'after_sales', title: '售后保障图', desc: '质保政策打消顾虑', defaultPrompt: '官方正品、全国联保、闪电发货、无忧退换售后服务专区标识图，专业可信赖。' },
  { key: 'usage_guide', title: '使用建议/操作指导', desc: '上手指导说明', defaultPrompt: '1-2-3 极简操作步序指引示意图，图文简明易懂，展现贴心用户关怀。' },
]

interface SelectedModuleItem {
  instanceId: string
  key: string
  title: string
  prompt: string
  status: 'idle' | 'generating' | 'done' | 'failed'
  imageUrl?: string
  error?: string
}

const PLATFORM_OPTIONS = ['淘宝天猫1688', '京东', '拼多多', '抖店', '小红书', '亚马逊']

export function APlusDetailPage() {
  // 表单状态
  const [keyword, setKeyword] = useState('')
  const [platform, setPlatform] = useState(PLATFORM_OPTIONS[0])
  const [extraRequirements, setExtraRequirements] = useState('')

  // 联动报告
  const [selectedReportId, setSelectedReportId] = useState('')
  const [currentReport, setCurrentReport] = useState<SuiteProduct | null>(null)

  // 双步工作流：form（填表）→ strategy（查看规划出的模块提示词）→ 生图
  const [step, setStep] = useState<'form' | 'strategy'>('form')
  const [strategyExpanded, setStrategyExpanded] = useState(true)

  // 选中的模块列表（有序）
  const [selectedModules, setSelectedModules] = useState<SelectedModuleItem[]>([
    { instanceId: 'mod-hero', key: 'hero_banner', title: '首屏主视觉', prompt: ALL_MODULES[0].defaultPrompt, status: 'idle' },
    { instanceId: 'mod-selling', key: 'core_selling_point', title: '核心卖点图', prompt: ALL_MODULES[1].defaultPrompt, status: 'idle' },
    { instanceId: 'mod-scene', key: 'usage_scene', title: '使用场景图', prompt: ALL_MODULES[2].defaultPrompt, status: 'idle' },
    { instanceId: 'mod-detail', key: 'detail_close_up', title: '商品细节特写', prompt: ALL_MODULES[5].defaultPrompt, status: 'idle' },
    { instanceId: 'mod-params', key: 'spec_table', title: '详细参数/规格表', prompt: ALL_MODULES[9].defaultPrompt, status: 'idle' },
    { instanceId: 'mod-after', key: 'after_sales', title: '售后保障图', prompt: ALL_MODULES[14].defaultPrompt, status: 'idle' },
  ])

  const [batchGenerating, setBatchGenerating] = useState(false)
  const [workflowPlanning, setWorkflowPlanning] = useState(false)
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null)

  const selectedKeys = new Set(selectedModules.map((m) => m.key))

  const handleReportChange = (reportId: string, report: SuiteProduct | null) => {
    setSelectedReportId(reportId)
    setCurrentReport(report)
    if (report && !keyword) {
      setKeyword(report.keyword || report.label)
    }
  }

  const toggleModuleKey = (def: DetailModuleDef) => {
    const existingIndex = selectedModules.findIndex((m) => m.key === def.key)
    if (existingIndex >= 0) {
      if (selectedModules.length <= 1) {
        Message.warning('至少保留 1 个详情图模块')
        return
      }
      setSelectedModules((prev) => prev.filter((_, i) => i !== existingIndex))
    } else {
      setSelectedModules((prev) => [
        ...prev,
        { instanceId: `mod-${nanoid(8)}`, key: def.key, title: def.title, prompt: def.defaultPrompt, status: 'idle' },
      ])
    }
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    setSelectedModules((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  const moveDown = (index: number) => {
    if (index === selectedModules.length - 1) return
    setSelectedModules((prev) => {
      const next = [...prev]
      ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
      return next
    })
  }

  // 智能生成详情工作流与提示词（数据流保持桌面端现状）
  const handlePlanWorkflow = async () => {
    if (!keyword.trim()) {
      Message.warning('请先填写商品名称与核心定位')
      return
    }
    setWorkflowPlanning(true)
    try {
      const reportText = [
        `商品名称: ${keyword}`,
        `目标平台: ${platform || '淘宝天猫'}`,
        `设计风格要求: ${extraRequirements || '现代轻奢，信息层级分明，专业视觉指引'}`,
        currentReport ? `竞品核心卖点: ${currentReport.keyword}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const { data } = await api.post('/api/product-sets/generate-detail-workflow', {
        reportText,
        promptSlots: selectedModules.map((m) => m.key),
      })

      const returnedItems: Array<{ type: string; prompt: string; name?: string }> = data?.data || []
      if (returnedItems.length > 0) {
        setSelectedModules((prev) =>
          prev.map((mod) => {
            const matched = returnedItems.find((p) => p.type === mod.key)
            return { ...mod, prompt: matched?.prompt || mod.prompt }
          }),
        )
        Message.success(`已规划 ${selectedModules.length} 个详情切片图专属提示词！`)
      } else {
        Message.info('已应用通用电商详情图排版优化')
      }
      setStep('strategy')
      setStrategyExpanded(true)
    } catch {
      Message.warning('使用预设模板完成工作流规划')
      setStep('strategy')
    } finally {
      setWorkflowPlanning(false)
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
      const { data } = await api.post('/api/product-sets/generate-image', {
        prompt: target.prompt,
        slotType: target.key,
      })

      const generatedUrl =
        data?.images?.[0]?.url || data?.url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'

      setSelectedModules((prev) =>
        prev.map((m) => (m.instanceId === instanceId ? { ...m, status: 'done', imageUrl: generatedUrl } : m)),
      )
      Message.success(`${target.title} 绘制完成！`)
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

  // 批量一键生成整套详情图
  const handleBatchGenerateAll = async () => {
    setBatchGenerating(true)
    Message.info(`开始顺次生成 ${selectedModules.length} 张详情图模块...`)
    for (const mod of selectedModules) {
      await generateSingleModuleImage(mod.instanceId)
    }
    setBatchGenerating(false)
    Message.success('全部详情切片图已生成完毕！')
  }

  const handleDownloadImage = (url: string, filename = 'detail-image.png') => {
    saveAs(url, filename)
    Message.success('已下载')
  }

  const handleBatchDownload = () => {
    const doneMods = selectedModules.filter((m) => m.imageUrl)
    if (doneMods.length === 0) {
      Message.warning('当前暂无可下载的已生成详情图')
      return
    }
    doneMods.forEach((m, idx) => {
      setTimeout(() => {
        handleDownloadImage(m.imageUrl!, `${idx + 1}_${m.title}.png`)
      }, idx * 300)
    })
    Message.success(`已开始下载 ${doneMods.length} 张详情长图模块`)
  }

  const INPUT_CLASS =
    'w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 text-[13px] font-semibold text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white'

  return (
    <div className="relative flex h-full bg-[#F2F4F7]">
      {/* ===================== 左侧 360px 配置面板（双步工作流） ===================== */}
      <div className="w-[360px] h-full shrink-0 overflow-y-auto border-r border-[#e5e8ef] bg-white px-5 pt-5 pb-4">
        {step === 'form' ? (
          <>
            {/* 商品原图（对照旧版 grid-cols-3 上传区） */}
            <div className="mb-5">
              <h2 className="mb-2 text-[14px] font-bold text-[#0A1B39]">商品原图</h2>
              <div className="flex min-h-[94px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#c9d5e8] bg-[#fbfcfe] transition-colors hover:border-[#1683FF] hover:bg-[#f5f9ff]">
                <Plus className="mb-1 h-5 w-5 text-[#86909C]" />
                <p className="m-0 text-[11px] text-[#86909C]">详情图无需上传原图，直接使用报告联动（可扩展）</p>
              </div>
            </div>

            {/* 选择 AI 报告 + 不引用 */}
            <div className="mb-5">
              <AIReportSelector
                value={selectedReportId}
                onChange={handleReportChange}
              />
              {selectedReportId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReportId('')
                    setCurrentReport(null)
                  }}
                  className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-[#86909C] hover:text-[#3388ff]"
                >
                  不引用 AI 报告
                </button>
              )}
            </div>

            {/* 生成设置 grid-cols-2 */}
            <div className="mb-5">
              <h2 className="mb-2 text-[14px] font-bold text-[#0A1B39]">生成设置</h2>
              <div className="grid grid-cols-2 gap-2">
                <Select size="small" value={platform} onChange={setPlatform}>
                  {PLATFORM_OPTIONS.map((p) => (
                    <Option key={p} value={p}>
                      {p}
                    </Option>
                  ))}
                </Select>
                <Input
                  size="small"
                  value={keyword}
                  onChange={setKeyword}
                  placeholder="商品名称与核心定位"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* 专属视觉调性要求 */}
            <div className="mb-5">
              <h2 className="mb-2 text-[14px] font-bold text-[#0A1B39]">专属视觉调性要求</h2>
              <Input.TextArea
                value={extraRequirements}
                onChange={setExtraRequirements}
                rows={4}
                placeholder="例如：浅色极简轻奢风，文字信息与视觉留白舒适平衡，高档感十足"
                className="rounded-lg text-[12px]"
              />
            </div>

            {/* 包含模块（多选）：grid-cols-2 16 个模块勾选钮（对照旧版） */}
            <div className="mb-5">
              <h2 className="mb-2 text-[14px] font-bold text-[#0A1B39]">包含模块（多选）</h2>
              <div className="grid grid-cols-2 gap-3">
                {ALL_MODULES.map((def) => {
                  const checked = selectedKeys.has(def.key)
                  return (
                    <button
                      key={def.key}
                      type="button"
                      onClick={() => toggleModuleKey(def)}
                      className={`cursor-pointer rounded-lg border p-2.5 text-left transition-colors ${
                        checked ? 'border-[#1683FF] bg-[#1683FF] text-white' : 'border-[#e5e8ef] bg-white text-[#0A1B39] hover:border-[#b8d7ff]'
                      }`}
                    >
                      <p className="m-0 text-[12px] font-bold">{def.title}</p>
                      <p className={`m-0 mt-0.5 text-[10px] ${checked ? 'text-white/80' : 'text-[#86909C]'}`}>{def.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 详情页规划卡（对照旧版折叠 max-h-[112px] + 展开钮） */}
            <div className="mb-4 rounded-xl border border-[#e5e8ef] bg-white p-3">
              <div className={`overflow-hidden transition-all ${strategyExpanded ? '' : 'max-h-[112px]'}`}>
                <p className="m-0 text-[12px] font-bold leading-5 text-[#344054]">
                  已按「{keyword || '当前商品'}」与目标平台「{platform}」规划 {selectedModules.length} 个详情切片模块及其专属提示词，
                  可在下方逐条微调后开始生成。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStrategyExpanded((v) => !v)}
                className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 border-0 bg-transparent p-0 text-[12px] font-bold text-[#3388ff]"
              >
                {strategyExpanded ? '收起' : '展开完整规划'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${strategyExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* 模块提示词列表（对照旧版 space-y-3 bg-[#F5F6F8] 项） */}
            <div className="space-y-3">
              {selectedModules.map((mod, index) => (
                <div key={mod.instanceId} className="rounded-lg bg-[#F5F6F8] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-[#86909C]">
                      <GripVertical className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate text-[12px] font-bold text-[#0A1B39]">
                        #{index + 1} {mod.title}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-[#86909C] hover:bg-white"
                        title="上移"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-[#86909C] hover:bg-white"
                        title="下移"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedModules.length <= 1) {
                            Message.warning('至少保留 1 个详情图模块')
                            return
                          }
                          setSelectedModules((prev) => prev.filter((m) => m.instanceId !== mod.instanceId))
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
                    className="w-full resize-none rounded-lg border border-[#e5e8ef] bg-white p-2 text-[12px] leading-5 text-[#344054] outline-none focus:border-[#3388ff]"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* 吸底操作条（strategy 步=上一步+生成详情图双钮；form 步=单钮） */}
        <div className="sticky bottom-0 -mx-5 mt-4 border-t border-[#EEF1F5] bg-white p-4">
          {step === 'form' ? (
            <Button
              type="primary"
              long
              size="large"
              loading={workflowPlanning}
              onClick={handlePlanWorkflow}
              className="rounded-lg font-bold"
            >
              <Sparkles className="mr-1 inline h-4 w-4" />
              生成详情工作流与提示词
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                size="large"
                disabled={batchGenerating}
                onClick={() => setStep('form')}
                className="w-[96px] shrink-0 rounded-lg font-bold"
              >
                上一步
              </Button>
              <Button
                type="primary"
                long
                size="large"
                loading={batchGenerating}
                onClick={handleBatchGenerateAll}
                className="rounded-lg font-bold"
              >
                {batchGenerating ? '正在生成详情图...' : `生成详情图（${selectedModules.length} 张）`}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ===================== 右侧画布区 ===================== */}
      <div className="h-full min-w-0 flex-1 overflow-y-auto p-6 custom-scrollbar">
        {selectedModules.every((m) => m.status !== 'done') ? (
          /* 默认态：标题 + 示例展卡（对照旧版 h-[444px] w-[792px]） */
          <div className="mx-auto flex min-h-full max-w-[1000px] flex-col items-center justify-center py-8 text-center">
            <h1 className="m-0 text-[32px] font-extrabold text-[#0A1B39] tracking-tight">详情图</h1>
            <p className="m-0 mt-2 text-[14px] text-[#86909C]">
              上传商品图，AI 即刻生成 <span className="font-bold text-[#3388ff]">符合多电商平台规范</span> 的专业详情图。
            </p>

            <div className="mt-8 flex h-[444px] w-[792px] items-center justify-center gap-4 rounded-2xl border border-[#eef2f8] bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,0.06)]">
              {/* 左：三产品图 grid-rows-3 */}
              <div className="grid h-[396px] w-[123px] shrink-0 grid-rows-3 gap-2">
                {[mainHeadphone, sceneDisplay, sellingPoint].map((src, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border border-[#f0f2f5] bg-[#fafbfc]">
                    <img src={src} alt={`产品图 ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>

              <svg className="h-5 w-5 shrink-0 text-[#c0c4cc]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>

              {/* 中：详情长图 */}
              <div className="h-[396px] w-[111px] shrink-0 overflow-hidden rounded-lg border border-[#f0f2f5] bg-[#fafbfc]">
                <img src={modelScene} alt="详情长图" className="h-full w-full object-cover" />
              </div>

              <svg className="h-5 w-5 shrink-0 text-[#c0c4cc]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>

              {/* 右：六横幅 grid-cols-2 grid-rows-3 */}
              <div className="grid h-[396px] w-[420px] shrink-0 grid-cols-2 grid-rows-3 gap-2">
                {[detailExplain, sellingPoint, sceneDisplay, modelScene, mainHeadphone, detailExplain].map((src, i) => (
                  <div key={i} className="overflow-hidden rounded-lg border border-[#f0f2f5] bg-[#fafbfc]">
                    <img src={src} alt={`横幅 ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 结果态：模块流网格（对照旧版 grid-cols-3） */
          <div className="mx-auto max-w-[1200px] pb-12">
            <div className="mb-6 flex items-center justify-between border-b border-[#e5e8ef] pb-4">
              <div>
                <h2 className="m-0 text-[20px] font-extrabold text-[#0A1B39]">详情图工作台</h2>
                <p className="m-0 mt-0.5 text-[12px] text-[#86909C]">
                  已完成 {selectedModules.filter((m) => m.status === 'done').length}/{selectedModules.length} 张详情切片生成，支持单独渲染与打包下载。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={handleBatchDownload}
                  className="rounded-lg"
                >
                  打包下载详情图
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {selectedModules.map((mod, index) => (
                <div key={mod.instanceId} className="overflow-hidden rounded-xl border border-[#e5eaf2] bg-white shadow-sm">
                  <div className="relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[#f4f7fb]">
                    {mod.status === 'generating' ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-[#3388ff]" />
                        <span className="text-[11px] text-[#86909C]">AI 渲染中...</span>
                      </div>
                    ) : mod.imageUrl ? (
                      <img
                        src={mod.imageUrl}
                        alt={mod.title}
                        className="h-full w-full cursor-zoom-in object-cover"
                        onClick={() => setPreviewModalUrl(mod.imageUrl!)}
                      />
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
                    <div className="flex items-center justify-between">
                      <p className="m-0 truncate text-[13px] font-bold text-[#0A1B39]">{mod.title}</p>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          mod.status === 'done' ? 'bg-[#e8f5e9] text-[#2e7d32]' : mod.status === 'failed' ? 'bg-[#ffEBEE] text-[#c62828]' : 'bg-[#f0f7ff] text-[#3388ff]'
                        }`}
                      >
                        {mod.status === 'done' ? '已生成' : mod.status === 'failed' ? '失败' : mod.status === 'generating' ? '生成中' : '待生成'}
                      </span>
                    </div>

                    <p className="m-0 line-clamp-2 text-[11px] leading-4 text-[#86909C]">{mod.prompt}</p>

                    <div className="flex items-center justify-between border-t border-[#f0f2f5] pt-2">
                      <Button
                        size="mini"
                        type="text"
                        loading={mod.status === 'generating'}
                        onClick={() => generateSingleModuleImage(mod.instanceId)}
                      >
                        单独渲染
                      </Button>
                      {mod.imageUrl && (
                        <Button
                          size="mini"
                          type="text"
                          icon={<Download className="h-3 w-3" />}
                          onClick={() => handleDownloadImage(mod.imageUrl!, `${index + 1}_${mod.title}.png`)}
                        >
                          下载
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 大图预览 */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70" onClick={() => setPreviewModalUrl(null)}>
          <div className="relative max-h-[88vh] max-w-[88vw]" onClick={(e) => e.stopPropagation()}>
            <img src={previewModalUrl} alt="预览" className="max-h-[88vh] max-w-[88vw] rounded-lg object-contain" />
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
