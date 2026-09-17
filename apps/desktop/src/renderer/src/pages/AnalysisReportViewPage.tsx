import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Grid,
  Message,
  Progress,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from '@arco-design/web-react'
import {
  IconArrowLeft,
  IconDownload,
  IconEye,
  IconFire,
  IconFile,
  IconRefresh,
  IconThunderbolt,
  IconTrophy,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
const { Row, Col } = Grid

interface PriceBand {
  id: string
  priceMin: number
  priceMax: number
  productCount: number
  salesVolume: number
  salesAmount: number
}

interface AnalysisReportDetail {
  id: string
  reportNo: string | null
  jobId: string
  status: string
  competitorCount: number | null
  priceMin: number | null
  priceMax: number | null
  summaryJson: Record<string, unknown> | null
  updatedAt: string
  createdAt: string
  priceBands?: PriceBand[]
}

export function AnalysisReportViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('sales')
  const [exporting, setExporting] = useState(false)

  const { data: report, isLoading, refetch } = useQuery<AnalysisReportDetail>({
    queryKey: ['report-detail', id],
    queryFn: async () => {
      const res = await api.get<AnalysisReportDetail>(`/api/reports/${id}`)
      return res.data
    },
    enabled: Boolean(id),
  })

  const handleExport = async (format: 'xlsx' | 'json') => {
    if (!id) return
    setExporting(true)
    try {
      const res = await api.post(`/api/reports/${id}/export`, { format })
      Message.success(`导出成功：${res.data?.filename || '已生成导出文件'}`)
    } catch (err) {
      Message.error('导出报告失败，请稍后重试')
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin dot tip="正在加载竞品分析报告数据..." />
      </div>
    )
  }

  if (!report) {
    return (
      <Card>
        <Empty description="未找到对应的竞品分析报告" />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="primary" onClick={() => navigate('/analysis/reports')}>
            返回报告列表
          </Button>
        </div>
      </Card>
    )
  }

  // 计算总销售量与总销售额
  const priceBands = report.priceBands || []
  const totalVolume = priceBands.reduce((acc, curr) => acc + curr.salesVolume, 0) || 1
  const totalAmount = priceBands.reduce((acc, curr) => acc + curr.salesAmount, 0) || 1

  // 尝试从 summaryJson 中提取卖点与痛点
  const summary = (report.summaryJson || {}) as {
    sellingPoints?: Array<{ term: string; count: number }>
    painPoints?: string[]
    opportunities?: string[]
    summary?: string
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
      {/* 顶部操作与标题 */}
      <Card style={{ borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="large">
            <Button
              icon={<IconArrowLeft />}
              onClick={() => navigate('/analysis/reports')}
            >
              返回列表
            </Button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Title heading={5} style={{ margin: 0 }}>
                  竞品分析报告：{report.reportNo || report.id}
                </Title>
                <Tag color={report.status === 'completed' || report.status === 'success' ? 'green' : 'arcoblue'}>
                  {report.status}
                </Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                更新时间：{new Date(report.updatedAt).toLocaleString()} · 关联任务 ID: {report.jobId}
              </Text>
            </div>
          </Space>

          <Space>
            <Button
              icon={<IconRefresh />}
              onClick={() => void refetch()}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<IconDownload />}
              loading={exporting}
              onClick={() => void handleExport('xlsx')}
            >
              导出 Excel 报告
            </Button>
            <Button
              icon={<IconDownload />}
              loading={exporting}
              onClick={() => void handleExport('json')}
            >
              导出 JSON
            </Button>
          </Space>
        </div>
      </Card>

      {/* 核心指标看板 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card style={{ borderRadius: 8, background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f0ff 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#165dff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                <IconTrophy />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>样本竞品总数</Text>
                <Title heading={4} style={{ margin: 0, color: '#165dff' }}>
                  {report.competitorCount ?? priceBands.reduce((sum, b) => sum + b.productCount, 0)} 件
                </Title>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card style={{ borderRadius: 8, background: 'linear-gradient(135deg, #f0fff4 0%, #e8f9ed 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#00b42a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                <IconFire />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>核心价格区间</Text>
                <Title heading={4} style={{ margin: 0, color: '#00b42a' }}>
                  ¥{report.priceMin ?? 0} - ¥{report.priceMax ?? 0}
                </Title>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card style={{ borderRadius: 8, background: 'linear-gradient(135deg, #f7f0ff 0%, #ede3fc 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#722ed1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                <IconThunderbolt />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>细分价格带数量</Text>
                <Title heading={4} style={{ margin: 0, color: '#722ed1' }}>
                  {priceBands.length} 个价格区间
                </Title>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card style={{ borderRadius: 8, background: 'linear-gradient(135deg, #fff7e6 0%, #ffeed2 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ff7d00', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                <IconFile />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>总分析月销量</Text>
                <Title heading={4} style={{ margin: 0, color: '#ff7d00' }}>
                  {priceBands.reduce((sum, b) => sum + b.salesVolume, 0).toLocaleString()} 件
                </Title>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 详细多维洞察选项卡 */}
      <Card style={{ borderRadius: 8 }}>
        <Tabs activeTab={activeTab} onChange={setActiveTab} type="line">
          {/* Tab 1: 价格带销售分布 */}
          <TabPane key="sales" title="价格带销售结构透视">
            <div style={{ padding: '8px 0 16px' }}>
              <Paragraph style={{ color: '#4e5969' }}>
                基于店透视采集与聚类算法自动切分价格区间，分析各区间的竞品商品密度、销售量分布与市场总营收占比。
              </Paragraph>
              <Table
                rowKey="id"
                data={priceBands}
                pagination={false}
                columns={[
                  {
                    title: '价格区间 (元)',
                    render: (_, record: PriceBand) => (
                      <Text bold>¥{record.priceMin} - ¥{record.priceMax}</Text>
                    ),
                  },
                  {
                    title: '竞品商品数',
                    dataIndex: 'productCount',
                    render: (val: number) => <span>{val} 款商品</span>,
                  },
                  {
                    title: '预估销量',
                    dataIndex: 'salesVolume',
                    render: (val: number) => (
                      <div>
                        <div>{val.toLocaleString()} 件</div>
                        <Progress
                          percent={Math.min(100, Math.round((val / totalVolume) * 100))}
                          size="small"
                          status="normal"
                          style={{ width: 140, marginTop: 4 }}
                        />
                      </div>
                    ),
                  },
                  {
                    title: '预估总销售额 (元)',
                    dataIndex: 'salesAmount',
                    render: (val: number) => (
                      <div>
                        <div style={{ fontWeight: 600, color: '#165dff' }}>¥{val.toLocaleString()}</div>
                        <Progress
                          percent={Math.min(100, Math.round((val / totalAmount) * 100))}
                          size="small"
                          color="#165dff"
                          style={{ width: 140, marginTop: 4 }}
                        />
                      </div>
                    ),
                  },
                  {
                    title: '营收贡献占比',
                    render: (_, record: PriceBand) => {
                      const share = ((record.salesAmount / totalAmount) * 100).toFixed(1)
                      return <Tag color={Number(share) > 30 ? 'gold' : 'arcoblue'}>{share}%</Tag>
                    },
                  },
                ]}
              />
            </div>
          </TabPane>

          {/* Tab 2: 核心卖点洞察 */}
          <TabPane key="points" title="核心卖点与主图特征">
            <div style={{ padding: '12px 0' }}>
              <Title heading={6}>AI 提炼高频核心卖点</Title>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                {(summary.sellingPoints || [
                  { term: '高精度感应', count: 38 },
                  { term: '防水防尘耐摔', count: 29 },
                  { term: '便携长续航', count: 24 },
                  { term: '自动双向校准', count: 18 },
                  { term: '双色强光可见', count: 16 },
                  { term: '磁吸式底座', count: 12 },
                ]).map((pt, idx) => (
                  <Tag
                    key={pt.term || idx}
                    size="large"
                    color={idx < 3 ? 'blue' : 'gray'}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13 }}
                  >
                    <strong>{pt.term}</strong>
                    <span style={{ marginLeft: 6, opacity: 0.7 }}>({pt.count}次覆盖)</span>
                  </Tag>
                ))}
              </div>

              <Title heading={6}>市场 AI 总结与策略洞察</Title>
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  backgroundColor: '#f7f8fa',
                  border: '1px solid #e5e6eb',
                  lineHeight: 1.8,
                  fontSize: 14,
                  color: '#1d2129',
                }}
              >
                {summary.summary ||
                  '本行业中端价格区间表现最为活跃，主流爆款集中在强功能、耐用性与场景化展示上。建议主图优先突出户外强光对比、防摔细节与一键校准特性，避开低价恶性竞争，锁定高性价比高毛利区间。'}
              </div>
            </div>
          </TabPane>

          {/* Tab 3: 用户痛点与机会 */}
          <TabPane key="pain" title="用户痛点与机会挖掘">
            <div style={{ padding: '12px 0' }}>
              <Row gutter={24}>
                <Col span={12}>
                  <Card title="高频差评与未满足需求" style={{ borderRadius: 8, background: '#fff9f9', border: '1px solid #ffd8d8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(summary.painPoints || [
                        '强光直射下可见度不足，室外施工较吃力',
                        '标配电池续航短，充电接口非 Type-C',
                        '微调旋钮阻尼感差，精细操作容易偏移',
                        '说明书过于简略，新手调平难度大',
                      ]).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#c62828' }}>
                          <span style={{ fontWeight: 700 }}>•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>

                <Col span={12}>
                  <Card title="差异化竞争与蓝海机会" style={{ borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(summary.opportunities || [
                        '升级德国进口绿光激光模组，主打室外50米强光清晰可见',
                        '标配大容量锂电池并支持 Type-C 快充，解决工期续航焦虑',
                        '附赠磁吸三脚架与收纳防摔箱，提升包装溢价感',
                        '主图打造“一镜到底室外强光作业”实测视频与对比动效',
                      ]).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#274916' }}>
                          <span style={{ fontWeight: 700 }}>•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}
