import { useMemo, useState } from 'react'
import { Button, Input, Message, Modal, Select } from '@arco-design/web-react'
import { ChevronLeft, ChevronRight, Download, Eye, Loader2, Play, Trash2 } from 'lucide-react'
import { saveAs } from 'file-saver'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { XSearchInput } from '../components/XInput'

const Option = Select.Option

interface VideoItem {
  id: string
  name: string
  coverUrl: string
  videoUrl: string
  type: '主图视频' | '详情视频' | '复刻视频'
  product: string
  platform: string
  duration: string
  size: string
  createTime: string
}

const MOCK_VIDEOS: VideoItem[] = [
  { id: 'v1', name: '智能手表旗舰款 · 360度旋转主图视频', coverUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', type: '主图视频', product: '智能手表', platform: '淘宝', duration: '0:30', size: '18.4 MB', createTime: '2026-09-17 10:20' },
  { id: 'v2', name: '蓝牙无线降噪耳机 · 深度功能实测测评', coverUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', type: '详情视频', product: '蓝牙耳机', platform: '天猫', duration: '1:15', size: '42.1 MB', createTime: '2026-09-16 15:40' },
  { id: 'v3', name: '高精度红外水平仪 · 工地场景复刻短片', coverUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', type: '复刻视频', product: '激光水平仪', platform: '京东', duration: '0:45', size: '26.8 MB', createTime: '2026-09-15 18:30' },
  { id: 'v4', name: '猫粮冻干双拼 · 适口性开箱实录', coverUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', type: '主图视频', product: '猫粮', platform: '拼多多', duration: '0:20', size: '12.0 MB', createTime: '2026-09-14 09:15' },
  { id: 'v5', name: '三合一冲锋衣 · 暴雨级防水防风性能实操', coverUrl: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=500', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', type: '详情视频', product: '冲锋衣', platform: '抖音', duration: '0:50', size: '31.5 MB', createTime: '2026-09-13 14:00' },
  { id: 'v6', name: '便携迷你榨汁机 · 10秒鲜榨演示短片', coverUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500', videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', type: '复刻视频', product: '便携榨汁机', platform: '抖店', duration: '0:35', size: '22.3 MB', createTime: '2026-09-12 11:20' },
]

export function VideoGalleryPage() {
  const [videos, setVideos] = useState<VideoItem[]>(MOCK_VIDEOS)
  const [loading, setLoading] = useState(false)

  // 搜索条件（应用态，对照旧版查询/重置）
  const [nameFilter, setNameFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [productFilter, setProductFilter] = useState('')
  const [applied, setApplied] = useState({ name: '', type: 'all', product: '' })

  // 播放弹窗
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null)

  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<VideoItem | null>(null)

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // 刷新视频数据（业务逻辑保持桌面端现状：后端优先，降级高保真列表）
  const refreshVideos = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/videos')
      if (Array.isArray(data) && data.length > 0) {
        const mapped: VideoItem[] = data.map((v: Record<string, unknown>, idx: number) => ({
          id: String(v.id || idx),
          name: String(v.originalName || v.title || `视频素材 #${idx + 1}`),
          coverUrl: String(v.coverUrl || MOCK_VIDEOS[idx % MOCK_VIDEOS.length].coverUrl),
          videoUrl: String(v.sourceUrl || MOCK_VIDEOS[idx % MOCK_VIDEOS.length].videoUrl),
          type: (v.videoType as VideoItem['type']) || '主图视频',
          product: String(v.productName || '数码配件'),
          platform: String(v.platform || '淘宝'),
          duration: String(v.duration || '0:30'),
          size: typeof v.size === 'number' ? `${(v.size / (1024 * 1024)).toFixed(1)} MB` : '20 MB',
          createTime: String(v.createdAt || new Date().toLocaleDateString()),
        }))
        setVideos(mapped)
      }
    } catch {
      // 保持优雅降级
    } finally {
      setLoading(false)
    }
  }

  // 过滤结果
  const filteredVideos = useMemo(() => {
    return videos.filter((item) => {
      const matchName = !applied.name || item.name.toLowerCase().includes(applied.name.toLowerCase())
      const matchType = applied.type === 'all' || item.type === applied.type
      const matchProduct = !applied.product || item.product.includes(applied.product)
      return matchName && matchType && matchProduct
    })
  }, [videos, applied])

  const pagedVideos = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredVideos.slice(start, start + pageSize)
  }, [filteredVideos, currentPage])

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)

  // 删除视频（确认后执行，业务逻辑保持桌面端现状：仅本地列表移除）
  const confirmDelete = () => {
    if (!deleteTarget) return
    setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id))
    setDeleteTarget(null)
    Message.success('视频素材已删除')
  }

  // 下载视频
  const handleDownload = (item: VideoItem) => {
    saveAs(item.videoUrl, `${item.name}.mp4`)
    Message.success('已开始下载视频')
  }

  return (
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        <PageHeader breadcrumbs={[{ label: '资产库' }, { label: '视频库' }]} className="mb-2" />

        {/* 查询条件卡（对照旧版 grid-cols-4 + 第二行查询/重置） */}
        <div className="mb-4 rounded-xl bg-white p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">视频名称</label>
              <XSearchInput
                value={nameFilter}
                onChange={setNameFilter}
                onEnter={() => setApplied({ name: nameFilter, type: typeFilter, product: productFilter })}
                placeholder="搜索视频标题、编号"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">视频类型</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] outline-none focus:border-[#409eff] ${typeFilter === 'all' ? 'text-[#98A2B3]' : 'text-[#0A1B39]'}`}
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c0c4cc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                <option value="all">全部视频类型</option>
                <option value="主图视频">主图视频</option>
                <option value="详情视频">详情视频</option>
                <option value="复刻视频">复刻视频</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">关联商品</label>
              <input
                type="text"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="请输入"
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] outline-none focus:border-[#409eff]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setApplied({ name: nameFilter, type: typeFilter, product: productFilter })
                  setCurrentPage(1)
                }}
                className="h-8 shrink-0 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff]"
              >
                查询
              </button>
              <button
                type="button"
                onClick={() => {
                  setNameFilter('')
                  setTypeFilter('all')
                  setProductFilter('')
                  setApplied({ name: '', type: 'all', product: '' })
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
        </div>

        {/* 视频卡片网格（对照旧版 grid-cols-4 gap-4） */}
        {loading ? (
          <div className="grid place-items-center rounded-xl bg-white py-20 text-[14px] text-[#86909C]">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            加载中…
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl bg-white py-20">
            <Play className="mb-4 h-14 w-14 text-[#d0d5dd]" />
            <p className="text-[16px] text-[#86909C]">暂无数据</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {pagedVideos.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-xl border border-[#e9edf3] bg-white transition-shadow hover:shadow-md">
                <div className="relative aspect-video cursor-pointer bg-black" onClick={() => setPlayingVideo(item)}>
                  <img src={item.coverUrl} alt={item.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-white/85 text-[#3388ff] shadow">
                      <Play className="ml-0.5 h-5 w-5 fill-[#3388ff]" />
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{item.duration}</span>
                </div>
                <div className="p-3">
                  <p className="m-0 truncate text-[13px] font-bold text-[#0A1B39]" title={item.name}>
                    {item.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#86909C]">
                    <span>{item.type}</span>
                    <span>{item.size}</span>
                    <span className="truncate">{item.product} · {item.platform}</span>
                  </div>
                  <p className="m-0 mt-0.5 text-[12px] text-[#c0c4cc]">{item.createTime}</p>
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
                      onClick={() => handleDownload(item)}
                      className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] text-[#409eff] hover:text-[#66b1ff]"
                    >
                      <Download className="h-3.5 w-3.5" />
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
        title={playingVideo?.name || '视频播放'}
        visible={Boolean(playingVideo)}
        onCancel={() => setPlayingVideo(null)}
        footer={null}
        style={{ width: 720 }}
      >
        {playingVideo && (
          <video src={playingVideo.videoUrl} controls autoPlay className="max-h-[60vh] w-full rounded-lg bg-black" />
        )}
      </Modal>

      {/* 删除确认弹窗（对照旧版 w-400 红钮） */}
      <Modal
        title="提示"
        visible={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        footer={null}
        style={{ width: 400 }}
      >
        <p className="m-0 mb-5 text-[14px] text-[#344054]">删除后不可恢复，确认删除该视频素材？</p>
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
            确认删除
          </button>
        </div>
      </Modal>
    </div>
  )
}
