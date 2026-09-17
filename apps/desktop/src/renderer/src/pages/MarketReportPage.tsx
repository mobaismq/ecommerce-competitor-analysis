import { useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Message, Table, Typography } from '@arco-design/web-react'
import { api } from '../api/client'

interface Band {
  priceBand: string
  targetPrice: number
  totalCost: number
  grossProfit: number
  grossMargin: number
  targetMarginPrice: number
}

export function MarketReportPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [bands, setBands] = useState<Band[]>([])
  const [collectionInfo, setCollectionInfo] = useState<{ keyword?: string | null; productCount: number } | null>(null)

  const preview = async () => {
    const v = await form.validate()
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (v.keyword) params.set('keyword', v.keyword)
      const nums: Array<[string, number | undefined]> = [
        ['costPrice', v.costPrice], ['shippingCost', v.shippingCost], ['packagingCost', v.packagingCost],
        ['laborCost', v.laborCost], ['platformFeeRate', v.platformFeeRate], ['adFeeRate', v.adFeeRate], ['targetMargin', v.targetMargin],
      ]
      for (const [k, val] of nums) if (val !== undefined && val !== null && val !== '') params.set(k, String(val))
      const { data } = await api.get(`/api/reports/market-bands-preview?${params.toString()}`)
      setBands(data?.profitSimulation ?? [])
      setCollectionInfo(data?.collection ?? null)
      Message.success(`共 ${data?.priceBands?.length ?? 0} 个价格带`)
    } catch {
      Message.error('价格带预览失败')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: '价格带', dataIndex: 'priceBand' },
    { title: '目标价', dataIndex: 'targetPrice', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '总成本', dataIndex: 'totalCost', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '毛利', dataIndex: 'grossProfit', render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '毛利率', dataIndex: 'grossMargin', render: (v: number) => `${(v * 100).toFixed(1)}%` },
    { title: '目标利润率售价', dataIndex: 'targetMarginPrice', render: (v: number) => (v > 0 ? `¥${v.toFixed(2)}` : '-') },
  ] as never

  return (
    <div className="page">
      <Card title="市场报告 · 生成工作台" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item label="关键词" field="keyword" rules={[{ required: true, message: '请输入关键词' }]}>
            <Input placeholder="例如：蓝牙耳机" />
          </Form.Item>
          <Form.Item label="成本与费率参数（可选）">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <Form.Item field="costPrice" label="成本价"><InputNumber style={{ width: '100%' }} placeholder="成本价" /></Form.Item>
              <Form.Item field="shippingCost" label="运费"><InputNumber style={{ width: '100%' }} placeholder="运费" /></Form.Item>
              <Form.Item field="packagingCost" label="包材"><InputNumber style={{ width: '100%' }} placeholder="包材" /></Form.Item>
              <Form.Item field="laborCost" label="人工"><InputNumber style={{ width: '100%' }} placeholder="人工" /></Form.Item>
              <Form.Item field="platformFeeRate" label="平台费率(%)"><InputNumber style={{ width: '100%' }} placeholder="如 5" /></Form.Item>
              <Form.Item field="adFeeRate" label="广告费率(%)"><InputNumber style={{ width: '100%' }} placeholder="如 10" /></Form.Item>
              <Form.Item field="targetMargin" label="目标利润率(%)"><InputNumber style={{ width: '100%' }} placeholder="如 20" /></Form.Item>
            </div>
          </Form.Item>
          <Button type="primary" loading={loading} onClick={() => void preview()}>价格带预览</Button>
        </Form>
      </Card>
      <Card title="价格带与利润测算">
        {collectionInfo && (
          <Typography.Paragraph style={{ fontSize: 13 }}>
            数据源：{collectionInfo.keyword ?? '-'} ｜ 商品数：{collectionInfo.productCount}
          </Typography.Paragraph>
        )}
        <Table rowKey="priceBand" columns={columns} data={bands} pagination={false} scroll={{ x: true }} />
        {bands.length === 0 && <Typography.Text type="secondary">输入关键词并点击预览，基于最近一次采集计算价格带与利润</Typography.Text>}
      </Card>
    </div>
  )
}