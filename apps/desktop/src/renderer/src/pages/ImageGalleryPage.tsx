import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Divider,
  Empty,
  Form,
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
  IconArrowLeft,
  IconArrowRight,
  IconDownload,
  IconEye,
  IconImage,
  IconRefresh,
  IconSearch,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'
import { saveAs } from 'file-saver'

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
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [formatFilter, setFormatFilter] = useState('ALL')

  // 轮播大图预览状态
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)

  const { data = [], isLoading, refetch, isFetching } = useQuery<Asset[]>({
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

  // 搜索和多维过滤
  const filteredImages = useMemo(() => {
    return imageAssets.filter((item) => {
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

      const matchType =
        typeFilter === 'ALL' ||
        (typeFilter === 'main' && name.includes('主图')) ||
        (typeFilter === 'aplus' && (name.includes('详情') || name.includes('aplus'))) ||
        (typeFilter === 'viral' && (name.includes('复刻') || name.includes('爆款'))) ||
        (typeFilter === 'other' && !name.includes('主图') && !name.includes('详情') && !name.includes('复刻'))

      return matchKeyword && matchFormat && matchType
    })
  }, [imageAssets, keyword, formatFilter, typeFilter])

  // 获取图片的真实加载 URL
  const getImageRawUrl = (assetId: string) => {
    const baseURL = api.defaults.baseURL || 'http://127.0.0.1:8787'
    return `${baseURL}/api/assets/${assetId}/raw`
  }

  // 下载单张图片
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

  // 批量下载全部筛选结果
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

  const currentPreviewAsset = previewIndex !== null ? filteredImages[previewIndex] : null

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#f4f7fb] flex flex-col gap-4">
      {/* 顶部标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 m-0 flex items-center gap-2">
            <span>图片资产库</span>
            <Tag color="arcoblue" icon={<IconImage />}>共 {imageAssets.length} 张图片</Tag>
          </h1>
          <p className="text-xs text-gray-500 mt-1 mb-0">
            集中管理与查看商品主图、详情图 A+、爆款复刻等工作流沉淀的高清图像资产
          </p>
        </div>
        <Space>
          <Button
            icon={<IconRefresh />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<IconDownload />}
            loading={zipping}
            disabled={filteredImages.length === 0}
            onClick={handleBatchDownload}
          >
            批量下载图片
          </Button>
        </Space>
      </div>

      {/* 顶部多维筛选卡片 (模式 3 规范) */}
      <Card bordered className="rounded-lg shadow-sm bg-white">
        <div className="flex flex-wrap items-center gap-4">
          <Input
            style={{ width: 240 }}
            prefix={<IconSearch />}
            placeholder="搜索名称 / 存储路径 / 批次"
            allowClear
            value={keyword}
            onChange={setKeyword}
          />
          <Select
            style={{ width: 140 }}
            value={typeFilter}
            onChange={setTypeFilter}
          >
            <Option value="ALL">全部类型</Option>
            <Option value="main">商品主图</Option>
            <Option value="aplus">详情图 A+</Option>
            <Option value="viral">爆款复刻</Option>
            <Option value="other">其他素材</Option>
          </Select>
          <Select
            style={{ width: 130 }}
            value={formatFilter}
            onChange={setFormatFilter}
          >
            <Option value="ALL">全部格式</Option>
            <Option value="png">PNG 格式</Option>
            <Option value="jpeg">JPG / JPEG</Option>
            <Option value="webp">WEBP 格式</Option>
            <Option value="svg">SVG 矢量</Option>
          </Select>

          <Button
            onClick={() => {
              setKeyword('')
              setTypeFilter('ALL')
              setFormatFilter('ALL')
            }}
          >
            重置
          </Button>

          <div className="ml-auto text-xs text-gray-400">
            当前筛选出 <span className="font-semibold text-blue-600">{filteredImages.length}</span> 项资产
          </div>
        </div>
      </Card>

      {/* 图片 4 列瀑布流网格区 */}
      <Spin loading={isLoading} style={{ width: '100%' }}>
        {filteredImages.length === 0 ? (
          <Card bordered className="rounded-lg text-center py-16 bg-white">
            <Empty
              description={
                keyword.trim() || formatFilter !== 'ALL' || typeFilter !== 'ALL'
                  ? '未找到符合条件的图片资产'
                  : '暂无图片资产，可在「商品主图」或「A+详情图」中一键生成'
              }
            />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {filteredImages.map((asset, idx) => {
              const fileName = asset.originalName || asset.storageKey.split('/').pop() || asset.storageKey
              const ext = asset.storageKey.split('.').pop()?.toUpperCase() || 'IMG'
              return (
                <Col key={asset.id} xs={24} sm={12} md={8} lg={6} xl={6}>
                  <Card
                    hoverable
                    bordered
                    className="rounded-lg overflow-hidden bg-white shadow-sm"
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
                        onClick={() => setPreviewIndex(idx)}
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
                              <div style={{ fontSize: 12, marginTop: 4 }}>点击放大预览</div>
                            </div>
                          }
                        />
                        <div style={{ position: 'absolute', top: 8, right: 8 }}>
                          <Tag size="small" color="blue">{ext}</Tag>
                        </div>
                      </div>
                    }
                  >
                    <div>
                      <div
                        className="font-semibold text-gray-900 truncate mb-1 text-sm"
                        title={fileName}
                      >
                        {fileName}
                      </div>

                      <div className="flex justify-between items-center text-xs text-gray-400 mb-3">
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
                          onClick={() => setPreviewIndex(idx)}
                        >
                          查看
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

      {/* 大图套图轮播预览 Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span>{currentPreviewAsset?.originalName || '图片预览'}</span>
            {previewIndex !== null && (
              <Tag size="small" color="arcoblue">
                {previewIndex + 1} / {filteredImages.length}
              </Tag>
            )}
          </div>
        }
        visible={previewIndex !== null}
        onCancel={() => setPreviewIndex(null)}
        footer={
          <div className="flex items-center justify-between w-full">
            <Space>
              <Button
                icon={<IconArrowLeft />}
                disabled={previewIndex === null || previewIndex === 0}
                onClick={() => setPreviewIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
              >
                上一张
              </Button>
              <Button
                icon={<IconArrowRight />}
                disabled={previewIndex === null || previewIndex >= filteredImages.length - 1}
                onClick={() => setPreviewIndex((prev) => (prev !== null && prev < filteredImages.length - 1 ? prev + 1 : prev))}
              >
                下一张
              </Button>
            </Space>

            <Space>
              <Button
                type="primary"
                icon={<IconDownload />}
                onClick={() => {
                  if (currentPreviewAsset) void handleDownload(currentPreviewAsset)
                }}
              >
                下载当前图片
              </Button>
              <Button onClick={() => setPreviewIndex(null)}>关闭</Button>
            </Space>
          </div>
        }
        style={{ width: '80vw', maxWidth: 840 }}
      >
        <div style={{ textAlign: 'center', maxHeight: '65vh', overflow: 'auto' }}>
          {currentPreviewAsset && (
            <img
              src={getImageRawUrl(currentPreviewAsset.id)}
              alt="原图预览"
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
