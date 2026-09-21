import { useEffect, useMemo, useState } from 'react'
import { Message, Modal } from '@arco-design/web-react'
import { ChevronLeft, ChevronRight, Download, Eye, Loader2, Play, Trash2 } from 'lucide-react'
import { saveAs } from 'file-saver'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { XSearchInput } from '../components/XInput'

// 视频资产来自后端 /api/videos（mediaAsset，sourceType 为 video_source / video_replication）。
// 数据契约仅保证以下字段；旧版所需 videoType/productName/platform/duration/coverUrl 后端暂无，
// 缺失字段一律不渲染、不造假数据占位（见 checklist 登记）。
interface VideoAsset {
  id: string
  storageKey: string
  mimeType: string
  size: number
  sourceUrl?: string | null
  originalName?: string | null
  createdAt?: string
}

function formatBytes(bytes: number) {
  if (!bytes) return '--'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function rawUrl(id: string) {
  const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8787'
  // 视频素材走 /api/videos/:id/raw（mediaAsset 表），与图片 assets/raw 区分
  return `${baseURL}/api/videos/${id}/raw`
}

export function VideoGalleryPage() {
  const [videos, setVideos] = useState<VideoAsset[]>([])
  const [loading, setLoading] = useState(true)

  // 搜索条件（应用态，对照旧版查询/重置）
  const [keyword, setKeyword] = useState('')
  const [applied, setApplied] = useState('')

  // 播放弹窗
  const [playingVideo, setPlayingVideo] = useState<VideoAsset | null>(null)

  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<VideoAsset | null>(null)

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // 刷新视频素材（业务逻辑保持桌面端现状：后端优先，无假数据降级）
  const refreshVideos = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/videos')
      if (Array.isArray(data)) {
        setVideos(data as VideoAsset[])
        setCurrentPage(1)
      }
    } catch {
      Message.error('视频素材加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshVideos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const videoName = (item: VideoAsset) =>
    item.originalName || item.storageKey.split('/').pop() || '未命名视频'

  // 过滤结果（仅按视频名称，旧版类型/关联主商品/创建时间字段后端暂无，见登记）
  const filteredVideos = useMemo(() => {
    const kw = applied.trim().toLowerCase()
    return videos.filter((item) => {
      if (!kw) return true
      return (
        videoName(item).toLowerCase().includes(kw) ||
        item.storageKey.toLowerCase().includes(kw)
      )
    })
  }, [videos, applied])

  const pagedVideos = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredVideos.slice(start, start + pageSize)
  }, [filteredVideos, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  // 下载视频（token 鉴权 raw 拉流，同图片资产）
  const handleDownload = async (item: VideoAsset) => {
    setDownloadingId(item.id)
    try {
      const token = localStorage.getItem('eca.token')
      const res = await fetch(rawUrl(item.id), {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('下载失败')
      const blob = await res.blob()
      saveAs(blob, videoName(item))
      Message.success('已开始下载视频')
    } catch {
      Message.error('下载视频失败')
    } finally {
      setDownloadingId(null)
    }
  }

  // 删除视频（确认后执行，业务逻辑保持桌面端现状：仅本地列表移除）
  const confirmDelete = () => {
    if (!deleteTarget) return
    setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id))
    setDeleteTarget(null)
    Message.success('视频素材已删除')
  }

  return (
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        <PageHeader breadcrumbs={[{ label: '资产库' }, { label: '视频库' }]} className="mb-2" />

        {/* 查询条件卡（对照旧版查询/重置） */}
        <div className="mb-4 rounded-xl bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[280px] flex-1 items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">视频名称</label>
              <XSearchInput
                value={keyword}
                onChange={setKeyword}
                onEnter={() => {
                  setApplied(keyword)
                  setCurrentPage(1)
                }}
                placeholder="请输入"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setApplied(keyword)
                setCurrentPage(1)
              }}
              className="h-8 shrink-0 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff]"
            >
              查询
            </button>
            <button
              type="button"
              onClick={() => {
                setKeyword('')
                setApplied('')
                setCurrentPage(1)
              }}
              className="h-8 shrink-0 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-4 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
            >
              重置
            </button>
            <button
              type="button"
              onClick={() => void refreshVideos()}
              disabled={loading}
              className="ml-auto flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#dce3ee] bg-white px-3 text-[12px] font-semibold text-[#344054] hover:border-[#3388ff] hover:text-[#3388ff] disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              刷新
            </button>
          </div>
        </div>

        {/* 视频卡片网格（对照旧版 grid-cols-4） */}
        {loading ? (
          <div className="grid place-items-center rounded-xl bg-white py-20 text-[14px] text-[#86909C]">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            加载中…
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white py-20">
            <Play className="mb-4 h-14 w-14 text-[#d0d5dd]" />
            <p className="text-[16px] text-[#86909C]">暂无数据</p>
            <p className="m-0 mt-1 text-[13px] text-[#98A2B3]">暂无视频素材，可在一键复刻中生成</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {pagedVideos.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-xl border border-[#e9edf3] bg-white transition-shadow hover:shadow-md">
                <div className="relative aspect-video cursor-pointer bg-black" onClick={() => setPlayingVideo(item)}>
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-white/85 text-[#3388ff] shadow">
                      <Play className="ml-0.5 h-5 w-5 fill-[#3388ff]" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <p className="m-0 truncate text-[13px] font-bold text-[#0A1B39]" title={videoName(item)}>
                    {videoName(item)}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[12px] text-[#86909C]">
                    <span>{formatBytes(item.size)}</span>
                    <span>{item.createdAt ? item.createdAt.slice(0, 10) : '—'}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 border-t border-[#f0f2f5] pt-2">
                    <button
                      type="button"
                      onClick={() => setPlayingVideo(item)}
                      className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] text-[#409eff] hover:text-[#66b1ff]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      查看
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownload(item)}
                      className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] text-[#409eff] hover:text-[#66b1ff]"
                    >
                      {downloadingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      下载
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] text-[#409eff] hover:text-[#66b1ff]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页（对照旧版 justify-between） */}
        {filteredVideos.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px] text-[#86909C]">共 {filteredVideos.length} 条</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#eef1f5] bg-white text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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

      {/* 播放弹窗 */}
      <Modal
        title={playingVideo ? videoName(playingVideo) : '视频播放'}
        visible={Boolean(playingVideo)}
        onCancel={() => setPlayingVideo(null)}
        footer={null}
        style={{ width: 720 }}
      >
        {playingVideo && (
          <video src={rawUrl(playingVideo.id)} controls autoPlay className="max-h-[60vh] w-full rounded-lg bg-black" />
        )}
      </Modal>

      {/* 删除确认弹窗（对照旧版 提示 + 取消/确定） */}
      <Modal
        title="提示"
        visible={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        footer={null}
        style={{ width: 400 }}
      >
        <p className="m-0 mb-5 text-[14px] text-[#344054]">确认删除该视频组？</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="h-10 flex-1 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white text-[14px] text-[#0A1B39] hover:bg-[#f5f6f8]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            className="h-10 flex-1 cursor-pointer rounded-lg border-0 bg-[#f56c6c] text-[14px] font-bold text-white hover:bg-[#e04b4b]"
          >
            确定
          </button>
        </div>
      </Modal>
    </div>
  )
}
