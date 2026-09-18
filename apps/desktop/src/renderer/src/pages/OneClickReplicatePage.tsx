import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Copy, Eye, Folder, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { Button, Input, Message, Modal, Select } from '@arco-design/web-react'
import { api } from '../api/client'
import { saveAs } from 'file-saver'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { XInput } from '../components/XInput'

const Option = Select.Option

interface ProductItem {
  id: string
  name: string
  spuCode: string
  brand: string
  category: string
  status: string
}

interface ReplicateResult {
  id: string
  title: string
  url: string
  badge: string
  ratio: string
  createTime: string
}

const DEFAULT_PRODUCTS: ProductItem[] = [
  { id: 'p1', name: '无线蓝牙耳机 Pro', spuCode: 'SPU-EP-001', brand: 'SoundWave', category: '数码配件', status: 'ACTIVE' },
  { id: 'p2', name: '智能运动手表 Series 5', spuCode: 'SPU-SW-002', brand: 'FitLife', category: '智能穿戴', status: 'ACTIVE' },
  { id: 'p3', name: '法式复古碎花连衣裙 夏季款', spuCode: 'SPU-DR-004', brand: 'ModeParis', category: '女装服饰', status: 'ACTIVE' },
  { id: 'p4', name: '便携快充移动电源 20000mAh', spuCode: 'SPU-PB-003', brand: 'PowerFast', category: '数码配件', status: 'ACTIVE' },
]

const CLONE_CATEGORIES = ['电商商品主图', '社媒广告图', '详情页模块图', '使用场景图', '核心卖点图', '营销海报图']
const CLONE_LANGUAGES = ['中文', '英文', '日文', '韩文', '德语', '法语', '西班牙语', '东南亚多语言']
const CLONE_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']

export function OneClickReplicatePage() {
  const [selectedProductId, setSelectedProductId] = useState<string>('p1')
  const [showProductModal, setShowProductModal] = useState(false)
  const [method, setMethod] = useState<'upload' | 'url'>('upload')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [referenceImages, setReferenceImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=200',
  ])
  const [level, setLevel] = useState<'style' | 'high'>('high')
  const [replicateNote, setReplicateNote] = useState('')
  const [category, setCategory] = useState('电商商品主图')
  const [language, setLanguage] = useState('中文')
  const [ratio, setRatio] = useState('1:1')

  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<ReplicateResult[]>([])
  const [previewImage, setPreviewImage] = useState<ReplicateResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 数据流保持桌面端现状：商品主档列表（远端优先，兜底默认）
  const { data: remoteProducts } = useQuery<ProductItem[]>({
    queryKey: ['products-master'],
    queryFn: async () => {
      try {
        const res = await api.get<ProductItem[]>('/api/products/master')
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data
        }
      } catch {
        // ignore
      }
      try {
        const res = await api.get<ProductItem[]>('/api/products')
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data
        }
      } catch {
        // ignore
      }
      return DEFAULT_PRODUCTS
    },
  })

  const productList = remoteProducts && remoteProducts.length > 0 ? remoteProducts : DEFAULT_PRODUCTS
  const currentProduct = productList.find((p) => p.id === selectedProductId) || productList[0]

  // 处理上传参考图（业务逻辑保持桌面端现状：FileReader 转 dataURL）
  const handleCustomUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        setReferenceImages((prev) => [e.target!.result as string, ...prev].slice(0, 10))
        Message.success('参考图上传成功')
      }
    }
    reader.readAsDataURL(file)
  }

  const removeReferenceImage = (idx: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== idx))
  }

  // 一键复刻（业务逻辑保持桌面端现状：提示词引擎调用 + 本地演示生图）
  const handleStartReplicate = async () => {
    if (!currentProduct) {
      Message.warning('请先选择需要复刻的商品')
      return
    }
    setGenerating(true)
    setResults([])

    try {
      // 优先尝试调后端真实提示词规则引擎或生图链路
      try {
        await api.post('/api/product-sets/generate-prompts', {
          productName: currentProduct.name,
          category,
          language,
          ratio,
          level,
          referenceNote: replicateNote,
        })
      } catch {
        // 后端若处于离线降级状态则平滑过渡
      }

      // 模拟高质 AI 批量生成渲染
      await new Promise((resolve) => setTimeout(resolve, 1800))

      const generated: ReplicateResult[] = [
        { id: 'res-1', title: `${currentProduct.name} · 高度复刻主图`, url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80', badge: '高度复刻', ratio, createTime: new Date().toLocaleTimeString() },
        { id: 'res-2', title: `${currentProduct.name} · 参考风格场景图`, url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80', badge: '参考风格', ratio, createTime: new Date().toLocaleTimeString() },
        { id: 'res-3', title: `${currentProduct.name} · 质感特写爆款图`, url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80', badge: '高度复刻', ratio, createTime: new Date().toLocaleTimeString() },
        { id: 'res-4', title: `${currentProduct.name} · 氛围卖点图`, url: 'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&q=80', badge: '参考风格', ratio, createTime: new Date().toLocaleTimeString() },
      ]
      setResults(generated)
      Message.success('一键复刻完成，已生成 4 张专属爆款图')
    } catch {
      Message.error('复刻生成异常，请重试')
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
      <div className="h-full w-[360px] shrink-0 overflow-y-auto bg-white px-5 pt-6 pb-4">
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
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowProductModal(true)}
              className="flex h-[80px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#8CC4FF] bg-[#f5faff] text-[#3388ff] transition-colors hover:bg-[#eef7ff]"
            >
              <Folder className="mb-1 h-5 w-5" />
              <span className="text-[12px] font-bold">从商品主档中选择</span>
            </button>
          )}
        </div>

        {/* ② 参考内容：双 tab + 虚线区/链接 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>② 参考内容</span>
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
                {referenceImages.length < 10 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid h-14 w-14 cursor-pointer place-items-center rounded-lg border border-dashed border-[#d8e0ea] bg-white text-[#86909C] hover:border-[#3388ff] hover:text-[#3388ff]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="m-0 text-[11px] text-[#98A2B3]">最多 10 张参考图，支持本地多选上传</p>
            </div>
          ) : (
            <Input
              value={referenceUrl}
              onChange={setReferenceUrl}
              placeholder="粘贴参考爆款链接"
              allowClear
              className="h-11 rounded-lg"
            />
          )}
        </div>

        {/* ③ 复刻程度 */}
        <div className="mb-5">
          <span className={LABEL_CLASS}>③ 复刻程度</span>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'style', title: '参考风格复刻', desc: '提取构图光影与排版调性重新演绎' },
              { key: 'high', title: '高度复刻', desc: '保持参考图版式，仅替换商品主体' },
            ] as const).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setLevel(item.key)}
                className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                  level === item.key ? 'border-[#8BBCFF] bg-white ring-1 ring-[#8BBCFF]' : 'border-[#e5e8ef] bg-[#fafbfc] hover:border-[#b8d7ff]'
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
            placeholder="例：文案统一英文、模特不变、仅替换商品"
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
          选择商品主档与参考内容，一键生成属于你商品的高转化专属爆款图。
        </p>

        {generating ? (
          <div className="grid place-items-center rounded-2xl bg-white py-24 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin text-[#3388ff]" />
                <Sparkles className="absolute -right-2 -top-1 h-4 w-4 text-[#f57c00]" />
              </div>
              <p className="m-0 text-[14px] text-[#4e5969]">AI 正在深度复刻中，请稍候...</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          /* 空态：三步流程示意卡（对照旧版 md:grid-cols-3） */
          <div className="rounded-2xl bg-white p-8 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-3">
              {[
                { icon: Folder, title: '选择商品', desc: '从商品主档中选定要复刻的商品' },
                { icon: Copy, title: '导入参考内容', desc: '上传参考爆款图或粘贴链接' },
                { icon: Sparkles, title: '生成复刻', desc: 'AI 按复刻程度输出专属爆款图' },
              ].map((step, idx) => (
                <div key={step.title} className="flex flex-col items-center text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#f0f7ff] text-[#3388ff]">
                    <step.icon className="h-7 w-7" />
                  </div>
                  <p className="m-0 mt-3 text-[14px] font-bold text-[#0A1B39]">
                    {idx + 1}. {step.title}
                  </p>
                  <p className="m-0 mt-1 text-[12px] text-[#86909C]">{step.desc}</p>
                </div>
              ))}
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
                      className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        item.badge === '高度复刻' ? 'bg-[#3388ff] text-white' : 'bg-[#e8f5e9] text-[#2e7d32]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className="m-0 truncate px-3 py-2.5 text-[12px] font-bold text-[#0A1B39]">{item.title}</p>
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
                    {p.spuCode} · {p.brand} · {p.category}
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
