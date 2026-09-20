import { useRef, useState } from 'react'
import { Button, Input, Message, Modal, Select } from '@arco-design/web-react'
import { CircleHelp, Download, Eye, Loader2, Upload } from 'lucide-react'
import { saveAs } from 'file-saver'
import { nanoid } from 'nanoid'
import { api } from '../api/client'

import referenceAd from '../assets/video-types/image-26.png'
import highCopyAd from '../assets/video-types/image-27.png'
import productCloth from '../assets/video-types/image-1.png'
import styleCopyAd from '../assets/viral/image.png'
import suiteArrow from '../assets/viral/arrow.svg'

const Option = Select.Option

const CLONE_CATEGORIES = ['电商商品图', '社媒广告图', '详情页模块', '主图', '场景图', '卖点图', '海报图']
const CLONE_LANGUAGES = ['英文', '中文', '日文', '韩文', '德文', '法文', '意大利文', '西班牙文', '葡萄牙文', '荷兰文', '波兰文', '泰文', '越南文', '印尼文']
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
  const [productImage, setProductImage] = useState<string | null>(null)
  // tab 高亮态：对照旧版 method（legacy:51），切 tab 仅切换高亮，内容区不变
  const [referenceMethod, setReferenceMethod] = useState<'upload' | 'link'>('upload')
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [replicateLevel, setReplicateLevel] = useState<'style' | 'exact'>('exact')
  const [customRequirements, setCustomRequirements] = useState('例如：文案统一用英文、模特保持完全不变、参考图不变只替换商品。')
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

  // 复刻生成：调用真实生图接口；失败保持错误提示，不渲染本地假图。
  const handleStartReplicate = async () => {
    if (referenceImages.length === 0) {
      Message.warning('请至少上传一张参考爆款图')
      return
    }

    setGenerating(true)
    try {
      const levelLabel = replicateLevel === 'style' ? '参考风格' : '高度复刻'
      const prompt = [
        `生成${category}`,
        `复刻程度：${levelLabel}`,
        `画面比例：${ratio}`,
        `文案语言：${language}`,
        customRequirements ? `统一复刻要求：${customRequirements}` : '',
      ].filter(Boolean).join('；')

      const { data } = await api.post('/api/product-sets/generate-image', {
        prompt,
        count: 4,
        jobId: 'viral-replication',
        // 图生图参考图：商品原图 + 上传的爆款参考图（后端去重并限 4 张）
        image: productImage || referenceImages[0],
        images: [...(productImage ? [productImage] : []), ...referenceImages].filter(Boolean),
        ratio,
      })
      const urls: string[] = (data?.images || [])
        .map((item: { url?: string; dataUrl?: string }) => item.url || item.dataUrl || '')
        .filter(Boolean)
      if (!urls.length) throw new Error('生成接口没有返回图片')

      const generated: GeneratedImageItem[] = urls.map((url, i) => ({
        id: `res-${nanoid(8)}-${i + 1}`,
        title: `爆款复刻 · ${category}`,
        url,
        badge: i % 2 === 0 ? '高度复刻' : '参考风格',
        ratio,
        createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }))
      setResults(generated)
      Message.success('爆款图复刻完成')
    } catch (error) {
      Message.error(error instanceof Error && error.message ? error.message : '复刻生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownload = (item: GeneratedImageItem) => {
    saveAs(item.url, `${item.title}.png`)
    Message.success('已触发保存')
  }

  const LABEL_CLASS = 'mb-3 block text-[14px] font-semibold text-[#171A1D]'

  return (
    <div className="relative flex h-full bg-[#F2F4F7]">
      {/* ─── 左侧 360px 配置面板（对照旧版块序①~⑤） ─── */}
      <div className="h-full w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pb-4 pt-5">
        {/* ① 产品原图（可选）：对照旧版蓝虚线占位 + 灰钮，无预览时恒空态、无删除钮 */}
        <div className="mb-5">
          <div className="mb-3 flex items-center gap-1">
            <span className="text-[14px] font-semibold text-[#171A1D]">产品原图(可选)</span>
            <CircleHelp className="h-3.5 w-3.5 text-[#8B949E]" />
          </div>
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
            className="flex h-[94px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#8CC4FF] bg-white"
            onClick={() => productInputRef.current?.click()}
          >
            {productImage ? (
              <img src={productImage} alt="产品原图" className="h-full w-full object-contain p-1.5" />
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

        {/* ② 参考内容：双 tab 仅高亮切换，内容区恒为上传区（对照旧版，无链接输入框/无缩略图） */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>参考内容</span>
          <div className="mb-2 flex rounded-lg bg-[#F2F3F5] p-0.5">
            {(['upload', 'link'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setReferenceMethod(m)}
                className={`h-9 flex-1 cursor-pointer rounded-[8px] border-0 text-[13px] transition-all ${
                  referenceMethod === m ? 'bg-white font-semibold text-[#171A1D] shadow-sm' : 'bg-transparent text-[#8B949E]'
                }`}
              >
                {m === 'upload' ? '上传参考图' : '导入链接'}
              </button>
            ))}
          </div>

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
          </div>
        </div>

        {/* ③ 复刻程度：grid-cols-2 两说明卡 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>复刻程度</span>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'style', title: '参考风格', desc: '参考整体风格和结构，自动调整色彩和重构场景。' },
              { key: 'exact', title: '高度复刻', desc: '参照参考图视觉结构替换产品和文案，场景细节略有差异。' },
            ] as const).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setReplicateLevel(item.key)}
                className={`cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                  replicateLevel === item.key ? 'border-[#8BBCFF] bg-white' : 'border-transparent bg-[#F2F3F5] hover:border-[#b8d7ff]'
                }`}
              >
                <p className="m-0 text-[13px] font-semibold text-[#171A1D]">{item.title}</p>
                <p className="m-0 mt-2 text-[12px] leading-5 text-[#8B949E]">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ④ 统一复刻要求 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>统一复刻要求（选填）</span>
          <Input.TextArea
            value={customRequirements}
            onChange={setCustomRequirements}
            rows={3}
            className="rounded-lg text-[12px]"
          />
        </div>

        {/* ⑤ 生成设置 */}
        <div className="mb-4">
          <span className={LABEL_CLASS}>生成设置</span>
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

        {/* 吸底生成条（对照旧版：恒灰 bg-[#C4C6CA]、文案恒为「一键复刻爆款图」；点击调用真实生图接口） */}
        <div className="sticky bottom-0 -mx-5 mt-2 border-t border-[#EEF1F5] bg-white p-4">
          <button
            type="button"
            disabled={generating}
            onClick={handleStartReplicate}
            className={`h-10 w-full cursor-pointer rounded-lg border-0 bg-[#C4C6CA] text-[13px] font-semibold text-white transition-opacity ${
              generating ? 'cursor-not-allowed opacity-70' : 'hover:opacity-90'
            }`}
          >
            一键复刻爆款图
          </button>
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
            <h1 className="m-0 text-[32px] font-bold leading-tight text-[#171A1D]">爆款图复刻</h1>
            <p className="m-0 mt-3 text-[14px] leading-6 text-[#5F6B7A]">想参考的爆款 + 你的产品图 = 你的爆款图</p>

            {/* 示例卡（对照旧版 h-[384px] w-[792px]：左336参考图+底部居中悬浮圆形产品图+双箭头+右2张162px） */}
            <div className="mt-12 flex h-[384px] w-[792px] items-center gap-4 rounded-[20px] bg-white p-6 shadow-[0_18px_40px_rgba(31,37,45,0.06)]">
              <div className="flex h-[336px] w-[336px] shrink-0 items-center">
                <div className="relative h-[209px] w-[336px] overflow-hidden rounded-[18px] bg-[#fafbfc]">
                  <img src={referenceAd} alt="参考爆款童装广告图" className="block h-full w-full object-contain" />
                  <span className="absolute right-3 top-3 rounded-full bg-[#F2F3F5] px-3 py-1.5 text-[12px] font-semibold text-[#22324D]">参考图</span>
                  <div className="absolute -bottom-9 left-1/2 grid h-28 w-28 -translate-x-1/2 place-items-center rounded-full bg-white shadow-[0_14px_30px_rgba(31,37,45,0.16)]">
                    <img src={productImage ?? productCloth} alt="蓝色童装产品图" className="h-20 w-20 object-contain" />
                    <span className="absolute bottom-3 text-[12px] font-semibold text-[#22324D]">产品图</span>
                  </div>
                </div>
              </div>

              <div className="flex h-[336px] w-10 shrink-0 flex-col items-center justify-center gap-8">
                <img src={suiteArrow} alt="" className="block w-[40px] shrink-0" />
                <img src={suiteArrow} alt="" className="block w-[40px] shrink-0 rotate-90" />
              </div>

              <div className="grid h-[336px] w-[336px] shrink-0 grid-rows-2 justify-items-center gap-3">
                <div className="relative h-[162px] w-[262px] overflow-hidden rounded-[18px] bg-[#fafbfc]">
                  <img src={highCopyAd} alt="高度复刻后的童装广告图" className="block h-full w-full object-contain" />
                  <span className="absolute right-3 top-3 rounded-full bg-[#F2F3F5] px-3 py-1.5 text-[12px] font-semibold text-[#22324D]">高度复刻</span>
                </div>
                <div className="relative h-[162px] w-[261px] overflow-hidden rounded-[18px] bg-[#fafbfc]">
                  <img src={styleCopyAd} alt="参考风格后的童装广告图" className="block h-full w-full object-contain" />
                  <span className="absolute right-3 top-3 rounded-full bg-[#F2F3F5] px-3 py-1.5 text-[12px] font-semibold text-[#22324D]">参考风格</span>
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

      {/* 右下帮助钮（对照旧版 legacy:153） */}
      <button type="button" className="absolute bottom-6 right-8 h-14 w-14 rounded-full border-0 bg-white text-xl shadow-md">
        ?
      </button>
    </div>
  )
}
