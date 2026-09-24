import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, Eye, Loader2, Search, Trash2 } from 'lucide-react'
import { Button, Message, Modal } from '@arco-design/web-react'
import { api } from '../api/client'
import { saveAs } from 'file-saver'
import { PageHeader } from '../components/PageHeader'
import { XSearchInput } from '../components/XInput'

interface Asset {
  id: string
  storageKey: string
  mimeType: string
  size: number
  runId: string | null
  jobId?: string | null
  sourceUrl?: string | null
  originalName?: string | null
  category?: string | null
  prompt?: string | null
  ratio?: string | null
  productName?: string | null
  productId?: string | null
  createdBy?: string | null
  platform?: string | null
  createdAt?: string
}

const PAGE_SIZE = 80

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

/** 按已落库的 productName 归组；没有商品名的不伪造关联，单独成组。 */
function groupImages(images: Asset[]) {
  const groups = new Map<string, Asset[]>()
  for (const asset of images) {
    const key = asset.productName?.trim() || '未关联商品'
    const list = groups.get(key) ?? []
    list.push(asset)
    groups.set(key, list)
  }
  return [...groups.entries()]
}

function GalleryGrid({
  images,
  groups,
  filteredImages,
  downloadingId,
  typeLabel,
  getDisplayUrl,
  onPreview,
  onDownload,
  onDelete,
}: {
  images: Asset[]
  groups: Array<[string, Asset[]]> | null
  filteredImages: Asset[]
  downloadingId: string | null
  typeLabel: (asset: Asset) => string
  getDisplayUrl: (asset: Asset) => string
  onPreview: (index: number) => void
  onDownload: (asset: Asset) => void
  onDelete: (asset: Asset) => void
}) {
  const renderCard = (asset: Asset) => {
    const fileName = asset.originalName || asset.storageKey.split('/').pop() || asset.storageKey
    return (
      <div key={asset.id} className="overflow-hidden rounded-lg border border-[#eef1f5] bg-white">
        <div className="group relative aspect-square cursor-pointer bg-[#f7f8fa]" onClick={() => onPreview(filteredImages.indexOf(asset))}>
          <img src={getDisplayUrl(asset)} alt={fileName} loading="lazy" className="h-full w-full object-contain p-1" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
            <span onClick={(e) => { e.stopPropagation(); onPreview(filteredImages.indexOf(asset)) }} className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#0A1B39] hover:bg-white" title="查看"><Eye className="h-3.5 w-3.5" /></span>
            <span onClick={(e) => { e.stopPropagation(); onDownload(asset) }} className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#0A1B39] hover:bg-white" title="下载">{downloadingId === asset.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}</span>
            <span onClick={(e) => { e.stopPropagation(); onDelete(asset) }} className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#0A1B39] hover:bg-white" title="删除"><Trash2 className="h-3.5 w-3.5" /></span>
          </div>
        </div>
        <div className="p-2">
          <p className="m-0 truncate text-[12px] font-semibold text-[#0A1B39]" title={fileName}>{fileName}</p>
          <div className="mt-1 flex items-center justify-between text-[11px] text-[#98A2B3]">
            <span>{typeLabel(asset)}</span>
            <span>{asset.ratio || formatBytes(asset.size)}</span>
          </div>
          {asset.platform && <p className="m-0 mt-0.5 truncate text-[11px] text-[#c0c4cc]">{asset.platform}</p>}
          {asset.productName && <p className="m-0 mt-0.5 truncate text-[11px] text-[#c0c4cc]">关联：{asset.productName}</p>}
          {asset.createdBy && <p className="m-0 mt-0.5 truncate text-[11px] text-[#c0c4cc]">创建人：{asset.createdBy}</p>}
        </div>
      </div>
    )
  }

  if (!groups) return <div className="grid grid-cols-8 gap-3">{images.map(renderCard)}</div>
  return (
    <div className="flex flex-col gap-5">
      {groups.map(([name, assets]) => (
        <section key={name}>
          <p className="m-0 mb-2 text-[13px] font-extrabold text-[#0A1B39]">{name}<span className="ml-2 font-medium text-[#98A2B3]">{assets.length} 张</span></p>
          <div className="grid grid-cols-8 gap-3">{assets.map(renderCard)}</div>
        </section>
      ))}
    </div>
  )
}

export function ImageGalleryPage() {
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [formatFilter, setFormatFilter] = useState('ALL')
  const [productFilter, setProductFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [applied, setApplied] = useState({ keyword: '', type: 'ALL', format: 'ALL', product: 'ALL', start: '', end: '' })
  const [groupByProduct, setGroupByProduct] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  // 轮播大图预览状态
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)
  // 真实落盘字节的 objectURL 缓存（<img> 带不了鉴权头，故用 token-fetch 预取 raw 转 blob）
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({})

  // 数据流保持桌面端现状：GET /api/assets + react-query
  const { data = [], isLoading, refetch } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: async () => {
      const response = await api.get<Asset[]>('/api/assets')
      return response.data
    },
  })

  // 筛选图片类型资产
  const imageAssets = useMemo(() => {
    return data.filter((item) => {
      return (
        item.mimeType?.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(item.storageKey)
      )
    })
  }, [data])

  // 搜索和多维过滤（应用态，对照旧版「查询」模式）
  const filteredImages = useMemo(() => {
    return imageAssets.filter((item) => {
      const name = item.originalName || item.storageKey.split('/').pop() || item.storageKey
      const kw = applied.keyword.trim().toLowerCase()
      const matchKeyword =
        !kw ||
        name.toLowerCase().includes(kw) ||
        item.storageKey.toLowerCase().includes(kw) ||
        (item.prompt || '').toLowerCase().includes(kw) ||
        (item.runId || item.jobId || '').toLowerCase().includes(kw)

      const matchFormat =
        applied.format === 'ALL' ||
        item.mimeType?.toLowerCase().includes(applied.format.toLowerCase()) ||
        item.storageKey.toLowerCase().endsWith(applied.format.toLowerCase())

      const category = (item.category || '').toLowerCase()
      const matchType =
        applied.type === 'ALL' ||
        (applied.type === 'main' && (category.includes('白底') || category.includes('场景') || category.includes('卖点') || category.includes('细节'))) ||
        (applied.type === 'aplus' && (category.includes('详情') || category.includes('aplus'))) ||
        (applied.type === 'viral' && (category.includes('复刻') || category.includes('爆款'))) ||
        (applied.type === 'other' && !category)

      const matchProduct = applied.product === 'ALL' || (item.productName?.trim() || '') === applied.product

      const matchStart = !applied.start || (item.createdAt && item.createdAt >= applied.start)
      const matchEnd = !applied.end || (item.createdAt && item.createdAt <= applied.end + ' 23:59:59')
      return matchKeyword && matchFormat && matchType && matchProduct && matchStart && matchEnd
    })
  }, [imageAssets, applied])

  // 关联商品下拉选项（来自已落库的真实 productName，不伪造）
  const productOptions = useMemo(
    () => Array.from(new Set(imageAssets.map((a) => a.productName?.trim()).filter((name): name is string => Boolean(name)))),
    [imageAssets],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [applied])

  // 预取真实落盘字节为 objectURL：图库优先展示持久资产，而非模型可能过期的 sourceUrl
  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('eca.token')
    const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8787'
    const load = async () => {
      const next: Record<string, string> = {}
      await Promise.all(
        imageAssets.map(async (asset) => {
          if (asset.size === 0) return // 无真实落盘字节的占位资产不预取 raw，避免 404/401
          try {
            const res = await fetch(`${baseURL}/api/assets/${asset.id}/raw`, {
              headers: token ? { authorization: `Bearer ${token}` } : {},
            })
            if (!res.ok) return
            const blob = await res.blob()
            next[asset.id] = URL.createObjectURL(new Blob([blob], { type: asset.mimeType || res.headers.get('content-type') || 'image/png' }))
          } catch {
            /* 单个失败回退 sourceUrl/raw */
          }
        }),
      )
      if (!cancelled) setBlobUrls(next)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [imageAssets])

  // 生成图优先展示真实落盘字节（objectURL）；未加载/无字节时回退 sourceUrl；仅当确有落盘字节(size>0)才走 raw 流，
  // 避免旧占位资产(假 storageKey、size 0、磁盘无文件)打到 raw 端点产生 404/401。
  const getDisplayUrl = (asset: Asset) => {
    if (blobUrls[asset.id]) return blobUrls[asset.id]
    if (asset.sourceUrl) return asset.sourceUrl
    if (asset.size > 0) {
      const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8787'
      return `${baseURL}/api/assets/${asset.id}/raw`
    }
    return ''
  }

  // 下载单张图片：优先真实落盘字节（token 鉴权 raw 拉流），失败才回退 sourceUrl
  const handleDownload = async (asset: Asset) => {
    setDownloadingId(asset.id)
    try {
      const token = localStorage.getItem('eca.token')
      const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8787'
      const name = asset.originalName || asset.storageKey.split('/').pop() || `image-${asset.id}.png`
      // 无真实落盘字节(size 0)的占位资产跳过 raw，直接回退 sourceUrl，避免 404/401
      const rawUrl = `${baseURL}/api/assets/${asset.id}/raw`
      const res = asset.size > 0
        ? await fetch(rawUrl, { headers: token ? { authorization: `Bearer ${token}` } : {} })
        : null
      if (res && res.ok) {
        const blob = await res.blob()
        saveAs(blob, name)
      } else if (asset.sourceUrl) {
        saveAs(asset.sourceUrl, name)
      } else {
        throw new Error('下载失败')
      }
      Message.success('已开始下载图片')
    } catch {
      Message.error('下载图片失败')
    } finally {
      setDownloadingId(null)
    }
  }

  // 批量下载全部筛选结果（业务逻辑保持桌面端现状）
  const handleBatchDownload = () => {
    if (filteredImages.length === 0) return
    setZipping(true)
    try {
      const items = filteredImages.slice(0, 20)
      items.forEach((asset, idx) => {
        setTimeout(() => {
          void handleDownload(asset)
        }, idx * 250)
      })
      Message.success(`正在批量下载前 ${items.length} 张图片...`)
    } catch {
      Message.error('批量下载失败，请重试')
    } finally {
      setTimeout(() => setZipping(false), 2000)
    }
  }

  // 删除图片（确认后调用后端删除端点并刷新列表，形成闭环）
  const handleDelete = async (asset: Asset) => {
    const name = asset.originalName || asset.storageKey.split('/').pop() || asset.storageKey
    Modal.confirm({
      title: '删除图片',
      content: `确定删除「${name}」吗？删除后不可恢复。`,
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        try {
          // 图库资产来源不限于 generated-images，统一走通用资产删除端点，避免对非生成图资产 404
          await api.delete(`/api/assets/${asset.id}`)
          Message.success('图片已删除')
          void refetch()
        } catch {
          Message.error('删除图片失败')
        }
      },
    })
  }

  const totalPages = Math.max(1, Math.ceil(filteredImages.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pageImages = filteredImages.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const currentPreviewAsset = previewIndex !== null ? filteredImages[previewIndex] : null
  const typeLabel = (asset: Asset) => {
    const category = asset.category || asset.originalName || asset.storageKey
    if (/白底|场景|卖点|细节|主图/.test(category)) return '商品主图'
    if (/详情|aplus/i.test(category)) return '详情图'
    if (/复刻|爆款/.test(category)) return '爆款复刻'
    return '其他素材'
  }

  return (
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        <PageHeader breadcrumbs={[{ label: '资产库' }, { label: '图库' }]} className="mb-2" />

        {/* 查询条件卡（对照旧版两行：筛选字段 + 查询/重置/批量下载） */}
        <div className="mb-4 rounded-xl bg-white p-4">
          <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">图片名称</label>
            <XSearchInput
              value={keyword}
              onChange={setKeyword}
              onEnter={() => setApplied({ keyword, type: typeFilter, format: formatFilter, product: productFilter, start: startDate, end: endDate })}
              placeholder="请输入"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">图片类型</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] outline-none focus:border-[#409eff] ${typeFilter === 'ALL' ? 'text-[#98A2B3]' : 'text-[#0A1B39]'}`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c0c4cc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="ALL">全部类型</option>
              <option value="main">商品主图</option>
              <option value="aplus">详情图 A+</option>
              <option value="viral">爆款复刻</option>
              <option value="other">其他素材</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">格式</label>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] outline-none focus:border-[#409eff] ${formatFilter === 'ALL' ? 'text-[#98A2B3]' : 'text-[#0A1B39]'}`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c0c4cc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="ALL">全部格式</option>
              <option value="png">PNG 格式</option>
              <option value="jpeg">JPG / JPEG</option>
              <option value="webp">WEBP 格式</option>
              <option value="svg">SVG 矢量</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">关联商品</label>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] outline-none focus:border-[#409eff] ${productFilter === 'ALL' ? 'text-[#98A2B3]' : 'text-[#0A1B39]'}`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c0c4cc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="ALL">全部商品</option>
              {productOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          </div>
          </div>

          {/* 第二行：创建时间 + 查询/重置/批量下载（对照旧版第二行） */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">创建时间</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 rounded-lg border border-[#e6e9ef] bg-white px-2 text-[13px] outline-none focus:border-[#409eff]"
            />
            <span className="text-[12px] text-[#86909C]">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 rounded-lg border border-[#e6e9ef] bg-white px-2 text-[13px] outline-none focus:border-[#409eff]"
            />
          </div>
          <button
            type="button"
            onClick={() => setApplied({ keyword, type: typeFilter, format: formatFilter, product: productFilter, start: startDate, end: endDate })}
            className="h-8 shrink-0 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff]"
          >
            查询
          </button>
          <button
            type="button"
            onClick={() => {
              setKeyword('')
              setTypeFilter('ALL')
              setFormatFilter('ALL')
              setProductFilter('ALL')
              setStartDate('')
              setEndDate('')
              setApplied({ keyword: '', type: 'ALL', format: 'ALL', product: 'ALL', start: '', end: '' })
            }}
            className="h-8 shrink-0 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-4 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
          >
            重置
          </button>
          <button
            type="button"
            onClick={handleBatchDownload}
            disabled={zipping || filteredImages.length === 0}
            className="ml-auto flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#dce3ee] bg-white px-3 text-[12px] font-semibold text-[#344054] hover:border-[#3388ff] hover:text-[#3388ff] disabled:cursor-not-allowed disabled:opacity-50"
            title="批量下载前 20 张筛选结果"
          >
            {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            批量下载
          </button>
        </div>

        {/* 图片网格（对照旧版 grid-cols-8 密集网格） */}
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setGroupByProduct((value) => !value)}
            className={`h-8 cursor-pointer rounded-lg border px-3 text-[13px] ${groupByProduct ? 'border-[#3388ff] bg-[#f0f7ff] text-[#3388ff]' : 'border-[#e6e9ef] bg-white text-[#344054]'}`}
          >
            {groupByProduct ? '取消按商品归组' : '按商品归组'}
          </button>
        </div>
        {isLoading ? (
          <div className="grid place-items-center rounded-xl bg-white py-20 text-[14px] text-[#86909C]">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            加载中…
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white py-20">
            <Search className="mb-4 h-14 w-14 text-[#d0d5dd]" />
            <p className="text-[16px] text-[#86909C]">暂无数据</p>
            <p className="m-0 mt-1 text-[13px] text-[#98A2B3]">
              {applied.keyword || applied.format !== 'ALL' || applied.type !== 'ALL'
                ? '未找到符合条件的图片资产'
                : '可在「商品主图」或「详情图 A+」中一键生成图片资产'}
            </p>
          </div>
        ) : (
          <GalleryGrid
            images={groupByProduct ? filteredImages : pageImages}
            groups={groupByProduct ? groupImages(filteredImages) : null}
            filteredImages={filteredImages}
            downloadingId={downloadingId}
            typeLabel={typeLabel}
            getDisplayUrl={getDisplayUrl}
            onPreview={setPreviewIndex}
            onDownload={(asset) => void handleDownload(asset)}
            onDelete={(asset) => void handleDelete(asset)}
          />
        )}

        {/* 分页（对照旧版 justify-between + 页码） */}
        {filteredImages.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px] text-[#86909C]">
              共 {filteredImages.length} 张，第 {safePage} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#eef1f5] bg-white text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-8 min-w-[32px] cursor-pointer items-center justify-center rounded-lg px-2 text-[13px] transition-colors ${
                    safePage === page ? 'border-0 bg-[#409eff] text-white' : 'border border-[#eef1f5] bg-white text-[#344054] hover:bg-[#f9fafb]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#eef1f5] bg-white text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 大图轮播预览 Modal（业务保留桌面端轮播） */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span>{currentPreviewAsset?.originalName || '图片预览'}</span>
            {previewIndex !== null && (
              <span className="rounded bg-[#f0f7ff] px-2 py-0.5 text-[12px] font-bold text-[#3388ff]">
                {previewIndex + 1} / {filteredImages.length}
              </span>
            )}
          </div>
        }
        visible={previewIndex !== null}
        onCancel={() => setPreviewIndex(null)}
        footer={
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                icon={<ChevronLeft className="h-3.5 w-3.5" />}
                disabled={previewIndex === null || previewIndex === 0}
                onClick={() => setPreviewIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                className="rounded-lg"
              >
                上一张
              </Button>
              <Button
                icon={<ChevronRight className="h-3.5 w-3.5" />}
                disabled={previewIndex === null || previewIndex >= filteredImages.length - 1}
                onClick={() => setPreviewIndex((prev) => (prev !== null && prev < filteredImages.length - 1 ? prev + 1 : prev))}
                className="rounded-lg"
              >
                下一张
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="primary"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={() => {
                  if (currentPreviewAsset) void handleDownload(currentPreviewAsset)
                }}
                className="rounded-lg"
              >
                下载当前图片
              </Button>
              <Button onClick={() => setPreviewIndex(null)} className="rounded-lg">
                关闭
              </Button>
            </div>
          </div>
        }
        style={{ width: '80vw', maxWidth: 840 }}
      >
        <div className="max-h-[65vh] overflow-auto text-center">
          {currentPreviewAsset && (
            <img
              src={getDisplayUrl(currentPreviewAsset)}
              alt="原图预览"
              className="max-h-[60vh] max-w-full rounded object-contain"
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
