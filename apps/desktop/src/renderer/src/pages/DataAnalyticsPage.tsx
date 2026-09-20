import { useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'

// 数据看板：后端当前未提供 analytics 接口，旧版（DataAnalytics.tsx）与桌面端此前均硬编码示例数据。
// 依照「禁止沿袭旧版硬编码 MOCK、宁不渲染也不伪造数据」红线，改走诚实空态；待真实 analytics 接口接入后填充。
// 保留交互控件与旧版一致的平台下拉、时间范围、统计卡、趋势分析与商品表现表头。

const PLATFORMS = ['全部', '亚马逊', 'TikTok', '速卖通', 'Temu', 'Shein', 'Shopee', 'Lazada', 'eBay']

type TrendPoint = { date: string; clickRate: number; conversionRate: number }
type ProductPerf = { id: string; name: string; platform: string; impressions: number; clicks: number; conversions: number }

const trendBarStyle = { backgroundColor: '#1f6feb', borderRadius: 4, height: '100%' } as const
const convBarStyle = { backgroundColor: '#2e7d32', borderRadius: 4, height: '100%' } as const

export function DataAnalyticsPage() {
  const [platform, setPlatform] = useState('全部')
  const [range, setRange] = useState<'7d' | '30d'>('7d')

  // 真实接口未接入，暂无任何趋势/商品数据 —— 诚实空态，不伪造。
  const shownTrend: TrendPoint[] = []
  const products: ProductPerf[] = []

  const filtered = useMemo(() => (platform === '全部' ? products : products.filter((p) => p.platform === platform)), [platform, products])

  const avgClick = '0.0'
  const avgConv = '0.0'
  const totalImpressions = filtered.reduce((sum, p) => sum + p.impressions, 0)
  const totalClicks = filtered.reduce((sum, p) => sum + p.clicks, 0)

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader title="数据分析" className="mb-3" />
      <p className="m-0 mb-4 text-[14px] font-medium text-[#86909C]">追踪商品图片的点击率和转化率，优化营销效果</p>

      <section style={{ background: '#fff', borderRadius: 12, border: '1px solid #e3e6ea', padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>数据分析</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={{ height: 32, padding: '0 8px', borderRadius: 8, border: '1px solid #d8e0ea', background: '#fff', color: '#0a1b39', fontSize: 13, fontWeight: 700 }}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 4, background: '#f2f4f7', borderRadius: 8, padding: 3 }}>
              {(['7d', '30d'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  style={{
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: range === r ? '#3388ff' : 'transparent',
                    color: range === r ? '#fff' : '#86909c',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {r === '7d' ? '近7天' : '近30天'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: '总曝光量', value: totalImpressions ? totalImpressions.toLocaleString() : '-' },
            { label: '平均点击率', value: `${avgClick}%` },
            { label: '平均转化率', value: `${avgConv}%` },
            { label: '总点击数', value: totalClicks ? totalClicks.toLocaleString() : '-' },
          ].map((item) => (
            <div key={item.label} style={{ border: '1px solid #e3e6ea', borderRadius: 8, padding: 16, background: '#fafbfc' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0a1b39' }}>趋势分析</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>点击率趋势</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1f6feb' }}>{avgClick}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 120 }}>
              {shownTrend.map((p) => (
                <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                  <div style={{ flex: 1, width: '100%' }}>
                    <div style={{ ...trendBarStyle, height: `${(p.clickRate / 5) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>{p.date}</span>
                </div>
              ))}
              {!shownTrend.length && <span style={{ fontSize: 13, color: '#9ca3af' }}>暂无趋势数据</span>}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>转化率趋势</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>{avgConv}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 120 }}>
              {shownTrend.map((p) => (
                <div key={p.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                  <div style={{ flex: 1, width: '100%' }}>
                    <div style={{ ...convBarStyle, height: `${(p.conversionRate / 3) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>{p.date}</span>
                </div>
              ))}
              {!shownTrend.length && <span style={{ fontSize: 13, color: '#9ca3af' }}>暂无趋势数据</span>}
            </div>
          </div>
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: '#0a1b39' }}>商品表现</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', color: '#86909c', textAlign: 'right' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>商品名称</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>曝光量</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>点击数</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>点击率</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>转化数</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>转化率</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid #eef1f5', color: '#344054' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'left' }}>{p.name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{p.impressions.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{p.clicks.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{p.clicks && p.impressions ? `${((p.clicks / p.impressions) * 100).toFixed(1)}%` : '-'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{p.conversions}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{p.conversions && p.clicks ? `${((p.conversions / p.clicks) * 100).toFixed(1)}%` : '-'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#86909c', fontSize: 12 }}>查看预警</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 12px', textAlign: 'center', color: '#9ca3af' }}>暂无数据，等待 analytics 数据接入</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}