import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  DatePicker,
  Divider,
  Empty,
  Form,
  Grid,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react'
import {
  IconEye,
  IconPlus,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconThunderbolt,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'
import { formatDateTime } from '../utils/format'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface AnalysisRun {
  id: string
  jobId: string
  reportNo: string | null
  status: string
  competitorCount: number | null
  priceMin: number | null
  priceMax: number | null
  updatedAt: string
}

export function ReportsListPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [filterKeyword, setFilterKeyword] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const { data, isLoading, refetch } = useQuery<AnalysisRun[]>({
    queryKey: ['analysis-runs'],
    queryFn: async () => (await api.get<AnalysisRun[]>('/api/reports')).data,
  })

  // 过滤后的列表
  const filteredData = useMemo(() => {
    if (!data) return []
    return data.filter((item) => {
      const matchKeyword =
        !filterKeyword ||
        (item.reportNo && item.reportNo.toLowerCase().includes(filterKeyword.toLowerCase())) ||
        item.jobId.toLowerCase().includes(filterKeyword.toLowerCase()) ||
        item.id.toLowerCase().includes(filterKeyword.toLowerCase())

      const matchStatus =
        filterStatus === 'all' ||
        item.status === filterStatus ||
        (filterStatus === 'completed' && (item.status === 'completed' || item.status === 'success'))

      return matchKeyword && matchStatus
    })
  }, [data, filterKeyword, filterStatus])

  // 统计数值
  const totalReports = data?.length || 0
  const completedReports = data?.filter((r) => r.status === 'completed' || r.status === 'success').length || 0
  const totalCompetitors = data?.reduce((acc, curr) => acc + (curr.competitorCount || 0), 0) || 0

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#f4f7fb] flex flex-col gap-4">
      {/* 顶部标题区与统计 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 m-0 flex items-center gap-2">
            <span>竞品分析报告大盘</span>
            <Tag color="arcoblue">多维透视</Tag>
          </h1>
          <p className="text-xs text-gray-500 mt-1 mb-0">
            基于真实竞品数据聚类算法与大模型生成的价格带切分、卖点挖掘与差评痛点看板
          </p>
        </div>
        <Space>
          <Button icon={<IconRefresh />} loading={isLoading} onClick={() => void refetch()}>
            刷新数据
          </Button>
          <Button
            type="primary"
            icon={<IconPlus />}
            onClick={() => navigate('/market/competitive/ai-collect')}
          >
            新建采集任务
          </Button>
        </Space>
      </div>

      {/* 概览统计指标卡片 (模式 3 标配) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card bordered className="rounded-lg shadow-sm bg-white">
          <div className="flex items-center justify-between">
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>累计生成报告</Text>
              <div className="text-2xl font-bold text-gray-900 font-mono mt-1">{totalReports} 份</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#165dff] flex items-center justify-center font-bold text-lg">
              📊
            </div>
          </div>
        </Card>

        <Card bordered className="rounded-lg shadow-sm bg-white">
          <div className="flex items-center justify-between">
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>分析就绪成功率</Text>
              <div className="text-2xl font-bold text-green-600 font-mono mt-1">
                {totalReports > 0 ? `${Math.round((completedReports / totalReports) * 100)}%` : '100%'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center font-bold text-lg">
              ✅
            </div>
          </div>
        </Card>

        <Card bordered className="rounded-lg shadow-sm bg-white">
          <div className="flex items-center justify-between">
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>累计覆盖竞品样本</Text>
              <div className="text-2xl font-bold text-purple-600 font-mono mt-1">
                {totalCompetitors.toLocaleString()} 款
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg">
              🎯
            </div>
          </div>
        </Card>
      </div>

      {/* 顶部全宽筛选卡片 (模式 3 标配) */}
      <Card bordered className="rounded-lg shadow-sm bg-white">
        <Form
          form={form}
          layout="inline"
          className="flex flex-wrap items-center gap-y-3"
        >
          <Form.Item label="报告关键词 / ID">
            <Input
              placeholder="搜索报告编号或任务ID"
              value={filterKeyword}
              onChange={setFilterKeyword}
              allowClear
              prefix={<IconSearch />}
              style={{ width: 220 }}
            />
          </Form.Item>

          <Form.Item label="报告状态">
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 140 }}
            >
              <Select.Option value="all">全部状态</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
              <Select.Option value="running">生成中</Select.Option>
              <Select.Option value="failed">生成失败</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="outline"
                onClick={() => {
                  setFilterKeyword('')
                  setFilterStatus('all')
                }}
              >
                重置
              </Button>
              <Button type="primary" icon={<IconSearch />} onClick={() => void refetch()}>
                查询
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 下部数据大表 (模式 3 标配) */}
      <Card bordered className="rounded-lg shadow-sm bg-white">
        <Table<AnalysisRun>
          rowKey="id"
          loading={isLoading}
          data={filteredData}
          pagination={{
            pageSize: 10,
            showTotal: true,
            sizeCanChange: true,
          }}
          noDataElement={
            <Empty
              description="暂无符合条件的竞品分析报告，请点击右上角新建采集"
              style={{ padding: '40px 0' }}
            />
          }
          columns={[
            {
              title: '报告编号 / 任务关联',
              render: (_, record) => (
                <div>
                  <div className="font-semibold text-gray-900">
                    {record.reportNo || `REP-${record.id.slice(0, 10).toUpperCase()}`}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    任务: {record.jobId}
                  </div>
                </div>
              ),
            },
            {
              title: '分析状态',
              dataIndex: 'status',
              render: (status: string) => (
                <Tag
                  color={
                    status === 'completed' || status === 'success'
                      ? 'green'
                      : status === 'running'
                      ? 'arcoblue'
                      : 'red'
                  }
                  size="small"
                >
                  {status === 'completed' || status === 'success'
                    ? '已就绪'
                    : status === 'running'
                    ? '分析中'
                    : status}
                </Tag>
              ),
            },
            {
              title: '竞品样本数',
              dataIndex: 'competitorCount',
              render: (val: number | null) => (
                <span className="font-medium text-gray-700">
                  {val ? `${val} 款商品` : '-'}
                </span>
              ),
            },
            {
              title: '核心覆盖价格带',
              render: (_, record) => (
                <span className="font-mono text-gray-700">
                  {record.priceMin != null && record.priceMax != null
                    ? `¥${record.priceMin} ~ ¥${record.priceMax}`
                    : '-'}
                </span>
              ),
            },
            {
              title: '最近更新时间',
              dataIndex: 'updatedAt',
              render: (time: string) => (
                <span className="text-xs text-gray-500">{formatDateTime(time)}</span>
              ),
            },
            {
              title: '操作',
              render: (_, record) => (
                <Space size="small">
                  <Button
                    type="primary"
                    size="mini"
                    icon={<IconEye />}
                    onClick={() => navigate(`/market/competitive/report/${record.id}`)}
                  >
                    查看大屏
                  </Button>
                  <Button
                    size="mini"
                    icon={<IconRobot />}
                    onClick={() => navigate(`/market/competitive/agent?reportId=${record.id}`)}
                  >
                    AI 问答
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
