import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Empty,
  Grid,
  Image,
  Input,
  Message,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from '@arco-design/web-react'
import {
  IconDownload,
  IconEye,
  IconImage,
  IconRefresh,
  IconSearch,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'

const { Title, Text } = Typography
const { Row, Col } = Grid
const { Option } = Select

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

export function ImageGalleryPage() {
  const [keyword, setKeyword] = useState('')
  const [formatFilter, setFormatFilter] = useState('ALL')
  const [previewAsset, setPreviewAsset] = useState<{ id: string; name: string; url: string } | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const { data = [], isLoading, refetch, isFetching } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: async () => {
      const response = await api.get<Asset[]>('/api/assets')
      return response.data
    },
  })

  // 筛选图片类型资产
  const imageAssets = data.filter((item) => {
    const isImg =
      item.mimeType?.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(item.storageKey)
    return isImg
  })

  // 搜索和格式过滤
  const filteredImages = imageAssets.filter((item) => {
    const name = item.originalName || item.storageKey.split('/').pop() || item.storageKey
    const matchKeyword =
      !keyword.trim() ||
      name.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      item.storageKey.toLowerCase().includes(keyword.trim().toLowerCase()) ||
      (item.runId && item.runId.toLowerCase().includes(keyword.trim().toLowerCase()))

    const matchFormat =
      formatFilter === 'ALL' ||
      item.mimeType?.toLowerCase().includes(formatFilter.toLowerCase()) ||
      item.storageKey.toLowerCase().endsWith(formatFilter.toLowerCase())

    return matchKeyword && matchFormat
  })

  // 获取图片的真实加载 URL（带 Token）
  const getImageRawUrl = (assetId: string) => {
    const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8787'
    return `${baseURL}/api/assets/${assetId}/raw`
  }

  // 查看大图
  const handlePreview = async (asset: Asset) => {
    try {
      const token = localStorage.getItem('eca.token')
      const rawUrl = getImageRawUrl(asset.id)
      const res = await fetch(rawUrl, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        Message.error('图片获取失败')
        return
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(new Blob([blob], { type: asset.mimeType }))
      const name = asset.originalName || asset.storageKey.split('/').pop() || '图片'
      setPreviewAsset({ id: asset.id, name, url: objectUrl })
    } catch {
      Message.error('图片加载异常')
    }
  }

  // 下载图片
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
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = asset.originalName || asset.storageKey.split('/').pop() || `image-${asset.id}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      Message.success('已开始下载')
    } catch {
      Message.error('下载图片失败')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div style={{ padding: '4px' }}>
      {/* 头部区 */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Space align="center" size="small">
              <Title heading={5} style={{ margin: 0 }}>
                图片库
              </Title>
              <Tag color="arcoblue" icon={<IconImage />}>
                共 {imageAssets.length} 张图片
              </Tag>
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                统一管理商品主图、场景图、细节图、卖点图等各类已生成的图像资产
              </Text>
            </div>
          </div>

          <Space size="medium">
            <Input
              style={{ width: 220 }}
              prefix={<IconSearch />}
              placeholder="搜索文件名 / 存储键 / 批次"
              allowClear
              value={keyword}
              onChange={setKeyword}
            />
            <Select
              style={{ width: 120 }}
              value={formatFilter}
              onChange={setFormatFilter}
            >
              <Option value="ALL">全部格式</Option>
              <Option value="png">PNG</Option>
              <Option value="jpeg">JPG/JPEG</Option>
              <Option value="webp">WEBP</Option>
              <Option value="svg">SVG</Option>
            </Select>
            <Button
              type="outline"
              icon={<IconRefresh />}
              loading={isFetching}
              onClick={() => void refetch()}
            >
              刷新
            </Button>
          </Space>
        </div>
      </Card>

      {/* 图片网格区 */}
      <Spin loading={isLoading} style={{ width: '100%' }}>
        {filteredImages.length === 0 ? (
          <Card bordered={false} style={{ textAlign: 'center', padding: '48px 0' }}>
            <Empty
              description={
                keyword.trim() || formatFilter !== 'ALL'
                  ? '未找到符合条件的图片资产'
                  : '暂无图片资产，可在「图片生成」或「详情图」工作流中生成'
              }
            />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {filteredImages.map((asset) => {
              const fileName = asset.originalName || asset.storageKey.split('/').pop() || asset.storageKey
              const ext = asset.storageKey.split('.').pop()?.toUpperCase() || 'IMG'
              return (
                <Col key={asset.id} xs={24} sm={12} md={8} lg={6} xl={6}>
                  <Card
                    hoverable
                    bordered
                    style={{ borderRadius: 8, overflow: 'hidden' }}
                    bodyStyle={{ padding: 12 }}
                    cover={
                      <div
                        style={{
                          height: 180,
                          backgroundColor: '#f7f8fa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                        onClick={() => void handlePreview(asset)}
                      >
                        <Image
                          preview={false}
                          src={getImageRawUrl(asset.id)}
                          alt={fileName}
                          style={{
                            maxHeight: 180,
                            maxWidth: '100%',
                            objectFit: 'contain',
                          }}
                          loader={
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                              <Spin />
                            </div>
                          }
                          error={
                            <div style={{ textAlign: 'center', color: '#86909c' }}>
                              <IconImage style={{ fontSize: 32 }} />
                              <div style={{ fontSize: 12, marginTop: 4 }}>点击查看原图</div>
                            </div>
                          }
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                          }}
                        >
                          <Tag size="small" color="blue">
                            {ext}
                          </Tag>
                        </div>
                      </div>
                    }
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: 6,
                        }}
                        title={fileName}
                      >
                        {fileName}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 12,
                          color: '#86909c',
                          marginBottom: 10,
                        }}
                      >
                        <span>{formatBytes(asset.size)}</span>
                        {asset.runId && (
                          <span title={`任务批次: ${asset.runId}`}>
                            批次: {asset.runId.slice(0, 8)}
                          </span>
                        )}
                      </div>

                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Button
                          size="small"
                          type="outline"
                          icon={<IconEye />}
                          onClick={() => void handlePreview(asset)}
                        >
                          查看大图
                        </Button>
                        <Button
                          size="small"
                          type="text"
                          icon={<IconDownload />}
                          loading={downloadingId === asset.id}
                          onClick={() => void handleDownload(asset)}
                        >
                          下载
                        </Button>
                      </Space>
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </Spin>

      {/* 大图查看弹窗 */}
      <Modal
        title={previewAsset?.name || '图片预览'}
        visible={Boolean(previewAsset)}
        onOk={() => setPreviewAsset(null)}
        onCancel={() => setPreviewAsset(null)}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<IconDownload />}
              onClick={() => {
                if (previewAsset) {
                  const asset = data.find((a) => a.id === previewAsset.id)
                  if (asset) void handleDownload(asset)
                }
              }}
            >
              下载图片
            </Button>
            <Button onClick={() => setPreviewAsset(null)}>关闭</Button>
          </Space>
        }
        style={{ width: '80vw', maxWidth: 840 }}
      >
        <div style={{ textAlign: 'center', maxHeight: '65vh', overflow: 'auto' }}>
          {previewAsset && (
            <img
              src={previewAsset.url}
              alt={previewAsset.name}
              style={{
                maxWidth: '100%',
                maxHeight: '60vh',
                objectFit: 'contain',
                borderRadius: 4,
              }}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
