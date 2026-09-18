import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Eye, Loader2, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { Button, Message, Modal } from '@arco-design/web-react'
import { api } from '../api/client'
import { saveAs } from 'file-saver'
import { Link } from 'react-router-dom'
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

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

type AssetCategory = 'all' | 'image' | 'video' | 'other'
const CATEGORIES: Array<{ key: AssetCategory; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'other', label: '其他' },
]

function rawUrl(id: string) {
  const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8787'
  return `${baseURL}/api/assets/${id}/raw`
}

export function AssetsPage() {
  const [category, setCategory] = useState<AssetCategory>('all')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [preview, setPreview] = useState<Asset | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // 数据流保持桌面端现状：GET /api/assets
  const { data = [], isLoading, refetch, isFetching } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: async () => {
      const response = await api.get<Asset[]>('/api/assets')
      return response.data
    },
  })

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const isImage = item.mimeType?.startsWith('image/')
      const isVideo = item.mimeType?.startsWith('video/')
      const matchCategory =
        category === 'all' || (category === 'image' && isImage) || (category === 'video' && isVideo) || (category === 'other' && !isImage && !isVideo)
      const kw = applied.trim().toLowerCase()
      const name = item.originalName || item.storageKey
      const matchSearch = !kw || name.toLowerCase().includes(kw) || item.storageKey.toLowerCase().includes(kw)
      return matchCategory && matchSearch
    })
  }, [data, category, applied])

  const imageAssets = filtered.filter((item) => item.mimeType?.startsWith('image/'))
  const otherAssets = filtered.filter((item) => !item.mimeType?.startsWith('image/'))

  const openPreview = async (asset: Asset) => {
    try {
      const token = localStorage.getItem('eca.token')
      const response = await fetch(rawUrl(asset.id), {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) {
        Message.error('资产获取失败')
        return
      }
      const blob = await response.blob()
      setPreviewUrl(URL.createObjectURL(new Blob([blob], { type: asset.mimeType })))
      setPreview(asset)
    } catch {
      Message.error('资产加载异常')
    }
  }

  const downloadAsset = async (asset: Asset) => {
    setDownloadingId(asset.id)
    try {
      const token = localStorage.getItem('eca.token')
      const response = await fetch(rawUrl(asset.id), {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) throw new Error('下载失败')
      const blob = await response.blob()
      const name = asset.storageKey.split('/').pop() || `asset-${asset.id}`
      saveAs(blob, name)
      Message.success('已开始下载')
    } catch {
      Message.error('下载资产失败')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      {/* 头部行（对照旧版 AssetLibrary：title+副标题+右侧渐变一键复刻钮） */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="资产库" className="mb-0" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#dce3ee] bg-white px-3 text-[13px] font-semibold text-[#344054] hover:border-[#3388ff] hover:text-[#3388ff] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <Link
            to="/one-click-replicate"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#3388ff] to-[#66a3ff] px-4 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(51,136,255,.25)] hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            一键复刻
          </Link>
        </div>
      </div>
      <p className="m-0 -mt-3 mb-5 text-[13px] text-[#86909C]">
        全量存储资产一览（生成的图片、视频与离线数据文件），可按分类筛选后预览或下载。
      </p>

      {/* 资产卡（对照旧版生成图片卡：表头+搜索+分类 chips+网格） */}
      <section className="rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-[16px] font-extrabold text-[#0A1B39]">资产一览</h2>
            <span className="rounded-full bg-[#f0f7ff] px-2.5 py-1 text-[12px] font-bold text-[#3388ff]">{filtered.length} 项</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={`cursor-pointer rounded-full border-0 px-3 py-1.5 text-[12px] font-bold transition-colors ${
                    category === c.key ? 'bg-[#3388ff] text-white' : 'bg-[#f2f4f7] text-[#4e5969] hover:bg-[#eceff4]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="w-[220px]">
              <XSearchInput
                value={search}
                onChange={setSearch}
                onEnter={() => setApplied(search)}
                placeholder="搜索资产名称"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-[14px] text-[#86909C]">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            加载中…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Search className="mb-4 h-14 w-14 text-[#d0d5dd]" />
            <p className="text-[15px] text-[#86909C]">暂无数据</p>
          </div>
        ) : (
          <>
            {/* 图片资产网格（对照旧版 grid-cols-2 sm:3 lg:4） */}
            {imageAssets.length > 0 && (
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">
                {imageAssets.map((asset) => {
                  const name = asset.originalName || asset.storageKey.split('/').pop() || asset.storageKey
                  return (
                    <div key={asset.id} className="group overflow-hidden rounded-xl border border-[#eef1f5] bg-white">
                      <div className="relative aspect-square cursor-pointer overflow-hidden bg-[#f7f8fa]">
                        <img
                          src={rawUrl(asset.id)}
                          alt={name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => void openPreview(asset)}
                            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-white text-[#0A1B39]"
                            title="预览"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void downloadAsset(asset)}
                            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border-0 bg-white text-[#0A1B39]"
                            title="下载"
                          >
                            {downloadingId === asset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="m-0 truncate text-[12px] font-semibold text-[#0A1B39]" title={name}>
                          {name}
                        </p>
                        <p className="m-0 mt-0.5 truncate text-[11px] text-[#98A2B3]">
                          {formatBytes(asset.size)} · {asset.createdAt || '—'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 非图片资产行式列表 */}
            {otherAssets.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[#eef1f5]">
                <div className="flex bg-[#f9fafb] px-4 py-2.5 text-[12px] font-medium text-[#86909C]">
                  <div className="min-w-0 flex-1">文件</div>
                  <div className="w-32 shrink-0">类型</div>
                  <div className="w-24 shrink-0">大小</div>
                  <div className="w-20 shrink-0 text-right">操作</div>
                </div>
                <div className="divide-y divide-[#eef1f5]">
                  {otherAssets.map((asset) => (
                    <div key={asset.id} className="flex items-center bg-white px-4 py-2.5 transition-colors hover:bg-[#fbfcff]">
                      <div className="min-w-0 flex-1 truncate text-[13px] text-[#0A1B39]" title={asset.storageKey}>
                        {asset.originalName || asset.storageKey}
                      </div>
                      <div className="w-32 shrink-0 truncate text-[12px] text-[#86909C]">{asset.mimeType}</div>
                      <div className="w-24 shrink-0 text-[12px] text-[#86909C]">{formatBytes(asset.size)}</div>
                      <div className="w-20 shrink-0 text-right">
                        <button
                          type="button"
                          onClick={() => void downloadAsset(asset)}
                          className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-[#3388ff] hover:text-[#1a6fe8]"
                        >
                          下载
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 预览 Modal（业务保留） */}
      <Modal
        title={preview ? preview.originalName || preview.storageKey.split('/').pop() || '资产预览' : '资产预览'}
        visible={Boolean(preview)}
        onCancel={() => setPreview(null)}
        footer={
          <Button onClick={() => setPreview(null)} className="rounded-lg">
            关闭
          </Button>
        }
        style={{ width: '80vw', maxWidth: 800 }}
      >
        <div className="max-h-[60vh] overflow-auto text-center">
          {preview && previewUrl && <img src={previewUrl} alt="预览" className="max-h-[55vh] max-w-full rounded object-contain" />}
        </div>
      </Modal>
    </div>
  )
}
