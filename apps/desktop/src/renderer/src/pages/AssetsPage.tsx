import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Message,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react'
import {
  IconDownload,
  IconEye,
  IconFolder,
  IconRefresh,
} from '@arco-design/web-react/icon'
import type { ColumnProps } from '@arco-design/web-react/es/Table'
import { saveAs } from 'file-saver'
import { api } from '../api/client'

const { Title, Text } = Typography

interface Asset {
  id: string
  storageKey: string
  mimeType: string
  size: number
  runId: string | null
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function AssetsPage() {
  const [preview, setPreview] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')

  const { data = [], isLoading, refetch, isFetching } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: async () => {
      const response = await api.get<Asset[]>('/api/assets')
      return response.data
    },
  })

  const openPreview = async (asset: Asset) => {
    try {
      const token = localStorage.getItem('eca.token')
      const response = await fetch(`http://127.0.0.1:8787/api/assets/${asset.id}/raw`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) {
        Message.error('资产获取失败')
        return
      }
      const blob = await response.blob()
      setPreviewTitle(asset.storageKey.split('/').pop() || asset.storageKey)
      setPreview(URL.createObjectURL(new Blob([blob], { type: asset.mimeType })))
    } catch {
      Message.error('资产加载异常')
    }
  }

  const downloadAsset = async (asset: Asset) => {
    try {
      const token = localStorage.getItem('eca.token')
      const response = await fetch(`http://127.0.0.1:8787/api/assets/${asset.id}/raw`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) throw new Error('下载失败')
      const blob = await response.blob()
      const name = asset.storageKey.split('/').pop() || `asset-${asset.id}`
      saveAs(blob, name)
      Message.success('已开始下载')
    } catch {
      Message.error('下载资产失败')
    }
  }

  const columns: ColumnProps<Asset>[] = [
    {
      title: '存储键 (Storage Key)',
      dataIndex: 'storageKey',
      render: (key: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13 }} title={key}>
          {key}
        </span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'mimeType',
      width: 140,
      render: (type: string) => {
        const color = type.startsWith('image/')
          ? 'arcoblue'
          : type.startsWith('video/')
          ? 'purple'
          : 'gray'
        return <Tag color={color}>{type}</Tag>
      },
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      width: 120,
      render: (size: number) => formatBytes(size),
    },
    {
      title: '批次 ID',
      dataIndex: 'runId',
      width: 150,
      render: (runId: string | null) => runId || '-',
    },
    {
      title: '操作',
      width: 160,
      render: (_, asset) => (
        <Space>
          {asset.mimeType.startsWith('image/') && (
            <Button
              type="text"
              size="small"
              icon={<IconEye />}
              onClick={() => void openPreview(asset)}
            >
              预览
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<IconDownload />}
            onClick={() => void downloadAsset(asset)}
          >
            下载
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Space align="center" size="small">
              <Title heading={5} style={{ margin: 0 }}>
                资产库
              </Title>
              <Tag color="cyan" icon={<IconFolder />}>
                共 {data.length} 项资产
              </Tag>
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                全量存储资产一览（包括生成的图片、视频、临时缓存与离线数据文件）
              </Text>
            </div>
          </div>
          <Button
            type="outline"
            icon={<IconRefresh />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            刷新
          </Button>
        </div>
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          data={data}
          pagination={{ pageSize: 15, showTotal: true }}
        />
      </Card>

      <Modal
        title={previewTitle || '资产预览'}
        visible={Boolean(preview)}
        onOk={() => setPreview(null)}
        onCancel={() => setPreview(null)}
        footer={<Button onClick={() => setPreview(null)}>关闭</Button>}
        style={{ width: '80vw', maxWidth: 800 }}
      >
        <div style={{ textAlign: 'center', maxHeight: '60vh', overflow: 'auto' }}>
          {preview && (
            <img
              src={preview}
              alt="预览"
              style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
