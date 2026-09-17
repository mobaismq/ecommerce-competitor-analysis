import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Empty,
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
} from '@arco-design/web-react/icon'
import { api } from '../api/client'

const { Title, Text } = Typography

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
  const { data, isLoading, refetch } = useQuery<AnalysisRun[]>({
    queryKey: ['analysis-runs'],
    queryFn: async () => (await api.get<AnalysisRun[]>('/api/reports')).data,
  })

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title heading={5} style={{ margin: 0 }}>
              竞品深度分析报告
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              基于店透视数据自动化完成多维价格带切分、高频卖点提炼、用户差评痛点分析
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
              onClick={() => navigate('/analysis/collect')}
            >
              新建采集分析
            </Button>
          </Space>
        </div>
      </Card>

      <Card style={{ borderRadius: 8 }}>
        <Table<AnalysisRun>
          rowKey="id"
          loading={isLoading}
          data={data ?? []}
          pagination={{ pageSize: 10, showTotal: true }}
          noDataElement={<Empty description="暂无分析报告，请先发起采集任务" />}
          columns={[
            {
              title: '报告编号 / ID',
              render: (_, record) => (
                <div>
                  <Text bold>{record.reportNo || record.id.slice(0, 16)}</Text>
                  <div style={{ fontSize: 11, color: '#86909c' }}>任务: {record.jobId}</div>
                </div>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status: string) => (
                <Tag color={status === 'completed' || status === 'success' ? 'green' : 'arcoblue'}>
                  {status}
                </Tag>
              ),
            },
            {
              title: '竞品总数',
              dataIndex: 'competitorCount',
              render: (val: number | null) => <span>{val ? `${val} 件` : '-'}</span>,
            },
            {
              title: '价格区间',
              render: (_, record) => (
                <span>
                  {record.priceMin != null && record.priceMax != null
                    ? `¥${record.priceMin} - ¥${record.priceMax}`
                    : '-'}
                </span>
              ),
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              render: (time: string) => new Date(time).toLocaleString(),
            },
            {
              title: '操作',
              render: (_, record) => (
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<IconEye />}
                    onClick={() => navigate(`/analysis/reports/${record.id}`)}
                  >
                    查看详情
                  </Button>
                  <Button
                    size="small"
                    icon={<IconRobot />}
                    onClick={() => navigate('/analysis/agent')}
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
