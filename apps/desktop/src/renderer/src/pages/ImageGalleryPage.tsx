import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, Eye, Loader2, Search } from 'lucide-react'
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
  sourceUrl?: string | null
  originalName?: string | null
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

export function ImageGalleryPage() {
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [formatFilter, setFormatFilter] = useState('ALL')
  const [applied, setApplied] = useState({ keyword: '', type: 'ALL', format: 'ALL' })
  const [currentPage, setCurrentPage] = useState(1)

  // 轮播大图预览状态
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)

  // 数据流保持桌面端现状：GET /api/assets + react-query
  const { data = [], isLoading } = useQuery<Asset[]>({
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
        (item.runId && item.runId.toLowerCase().includes(kw))

      const matchFormat =
        applied.format === 'ALL' ||
        item.mimeType?.toLowerCase().includes(applied.format.toLowerCase()) ||
        item.storageKey.toLowerCase().endsWith(applied.format.toLowerCase())

      const matchType =
        applied.type === 'ALL' ||
        (applied.type === 'main' && name.includes('主图')) ||
        (applied.type === 'aplus' && (name.includes('详情') || name.includes('aplus'))) ||
        (applied.type === 'viral' && (name.includes('复刻') || name.includes('爆款'))) ||
        (applied.type === 'other' && !name.includes('主图') && !name.includes('详情') && !name.includes('复刻'))

      return matchKeyword && matchFormat && matchType
    })
  }, [imageAssets, applied])

  useEffect(() => {
    setCurrentPage(1)
  }, [applied])

  // 获取图片的真实加载 URL
  const getImageRawUrl = (assetId: string) => {
    const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8787'
    return `${baseURL}/api/assets/${assetId}/raw`
  }

  // 下载单张图片（业务逻辑保持桌面端现状：token 鉴权 raw 拉流）
  const handleDownload = async (asset: Asset) => {
    setDownloadingId(asset.id)
    try {
      const token = localStorage.getItem('eca.token')
      const rawUrl = getImageRawUrl(asset.id)
      const res = await fetch(rawUrl, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('下载失败')
      const blob = await res.blob()
      const name = asset.originalName || asset.storageKey.split('/').pop() || `image-${asset.id}.png`
      saveAs(blob, name)
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

  const totalPages = Math.max(1, Math.ceil(filteredImages.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pageImages = filteredImages.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const currentPreviewAsset = previewIndex !== null ? filteredImages[previewIndex] : null
  const typeLabel = (asset: Asset) => {
    const name = asset.originalName || asset.storageKey
    if (name.includes('主图')) return '商品主图'
    if (name.includes('详情') || name.includes('aplus')) return '详情图'
    if (name.includes('复刻') || name.includes('爆款')) return '爆款复刻'
    return '其他素材'
  }

  return (
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        <PageHeader breadcrumbs={[{ label: '资产库' }, { label: '图库' }]} className="mb-2" />

        {/* 查询条件卡（对照旧版 grid-cols-4） */}
        <div className="mb-4 grid grid-cols-4 gap-3 rounded-xl bg-white p-4">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">图片名称</label>
            <XSearchInput
              value={keyword}
              onChange={setKeyword}
              onEnter={() => setApplied({ keyword, type: typeFilter, format: formatFilter })}
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
            <button
              type="button"
              onClick={() => setApplied({ keyword, type: typeFilter, format: formatFilter })}
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
                setApplied({ keyword: '', type: 'ALL', format: 'ALL' })
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
        </div>

        {/* 图片网格（对照旧版 grid-cols-8 密集网格） */}
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
          <div className="grid grid-cols-8 gap-3">
            {pageImages.map((asset, idx) => {
              const fileName = asset.originalName || asset.storageKey.split('/').pop() || asset.storageKey
              return (
                <div key={asset.id} className="overflow-hidden rounded-lg border border-[#eef1f5] bg-white">
                  <div
                    className="group relative aspect-square cursor-pointer bg-[#f7f8fa]"
                    onClick={() => setPreviewIndex(filteredImages.indexOf(asset))}
                  >
                    <img
                      src={getImageRawUrl(asset.id)}
                      alt={fileName}
                      loading="lazy"
                      className="h-full w-full object-contain p-1"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          setPreviewIndex(filteredImages.indexOf(asset))
                        }}
                        className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#0A1B39] hover:bg-white"
                        title="查看"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleDownload(asset)
                        }}
                        className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#0A1B39] hover:bg-white"
                        title="下载"
                      >
                        {downloadingId === asset.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="m-0 truncate text-[12px] font-semibold text-[#0A1B39]" title={fileName}>
                      {fileName}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-[#98A2B3]">
                      <span>{typeLabel(asset)}</span>
                      <span>{formatBytes(asset.size)}</span>
                    </div>
                    {asset.runId && (
                      <p className="m-0 mt-0.5 truncate text-[11px] text-[#c0c4cc]" title={`任务批次: ${asset.runId}`}>
                        批次 {asset.runId.slice(0, 8)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
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
              src={getImageRawUrl(currentPreviewAsset.id)}
              alt="原图预览"
              className="max-h-[60vh] max-w-full rounded object-contain"
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
