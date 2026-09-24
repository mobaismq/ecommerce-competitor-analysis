import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, RefreshCw, Search, X } from 'lucide-react'
import { Table } from '@arco-design/web-react'
import { formatDateTime } from '../utils/format'
import { PageHeader } from '../components/PageHeader'

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

const PLATFORM_LABELS: Record<string, string> = {
  taobao: '淘宝天猫',
  jd: '京东',
  douyin: '抖音电商',
  pdd: '拼多多',
}

const PAGE_SIZE = 10

export function ProductManagementPage() {
  const navigate = useNavigate()
  const [platform, setPlatform] = useState<string>('all')
  const [keyword, setKeyword] = useState<string>('')
  const [status, setStatus] = useState<string>('all')

  // 数据流走本地能力 IPC（worker 读本地 ListingDraft + ProductSnapshot），不再经本地 HTTP 后端
  const { data, isLoading, refetch, isFetching } = useQuery<{
    items?: PlatformProduct[]
    total?: number
  }>({
    queryKey: ['platform-products', platform, keyword, status],
    queryFn: async () => {
      const res = await window.desktop?.capabilities.invoke('platform.listProducts', {
        tenantId: 'local',
        platform: platform === 'all' ? undefined : platform,
        status: status === 'all' ? undefined : status,
        keyword: keyword.trim() || undefined,
      }) as { items?: PlatformProduct[]; total?: number } | undefined
      const items = Array.isArray(res?.items) ? res.items : []
      return { items, total: res?.total ?? items.length }
    },
  })

  const items = data?.items ?? []

  // 动态平台 Tabs（对照旧版下划线样式；全部 + 数据中出现的平台）
  const platforms = useMemo(() => {
    const set = new Set<string>()
    items.forEach((it) => it.platform && set.add(it.platform))
    return ['all', ...Array.from(set)]
  }, [items])

  const platformLabel = (plat: string) => PLATFORM_LABELS[plat?.toLowerCase()] || plat || '电商平台'

  const statusBadge = (st: string) => {
    const map: Record<string, { text: string; className: string }> = {
      online: { text: '在售中', className: 'bg-[#e8f5e9] text-[#2e7d32]' },
      published: { text: '在售中', className: 'bg-[#e8f5e9] text-[#2e7d32]' },
      offline: { text: '已下架', className: 'bg-[#f2f4f7] text-[#86909C]' },
      draft: { text: '草稿待发', className: 'bg-[#fff8e6] text-[#b45309]' },
    }
    const view = map[st?.toLowerCase()] || { text: st || '正常', className: 'bg-[#f0f7ff] text-[#3388ff]' }
    return <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${view.className}`}>{view.text}</span>
  }

  const columns = [
    {
      title: '商品标题',
      dataIndex: 'title',
      render: (_: unknown, record: PlatformProduct) => (
        <div>
          <p className="m-0 text-[13px] font-semibold text-[#0A1B39]">{record.title || '未命名商品'}</p>
          <p className="m-0 mt-0.5 font-mono text-[11px] text-[#c0c4cc]">
            {record.outerId ? `编码 ${record.outerId}` : `ID ${record.id}`}
          </p>
        </div>
      ),
    },
    {
      title: '渠道平台',
      dataIndex: 'platform',
      render: (platform: string) => <span className="whitespace-nowrap text-[13px] text-[#344054]">{platformLabel(platform)}</span>,
    },
    {
      title: '销售价',
      dataIndex: 'price',
      render: (price: number) => <span className="whitespace-nowrap text-[13px] font-bold text-[#ff7d00]">¥{Number(price || 0).toFixed(2)}</span>,
    },
    {
      title: '当前库存',
      dataIndex: 'stock',
      render: (stock: number) => <span className="whitespace-nowrap text-[13px] text-[#344054]">{stock ?? '—'} 件</span>,
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      render: (status: string) => statusBadge(status),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      render: (updatedAt?: string) => <span className="whitespace-nowrap text-[13px] text-[#86909C]">{formatDateTime(updatedAt)}</span>,
    },
    {
      title: '操作',
      dataIndex: 'op',
      render: (_: unknown, record: PlatformProduct) => (
        <button
          type="button"
          onClick={() => navigate('/products/management/manual')}
          className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#3388ff] hover:text-[#1a6fe8]"
        >
          编辑发布
        </button>
      ),
    },
  ]

  return (
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        <PageHeader breadcrumbs={[{ label: '商品' }, { label: '平台商品' }]} className="mb-2" />

        {/* 平台 Tabs（对照旧版下划线高亮） */}
        <div className="mb-2 flex items-center gap-6 border-b border-[#e6e9ef]">
          {platforms.map((plat) => (
            <button
              key={plat}
              type="button"
              onClick={() => setPlatform(plat)}
              className={`relative cursor-pointer border-0 bg-transparent pb-2.5 pt-1 text-[14px] transition-colors ${
                platform === plat ? 'font-bold text-[#409eff]' : 'text-[#4e5969] hover:text-[#0A1B39]'
              }`}
            >
              {plat === 'all' ? '全部平台' : platformLabel(plat)}
              {platform === plat && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#409eff]" />}
            </button>
          ))}
        </div>

        {/* 查询条件卡（对照旧版两行） */}
        <div className="mb-4 rounded-xl bg-white p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">商品标题</label>
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="请输入"
                  className={`h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 text-[13px] outline-none focus:border-[#409eff] ${keyword ? 'pr-7' : 'pr-3'}`}
                />
                {keyword && (
                  <button
                    type="button"
                    onClick={() => setKeyword('')}
                    aria-label="清空"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">发布状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] outline-none focus:border-[#409eff] ${status === 'all' ? 'text-[#98A2B3]' : 'text-[#0A1B39]'}`}
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c0c4cc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                <option value="all">请选择</option>
                <option value="online">在售中</option>
                <option value="offline">已下架</option>
                <option value="draft">草稿待发</option>
              </select>
            </div>
            <div className="col-span-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate('/products/management/manual')}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#409eff] px-4 text-[13px] font-bold text-white hover:bg-[#66b1ff]"
              >
                <Plus className="h-3.5 w-3.5" />
                发布商品
              </button>
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e6e9ef] bg-white px-4 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                同步商品
              </button>
            </div>
          </div>
        </div>

        {/* 表格卡（Arco Table：loading / 空状态 / 分页内建） */}
        <div className="overflow-hidden rounded-xl bg-white">
          <Table
            columns={columns}
            data={items}
            rowKey="id"
            loading={isLoading}
            border={false}
            scroll={{ x: 960 }}
            pagination={{ pageSize: PAGE_SIZE, showTotal: true }}
          />
        </div>
      </div>
    </div>
  )
}
