import { useEffect, useState, type ReactNode } from 'react'
import { Select, Space, Tag, Tooltip, Typography } from '@arco-design/web-react'
import { IconBook, IconQuestionCircle } from '@arco-design/web-react/icon'
import { api } from '../api/client'

export interface SuiteProduct {
  value: string
  label: string
  keyword?: string
  count: number
  priceRange?: string
  status?: string
  reportId?: string | number
  latestAt?: string
}

export function SectionTitle({ children, help = false, tooltip = '' }: { children: ReactNode; help?: boolean; tooltip?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
      <Typography.Title heading={6} style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1d2129' }}>
        {children}
      </Typography.Title>
      {help && (
        <Tooltip content={tooltip || '联动竞品分析报告，自动提取核心卖点、价格带与消费者痛点'}>
          <IconQuestionCircle style={{ color: '#86909c', fontSize: 13, cursor: 'help' }} />
        </Tooltip>
      )}
    </div>
  )
}

export interface AIReportSelectorProps {
  value?: string
  onChange: (reportId: string, report: SuiteProduct | null) => void
}

export function AIReportSelector({ value, onChange }: AIReportSelectorProps) {
  const [reports, setReports] = useState<SuiteProduct[]>([])
  const [loading, setLoading] = useState(false)

  async function loadReports() {
    setLoading(true)
    try {
      // 优先从新后端 /api/reports 加载
      const res = await api.get('/api/reports')
      const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? []
      const items: SuiteProduct[] = rows.map((r: { id: string; title?: string; keyword?: string; status?: string; competitorCount?: number; priceRange?: string; createdAt?: string }) => ({
        value: String(r.id),
        label: String(r.title || r.keyword || `报告 #${r.id}`),
        keyword: r.keyword || '竞品分析',
        count: Number(r.competitorCount || 0),
        priceRange: r.priceRange || '',
        status: r.status,
        reportId: r.id,
        latestAt: r.createdAt,
      }))
      setReports(items)
      // 如果当前没有选中且有报告，自动触发第一项或匹配项
      if (value) {
        const found = items.find((it) => it.value === value)
        if (found) onChange(found.value, found)
      }
    } catch {
      // 降级兜底
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [])

  return (
    <div style={{ marginBottom: 16 }}>
      <SectionTitle help tooltip="选择已完成的竞品分析报告，系统将自动把该报告的提炼卖点填充至生图提示词中">
        联动竞品 AI 报告
      </SectionTitle>
      <Select
        placeholder="请选择已生成的竞品分析报告..."
        value={value}
        loading={loading}
        allowClear
        showSearch
        style={{ width: '100%' }}
        onChange={(val) => {
          if (!val) {
            onChange('', null)
            return
          }
          const item = reports.find((it) => it.value === String(val)) || null
          onChange(String(val), item)
        }}
        renderFormat={(option) => {
          const item = reports.find((it) => it.value === option?.value)
          return item ? `${item.label} (${item.keyword} · ${item.count}个竞品)` : option?.label
        }}
      >
        {reports.map((r) => (
          <Select.Option key={r.value} value={r.value}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Space size="small">
                <IconBook style={{ color: '#165dff' }} />
                <span style={{ fontWeight: 600 }}>{r.label}</span>
              </Space>
              <Space size="mini">
                <Tag size="small" color="arcoblue">{r.keyword}</Tag>
                {r.count > 0 && <Tag size="small">{r.count}竞品</Tag>}
              </Space>
            </div>
          </Select.Option>
        ))}
      </Select>
    </div>
  )
}
