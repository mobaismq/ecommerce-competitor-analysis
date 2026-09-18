import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'

// 数据看板：当前后端未提供 analytics 接口，先用本地示例数据展示卡片式统计、趋势与商品表格。
// 迁移自旧 apps/legacy/src/app/pages/DataAnalytics.tsx，改为新前端纯 CSS 风格。

interface TrendPoint {
  date: string
  clickRate: number
  conversionRate: number
}

interface ProductPerf {
  id: string
  name: string
  platform: string
  impressions: number
  clicks: number
  conversions: number
}

const TREND: TrendPoint[] = [
  { date: '06-14', clickRate: 3.2, conversionRate: 1.8 },
  { date: '06-15', clickRate: 3.5, conversionRate: 2.1 },
  { date: '06-16', clickRate: 3.1, conversionRate: 1.9 },
  { date: '06-17', clickRate: 3.8, conversionRate: 2.3 },
  { date: '06-18', clickRate: 4.2, conversionRate: 2.5 },
  { date: '06-19', clickRate: 4.0, conversionRate: 2.4 },
  { date: '06-20', clickRate: 4.5, conversionRate: 2.8 },
]

const PRODUCTS: ProductPerf[] = [
  { id: '1', name: '无线蓝牙耳机 Pro', platform: '亚马逊', impressions: 12580, clicks: 528, conversions: 142 },
  { id: '2', name: '智能手表 Series 5', platform: 'TikTok', impressions: 8920, clicks: 356, conversions: 89 },
  { id: '3', name: '便携充电宝 20000mAh', platform: '速卖通', impressions: 6540, clicks: 196, conversions: 45 },
  { id: '4', name: '运动手环 Lite', platform: 'Temu', impressions: 15200, clicks: 684, conversions: 178 },
]

const PLATFORMS = ['全部', '亚马逊', 'TikTok', '速卖通', 'Temu']

export function DataAnalyticsPage() {
  const [platform, setPlatform] = useState('全部')
  const [range, setRange] = useState<'7d' | '30d'>('7d')

  const filtered = useMemo(() => (platform === '全部' ? PRODUCTS : PRODUCTS.filter((p) => p.platform === platform)), [platform])
  const shownTrend = range === '7d' ? TREND : TREND

  const avgClick = (shownTrend.reduce((sum, d) => sum + d.clickRate, 0) / shownTrend.length).toFixed(1)
  const avgConv = (shownTrend.reduce((sum, d) => sum + d.conversionRate, 0) / shownTrend.length).toFixed(1)
  const totalImpressions = filtered.reduce((sum, p) => sum + p.impressions, 0)
  const totalClicks = filtered.reduce((sum, p) => sum + p.clicks, 0)

  const ClickRateBar = ({ rate }: { rate: number }) => <div style={{ width: `${(rate / 5) * 100}%`, height: '100%', background: '#1f6feb', borderRadius: 4 }} />
  const ConvRateBar = ({ rate }: { rate: number }) => <div style={{ width: `${(rate / 3) * 100}%`, height: '100%', background: '#2e7d32', borderRadius: 4 }} />

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader title="数据分析" className="mb-3" />
      <section className="panel">
        <div className="panel-head">
        <h2>数据看板</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ padding: 6 }}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['7d', '30d'] as const).map((r) => (
              <button key={r} className="ghost" onClick={() => setRange(r)} style={{ fontWeight: range === r ? 700 : 400 }}>
                {r === '7d' ? '近7天' : '近30天'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: '总曝光量', value: totalImpressions.toLocaleString() },
          { label: '平均点击率', value: `${avgClick}%` },
          { label: '平均转化率', value: `${avgConv}%` },
          { label: '总点击数', value: totalClicks.toLocaleString() },
        ].map((item) => (
          <div key={item.label} style={{ border: '1px solid #e3e6ea', borderRadius: 8, padding: 16, background: '#fafbfc' }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{item.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>点击率趋势</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1f6feb' }}>{avgClick}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
            {shownTrend.map((p) => (
              <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                <div style={{ flex: 1, width: '100%' }}><ClickRateBar rate={p.clickRate} /></div>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{p.date}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>转化率趋势</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>{avgConv}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
            {shownTrend.map((p) => (
              <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                <div style={{ flex: 1, width: '100%' }}><ConvRateBar rate={p.conversionRate} /></div>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{p.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>商品表现</h3>
      <table>
        <thead>
          <tr><th>商品名称</th><th>平台</th><th className="right">曝光量</th><th className="right">点击数</th><th className="right">点击率</th><th className="right">转化率</th></tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 600 }}>{p.name}</td>
              <td>{p.platform}</td>
              <td className="right">{p.impressions.toLocaleString()}</td>
              <td className="right">{p.clicks.toLocaleString()}</td>
              <td className="right">{(p.clicks / p.impressions * 100).toFixed(1)}%</td>
              <td className="right">{(p.conversions / p.clicks * 100).toFixed(1)}%</td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={6}>暂无数据</td></tr>}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 12 }}>提示：当前为示例数据，后端 analytics 接口待接入。</p>
      </section>
    </div>
  )
}