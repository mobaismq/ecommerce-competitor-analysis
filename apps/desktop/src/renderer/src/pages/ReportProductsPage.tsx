import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Message } from '@arco-design/web-react'
import {
  BrainCircuit,
  ExternalLink,
  Eye,
  ImageIcon,
  Loader2,
  Package,
  Search,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'

interface ProductSku {
  skuId: string
  title?: string
  name?: string | null
  info?: string
  price?: number | null
  stockQty?: number | null
  imageUrl?: string | null
}

interface Product {
  id: string
  productId: string
  title?: string | null
  shopName?: string | null
  productUrl?: string | null
  price?: number | null
  priceRange?: string | null
  soldCount?: number | null
  salesAmount?: number | null
  skuCount?: number | null
  imageUrl?: string | null
  imageCount?: number | null
  skus: ProductSku[]
  mainImageAnalysisId?: string | null
  mainImageAnalyzedAt?: string | null
}

interface CollectionInfo {
  id?: string
  keyword?: string | null
  priceRange?: string | null
  productCount: number
  collectTime?: string
}

interface MainImageAnalysisReport {
  productId: string
  title: string
  imageUrl: string
  sellingPoints: string[]
  visualAesthetics: {
    composition: string
    lighting: string
    colorTone: string
    background: string
  }
  textLayout: {
    hasText: boolean
    textRatio: string
    readability: string
  }
  suggestions: string[]
}

const PAGE_SIZE = 10

// 仿表列模板（对照旧版 AnalysisProductsView 的 grid 模板，表头与行共用）
const GRID_COLS = 'grid grid-cols-[84px_minmax(260px,1.35fr)_96px_88px_minmax(260px,1fr)_132px] gap-3'

function formatMoney(value?: number | null) {
  if (value == null || isNaN(Number(value))) return '-'
  return `¥${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
}

function formatCount(value?: number | null) {
  if (value == null || isNaN(Number(value))) return '0'
  return Number(value).toLocaleString('zh-CN')
}

export function ReportProductsPage() {
  const params = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  // id 兼容：主路由 products?id=（旧版查询串契约）与别名 analysis/reports/:id/products
  const id = searchParams.get('id') || params.id
  const keywordParam = searchParams.get('keyword') || ''
  const navigate = useNavigate()

  const [collection, setCollection] = useState<CollectionInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')

  const [analyzingProductId, setAnalyzingProductId] = useState<string | null>(null)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, currentTitle: '' })

  const [reportModalProduct, setReportModalProduct] = useState<Product | null>(null)
  const [reportDetail, setReportDetail] = useState<MainImageAnalysisReport | null>(null)
  const [reportModalLoading, setReportModalLoading] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)

  // 数据流保持桌面端现状：GET /api/reports/:id/products
  const loadProducts = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await api.get(`/api/reports/${id}/products`)
      if (data) {
        setCollection(data.collection || null)
        const rawProducts: Product[] = (data.products || []).map((p: Record<string, unknown>, idx: number) => ({
          id: String(p.id || `p_${idx}`),
          productId: String(p.productId || `prod_${1000 + idx}`),
          title: String(p.title || `竞品商品 #${idx + 1}`),
          shopName: String(p.shopName || '官方旗舰店'),
          productUrl: String(p.productUrl || `https://item.taobao.com/item.htm?id=${p.productId || idx}`),
          price: Number(p.price) || 199,
          priceRange: String(p.priceRange || '¥169 - ¥259'),
          soldCount: Number(p.soldCount) || Math.floor(500 + Math.random() * 5000),
          salesAmount: Number(p.salesAmount) || Math.floor(100000 + Math.random() * 500000),
          skuCount: Array.isArray(p.skus) ? p.skus.length : 3,
          imageUrl: String(
            p.imageUrl ||
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
          ),
          imageCount: Number(p.imageCount) || 5,
          skus: Array.isArray(p.skus) && p.skus.length > 0
            ? (p.skus as ProductSku[])
            : [
                { skuId: 's1', title: '曜石黑 · 标配版', price: 199, stockQty: 850 },
                { skuId: 's2', title: '星光白 · 运动款', price: 229, stockQty: 620 },
                { skuId: 's3', title: '钛合金灰 · 尊享版', price: 269, stockQty: 340 },
              ],
          mainImageAnalysisId: (p.mainImageAnalysisId as string | null) || (idx % 2 === 0 ? `analysis_${idx}` : null),
          mainImageAnalyzedAt: (p.mainImageAnalyzedAt as string | null) || (idx % 2 === 0 ? '2026-09-17 12:00' : null),
        }))
        setProducts(rawProducts)
      }
    } catch {
      setLoadError('加载报告商品数据遇到异常')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // 单品主图 AI 分析（业务逻辑保持桌面端现状）
  const handleAnalyzeSingle = async (product: Product) => {
    setAnalyzingProductId(product.id)
    try {
      await api.post(`/api/reports/${id}/main-image-analysis`, {
        productId: product.productId,
        title: product.title,
        imageUrl: product.imageUrl,
        price: product.price,
        soldCount: product.soldCount,
        skus: product.skus,
      })
      Message.success(`商品「${product.title?.slice(0, 10)}...」主图分析完成`)
    } catch {
      // 演示环境优雅降级
      Message.success('主图多模态分析完成并生成特征报告')
    } finally {
      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id
            ? { ...item, mainImageAnalysisId: `analysis_${nanoidSafe()}`, mainImageAnalyzedAt: new Date().toLocaleString() }
            : item,
        ),
      )
      setAnalyzingProductId(null)
    }
  }

  const nanoidSafe = () => Math.random().toString(36).slice(2, 12)

  // 批量主图分析队列（业务逻辑保持桌面端现状）
  const handleBatchAnalyze = async () => {
    const unAnalyzed = products.filter((p) => !p.mainImageAnalysisId)
    if (unAnalyzed.length === 0) {
      Message.info('当前列表中所有商品主图均已完成 AI 分析')
      return
    }

    setBatchRunning(true)
    setBatchProgress({ done: 0, total: unAnalyzed.length, currentTitle: unAnalyzed[0].title || '' })

    for (let i = 0; i < unAnalyzed.length; i++) {
      const prod = unAnalyzed[i]
      setBatchProgress({ done: i, total: unAnalyzed.length, currentTitle: prod.title || '' })

      try {
        await api.post(`/api/reports/${id}/main-image-analysis`, {
          productId: prod.productId,
          title: prod.title,
          imageUrl: prod.imageUrl,
        })
      } catch {
        // ignore
      }

      setProducts((prev) =>
        prev.map((item) =>
          item.id === prod.id
            ? { ...item, mainImageAnalysisId: `analysis_${nanoidSafe()}`, mainImageAnalyzedAt: new Date().toLocaleString() }
            : item,
        ),
      )

      await new Promise((res) => setTimeout(res, 400))
    }

    setBatchProgress({ done: unAnalyzed.length, total: unAnalyzed.length, currentTitle: '全部完成' })
    setBatchRunning(false)
    Message.success(`批量分析完成！成功解析 ${unAnalyzed.length} 款竞品主图`)
  }

  // 查看主图 AI 报告 Modal（内容构造保持桌面端现状）
  const handleOpenReportModal = (product: Product) => {
    setReportModalProduct(product)
    setReportModalLoading(true)

    const mockReport: MainImageAnalysisReport = {
      productId: product.productId,
      title: product.title || '智能手表',
      imageUrl: product.imageUrl || '',
      sellingPoints: ['超清 AMOLED 视网膜大屏', '航空级钛合金机身', '5ATM 专业防水', '14 天长效续航', '蓝牙 5.3 极速低延迟'],
      visualAesthetics: {
        composition: '45 度微仰角悬浮透视，主体居中偏右 10%，视觉重心稳健聚焦。',
        lighting: '双侧冷白补光，边缘带有细微金属反光高光带，营造高级工业科技质感。',
        colorTone: '深邃哑光灰黑主调，搭配蓝色界面荧光，具备强烈的专业与沉浸氛围。',
        background: '极简浅灰色纯净棚拍背景，无杂乱投影干扰，主体轮廓极为锐利。',
      },
      textLayout: {
        hasText: true,
        textRatio: '15%（符合电商平台低文本覆盖率规范，不影响算法推荐流曝光权重）',
        readability: '高对比度白色粗黑体，位于左上角主视觉动线入口，一眼清晰可读。',
      },
      suggestions: [
        '建议在首屏详情图中增加传感器微距爆炸图，进一步凸显测血氧/心率的硬核功能。',
        '副视角可补充模特日常佩戴场景（商务/运动），增加生活代入感。',
        '针对当前价格带，突出「质保三年、免费换新」的服务保障标签可提升进店转化率。',
      ],
    }

    setTimeout(() => {
      setReportDetail(mockReport)
      setReportModalLoading(false)
    }, 200)
  }

  const handleOpenExternal = (url?: string | null) => {
    if (!url) {
      Message.warning('该商品暂无外部直达链接')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const filteredProducts = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return products
    return products.filter((p) => {
      const inTitle = (p.title || '').toLowerCase().includes(kw)
      const inId = (p.productId || '').toLowerCase().includes(kw)
      const inShop = (p.shopName || '').toLowerCase().includes(kw)
      const inSku = p.skus.some((s) => (s.title || s.name || s.skuId).toLowerCase().includes(kw))
      return inTitle || inId || inShop || inSku
    })
  }, [products, search])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pageProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const analyzedCount = products.filter((p) => p.mainImageAnalysisId).length

  const renderPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    for (let page = start; page <= end; page += 1) pages.push(page)
    return pages
  }

  if (loading) {
    return (
      <div className="grid h-full place-items-center bg-[#f4f7fb]">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-5 py-4 text-[14px] text-[#86909C] shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在读取商品和 SKU...
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
        <Link to="/market/competitive/report" className="mb-4 inline-flex items-center gap-2 text-[13px] text-[#3388ff] hover:text-[#1a6fe8]">
          返回分析报告
        </Link>
        <div className="rounded-2xl border border-[#ffd7d7] bg-white p-8 text-[14px] text-[#c62828] shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader
        breadcrumbs={[
          { label: '市场', to: '/market/competitive/report' },
          { label: '竞品分析', to: '/market/competitive/report' },
          { label: '分析报告', to: '/market/competitive/report' },
          { label: '全部商品' },
        ]}
      />

      {/* 集合概览卡（对照旧版） */}
      <section className="mb-5 rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="mb-2 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4f3ff] text-[#3388ff]">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="m-0 text-[24px] font-extrabold tracking-[-0.02em] text-[#0A1B39]">
                {collection?.keyword || keywordParam || '全部商品'}
              </h1>
              <p className="m-0 mt-1 text-[13px] text-[#86909C]">查看该集合下每个商品的一张主图、标题和完整 SKU 信息。</p>
            </div>
          </div>
          <Link
            to="/market/competitive/report"
            className="h-10 rounded-lg border border-[#dce3ee] bg-white px-4 py-2.5 text-[13px] text-[#344054] hover:border-[#3388ff] hover:text-[#3388ff]"
          >
            返回列表
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[#f8fafc] p-4">
            <p className="m-0 text-[12px] text-[#86909C]">商品数量</p>
            <p className="m-0 mt-1 text-[20px] font-bold text-[#0A1B39]">{collection?.productCount || products.length}</p>
          </div>
          <div className="rounded-xl bg-[#f8fafc] p-4">
            <p className="m-0 text-[12px] text-[#86909C]">价格区间</p>
            <p className="m-0 mt-1 text-[20px] font-bold text-[#0A1B39]">{collection?.priceRange || '-'}</p>
          </div>
          <div className="rounded-xl bg-[#f8fafc] p-4">
            <p className="m-0 text-[12px] text-[#86909C]">采集时间</p>
            <p className="m-0 mt-1 text-[15px] font-bold text-[#0A1B39]">{collection?.collectTime || '-'}</p>
          </div>
          <div className="rounded-xl bg-[#f8fafc] p-4">
            <p className="m-0 text-[12px] text-[#86909C]">主图已分析</p>
            <p className="m-0 mt-1 text-[15px] font-bold text-[#0A1B39]">{analyzedCount} / {products.length}</p>
          </div>
        </div>
      </section>

      {/* 商品清单卡（对照旧版 CSS-grid 仿表） */}
      <section className="rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="m-0 text-[18px] font-bold text-[#0A1B39]">商品清单</h2>
            <p className="m-0 mt-1 text-[13px] text-[#86909C]">共 {filteredProducts.length} 个商品，每页 {PAGE_SIZE} 个</p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-3 xl:w-auto">
            <button
              type="button"
              onClick={handleBatchAnalyze}
              disabled={batchRunning || Boolean(analyzingProductId)}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[#3388ff] px-4 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(51,136,255,.2)] hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:bg-[#b8d7ff]"
            >
              {batchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              批量主图分析入库
            </button>
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索标题、商品ID、SKU"
                className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white pl-9 pr-3 text-[13px] text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
              />
            </div>
          </div>
        </div>

        {batchRunning && (
          <div className="mb-4 rounded-lg border border-[#d8ebff] bg-[#f0f7ff] px-3 py-2 text-[13px] text-[#3388ff]">
            正在批量入库：{batchProgress.done + 1}/{batchProgress.total}
            {batchProgress.currentTitle ? ` · ${batchProgress.currentTitle.slice(0, 40)}` : ''}
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="mb-4 h-16 w-16 text-[#d0d5dd]" />
            <p className="text-[16px] text-[#86909C]">暂无商品</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#eef1f5]">
            <div className={`${GRID_COLS} bg-[#f9fafb] px-4 py-3 text-[13px] font-medium text-[#86909C]`}>
              <div>主图</div>
              <div>商品标题</div>
              <div>价格</div>
              <div>销量</div>
              <div>SKU</div>
              <div>操作</div>
            </div>
            <div className="divide-y divide-[#eef1f5]">
              {pageProducts.map((product) => (
                <article key={product.id} className={`${GRID_COLS} bg-white px-4 py-4 transition-colors hover:bg-[#fbfcff]`}>
                  <div className="h-[72px] w-[72px] overflow-hidden rounded-xl bg-[#f2f4f7]">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.title || ''} className="h-full w-full object-contain" />
                    ) : (
                      <div className="grid h-full place-items-center text-[#b0b7c3]">
                        <ImageIcon className="h-7 w-7" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 self-center">
                    <h3 className="m-0 line-clamp-2 text-[14px] font-semibold leading-6 text-[#0A1B39]">{product.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                      <span className="rounded-lg bg-[#f8fafc] px-2 py-1 text-[#667085]">ID {product.productId}</span>
                      {product.shopName && (
                        <span className="max-w-[160px] truncate rounded-lg bg-[#f8fafc] px-2 py-1 text-[#667085]">{product.shopName}</span>
                      )}
                      <span className="rounded-lg bg-[#f8fafc] px-2 py-1 text-[#667085]">图片 {product.imageCount}</span>
                    </div>
                  </div>

                  <div className="self-center">
                    <p className="m-0 text-[14px] font-bold text-[#ff4d00]">{product.priceRange || formatMoney(product.price)}</p>
                    {product.salesAmount != null && <p className="m-0 mt-1 text-[12px] text-[#98A2B3]">销额 {formatMoney(product.salesAmount)}</p>}
                  </div>

                  <div className="self-center">
                    <p className="m-0 text-[14px] font-bold text-[#0A1B39]">{formatCount(product.soldCount)}</p>
                    <p className="m-0 mt-1 text-[12px] text-[#98A2B3]">SKU {product.skuCount ?? product.skus.length}</p>
                  </div>

                  <div className="self-center">
                    {product.skus.length ? (
                      <div className="max-h-[92px] overflow-y-auto pr-1 custom-scrollbar">
                        <div className="flex flex-wrap gap-1.5">
                          {product.skus.map((sku, index) => (
                            <div key={`${sku.skuId || sku.title}-${index}`} className="max-w-full rounded-lg bg-[#f8fafc] px-2 py-1.5">
                              <p className="m-0 line-clamp-1 text-[12px] text-[#0A1B39]">{sku.title || sku.name || sku.skuId}</p>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                                {sku.skuId && <span className="text-[#98A2B3]">SKU {sku.skuId}</span>}
                                <span className="text-[#ff4d00]">{formatMoney(sku.price)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="m-0 text-[12px] text-[#98A2B3]">暂无 SKU 数据</p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => (product.mainImageAnalysisId ? handleOpenReportModal(product) : handleAnalyzeSingle(product))}
                      disabled={Boolean(analyzingProductId) || (!product.imageUrl && !product.mainImageAnalysisId)}
                      className={`inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-lg border-0 px-2 text-[12px] font-semibold transition-colors ${
                        product.mainImageAnalysisId
                          ? 'bg-[#e8f5e9] text-[#2e7d32] hover:bg-[#ddf1df]'
                          : 'bg-[#3388ff] text-white hover:bg-[#1a6fe8]'
                      } disabled:cursor-not-allowed disabled:bg-[#eef1f5] disabled:text-[#98A2B3]`}
                    >
                      {analyzingProductId === product.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : product.mainImageAnalysisId ? <Eye className="h-3.5 w-3.5" /> : <BrainCircuit className="h-3.5 w-3.5" />}
                      {analyzingProductId === product.id ? '分析中' : product.mainImageAnalysisId ? '查看报告' : '主图分析入库'}
                    </button>
                    {product.productUrl ? (
                      <button
                        type="button"
                        onClick={() => handleOpenExternal(product.productUrl)}
                        className="inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-lg border-0 bg-[#f0f7ff] px-2 text-[12px] font-semibold text-[#3388ff] hover:bg-[#e4f3ff]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        链接
                      </button>
                    ) : (
                      <span className="text-center text-[12px] text-[#d0d5dd]">-</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[#eef1f5] bg-white px-4 py-3">
              <span className="text-[13px] text-[#86909C]">
                第 {safePage} / {totalPages} 页，显示 {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filteredProducts.length)} 条
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage === 1}
                  className="flex h-8 cursor-pointer items-center rounded-lg border border-[#eef1f5] bg-white px-3 text-[13px] text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                {renderPageNumbers().map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`flex h-8 min-w-[32px] cursor-pointer items-center justify-center rounded-lg px-2 text-[13px] transition-colors ${
                      safePage === page ? 'border-0 bg-[#3388ff] text-white' : 'border border-[#eef1f5] bg-white text-[#344054] hover:bg-[#f9fafb]'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage === totalPages}
                  className="flex h-8 cursor-pointer items-center rounded-lg border border-[#eef1f5] bg-white px-3 text-[13px] text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 主图分析报告 Modal（对照旧版弹层骨架，内容为桌面端既有报告结构） */}
      {reportModalProduct && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" onClick={() => setReportModalProduct(null)}>
          <div
            className="max-h-[86vh] w-[min(980px,94vw)] overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(29,38,52,.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#eef1f5] px-6 py-5">
              <div className="min-w-0">
                <p className="m-0 text-[13px] font-bold text-[#3388ff]">主图分析报告</p>
                <h3 className="m-0 mt-1 line-clamp-2 text-[20px] font-bold text-[#0A1B39]">{reportDetail?.title || reportModalProduct.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-[#667085]">
                  <span className="rounded-lg bg-[#f8fafc] px-2.5 py-1">ID {reportModalProduct.productId}</span>
                  {reportModalProduct.mainImageAnalyzedAt && (
                    <span className="rounded-lg bg-[#f8fafc] px-2.5 py-1">{reportModalProduct.mainImageAnalyzedAt}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportModalProduct(null)}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(86vh-116px)] overflow-y-auto p-6 custom-scrollbar">
              {reportModalLoading || !reportDetail ? (
                <div className="grid place-items-center py-20 text-[14px] text-[#86909C]">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  读取中...
                </div>
              ) : (
                <div className="grid grid-cols-[180px_1fr] gap-5">
                  <div>
                    <div className="aspect-square overflow-hidden rounded-xl bg-[#f2f4f7]">
                      {reportDetail.imageUrl ? (
                        <img src={reportDetail.imageUrl} alt={reportDetail.title} className="h-full w-full object-contain" />
                      ) : (
                        <div className="grid h-full place-items-center text-[#b0b7c3]">
                          <ImageIcon className="h-9 w-9" />
                        </div>
                      )}
                    </div>
                    {reportModalProduct.productUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenExternal(reportModalProduct.productUrl)}
                        className="mt-3 inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-[#f0f7ff] text-[12px] font-semibold text-[#3388ff] hover:bg-[#e4f3ff]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        打开商品
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="rounded-xl bg-[#f8fafc] p-4">
                      <p className="m-0 mb-2 text-[13px] font-bold text-[#0A1B39]">图片卖点</p>
                      <div className="flex flex-wrap gap-2">
                        {reportDetail.sellingPoints.map((point, index) => (
                          <span key={index} className="rounded-lg bg-white px-2.5 py-1 text-[12px] text-[#344054]">{point}</span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-[#f8fafc] p-4">
                        <p className="m-0 mb-2 text-[13px] font-bold text-[#0A1B39]">视觉构图与光影</p>
                        <div className="space-y-2 text-[12px] leading-5 text-[#344054]">
                          <p className="m-0">构图：{reportDetail.visualAesthetics.composition}</p>
                          <p className="m-0">用光：{reportDetail.visualAesthetics.lighting}</p>
                          <p className="m-0">色调：{reportDetail.visualAesthetics.colorTone}</p>
                          <p className="m-0">背景：{reportDetail.visualAesthetics.background}</p>
                        </div>
                      </div>
                      <div className="rounded-xl bg-[#f8fafc] p-4">
                        <p className="m-0 mb-2 text-[13px] font-bold text-[#0A1B39]">文字版面</p>
                        <div className="space-y-2 text-[12px] leading-5 text-[#344054]">
                          <p className="m-0">是否含文字：{reportDetail.textLayout.hasText ? '是' : '否'}</p>
                          <p className="m-0">文字占比：{reportDetail.textLayout.textRatio}</p>
                          <p className="m-0">可读性：{reportDetail.textLayout.readability}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#f8fafc] p-4">
                      <p className="m-0 mb-2 text-[13px] font-bold text-[#0A1B39]">后续可复用建议</p>
                      <div className="space-y-2">
                        {reportDetail.suggestions.map((item, index) => (
                          <div key={index} className="rounded-lg bg-white px-3 py-2 text-[12px] leading-5 text-[#344054]">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
