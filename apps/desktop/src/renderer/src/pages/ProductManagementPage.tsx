import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Empty,
  Input,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react'
import {
  IconGift,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@arco-design/web-react/icon'

import { api } from '../api/client'
import { formatDateTime } from '../utils/format'

const { Title, Text } = Typography
const { Option } = Select

interface PlatformProduct {
  id: string
  title: string
  platform: string
  outerId?: string
  price: number
  stock: number
  status: string
  updatedAt?: string
}

export function ProductManagementPage() {
  const navigate = useNavigate()
  const [platform, setPlatform] = useState<string>('all')
  const [keyword, setKeyword] = useState<string>('')
  const [status, setStatus] = useState<string>('all')

  const { data, isLoading, refetch } = useQuery<{
    items?: PlatformProduct[]
    total?: number
  }>({
    queryKey: ['platform-products', platform, keyword, status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (platform !== 'all') params.set('platform', platform)
      if (status !== 'all') params.set('status', status)
      if (keyword.trim()) params.set('keyword', keyword.trim())
      const res = await api.get(`/api/platform-adapters/products?${params.toString()}`)
      const items = Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data) ? res.data : []
      return { items, total: res.data?.total ?? items.length }
    },
  })

  const platformTag = (plat: string) => {
    switch (plat?.toLowerCase()) {
      case 'taobao':
        return <Tag color="orangered">淘宝天猫</Tag>
      case 'jd':
        return <Tag color="red">京东</Tag>
      case 'douyin':
        return <Tag color="cyan">抖音电商</Tag>
      case 'pdd':
        return <Tag color="magenta">拼多多</Tag>
      default:
        return <Tag color="arcoblue">{plat || '电商平台'}</Tag>
    }
  }

  const statusTag = (st: string) => {
    switch (st?.toLowerCase()) {
      case 'online':
      case 'published':
        return <Tag color="green">在售中</Tag>
      case 'offline':
        return <Tag color="gray">已下架</Tag>
      case 'draft':
        return <Tag color="gold">草稿待发</Tag>
      default:
        return <Tag color="arcoblue">{st || '正常'}</Tag>
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#f4f7fb] flex flex-col gap-4">
      {/* 头部标题与新建按钮 */}
      <Card style={{ borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title heading={5} style={{ margin: 0 }}>
              平台商品管理
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              统一管理已同步与发布的各电商平台商品主档、上下架状态与价格库存
            </Text>
          </div>
          <Space>
            <Button
              icon={<IconRefresh />}
              loading={isLoading}
              onClick={() => void refetch()}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={() => navigate('/products/management/manual')}
            >
              手动发布商品
            </Button>
          </Space>
        </div>
      </Card>

      {/* 筛选过滤栏 */}
      <Card style={{ borderRadius: 8 }}>
        <Space size="large" wrap>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, color: '#4e5969' }}>平台渠道:</Text>
            <Radio.Group
              type="button"
              value={platform}
              onChange={(val) => setPlatform(val)}
            >
              <Radio value="all">全部</Radio>
              <Radio value="taobao">淘宝</Radio>
              <Radio value="jd">京东</Radio>
              <Radio value="douyin">抖音</Radio>
              <Radio value="pdd">拼多多</Radio>
            </Radio.Group>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, color: '#4e5969' }}>在售状态:</Text>
            <Select
              value={status}
              onChange={(val) => setStatus(val)}
              style={{ width: 120 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="online">在售中</Option>
              <Option value="offline">已下架</Option>
              <Option value="draft">草稿</Option>
            </Select>
          </div>

          <Input
            prefix={<IconSearch />}
            placeholder="搜索商品标题或外部编码..."
            value={keyword}
            onChange={(val) => setKeyword(val)}
            onPressEnter={() => void refetch()}
            style={{ width: 260 }}
            allowClear
          />

          <Button type="primary" onClick={() => void refetch()}>
            查询
          </Button>
        </Space>
      </Card>

      {/* 表格列表 */}
      <Card style={{ borderRadius: 8 }}>
        <Table<PlatformProduct>
          rowKey="id"
          loading={isLoading}
          data={data?.items ?? []}
          pagination={{ pageSize: 10, total: data?.total ?? 0, showTotal: true }}
          noDataElement={<Empty description="暂无符合条件的平台商品数据" />}
          columns={[
            {
              title: '商品标题',
              render: (_, record) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      background: '#f2f3f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#86909c',
                      fontSize: 18,
                    }}
                  >
                    <IconGift />
                  </div>
                  <div>
                    <Text bold style={{ color: '#1d2129' }}>{record.title || '未命名商品'}</Text>
                    <div style={{ fontSize: 11, color: '#86909c' }}>ID: {record.id}</div>
                  </div>
                </div>
              ),
            },
            {
              title: '渠道平台',
              dataIndex: 'platform',
              render: (plat: string) => platformTag(plat),
            },
            {
              title: '销售价 (元)',
              dataIndex: 'price',
              render: (price: number) => (
                <Text bold style={{ color: '#ff7d00' }}>
                  ¥{Number(price || 0).toFixed(2)}
                </Text>
              ),
            },
            {
              title: '当前库存',
              dataIndex: 'stock',
              render: (stock: number) => <span>{stock ?? 999} 件</span>,
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (st: string) => statusTag(st),
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              render: (time?: string) => formatDateTime(time),
            },
            {
              title: '操作',
              render: (_, record) => (
                <Space>
                  <Button
                    type="text"
                    size="small"
                    onClick={() => navigate('/products/management/manual')}
                  >
                    编辑发布
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
