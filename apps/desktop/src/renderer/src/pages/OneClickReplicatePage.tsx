import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronRight, CircleHelp, Copy, Eye, Folder, Loader2, Plus, Sparkles, Upload, X } from 'lucide-react'
import { Button, Input, Message, Modal, Select } from '@arco-design/web-react'
import { api } from '../api/client'
import { saveAs } from 'file-saver'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { XInput } from '../components/XInput'
/**
 * 数据契约：
 * - 商品列表走真实 /api/products/master（productName/productCode/brand/productImage/skus）。
 * - 桌面端没有旧版 MOCK_PRODUCTS 的 sku/platform/imageCount/createdAt 契约；缺失字段不渲染、不伪造。
 * - 商品资产缩略图使用 productImage 与 skus[].specImage 的真实图片；无图则诚实空态。
 * - 生成结果走 /api/product-sets/generate-image；无结果时不渲染任何本地样图。
 */

const Option = Select.Option

interface MasterProduct {
  id: string
  productCode: string
  productName: string
  brand: string | null
  productImage?: string | null
  status: string
  skus?: Array<{ id: string; specImage?: string | null }>
}

interface ProductItem {
  id: string
  name: string
  spuCode: string
  brand: string
  productImage?: string | null
  skuImages: string[]
}

interface ProductAsset {
  id: string
  name: string
  url: string
}

interface ReplicateResult {
  id: string
  title: string
  url: string
  badge: string
  ratio: string
  createTime: string
}

// 选项集合逐字对齐旧版 CLONE_OPTIONS（legacy:55-58）
const CLONE_CATEGORIES = ['电商商品图', '社媒广告图', '详情页模块', '主图', '场景图', '卖点图', '海报图']
const CLONE_LANGUAGES = ['英文', '中文', '日文', '韩文', '德文', '法文', '意大利文', '西班牙文', '葡萄牙文', '荷兰文', '波兰文', '泰文', '越南文', '印尼文']
const CLONE_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']

export function OneClickReplicatePage() {
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [method, setMethod] = useState<'upload' | 'url'>('upload')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [level, setLevel] = useState<'style' | 'high'>('high')
  const [replicateNote, setReplicateNote] = useState('')
  const [category, setCategory] = useState('电商商品图')
  const [language, setLanguage] = useState('英文')
  const [ratio, setRatio] = useState('1:1')

  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<ReplicateResult[]>([])
  const [previewImage, setPreviewImage] = useState<ReplicateResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 数据流：真实商品主档；空列表/接口失败保持诚实空态，不回填假商品。
  const { data: remoteProducts, isLoading: productsLoading } = useQuery<MasterProduct[]>({
    queryKey: ['products-master'],
    queryFn: async () => {
      const res = await api.get<MasterProduct[]>('/api/products/master')
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const productList = (remoteProducts || []).map((p) => ({
    id: p.id,
    name: p.productName,
    spuCode: p.productCode,
    brand: p.brand || '',
    productImage: p.productImage || null,
    skuImages: (p.skus || []).map((sku) => sku.specImage || '').filter(Boolean),
  }))
  const currentProduct = productList.find((p) => p.id === selectedProductId) ?? null
  const selectedAssets: ProductAsset[] = [
    ...(currentProduct?.productImage ? [{ id: `${currentProduct.id}-main`, name: '商品主图', url: currentProduct.productImage }] : []),
    ...(currentProduct?.skuImages || []).map((url, i) => ({ id: `${currentProduct?.id}-sku-${i}`, name: `规格图 ${i + 1}`, url })),
  ]

  // 处理上传参考图（业务逻辑保持桌面端现状：FileReader 转 dataURL）
  const handleCustomUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        setReferenceImages((prev) => [e.target!.result as string, ...prev].slice(0, 20))
        Message.success('参考图上传成功')
      }
    }
    reader.readAsDataURL(file)
  }

  const removeReferenceImage = (idx: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== idx))
  }

  // 一键复刻：调用真实生图接口；失败保持错误提示，不渲染本地假图。
  const handleStartReplicate = async () => {
    if (!currentProduct) {
      Message.warning('请先选择需要复刻的商品')
      return
    }
    setGenerating(true)
    setResults([])

    try {
      const levelLabel = level === 'style' ? '参考风格' : '高度复刻'
      const prompt = [
        `生成${category}`,
        `商品：${currentProduct.name}`,
        `复刻程度：${levelLabel}`,
        `画面比例：${ratio}`,
        `文案语言：${language}`,
        replicateNote ? `补充要求：${replicateNote}` : '',
      ].filter(Boolean).join('；')

      const { data } = await api.post('/api/product-sets/generate-image', {
        prompt,
        count: 4,
        jobId: `one-click-replicate-${currentProduct.id}`,
      })
      const urls: string[] = (data?.images || [])
        .map((item: { url?: string; dataUrl?: string }) => item.url || item.dataUrl || '')
        .filter(Boolean)

      if (!urls.length) throw new Error('生成接口没有返回图片')

      const generated: ReplicateResult[] = urls.map((url, i) => ({
        id: `res-${i + 1}-${url.slice(-12)}`,
        title: `${currentProduct.name} - ${category}`,
        url,
        badge: i % 2 === 0 ? '高度复刻' : '参考风格',
        ratio,
        createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }))
      setResults(generated)
      Message.success('一键复刻完成')
    } catch (error) {
      Message.error(error instanceof Error && error.message ? error.message : '复刻生成异常，请重试')
    } finally {
      setGenerating(false)
    }
  }

  const downloadResult = (item: ReplicateResult) => {
    saveAs(item.url, `${item.title}.jpg`)
    Message.success('已触发图片保存')
  }

  const LABEL_CLASS = 'mb-2 block text-[13px] font-bold text-[#344054]'

  return (
    <div className="relative flex h-full bg-[#f4f7fb]">
      {/* ─── 左侧 360px 配置面板（无 border-r，对照旧版） ─── */}
      <div className="h-full w-[360px] shrink-0 overflow-y-auto bg-white px-4 pt-7 pb-28 custom-scrollbar sm:px-6">
        <Link
          to="/asset/image-gallery"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[#667085] hover:text-[#3388ff]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回资产库
        </Link>

        {/* ① 选择商品 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>① 选择商品</span>
          {currentProduct ? (
            <div className="rounded-xl border border-[#e5e8ef] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[13px] font-bold text-[#0A1B39]">{currentProduct.name}</p>
                  <p className="m-0 mt-0.5 text-[11px] text-[#86909C]">
                    {currentProduct.spuCode} · {currentProduct.brand}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductModal(true)}
                  className="shrink-0 cursor-pointer rounded-lg border-0 bg-[#f0f7ff] px-2.5 py-1 text-[11px] font-bold text-[#3388ff] hover:bg-[#e4f3ff]"
                >
                  更换
                </button>
              </div>
              {selectedAssets.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {selectedAssets.map((a) => (
                    <div key={a.id} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#f2f4f7]">
                      <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowProductModal(true)}
              className="flex h-[80px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#8CC4FF] bg-[#f5faff] text-[#3388ff] transition-colors hover:bg-[#eef7ff]"
            >
              <Folder className="mb-1 h-5 w-5" />
              <span className="text-[12px] font-bold">点击选择商品</span>
            </button>
          )}
        </div>

        {/* ② 参考内容：双 tab + 虚线区/链接 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>
            ② 参考内容
            <CircleHelp className="mb-0.5 ml-1 inline h-3.5 w-3.5 text-[#86909C]" />
          </span>
          <div className="mb-2 flex rounded-lg bg-[#f2f4f7] p-1">
            {(['upload', 'url'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`h-8 flex-1 cursor-pointer rounded-md border-0 text-[12px] transition-colors ${
                  method === m ? 'bg-white font-semibold text-[#3388ff] shadow-sm' : 'bg-transparent text-[#667085]'
                }`}
              >
                {m === 'upload' ? '上传参考图' : '导入链接'}
              </button>
            ))}
          </div>

          {method === 'upload' ? (
            <div className="rounded-2xl border border-dashed border-[#d8e0ea] bg-[#fafbfc] p-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  Array.from(e.target.files || []).forEach((f) => handleCustomUpload(f))
                  e.currentTarget.value = ''
                }}
              />
              <div className="mb-2 flex flex-wrap gap-2">
                {referenceImages.map((src, idx) => (
                  <div key={idx} className="group relative h-14 w-14 overflow-hidden rounded-lg border border-[#e5e8ef]">
                    <img src={src} alt={`参考图 ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeReferenceImage(idx)}
                      className="absolute right-0.5 top-0.5 grid h-5 w-5 cursor-pointer place-items-center rounded-full border-0 bg-white/90 text-[#c62828] opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {referenceImages.length < 20 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid h-14 w-14 cursor-pointer place-items-center rounded-lg border border-dashed border-[#d8e0ea] bg-white text-[#86909C] hover:border-[#3388ff] hover:text-[#3388ff]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="m-0 text-[11px] text-[#98A2B3]">最多 20 张</p>
            </div>
          ) : (
            <div>
              <Input
                value={referenceUrl}
                onChange={setReferenceUrl}
                placeholder="粘贴商品链接或图片链接..."
                allowClear
                className="h-11 rounded-lg"
              />
              <p className="m-0 mt-2 text-[12px] text-[#86909C]">支持亚马逊、TikTok、速卖通等平台链接</p>
            </div>
          )}
        </div>

        {/* ③ 复刻程度 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>③ 复刻程度</span>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'style', title: '参考风格', desc: '参考整体风格和结构，自动调整色彩和重构场景。' },
              { key: 'high', title: '高度复刻', desc: '参照参考图视觉结构替换产品和文案，场景细节略有差异。' },
            ] as const).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setLevel(item.key)}
                className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                  level === item.key ? 'border border-[#8bbcff] bg-white shadow-sm' : 'bg-[#f5f6f8]'
                }`}
              >
                <p className={`m-0 text-[13px] font-bold ${level === item.key ? 'text-[#3388ff]' : 'text-[#0A1B39]'}`}>{item.title}</p>
                <p className="m-0 mt-1 text-[11px] leading-4 text-[#86909C]">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ④ 统一复刻要求 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>④ 统一复刻要求（选填）</span>
          <Input.TextArea
            value={replicateNote}
            onChange={setReplicateNote}
            rows={3}
            placeholder="例如：文案统一用英文、模特保持完全不变、参考图不变只替换商品。"
            className="rounded-lg text-[12px]"
          />
        </div>

        {/* ⑤ 生成设置（对照旧版 h-[42px] 大号 Select） */}
        <div className="mb-4">
          <span className={LABEL_CLASS}>⑤ 生成设置</span>
          <div className="space-y-2">
            <Select value={category} onChange={setCategory} size="large" className="w-full">
              {CLONE_CATEGORIES.map((c) => (
                <Option key={c} value={c}>
                  {c}
                </Option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Select size="large" value={language} onChange={setLanguage}>
                {CLONE_LANGUAGES.map((l) => (
                  <Option key={l} value={l}>
                    {l}
                  </Option>
                ))}
              </Select>
              <Select size="large" value={ratio} onChange={setRatio}>
                {CLONE_RATIOS.map((r) => (
                  <Option key={r} value={r}>
                    {r}
                  </Option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* 吸底生成条（对照旧版渐变钮） */}
        <div className="sticky bottom-0 -mx-5 mt-2 bg-white p-4">
          <Button
            type="primary"
            long
            size="large"
            loading={generating}
            disabled={!selectedProductId || generating}
            onClick={handleStartReplicate}
            className="rounded-lg font-bold"
          >
            {generating ? '复刻中...' : '一键复刻爆款图'}
          </Button>
        </div>
      </div>

      {/* ─── 右侧画布区（PageHeader + 三态内容） ─── */}
      <div className="h-full min-w-0 flex-1 overflow-y-auto p-6 custom-scrollbar">
        <PageHeader title="一键复刻" />
        <p className="m-0 -mt-2 mb-5 text-[13px] text-[#86909C]">
          选择商品 + 参考爆款 = 你的专属爆款图
        </p>

        {generating ? (
          <div className="grid place-items-center rounded-2xl bg-white py-24 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin text-[#3388ff]" />
                <Sparkles className="absolute -right-2 -top-1 h-4 w-4 text-[#f57c00]" />
              </div>
              <p className="m-0 text-[18px] font-bold text-[#0A1B39]">正在复刻中...</p>
              <p className="m-0 text-[14px] text-[#86909C]">AI 正在分析参考图并生成专属爆款图，请稍候</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          /* 空态：三步流程示意卡（逐字对齐旧版 :287-304，去掉新增序号，保留连接箭头） */
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-[0_18px_50px_rgba(29,38,52,.06)] sm:p-8">
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-3 md:gap-6">
              {[
                {
                  selected: Boolean(currentProduct),
                  icon: currentProduct ? Check : Folder,
                  title: '选择商品',
                  desc: currentProduct ? `已选：${currentProduct.name}` : '从资产库中选择要复刻的商品',
                },
                { selected: false, icon: Upload, title: '上传参考图', desc: '上传或导入你想复刻的爆款图片' },
                { selected: false, icon: Sparkles, title: '一键生成', desc: 'AI 自动复刻，生成高度还原的爆款图' },
              ].map((step) => (
                <div key={step.title} className="flex flex-col items-center text-center">
                  <div
                    className={`mb-4 grid h-16 w-16 place-items-center rounded-2xl ${
                      step.selected ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#f2f4f7] text-[#86909C]'
                    }`}
                  >
                    <step.icon className="h-7 w-7" />
                  </div>
                  <p className="m-0 text-[15px] font-bold text-[#0A1B39]">{step.title}</p>
                  <p className="m-0 mt-1.5 text-[13px] text-[#86909C]">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* 连接箭头（旧版 :308-315） */}
            <div className="mt-6 flex items-center justify-center gap-4 text-[#c8d3e2]">
              <div className="h-px flex-1 bg-[#e9edf3]" />
              <ChevronRight className="h-5 w-5" />
              <div className="h-px flex-1 bg-[#e9edf3]" />
              <ChevronRight className="h-5 w-5" />
              <div className="h-px flex-1 bg-[#e9edf3]" />
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="m-0 text-[18px] font-extrabold text-[#0A1B39]">复刻结果</h2>
                <span className="rounded-full bg-[#e8f5e9] px-2.5 py-1 text-[12px] font-bold text-[#2e7d32]">+{results.length} 张</span>
              </div>
              <Button size="small" onClick={handleStartReplicate} loading={generating} className="rounded-lg">
                重新生成
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {results.map((item) => (
                <div key={item.id} className="group overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#f2f3f5]">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 grid place-items-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(item)}
                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-white text-[#0A1B39]"
                        title="查看大图"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadResult(item)}
                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-0 bg-white text-[#0A1B39]"
                        title="保存图片"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <span
                      className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        item.badge === '高度复刻' ? 'bg-[#3388ff] text-white' : 'bg-[#e8f5e9] text-[#2e7d32]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="m-0 truncate text-[12px] font-bold text-[#0A1B39]">{item.title}</p>
                    <p className="m-0 mt-1 text-[12px] text-[#86909C]">{item.badge} · 刚刚生成</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 商品选择 Modal（对照旧版 w-min(600px,90vw) max-h-70vh） */}
      <Modal
        title="选择商品"
        visible={showProductModal}
        onCancel={() => setShowProductModal(false)}
        footer={null}
        style={{ width: 'min(600px, 90vw)' }}
      >
        <div className="max-h-[calc(70vh-64px)] overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-2">
            {productList.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProductId(p.id)
                  setShowProductModal(false)
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                  p.id === currentProduct?.id ? 'border-[#3388ff] bg-[#eef5ff]' : 'border-[#eef1f5] bg-white hover:border-[#c9ddff]'
                }`}
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-[13px] font-bold text-[#0A1B39]">{p.name}</p>
                  <p className="m-0 mt-0.5 text-[11px] text-[#86909C]">
                    {p.spuCode}{p.brand ? ` · ${p.brand}` : ''}
                  </p>
                </div>
                {p.id === currentProduct?.id && (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#3388ff] text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* 结果大图预览 Modal */}
      <Modal
        title={previewImage?.title || '结果大图预览'}
        visible={Boolean(previewImage)}
        onCancel={() => setPreviewImage(null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              type="primary"
              icon={<Copy className="h-3.5 w-3.5" />}
              onClick={() => previewImage && downloadResult(previewImage)}
              className="rounded-lg"
            >
              保存图片
            </Button>
            <Button onClick={() => setPreviewImage(null)} className="rounded-lg">
              关闭
            </Button>
          </div>
        }
        style={{ width: 640 }}
      >
        {previewImage && (
          <img src={previewImage.url} alt={previewImage.title} className="max-h-[65vh] max-w-full rounded-lg object-contain" />
        )}
      </Modal>
    </div>
  )
}
