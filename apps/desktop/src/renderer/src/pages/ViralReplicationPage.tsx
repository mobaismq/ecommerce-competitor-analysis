import { useRef, useState } from 'react'
import { XInput } from '../components/XInput'
import { Button, Input, Message, Modal, Select } from '@arco-design/web-react'
import { Download, Eye, Loader2, Upload, X } from 'lucide-react'
import { saveAs } from 'file-saver'
import { nanoid } from 'nanoid'

import referenceAd from '../assets/video-types/image-26.png'
import highCopyAd from '../assets/video-types/image-27.png'
import productCloth from '../assets/video-types/image-1.png'
import styleCopyAd from '../assets/viral/image.png'

const Option = Select.Option

const CLONE_CATEGORIES = ['电商商品图', '社媒广告图', '详情页模块', '主图', '场景图', '卖点图', '海报图']
const CLONE_LANGUAGES = ['中文', '英文', '日文', '韩文', '德文', '法文', '意大利文', '西班牙文', '葡萄牙文', '荷兰文', '波兰文', '泰文', '越南文', '印尼文']
const CLONE_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']

export interface GeneratedImageItem {
  id: string
  title: string
  url: string
  badge: '高度复刻' | '参考风格'
  ratio: string
  createTime: string
}

export function ViralReplicationPage() {
  const [productImage, setProductImage] = useState<string | null>(productCloth)
  const [referenceMethod, setReferenceMethod] = useState<'upload' | 'link'>('upload')
  const [referenceImages, setReferenceImages] = useState<string[]>([referenceAd])
  const [referenceLink, setReferenceLink] = useState('')
  const [replicateLevel, setReplicateLevel] = useState<'style' | 'exact'>('exact')
  const [customRequirements, setCustomRequirements] = useState('文案统一用英文、模特保持完全不变、参考图不变只替换商品')
  const [category, setCategory] = useState('电商商品图')
  const [language, setLanguage] = useState('英文')
  const [ratio, setRatio] = useState('1:1')

  const productInputRef = useRef<HTMLInputElement | null>(null)
  const refImagesInputRef = useRef<HTMLInputElement | null>(null)

  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<GeneratedImageItem[]>([])
  const [previewImage, setPreviewImage] = useState<GeneratedImageItem | null>(null)

  // 上传产品图：真实文件选择 + FileReader 预览
  const handleProductUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) setProductImage(e.target.result as string)
    }
    reader.readAsDataURL(file)
  }

  // 上传参考图：多选追加，最多 20 张
  const handleRefImagesUpload = (files: FileList | null) => {
    const list = Array.from(files || [])
    if (!list.length) return
    const slots = 20 - referenceImages.length
    list.slice(0, slots).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          setReferenceImages((prev) => (prev.length >= 20 ? prev : [...prev, e.target!.result as string]))
        }
      }
      reader.readAsDataURL(file)
    })
  }

  // 复刻生成（业务逻辑保持桌面端现状：本地演示流）
  const handleStartReplicate = async () => {
    if (referenceMethod === 'upload' && referenceImages.length === 0) {
      Message.warning('请至少上传一张参考爆款图')
      return
    }
    if (referenceMethod === 'link' && !referenceLink.trim()) {
      Message.warning('请输入要导入的参考爆款链接')
      return
    }

    setGenerating(true)
    try {
      // 模拟高精度生图等待
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const generated: GeneratedImageItem[] = [
        { id: `res-${nanoid(8)}-1`, title: '爆款复刻 · 高度还原营销图', url: highCopyAd, badge: '高度复刻', ratio, createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        { id: `res-${nanoid(8)}-2`, title: '爆款复刻 · 风格化场景融合图', url: styleCopyAd, badge: '参考风格', ratio, createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        { id: `res-${nanoid(8)}-3`, title: '爆款复刻 · 核心卖点强化图', url: referenceAd, badge: '高度复刻', ratio, createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        { id: `res-${nanoid(8)}-4`, title: '爆款复刻 · 氛围感变体展示图', url: productCloth, badge: '参考风格', ratio, createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]
      setResults(generated)
      Message.success('爆款图复刻完成，已生成 4 张专属爆款图')
    } catch {
      Message.error('复刻生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = (item: GeneratedImageItem) => {
    saveAs(item.url, `${item.title}.png`)
    Message.success('已触发保存')
  }

  const addReferenceImages = () => {
    // 演示环境：从内置样图池轮询追加，最多 20 张
    setReferenceImages((prev) => (prev.length >= 20 ? prev : [...prev, [referenceAd, highCopyAd, styleCopyAd][prev.length % 3]]))
  }

  const LABEL_CLASS = 'mb-2 block text-[13px] font-bold text-[#344054]'

  return (
    <div className="relative flex h-full bg-[#F2F4F7]">
      {/* ─── 左侧 360px 配置面板（对照旧版块序①~⑤） ─── */}
      <div className="h-full w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pt-5 pb-4">
        {/* ① 产品原图（可选）：对照旧版蓝虚线占位 + 灰钮，无预览无删除钮 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>产品原图(可选)</span>
          <input
            ref={productInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleProductUpload(e.target.files[0])
              e.currentTarget.value = ''
            }}
          />
          <div
            className="group relative flex h-[94px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#8CC4FF] bg-white"
            onClick={() => productInputRef.current?.click()}
          >
            {productImage ? (
              <>
                <img src={productImage} alt="产品原图" className="absolute inset-0 h-full w-full object-contain p-1.5" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setProductImage(null)
                  }}
                  className="absolute right-1.5 top-1.5 z-10 grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-white/90 text-[#c62828] opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                  title="移除产品图"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="mb-3 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]"
                >
                  <Upload className="h-4 w-4" />
                  上传产品图
                </button>
                <p className="m-0 text-[12px] text-[#8B949E]">有商品需替换时上传，无商品可跳过</p>
              </>
            )}
          </div>
        </div>

        {/* ② 参考内容：双 tab + 上传区/链接 */}
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className={LABEL_CLASS + ' mb-0'}>② 参考内容</span>
            <span className="text-[12px] text-[#86909C]">最多 20 张</span>
          </div>
          <div className="mb-2 flex rounded-lg bg-[#f2f4f7] p-1">
            {(['upload', 'link'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setReferenceMethod(m)}
                className={`h-8 flex-1 cursor-pointer rounded-md border-0 text-[12px] transition-colors ${
                  referenceMethod === m ? 'bg-white font-semibold text-[#3388ff] shadow-sm' : 'bg-transparent text-[#667085]'
                }`}
              >
                {m === 'upload' ? '上传参考图' : '导入链接'}
              </button>
            ))}
          </div>

          {referenceMethod === 'upload' ? (
            <div className="rounded-lg border border-dashed border-[#E3E7EF] bg-white">
              <input
                ref={refImagesInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleRefImagesUpload(e.target.files)
                  e.currentTarget.value = ''
                }}
              />
              {referenceImages.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2.5">
                  {referenceImages.map((src, idx) => (
                    <div key={idx} className="group relative h-[62px] w-[62px] overflow-hidden rounded-md border border-[#e5e8ef]">
                      <img src={src} alt={`参考图 ${idx + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setReferenceImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-white p-0 text-[#c62828] shadow-sm opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {referenceImages.length < 20 && (
                <div
                  className="flex h-[94px] cursor-pointer flex-col items-center justify-center"
                  onClick={() => refImagesInputRef.current?.click()}
                >
                  <button
                    type="button"
                    className="mb-3 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]"
                  >
                    <Upload className="h-4 w-4" />
                    上传参考图
                  </button>
                  <p className="m-0 text-[12px] text-[#8B949E]">最多20张</p>
                </div>
              )}
            </div>
          ) : (
            <Input
              value={referenceLink}
              onChange={setReferenceLink}
              placeholder="粘贴参考爆款链接（商品/笔记页）"
              allowClear
              className="h-10 rounded-lg"
            />
          )}
        </div>

        {/* ③ 复刻程度：grid-cols-2 两说明卡 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>③ 复刻程度</span>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'style', title: '参考风格', desc: '参考整体风格和结构，自动调整色彩和重构场景。' },
              { key: 'exact', title: '高度复刻', desc: '尽量保持参考图版式与元素位置，仅替换商品主体' },
            ] as const).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setReplicateLevel(item.key)}
                className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                  replicateLevel === item.key ? 'border-[#8BBCFF] bg-white ring-1 ring-[#8BBCFF]' : 'border-[#e5e8ef] bg-[#fafbfc] hover:border-[#b8d7ff]'
                }`}
              >
                <p className={`m-0 text-[13px] font-bold ${replicateLevel === item.key ? 'text-[#3388ff]' : 'text-[#0A1B39]'}`}>{item.title}</p>
                <p className="m-0 mt-1 text-[11px] leading-4 text-[#86909C]">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ④ 统一复刻要求 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>④ 统一复刻要求（选填）</span>
          <Input.TextArea
            value={customRequirements}
            onChange={setCustomRequirements}
            rows={3}
            placeholder="例：文案统一用英文、模特保持不变、只替换商品主体"
            className="rounded-lg text-[12px]"
          />
        </div>

        {/* ⑤ 生成设置 */}
        <div className="mb-4">
          <span className={LABEL_CLASS}>⑤ 生成设置</span>
          <Select value={category} onChange={setCategory} className="mb-2 w-full">
            {CLONE_CATEGORIES.map((c) => (
              <Option key={c} value={c}>
                {c}
              </Option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={language} onChange={setLanguage}>
              {CLONE_LANGUAGES.map((l) => (
                <Option key={l} value={l}>
                  {l}
                </Option>
              ))}
            </Select>
            <Select value={ratio} onChange={setRatio}>
              {CLONE_RATIOS.map((r) => (
                <Option key={r} value={r}>
                  {r}
                </Option>
              ))}
            </Select>
          </div>
        </div>

        {/* 吸底生成条（对照旧版，禁用态 bg-[#C4C6CA]） */}
        <div className="sticky bottom-0 -mx-5 mt-2 border-t border-[#EEF1F5] bg-white p-4">
          <Button
            type="primary"
            long
            size="large"
            loading={generating}
            onClick={handleStartReplicate}
            className="rounded-lg font-bold"
          >
            {generating ? 'AI 正在复刻爆款图中...' : '一键复刻爆款图'}
          </Button>
        </div>
      </div>

      {/* ─── 右侧画布区（对照旧版：标题32px + 示例卡 h-384 w-792 / 结果网格） ─── */}
      <div className="h-full min-w-0 flex-1 overflow-y-auto p-6 custom-scrollbar">
        {generating ? (
          <div className="grid h-full place-items-center">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-10 py-8 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
              <Loader2 className="h-8 w-8 animate-spin text-[#3388ff]" />
              <p className="m-0 text-[14px] text-[#4e5969]">AI 正在深度解析参考图视觉特征并融合产品原图，请稍候...</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="mx-auto flex min-h-full max-w-[980px] flex-col items-center justify-center py-8 text-center">
            <h1 className="m-0 text-[32px] font-extrabold text-[#0A1B39]">爆款图复刻</h1>
            <p className="m-0 mt-2 text-[14px] text-[#86909C]">想参考的爆款 + 你的产品图 = 你的爆款图</p>

            {/* 示例卡（对照旧版 h-[384px] w-[792px]：左336参考图+悬浮圆形产品图+双箭头+右2张162px） */}
            <div className="mt-8 flex h-[384px] w-[792px] items-center justify-center gap-4 rounded-2xl border border-[#eef2f8] bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,0.06)]">
              <div className="relative h-[336px] w-[336px] shrink-0 overflow-hidden rounded-xl border border-[#f0f2f5] bg-[#fafbfc]">
                <img src={referenceAd} alt="参考爆款" className="h-full w-full object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#4e5969] shadow-sm">参考爆款</span>
                {productImage && (
                  <div className="absolute -bottom-1 -right-1 h-[104px] w-[104px] overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
                    <img src={productImage} alt="你的产品" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>

              <div className="flex w-10 shrink-0 flex-col items-center gap-1 text-[#c0c4cc]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5m6 6-6-6 6-6" />
                </svg>
              </div>

              <div className="grid h-[336px] w-[336px] shrink-0 grid-rows-2 gap-3">
                <div className="relative overflow-hidden rounded-xl border border-[#f0f2f5] bg-[#fafbfc]">
                  <img src={highCopyAd} alt="复刻结果示意" className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#4e5969] shadow-sm">高度复刻</span>
                </div>
                <div className="relative overflow-hidden rounded-xl border border-[#f0f2f5] bg-[#fafbfc]">
                  <img src={styleCopyAd} alt="风格复刻示意" className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#4e5969] shadow-sm">参考风格</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[1000px] pb-12">
            <div className="mb-6 flex items-center justify-between border-b border-[#e5e8ef] pb-4">
              <div>
                <h2 className="m-0 text-[20px] font-extrabold text-[#0A1B39]">复刻结果</h2>
                <p className="m-0 mt-0.5 text-[12px] text-[#86909C]">共 {results.length} 张爆款图，支持查看大图与保存。</p>
              </div>
              <span className="rounded-full bg-[#f0f7ff] px-3 py-1 text-[12px] font-bold text-[#3388ff]">+{results.length} 张</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {results.map((item) => (
                <div key={item.id} className="group overflow-hidden rounded-xl border border-[#e5e8ef] bg-white shadow-sm">
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#f2f3f5]">
                    <img src={item.url} alt={item.title} className="h-full w-full object-cover" />
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        item.badge === '高度复刻' ? 'bg-[#3388ff] text-white' : 'bg-[#e8f5e9] text-[#2e7d32]'
                      }`}
                    >
                      {item.badge}
                    </span>
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                      比例 {item.ratio}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="m-0 truncate text-[13px] font-bold text-[#0A1B39]">{item.title}</p>
                    <p className="m-0 mt-1 text-[12px] text-[#86909C]">生成时间: {item.createTime}</p>
                    <div className="mt-2.5 flex items-center justify-end gap-2">
                      <Button size="small" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setPreviewImage(item)} className="rounded-lg">
                        查看大图
                      </Button>
                      <Button
                        type="primary"
                        size="small"
                        icon={<Download className="h-3.5 w-3.5" />}
                        onClick={() => handleDownload(item)}
                        className="rounded-lg"
                      >
                        保存图片
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 大图预览 */}
      <Modal
        title={previewImage?.title || '复刻结果大图预览'}
        visible={Boolean(previewImage)}
        onOk={() => setPreviewImage(null)}
        onCancel={() => setPreviewImage(null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="primary"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() => previewImage && handleDownload(previewImage)}
              className="rounded-lg"
            >
              保存图片
            </Button>
            <Button onClick={() => setPreviewImage(null)} className="rounded-lg">
              关闭
            </Button>
          </div>
        }
        style={{ width: 680 }}
      >
        <div className="text-center">
          {previewImage && (
            <img src={previewImage.url} alt={previewImage.title} className="max-h-[65vh] max-w-full rounded-lg object-contain" />
          )}
        </div>
      </Modal>
    </div>
  )
}
