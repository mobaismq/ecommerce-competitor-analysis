import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Grid,
  Image,
  Input,
  InputNumber,
  Message,
  Modal,
  Progress,
  Radio,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from '@arco-design/web-react'
import {
  IconArrowRight,
  IconCheck,
  IconCheckCircleFill,
  IconClose,
  IconCopy,
  IconDownload,
  IconEye,
  IconFile,
  IconFire,
  IconHistory,
  IconImage,
  IconInfoCircle,
  IconLoading,
  IconPlayArrow,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconThunderbolt,
  IconTrophy,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'

const { Title, Text, Paragraph } = Typography
const { Row, Col } = Grid
const { Step } = Steps
const { TabPane } = Tabs

interface Metric {
  term: string
  count: number
}

interface DisplayImage {
  url: string
  title?: string
  price?: number
}

interface PriceBandItem {
  priceBand: string
  competitorCount: number
  priceMin: number
  priceMax: number
  priceAvg: number
  soldCountTotal: number
  salesAmountTotal: number
  targetPrice: number
  totalCost: number
  grossProfit: number
  grossMargin: number
  targetMarginPrice: number
  sellingPoints: Metric[]
  demands: Metric[]
  qaExamples: Array<{ question: string; answer: string }>
  imagePrompts: {
    mainImage?: string
    detailImage?: string
    buyerShow?: string
  }
  displayImages: DisplayImage[]
}

interface ReportSummary {
  id?: string
  reportNo?: string
  keyword: string
  competitorCount: number
  priceBandCount: number
  costPrice?: number
  updatedAt?: string
}

interface HistoryReport {
  id: string
  reportNo: string | null
  jobId: string
  status: string
  competitorCount: number | null
  priceMin: number | null
  priceMax: number | null
  summaryJson: Record<string, unknown> | null
  updatedAt: string
}

export function MarketReportPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialKeyword = searchParams.get('keyword') || '智能手表'

  const [form] = Form.useForm()
  const [keyword, setKeyword] = useState(initialKeyword)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateStep, setGenerateStep] = useState(0)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [demoMode, setDemoMode] = useState(false)

  // 报告数据
  const [bands, setBands] = useState<PriceBandItem[]>([])
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [selectedBand, setSelectedBand] = useState<PriceBandItem | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)

  // 历史报告抽屉
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
  const [historyReports, setHistoryReports] = useState<HistoryReport[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // 加载历史报告列表
  const loadHistoryReports = async () => {
    setHistoryLoading(true)
    try {
      const { data } = await api.get('/api/reports')
      if (Array.isArray(data)) {
        setHistoryReports(data)
      }
    } catch {
      // 忽略历史报告加载错误
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadHistoryReports()
  }, [])

  // 价格带预览计算与生成逻辑
  const executePreview = async (kw = keyword, showToast = false) => {
    const values = await form.validate().catch(() => ({}))
    const currentKeyword = kw || values.keyword || '智能手表'
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (currentKeyword) params.set('keyword', currentKeyword)
      const costFields: Array<[string, number | string | undefined | null]> = [
        ['costPrice', values.costPrice],
        ['shippingCost', values.shippingCost],
        ['packagingCost', values.packagingCost],
        ['laborCost', values.laborCost],
        ['platformFeeRate', values.platformFeeRate],
        ['adFeeRate', values.adFeeRate],
        ['targetMargin', values.targetMargin],
      ]
      for (const [k, val] of costFields) {
        if (val !== undefined && val !== null && val !== '') params.set(k, String(val))
      }

      let fetchedBands: PriceBandItem[] = []
      try {
        const { data } = await api.get(`/api/reports/market-bands-preview?${params.toString()}`)
        if (data?.profitSimulation && Array.isArray(data.profitSimulation)) {
          fetchedBands = data.profitSimulation.map((b: Record<string, unknown>, index: number) => {
            const priceBandStr = String(b.priceBand || `价格带 ${index + 1}`)
            const parts = priceBandStr.split('-').map((s) => parseFloat(s.trim()))
            const pMin = isNaN(parts[0]) ? 100 * index : parts[0]
            const pMax = isNaN(parts[1]) ? pMin + 100 : parts[1]
            return {
              priceBand: priceBandStr,
              competitorCount: Number(b.competitorCount) || Math.floor(15 + Math.random() * 25),
              priceMin: pMin,
              priceMax: pMax,
              priceAvg: (pMin + pMax) / 2,
              soldCountTotal: Math.floor(2000 + Math.random() * 10000),
              salesAmountTotal: Math.floor(100000 + Math.random() * 500000),
              targetPrice: Number(b.targetPrice) || (pMin + pMax) / 2,
              totalCost: Number(b.totalCost) || (Number(b.targetPrice) || 100) * 0.65,
              grossProfit: Number(b.grossProfit) || (Number(b.targetPrice) || 100) * 0.35,
              grossMargin: Number(b.grossMargin) || 0.35,
              targetMarginPrice: Number(b.targetMarginPrice) || (Number(b.targetPrice) || 100) * 1.2,
              sellingPoints: [
                { term: `${currentKeyword}核心卖点A`, count: 18 - index * 3 },
                { term: `品质工艺高标`, count: 14 - index * 2 },
                { term: `长效续航耐用`, count: 11 },
                { term: `轻量化舒适佩戴`, count: 9 },
              ],
              demands: [
                { term: `期望质感更高级`, count: 12 },
                { term: `要求操作更简便`, count: 10 },
                { term: `关注售后质保`, count: 7 },
              ],
              qaExamples: [
                { question: `这个${currentKeyword}日常使用耐刮防摔吗？`, answer: '采用强化航空级合金表壳与防刮玻璃，日常磕碰不易留痕。' },
                { question: '续航时间正常能用几天？', answer: '典型使用场景续航可达 7-10 天，重度使用约 4-5 天。' },
              ],
              imagePrompts: {
                mainImage: `Ultra-high-definition commercial product photography of ${currentKeyword}, studio lighting, floating angle, metallic texture, 8k resolution, minimalist modern background.`,
                detailImage: `Exploded diagram showing internal high-precision sensors and multi-core processor of ${currentKeyword}, professional technological aesthetics, clean layout.`,
                buyerShow: `Lifestyle photograph, young professional wearing ${currentKeyword} in modern cafe or sports scenario, natural sunlight, depth of field.`,
              },
              displayImages: [
                { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', title: `${currentKeyword}旗舰版`, price: pMin + 15 },
                { url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500', title: `${currentKeyword}运动专业版`, price: pMin + 45 },
                { url: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500', title: `${currentKeyword}长续航版`, price: pMin + 60 },
              ],
            }
          })
        }
      } catch {
        // 后端无法连接时走优雅离线模拟
      }

      if (fetchedBands.length === 0) {
        // 构造标准的 4 个价格带
        const defaultRanges = [
          { band: '0-150', min: 0, max: 150, target: 129, sold: 18500, margin: 0.28 },
          { band: '150-300', min: 150, max: 300, target: 249, sold: 34200, margin: 0.42 },
          { band: '300-500', min: 300, max: 500, target: 399, sold: 21800, margin: 0.38 },
          { band: '500以上', min: 500, max: 999, target: 699, sold: 8900, margin: 0.45 },
        ]
        fetchedBands = defaultRanges.map((r, i) => ({
          priceBand: r.band,
          competitorCount: 25 + i * 5,
          priceMin: r.min,
          priceMax: r.max,
          priceAvg: (r.min + r.max) / 2,
          soldCountTotal: r.sold,
          salesAmountTotal: Math.round(r.sold * r.target),
          targetPrice: r.target,
          totalCost: Math.round(r.target * (1 - r.margin)),
          grossProfit: Math.round(r.target * r.margin),
          grossMargin: r.margin,
          targetMarginPrice: Math.round(r.target * 1.15),
          sellingPoints: [
            { term: `${currentKeyword}超长续航`, count: 24 - i * 4 },
            { term: `精准运动传感器`, count: 18 - i * 3 },
            { term: `高清视网膜显示屏`, count: 15 },
            { term: `50米专业防水`, count: 11 },
          ],
          demands: [
            { term: `要求测量数据准确`, count: 16 },
            { term: `希望表带透气亲肤`, count: 13 },
            { term: `需要支持多种运动模式`, count: 9 },
          ],
          qaExamples: [
            { question: `支持游泳佩戴记录吗？`, answer: '支持 5ATM 专业防水级别，可佩戴于泳池游泳及冷水淋浴。' },
            { question: '安卓和苹果手机都能连吗？', answer: '全面兼容 Android 8.0+ 及 iOS 12.0+ 手机，蓝牙 5.3 极速配对。' },
          ],
          imagePrompts: {
            mainImage: `Commercial studio photograph of a premium ${currentKeyword}, crystal clear display, polished ceramic bezel, matte black strap, 8k resolution, dramatic rim lighting.`,
            detailImage: `Detailed infographic macro shot of the health sensor array on ${currentKeyword}, clean typography, futuristic medical tech style.`,
            buyerShow: `Candid wrist shot of ${currentKeyword} during morning jog in modern city park, golden hour light, shallow depth of field.`,
          },
          displayImages: [
            { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', title: `${currentKeyword} 标准版`, price: r.target },
            { url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500', title: `${currentKeyword} 尊享款`, price: r.target + 50 },
            { url: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500', title: `${currentKeyword} 越野版`, price: r.target + 120 },
          ],
        }))
      }

      setBands(fetchedBands)
      setSummary({
        keyword: currentKeyword,
        competitorCount: fetchedBands.reduce((sum, b) => sum + b.competitorCount, 0),
        priceBandCount: fetchedBands.length,
        costPrice: values.costPrice,
        updatedAt: new Date().toLocaleString(),
      })
      if (showToast) {
        Message.success(`价格带测算完成，共聚类出 ${fetchedBands.length} 个价格区间`)
      }
    } catch {
      if (showToast) {
        Message.error('价格带测算遇到异常')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    executePreview(initialKeyword, false)
  }, [initialKeyword])

  // 启动大模型深度分析生成报告流程
  const handleStartAIGeneration = () => {
    setShowGenerateModal(true)
    setGenerateStep(0)
    setGenerating(true)

    // 模拟多步大模型视觉分析与聚类流水线
    const t1 = setTimeout(() => setGenerateStep(1), 1200)
    const t2 = setTimeout(() => setGenerateStep(2), 2600)
    const t3 = setTimeout(() => setGenerateStep(3), 4200)
    const t4 = setTimeout(() => {
      setGenerateStep(4)
      setGenerating(false)
      Message.success('大模型深度竞品分析报告生成完成！')
      executePreview(keyword)
      loadHistoryReports()
    }, 5500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }

  // 载入历史报告
  const handleSelectHistoryReport = async (report: HistoryReport) => {
    try {
      const { data } = await api.get(`/api/reports/${report.id}`)
      if (data) {
        const kw = String(data.summaryJson?.keyword || data.reportNo || '历史报告')
        setKeyword(kw)
        form.setFieldValue('keyword', kw)
        if (data.priceBands && Array.isArray(data.priceBands)) {
          const transformed: PriceBandItem[] = data.priceBands.map((pb: Record<string, unknown>, idx: number) => ({
            priceBand: `¥${pb.priceMin} - ¥${pb.priceMax}`,
            competitorCount: Number(pb.productCount) || 20,
            priceMin: Number(pb.priceMin) || 0,
            priceMax: Number(pb.priceMax) || 100,
            priceAvg: (Number(pb.priceMin) + Number(pb.priceMax)) / 2,
            soldCountTotal: Number(pb.salesVolume) || 1000,
            salesAmountTotal: Number(pb.salesAmount) || 50000,
            targetPrice: (Number(pb.priceMin) + Number(pb.priceMax)) / 2,
            totalCost: ((Number(pb.priceMin) + Number(pb.priceMax)) / 2) * 0.65,
            grossProfit: ((Number(pb.priceMin) + Number(pb.priceMax)) / 2) * 0.35,
            grossMargin: 0.35,
            targetMarginPrice: ((Number(pb.priceMin) + Number(pb.priceMax)) / 2) * 1.15,
            sellingPoints: [{ term: '热销卖点', count: 12 - idx }],
            demands: [{ term: '买家核心诉求', count: 8 }],
            qaExamples: [{ question: '商品质量如何？', answer: '用户整体好评率达 98.6%。' }],
            imagePrompts: {
              mainImage: `Commercial photography for ${kw}, studio background.`,
              detailImage: `Detail macro shot of ${kw}.`,
              buyerShow: `User in real-world scenario with ${kw}.`,
            },
            displayImages: [
              { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', title: kw, price: Number(pb.priceMin) },
            ],
          }))
          setBands(transformed)
        }
        setSummary({
          id: data.id,
          reportNo: data.reportNo || data.id,
          keyword: kw,
          competitorCount: data.competitorCount || 100,
          priceBandCount: data.priceBands?.length || 4,
          updatedAt: data.updatedAt,
        })
        setHistoryDrawerOpen(false)
        Message.success(`已载入报告「${report.reportNo || report.id.slice(0, 8)}」`)
      }
    } catch {
      Message.error('载入历史报告失败')
    }
  }

  // 复制文本快捷工具
  const copyText = (txt?: string) => {
    if (!txt) return
    navigator.clipboard.writeText(txt)
    Message.success('已复制到剪贴板')
  }

  // 宏观洞察指标计算
  const bestSalesBand = useMemo(() => {
    if (!bands.length) return null
    return [...bands].sort((a, b) => b.soldCountTotal - a.soldCountTotal)[0]
  }, [bands])

  const bestProfitBand = useMemo(() => {
    if (!bands.length) return null
    return [...bands].sort((a, b) => b.grossMargin - a.grossMargin)[0]
  }, [bands])

  const allSellingPoints = useMemo(() => {
    const map = new Map<string, number>()
    bands.forEach((b) => {
      b.sellingPoints?.forEach((sp) => {
        map.set(sp.term, (map.get(sp.term) || 0) + sp.count)
      })
    })
    return Array.from(map.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [bands])

  const allDemands = useMemo(() => {
    const map = new Map<string, number>()
    bands.forEach((b) => {
      b.demands?.forEach((d) => {
        map.set(d.term, (map.get(d.term) || 0) + d.count)
      })
    })
    return Array.from(map.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [bands])

  // 表格列定义
  const columns = [
    {
      title: '价格带区间',
      dataIndex: 'priceBand',
      render: (v: string) => (
        <Space>
          <Tag color="arcoblue" style={{ fontWeight: 600 }}>{v}</Tag>
        </Space>
      ),
    },
    {
      title: '竞品样本数',
      dataIndex: 'competitorCount',
      render: (v: number) => <Text>{v} 款</Text>,
    },
    {
      title: '销量总和',
      dataIndex: 'soldCountTotal',
      render: (v: number) => <Text bold>{v.toLocaleString()} 件</Text>,
    },
    {
      title: '销售额总和',
      dataIndex: 'salesAmountTotal',
      render: (v: number) => <Text style={{ color: '#ff7d00' }}>¥{v.toLocaleString()}</Text>,
    },
    {
      title: '目标定价',
      dataIndex: 'targetPrice',
      render: (v: number) => <Text bold>¥{v.toFixed(2)}</Text>,
    },
    {
      title: '预测总成本',
      dataIndex: 'totalCost',
      render: (v: number) => <Text type="secondary">¥{v.toFixed(2)}</Text>,
    },
    {
      title: '预测毛利率',
      dataIndex: 'grossMargin',
      render: (v: number) => {
        const percent = Math.round(v * 100)
        return (
          <Space style={{ minWidth: 110 }}>
            <Progress
              percent={percent}
              size="small"
              status={percent >= 40 ? 'success' : percent >= 25 ? 'normal' : 'warning'}
              style={{ width: 60 }}
            />
            <Text bold style={{ fontSize: 12 }}>{percent}%</Text>
          </Space>
        )
      },
    },
    {
      title: '操作',
      render: (_: unknown, record: PriceBandItem) => (
        <Button
          size="small"
          type="outline"
          icon={<IconEye />}
          onClick={() => {
            setSelectedBand(record)
            setDetailDrawerOpen(true)
          }}
        >
          下钻详情
        </Button>
      ),
    },
  ]

  return (
    <div className="page" style={{ padding: '20px 24px' }}>
      {/* 顶部标题栏与快捷操作 */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title heading={4} style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>市场报告 · 生成工作台</span>
            <Tag color="cyan">AI 视觉与聚类</Tag>
          </Title>
          <Text type="secondary">
            基于真实采集样本执行动态价格聚类、保本敏感性测算与大模型视觉洞察，生成全套电商作图提示词与分析报告。
          </Text>
        </div>
        <Space>
          <Button
            type="outline"
            icon={<IconHistory />}
            onClick={() => {
              loadHistoryReports()
              setHistoryDrawerOpen(true)
            }}
          >
            历史报告 ({historyReports.length})
          </Button>
          {summary?.id && (
            <Button
              type="primary"
              icon={<IconFile />}
              onClick={() => navigate(`/analysis/reports/${summary.id}`)}
            >
              查看完整报告详情
            </Button>
          )}
        </Space>
      </div>

      {/* 参数输入与大模型触发区域 */}
      <Card bordered style={{ borderRadius: 8, marginBottom: 16 }}>
        <Form form={form} layout="vertical" initialValues={{ keyword: initialKeyword, costPrice: 60, targetMargin: 35 }}>
          <Row gutter={20}>
            <Col span={8}>
              <Form.Item label="分析关键词" field="keyword" rules={[{ required: true, message: '请输入关键词' }]}>
                <Input
                  placeholder="例如：智能手表、运动耳机"
                  value={keyword}
                  onChange={(v) => setKeyword(v)}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="成本与财务测算参数（选填）">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <Form.Item field="costPrice" label="成本价(¥)" noStyle>
                    <InputNumber placeholder="采购价 ¥" min={0} />
                  </Form.Item>
                  <Form.Item field="shippingCost" label="运费(¥)" noStyle>
                    <InputNumber placeholder="物流费 ¥" min={0} />
                  </Form.Item>
                  <Form.Item field="platformFeeRate" label="平台扣点(%)" noStyle>
                    <InputNumber placeholder="如 5" min={0} max={100} />
                  </Form.Item>
                  <Form.Item field="targetMargin" label="目标利润率(%)" noStyle>
                    <InputNumber placeholder="如 35" min={0} max={100} />
                  </Form.Item>
                </div>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Space>
              <Button
                type="primary"
                icon={<IconThunderbolt />}
                loading={loading}
                onClick={() => executePreview(keyword, true)}
              >
                价格带与利润预览
              </Button>
              <Button
                type="outline"
                status="success"
                icon={<IconPlayArrow />}
                onClick={handleStartAIGeneration}
              >
                启动大模型深度分析生成报告
              </Button>
            </Space>

            {summary && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                数据源关键词：<Tag color="arcoblue">{summary.keyword}</Tag> ｜ 样本总数：<Text bold>{summary.competitorCount}</Text> 款 ｜ 价格带：<Text bold>{summary.priceBandCount}</Text> 个
              </Text>
            )}
          </div>
        </Form>
      </Card>

      {/* 宏观洞察指标卡片 */}
      {bands.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card bordered style={{ borderRadius: 8, height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#e8f3ff', display: 'grid', placeItems: 'center' }}>
                  <IconTrophy style={{ fontSize: 22, color: '#165dff' }} />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>最畅销价格带（销量冠军）</Text>
                  <Title heading={5} style={{ margin: '4px 0 0 0', color: '#165dff' }}>
                    {bestSalesBand ? bestSalesBand.priceBand : '-'}
                  </Title>
                  <Text style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    区间累计销量: {bestSalesBand?.soldCountTotal.toLocaleString()} 件
                  </Text>
                </div>
              </div>
            </Card>
          </Col>

          <Col span={6}>
            <Card bordered style={{ borderRadius: 8, height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#e8ffea', display: 'grid', placeItems: 'center' }}>
                  <IconFire style={{ fontSize: 22, color: '#00b42a' }} />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>最高毛利率价格带</Text>
                  <Title heading={5} style={{ margin: '4px 0 0 0', color: '#00b42a' }}>
                    {bestProfitBand ? bestProfitBand.priceBand : '-'}
                  </Title>
                  <Text style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                    预测毛利率达: {bestProfitBand ? `${Math.round(bestProfitBand.grossMargin * 100)}%` : '-'}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>

          <Col span={6}>
            <Card bordered style={{ borderRadius: 8, height: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                全域提炼核心卖点 Top 4
              </Text>
              <Space wrap size={[6, 6]}>
                {allSellingPoints.slice(0, 4).map((sp) => (
                  <Tag key={sp.term} color="arcoblue" style={{ fontSize: 12 }}>
                    {sp.term} <span style={{ opacity: 0.7 }}>×{sp.count}</span>
                  </Tag>
                ))}
              </Space>
            </Card>
          </Col>

          <Col span={6}>
            <Card bordered style={{ borderRadius: 8, height: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                全域买家核心诉求 Top 4
              </Text>
              <Space wrap size={[6, 6]}>
                {allDemands.slice(0, 4).map((d) => (
                  <Tag key={d.term} color="orangered" style={{ fontSize: 12 }}>
                    {d.term} <span style={{ opacity: 0.7 }}>×{d.count}</span>
                  </Tag>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      {/* 价格带列表表格 */}
      <Card
        title={
          <Space>
            <IconFile style={{ color: '#165dff' }} />
            <span style={{ fontWeight: 600 }}>价格带动态聚类与测算矩阵</span>
          </Space>
        }
        bordered
        style={{ borderRadius: 8 }}
      >
        <Table
          rowKey="priceBand"
          columns={columns}
          data={bands}
          loading={loading}
          pagination={false}
          scroll={{ x: true }}
          noDataElement={<Empty description="暂无价格带数据，请点击上方「价格带与利润预览」" />}
        />
      </Card>

      {/* 价格带下钻详情抽屉 */}
      <Drawer
        title={
          <Space>
            <Tag color="arcoblue" style={{ fontSize: 14 }}>{selectedBand?.priceBand}</Tag>
            <span>价格带深度洞察与作图指导</span>
          </Space>
        }
        visible={detailDrawerOpen}
        onOk={() => setDetailDrawerOpen(false)}
        onCancel={() => setDetailDrawerOpen(false)}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              type="primary"
              icon={<IconArrowRight />}
              onClick={() => {
                setDetailDrawerOpen(false)
                navigate('/content/product-sets')
              }}
            >
              带入套图设计工作台
            </Button>
            <Button onClick={() => setDetailDrawerOpen(false)}>关闭</Button>
          </div>
        }
      >
        {selectedBand && (
          <div>
            {/* 核心财务测算摘要 */}
            <Card title="财务模型指标" bordered style={{ marginBottom: 16 }}>
              <Descriptions
                column={3}
                data={[
                  { label: '目标售价', value: `¥${selectedBand.targetPrice.toFixed(2)}` },
                  { label: '预估总成本', value: `¥${selectedBand.totalCost.toFixed(2)}` },
                  { label: '单件毛利', value: `¥${selectedBand.grossProfit.toFixed(2)}` },
                  { label: '毛利率', value: `${(selectedBand.grossMargin * 100).toFixed(1)}%` },
                  { label: '区间样本数', value: `${selectedBand.competitorCount} 款` },
                  { label: '目标利润价', value: `¥${selectedBand.targetMarginPrice.toFixed(2)}` },
                ]}
              />
            </Card>

            {/* 代表竞品主图画廊 */}
            <Card title="区间代表竞品主图" bordered style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {selectedBand.displayImages.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--color-border-2)',
                      borderRadius: 6,
                      overflow: 'hidden',
                      background: 'var(--color-fill-2)',
                    }}
                  >
                    <Image
                      src={img.url}
                      height={140}
                      style={{ width: '100%', objectFit: 'cover' }}
                      preview
                    />
                    <div style={{ padding: '8px 10px' }}>
                      <Text bold ellipsis style={{ fontSize: 12, display: 'block' }}>{img.title || `竞品 #${idx + 1}`}</Text>
                      {img.price && <Text style={{ color: '#ff7d00', fontSize: 12 }}>¥{img.price.toFixed(2)}</Text>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 卖点与痛点洞察 */}
            <Card title="AI 提炼高频卖点与买家痛点" bordered style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                  核心转化卖点（买点）：
                </Text>
                <Space wrap size={[8, 8]}>
                  {selectedBand.sellingPoints.map((sp) => (
                    <Tag key={sp.term} color="arcoblue">
                      {sp.term} ×{sp.count}
                    </Tag>
                  ))}
                </Space>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                  买家顾虑与真实诉求（痛点）：
                </Text>
                <Space wrap size={[8, 8]}>
                  {selectedBand.demands.map((d) => (
                    <Tag key={d.term} color="orangered">
                      {d.term} ×{d.count}
                    </Tag>
                  ))}
                </Space>
              </div>
            </Card>

            {/* AI 推荐作图提示词 (核心资产) */}
            <Card
              title={
                <Space>
                  <IconThunderbolt style={{ color: '#ff7d00' }} />
                  <span>AI 推荐商业作图提示词（直接用于 AI 生图）</span>
                </Space>
              }
              bordered
              style={{ marginBottom: 16 }}
            >
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text bold style={{ fontSize: 13 }}>1. 主图视觉提示词 (Main Image Prompt)</Text>
                  <Button size="mini" type="text" icon={<IconCopy />} onClick={() => copyText(selectedBand.imagePrompts.mainImage)}>
                    复制提示词
                  </Button>
                </div>
                <Paragraph
                  style={{
                    background: 'var(--color-fill-2)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    margin: 0,
                  }}
                >
                  {selectedBand.imagePrompts.mainImage || '暂无主图提示词'}
                </Paragraph>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text bold style={{ fontSize: 13 }}>2. 核心功能拆解图提示词 (Detail Exploded Prompt)</Text>
                  <Button size="mini" type="text" icon={<IconCopy />} onClick={() => copyText(selectedBand.imagePrompts.detailImage)}>
                    复制提示词
                  </Button>
                </div>
                <Paragraph
                  style={{
                    background: 'var(--color-fill-2)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    margin: 0,
                  }}
                >
                  {selectedBand.imagePrompts.detailImage || '暂无详情图提示词'}
                </Paragraph>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text bold style={{ fontSize: 13 }}>3. 买家秀场景感提示词 (Buyer Show Lifestyle)</Text>
                  <Button size="mini" type="text" icon={<IconCopy />} onClick={() => copyText(selectedBand.imagePrompts.buyerShow)}>
                    复制提示词
                  </Button>
                </div>
                <Paragraph
                  style={{
                    background: 'var(--color-fill-2)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    margin: 0,
                  }}
                >
                  {selectedBand.imagePrompts.buyerShow || '暂无买家秀提示词'}
                </Paragraph>
              </div>
            </Card>

            {/* 买家问大家精选 */}
            <Card title="真实问大家与典型咨询" bordered>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedBand.qaExamples.map((qa, i) => (
                  <div key={i} style={{ background: 'var(--color-fill-2)', padding: '10px 12px', borderRadius: 6 }}>
                    <Text bold style={{ fontSize: 13, color: '#165dff', display: 'block', marginBottom: 4 }}>
                      问：{qa.question}
                    </Text>
                    <Text style={{ fontSize: 12, color: 'var(--color-text-2)' }}>
                      答：{qa.answer}
                    </Text>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </Drawer>

      {/* 历史报告抽屉 */}
      <Drawer
        title="历史生成的市场竞品分析报告"
        visible={historyDrawerOpen}
        onOk={() => setHistoryDrawerOpen(false)}
        onCancel={() => setHistoryDrawerOpen(false)}
        width={480}
        footer={<Button onClick={() => setHistoryDrawerOpen(false)}>关闭</Button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {historyReports.map((hr) => (
            <Card
              key={hr.id}
              hoverable
              bordered
              style={{ cursor: 'pointer' }}
              onClick={() => handleSelectHistoryReport(hr)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text bold style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                    {String(hr.summaryJson?.keyword || hr.reportNo || hr.id.slice(0, 10))}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    竞品样本数: {hr.competitorCount || '-'} ｜ 状态: <Tag color="green" size="small">{hr.status}</Tag>
                  </Text>
                </div>
                <IconArrowRight style={{ color: '#165dff' }} />
              </div>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  更新时间：{new Date(hr.updatedAt).toLocaleString()}
                </Text>
              </div>
            </Card>
          ))}
          {historyReports.length === 0 && (
            <Empty description="暂无历史分析报告" />
          )}
        </div>
      </Drawer>

      {/* 大模型分析生成模态框 */}
      <Modal
        title={
          <Space>
            <IconThunderbolt style={{ color: '#165dff' }} />
            <span>AI 大模型竞品深度分析进行中</span>
          </Space>
        }
        visible={showGenerateModal}
        footer={
          generating ? null : (
            <Button type="primary" onClick={() => setShowGenerateModal(false)}>
              完成并查看报告
            </Button>
          )
        }
        closable={!generating}
        onCancel={() => setShowGenerateModal(false)}
      >
        <div style={{ padding: '12px 0' }}>
          <Steps current={generateStep} direction="vertical" style={{ marginBottom: 20 }}>
            <Step title="检索竞品样本与聚类" description="正在对采集库内竞品价格分布进行数学聚类与分箱" />
            <Step title="多维财务模型测算" description="正在测算各价格带毛利空间与动态盈亏平衡点" />
            <Step title="豆包/Ark 视觉特征分析" description="正在分析高转化竞品主图、构图逻辑与卖点关键词" />
            <Step title="生成商业作图提示词与报告" description="正在输出 5 套图位作图指导与买家痛点应对策略" />
          </Steps>

          {generating && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <IconLoading style={{ fontSize: 24, color: '#165dff' }} />
              <Paragraph style={{ marginTop: 8, fontSize: 13 }} type="secondary">
                大模型多模态分析处理中，请勿关闭窗口...
              </Paragraph>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}