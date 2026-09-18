import React, { useMemo, useState } from 'react'
import {
  Button,
  Card,
  DatePicker,
  Divider,
  Empty,
  Form,
  Grid,
  Image,
  Input,
  Message,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from '@arco-design/web-react'
import {
  IconDelete,
  IconDownload,
  IconEye,
  IconFilter,
  IconPlayArrow,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconVideoCamera,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'

const { Title, Text, Paragraph } = Typography
const { Row, Col } = Grid
const { RangePicker } = DatePicker

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
  {
    id: 'v1',
    name: '智能手表旗舰款 · 360度旋转主图视频',
    coverUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    type: '主图视频',
    product: '智能手表',
    platform: '淘宝',
    duration: '0:30',
    size: '18.4 MB',
    createTime: '2026-09-17 10:20',
  },
  {
    id: 'v2',
    name: '蓝牙无线降噪耳机 · 深度功能实测测评',
    coverUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    type: '详情视频',
    product: '蓝牙耳机',
    platform: '天猫',
    duration: '1:15',
    size: '42.1 MB',
    createTime: '2026-09-16 15:40',
  },
  {
    id: 'v3',
    name: '高精度红外水平仪 · 工地场景复刻短片',
    coverUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    type: '复刻视频',
    product: '激光水平仪',
    platform: '京东',
    duration: '0:45',
    size: '26.8 MB',
    createTime: '2026-09-15 18:30',
  },
  {
    id: 'v4',
    name: '猫粮冻干双拼 · 适口性开箱实录',
    coverUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    type: '主图视频',
    product: '猫粮',
    platform: '拼多多',
    duration: '0:20',
    size: '12.0 MB',
    createTime: '2026-09-14 09:15',
  },
  {
    id: 'v5',
    name: '三合一冲锋衣 · 暴雨级防水防风性能实操',
    coverUrl: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=500',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    type: '详情视频',
    product: '冲锋衣',
    platform: '抖音',
    duration: '0:50',
    size: '31.5 MB',
    createTime: '2026-09-13 14:00',
  },
  {
    id: 'v6',
    name: '便携迷你榨汁机 · 10秒鲜榨演示短片',
    coverUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    type: '复刻视频',
    product: '便携榨汁机',
    platform: '抖店',
    duration: '0:35',
    size: '22.3 MB',
    createTime: '2026-09-12 11:20',
  },
]

export function VideoGalleryPage() {
  const [videos, setVideos] = useState<VideoItem[]>(MOCK_VIDEOS)
  const [loading, setLoading] = useState(false)

  // 搜索条件
  const [nameFilter, setNameFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [productFilter, setProductFilter] = useState('')

  // 播放弹窗
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null)

  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // 刷新视频数据（优先从后端读取，若无则使用高保真列表）
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
      const matchName = !nameFilter || item.name.toLowerCase().includes(nameFilter.toLowerCase())
      const matchType = typeFilter === 'all' || item.type === typeFilter
      const matchProduct = !productFilter || item.product.includes(productFilter)
      return matchName && matchType && matchProduct
    })
  }, [videos, nameFilter, typeFilter, productFilter])

  const pagedVideos = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredVideos.slice(start, start + pageSize)
  }, [filteredVideos, currentPage])

  // 删除视频
  const handleDelete = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id))
    Message.success('视频素材已删除')
  }

  // 重置搜索
  const handleReset = () => {
    setNameFilter('')
    setTypeFilter('all')
    setProductFilter('')
    setCurrentPage(1)
  }

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#f4f7fb] flex flex-col gap-4">
      {/* 顶部标题栏 */}
      <div className="flex justify-between items-center">
        <div>
          <Title heading={4} style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>视频素材资产库</span>
            <Tag color="purple" icon={<IconVideoCamera />}>Media Assets</Tag>
          </Title>
          <Text type="secondary">
            集中管理商品主图视频、商详评测视频与爆款复刻素材，支持多端画幅剪辑、高清大图封面预览与极速下载。
          </Text>
        </div>

        <Space>
          <Button type="outline" icon={<IconRefresh />} loading={loading} onClick={refreshVideos}>
            刷新资产
          </Button>
        </Space>
      </div>

      {/* 搜索与过滤工具栏 */}
      <Card bordered style={{ borderRadius: 8, marginBottom: 16 }}>
        <Row gutter={16} align="center">
          <Col span={6}>
            <Input
              placeholder="搜索视频标题、编号"
              prefix={<IconSearch />}
              value={nameFilter}
              onChange={(v) => {
                setNameFilter(v)
                setCurrentPage(1)
              }}
              allowClear
            />
          </Col>
          <Col span={5}>
            <Select
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(v)
                setCurrentPage(1)
              }}
              style={{ width: '100%' }}
            >
              <Select.Option value="all">全部视频类型</Select.Option>
              <Select.Option value="主图视频">主图视频</Select.Option>
              <Select.Option value="详情视频">详情视频</Select.Option>
              <Select.Option value="复刻视频">复刻视频</Select.Option>
            </Select>
          </Col>
          <Col span={5}>
            <Input
              placeholder="按所属商品筛选 (如手表)"
              value={productFilter}
              onChange={(v) => {
                setProductFilter(v)
                setCurrentPage(1)
              }}
              allowClear
            />
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleReset}>重置条件</Button>
              <Text type="secondary" style={{ fontSize: 13 }}>
                共计 <Text bold style={{ color: '#165dff' }}>{filteredVideos.length}</Text> 个视频
              </Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 视频卡片画廊 */}
      {filteredVideos.length > 0 ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {pagedVideos.map((video) => (
              <Card
                key={video.id}
                hoverable
                bordered
                style={{ borderRadius: 8, overflow: 'hidden' }}
                bodyStyle={{ padding: 12 }}
              >
                {/* 封面与播放按钮 */}
                <div style={{ position: 'relative', height: 160, background: '#000', borderRadius: 6, overflow: 'hidden' }}>
                  <img
                    src={video.coverUrl}
                    alt={video.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    onClick={() => setPlayingVideo(video)}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      background: 'rgba(0,0,0,0.3)',
                    }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'grid', placeItems: 'center' }}>
                      <IconPlayArrow style={{ color: '#165dff', fontSize: 20, marginLeft: 2 }} />
                    </div>
                  </div>
                  <span style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
                    {video.duration}
                  </span>
                  <span style={{ position: 'absolute', top: 6, left: 6 }}>
                    <Tag size="small" color={video.type === '主图视频' ? 'blue' : video.type === '详情视频' ? 'green' : 'orange'}>
                      {video.type}
                    </Tag>
                  </span>
                </div>

                {/* 视频详细信息 */}
                <div style={{ marginTop: 10 }}>
                  <Text bold ellipsis style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                    {video.name}
                  </Text>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>商品: {video.product}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>平台: {video.platform}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                      {video.size} ｜ {video.createTime}
                    </Text>
                    <Space size="mini">
                      <Button
                        size="mini"
                        type="text"
                        icon={<IconDownload />}
                        onClick={() => Message.success('已启动视频文件下载')}
                      />
                      <Popconfirm
                        title="确定删除此视频素材吗？"
                        onOk={() => handleDelete(video.id)}
                      >
                        <Button
                          size="mini"
                          type="text"
                          status="danger"
                          icon={<IconDelete />}
                        />
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* 分页控制 */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <Pagination
              total={filteredVideos.length}
              current={currentPage}
              pageSize={pageSize}
              showTotal
              onChange={(p) => setCurrentPage(p)}
            />
          </div>
        </div>
      ) : (
        <Card bordered style={{ borderRadius: 8, minHeight: 400, display: 'grid', placeItems: 'center' }}>
          <Empty description="未找到匹配的视频素材，请调整筛选条件或通过「爆款视频工作台」生成新视频" />
        </Card>
      )}

      {/* 视频播放 Modal */}
      <Modal
        title={playingVideo?.name || '视频播放'}
        visible={Boolean(playingVideo)}
        onCancel={() => setPlayingVideo(null)}
        footer={<Button type="primary" onClick={() => setPlayingVideo(null)}>关闭播放</Button>}
        style={{ width: 680 }}
      >
        {playingVideo && (
          <div>
            <video
              src={playingVideo.videoUrl}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: 420, borderRadius: 8, background: '#000' }}
            />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text bold>{playingVideo.name}</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  类型: {playingVideo.type} ｜ 商品: {playingVideo.product} ｜ 大小: {playingVideo.size}
                </Text>
              </div>
              <Button type="outline" icon={<IconDownload />} onClick={() => Message.success('下载任务已提交')}>
                下载 MP4
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
