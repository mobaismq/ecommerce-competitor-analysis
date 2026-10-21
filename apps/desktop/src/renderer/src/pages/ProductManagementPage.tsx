import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DatePicker, Message } from '@arco-design/web-react'
import dayjs from 'dayjs'
import { ChevronDown, ChevronRight, Plus, RotateCcw, Search, Upload, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Can } from '../components/Can'
import { api } from '../api/client'
import { formatDateTime } from '../utils/format'

/**
 * 平台商品（迁移自旧版 apps/legacy/src/app/pages/ProductManagement.tsx + 服务端 platform/*）。
 *
 * ## 布局与样式：沿用旧版
 * - 面包屑「商品 / 平台商品」+ 平台 Tab（蓝色文字 + 2px 下划线，无「全部」）
 * - 查询卡：4 列单行（店铺 / 商品标题 / 商品编码 / 商品ID）+ 第二行（状态 / 更新时间 / 查询+重置），控件 32px
 * - 操作条：「发布商品」（蓝）+「同步商品」（描边 + RotateCcw）
 * - 列表：自定义 `<table>`，表头 `#fafbfc`、行 hover、首列展开按钮；展开后插入 SKU 子表
 *   （sku图片/sku名称/sku编码/sku ID/价格，浅灰底 `#fafbfc`）
 * - 分页在卡片内部：共 N 条 + `< 1 2 3 >`
 *
 * ## 唯一权威判据
 * - 列表字段/筛选/分页由 worker `platform.listProducts` 判定，失败如实提示，不落假数据
 * - 店铺来自服务端 `/api/stores`（店铺归属服务器）
 * - 上下架无平台真实接口 → 只给明确提示，不伪造切换成功
 * - 采集快照不是上架草稿，不提供编辑/发布入口
 */
const TENANT_ID = 'local'
const PAGE_SIZE = 10

const STATUS_OPTIONS = ['草稿', '已发布', '发布失败', '审核中']

const PLATFORM_LABELS: Record<string, string> = {
  taobao: '淘宝',
  tmall: '天猫',
  jd: '京东',
  pdd: '拼多多',
  douyin: '抖店',
  xhs: '小红书',
}

interface PlatformSku {
  skuName: string
  skuCode: string
  skuId: string
  price: number
  stock: number
  skuImage: string | null
}

interface PlatformProduct {
  id: string
  source: 'draft' | 'snapshot'
  productId: string
  productName: string
  productCode: string
  category: string
  platform: string
  storeId: string | null
  storeName: string | null
  price: number
  minPrice: number
  maxPrice: number
  publishStatus: string
  publishStatusCode: string
  listingStatus: string
  productImage: string | null
  updateTime: string
  createTime: string
  skus: PlatformSku[]
}

interface Filters {
  storeId: string
  keyword: string
  productCode: string
  externalId: string
  status: string
  updateRange: string[]
}

const EMPTY_FILTERS: Filters = { storeId: '', keyword: '', productCode: '', externalId: '', status: '', updateRange: [] }

const INPUT_CLASS = 'h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] text-[#0A1B39] outline-none transition-colors focus:border-[#409eff]'

function desktopInvoke(capability: string, payload?: unknown): Promise<unknown> {
  if (!window.desktop?.capabilities) throw new Error('当前环境未接入本地能力（window.desktop 缺失），无法调用该能力')
  return window.desktop.capabilities.invoke(capability, payload)
}

function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^Error:\s*/, '')
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  const record = payload as { rows?: T[]; items?: T[]; data?: T[] } | null
  if (Array.isArray(record?.rows)) return record.rows
  if (Array.isArray(record?.items)) return record.items
  if (Array.isArray(record?.data)) return record.data
  return []
}

/** 图片引用解析：本地落盘是 storageKey（listings/...），需要经能力层读回 dataUrl；http/data 直接用。 */
function ListingThumb({ value, size = 40 }: { value: string | null; size?: number }) {
  const direct = Boolean(value && (value.startsWith('http') || value.startsWith('data:')))
  const { data } = useQuery<string | null>({
    queryKey: ['listing-media', value],
    enabled: Boolean(value) && !direct,
    queryFn: async () => {
      const res = (await desktopInvoke('platform.mediaRaw', { storageKey: value })) as { dataUrl?: string } | null
      return res?.dataUrl ?? null
    },
  })
  const src = direct ? value : (data ?? null)

  if (src) return <img src={src} alt="" style={{ width: size, height: size }} className="rounded-lg object-cover" />
  return (
    <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-lg bg-[#f5f6f8]">
      <Upload className="h-4 w-4 text-[#c0c4cc]" />
    </div>
  )
}

/** 旧版 ProductRow：主行 + 展开后的 SKU 子表（浅灰底）。 */
function ProductRow({
  product,
  isExpanded,
  onToggleExpand,
  onEdit,
  onPublish,
  onToggleListing,
  storeLabel,
}: {
  product: PlatformProduct
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onPublish: () => void
  onToggleListing: () => void
  storeLabel: string
}) {
  return (
    <>
      <tr className="border-b border-[#f0f2f5] hover:bg-[#fafafa]">
        <td className="py-3 pl-4 pr-2">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent hover:bg-[#e9edf3]"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4 text-[#86909C]" /> : <ChevronRight className="h-4 w-4 text-[#86909C]" />}
          </button>
        </td>
        <td className="py-3 pr-2">
          <ListingThumb value={product.productImage} size={40} />
        </td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productName}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productCode || '--'}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productId || '--'}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.category || '--'}</td>
        <td className="whitespace-nowrap py-3 pr-2 text-[14px] text-[#0A1B39]">
          {product.minPrice === product.maxPrice ? `¥${product.minPrice}` : `¥${product.minPrice}-¥${product.maxPrice}`}
        </td>
        <td className="whitespace-nowrap py-3 pr-2 text-[14px] text-[#0A1B39]">{storeLabel}</td>
        <td className="py-3 pr-2">
          <span className="inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-[12px] text-black">{product.publishStatus}</span>
        </td>
        <td className="py-3 pr-2">
          <span className="inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-[12px] text-black">{product.listingStatus}</span>
        </td>
        <td className="whitespace-nowrap py-3 pr-2 text-[14px] text-[#0A1B39]">{formatDateTime(product.updateTime, '--')}</td>
        <td className="whitespace-nowrap py-3 pr-2 text-[14px] text-[#0A1B39]">{formatDateTime(product.createTime, '--')}</td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-3">
            <Can code="product:listing:edit">
              <button type="button" onClick={onEdit} className="cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-[14px] text-[#409eff] hover:text-[#66b1ff]">
                编辑
              </button>
            </Can>
            <Can code="product:listing:publish">
              <button type="button" onClick={onPublish} className="cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-[14px] text-[#409eff] hover:text-[#66b1ff]">
                发布
              </button>
            </Can>
            <Can code="product:listing:toggle">
              <button type="button" onClick={onToggleListing} className="cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-[14px] text-[#409eff] hover:text-[#66b1ff]">
                {product.listingStatus === '上架' ? '下架' : '上架'}
              </button>
            </Can>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <>
          <tr className="border-b border-[#f0f2f5] bg-[#fafbfc]">
            <td className="py-2 pl-4 pr-2"></td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">sku图片</td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">sku名称</td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">sku编码</td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">sku ID</td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">价格</td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-4"></td>
          </tr>
          {product.skus.length === 0 ? (
            <tr className="border-b border-[#f0f2f5] bg-[#fafbfc]">
              <td className="py-2 pl-4 pr-2"></td>
              <td colSpan={12} className="py-2 pr-2 text-[13px] text-[#86909C]">
                该商品暂无规格数据
              </td>
            </tr>
          ) : (
            product.skus.map((sku, index) => (
              <tr key={sku.skuId || sku.skuCode || index} className="border-b border-[#f0f2f5] bg-[#fafbfc]">
                <td className="py-2 pl-4 pr-2"></td>
                <td className="py-2 pr-2">
                  <ListingThumb value={sku.skuImage} size={32} />
                </td>
                <td className="py-2 pr-2 text-[13px] text-[#0A1B39]">{sku.skuName || '--'}</td>
                <td className="py-2 pr-2 text-[13px] text-[#0A1B39]">{sku.skuCode || '--'}</td>
                <td className="py-2 pr-2 text-[13px] text-[#0A1B39]">{sku.skuId || '--'}</td>
                <td className="py-2 pr-2 text-[13px] text-[#0A1B39]">{Number(sku.price) > 0 ? `¥${sku.price}` : '--'}</td>
                <td className="py-2 pr-2"></td>
                <td className="py-2 pr-2"></td>
                <td className="py-2 pr-2"></td>
                <td className="py-2 pr-2"></td>
                <td className="py-2 pr-2"></td>
                <td className="py-2 pr-2"></td>
                <td className="py-2 pr-4"></td>
              </tr>
            ))
          )}
        </>
      )}
    </>
  )
}

export function ProductManagementPage() {
  const navigate = useNavigate()

  const [activePlatform, setActivePlatform] = useState('')
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const platformsQuery = useQuery({
    queryKey: ['platform-dictionary'],
    queryFn: async () => {
      const { data } = await api.get('/api/platforms')
      return unwrapList<{ id: string; code: string; name?: string }>(data)
    },
  })

  const storesQuery = useQuery({
    queryKey: ['store-dictionary'],
    queryFn: async () => {
      const { data } = await api.get('/api/stores')
      return unwrapList<{ id: string; name?: string; storeName?: string; platformId?: string; platform?: { code?: string; name?: string } }>(data).map(
        (store) => ({
          id: store.id,
          name: store.name || store.storeName || `店铺 #${store.id}`,
          platformId: store.platformId ?? '',
          platformCode: store.platform?.code ?? '',
        }),
      )
    },
  })

  const platforms = platformsQuery.data ?? []
  const stores = storesQuery.data ?? []
  const storeNameById = useMemo(() => new Map(stores.map((store) => [store.id, store.name])), [stores])

  // 平台 Tab 需要覆盖「字典里有」+「数据里出现但字典缺失」两类平台，否则字典外平台的草稿会不可见
  const probeQuery = useQuery({
    queryKey: ['platform-products-probe'],
    queryFn: async () => {
      const result = (await desktopInvoke('platform.listProducts', { tenantId: TENANT_ID, page: 1, pageSize: 200 })) as
        | { items?: PlatformProduct[] }
        | undefined
      return Array.isArray(result?.items) ? result.items : []
    },
  })

  const platformTabs = useMemo(() => {
    const codes: string[] = []
    platforms.forEach((platform) => {
      if (platform.code && !codes.includes(platform.code)) codes.push(platform.code)
    })
    ;(probeQuery.data ?? []).forEach((item) => {
      if (item.platform && !codes.includes(item.platform)) codes.push(item.platform)
    })
    return codes
  }, [platforms, probeQuery.data])

  // 平台 Tab（旧版无「全部」）：默认第一个平台
  const currentPlatform = activePlatform || platformTabs[0] || ''

  const listQuery = useQuery({
    queryKey: ['platform-products', currentPlatform, applied, page],
    enabled: Boolean(currentPlatform),
    queryFn: async () => {
      const result = (await desktopInvoke('platform.listProducts', {
        tenantId: TENANT_ID,
        platform: currentPlatform,
        storeId: applied.storeId || undefined,
        keyword: applied.keyword.trim() || undefined,
        productCode: applied.productCode.trim() || undefined,
        externalId: applied.externalId.trim() || undefined,
        status: applied.status || undefined,
        updateTimeFrom: applied.updateRange[0] || undefined,
        updateTimeTo: applied.updateRange[1] || undefined,
        page,
        pageSize: PAGE_SIZE,
      })) as { items?: PlatformProduct[]; total?: number } | undefined
      return { items: Array.isArray(result?.items) ? result.items : [], total: Number(result?.total) || 0 }
    },
  })

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const platformLabel = (code: string) =>
    platforms.find((platform) => platform.code === code)?.name || PLATFORM_LABELS[code?.toLowerCase()] || code || '电商平台'

  // 旧版 currentStoreOptions：只列出当前平台下的店铺
  const storeOptions = useMemo(
    () => stores.filter((store) => !store.platformCode || store.platformCode === currentPlatform),
    [stores, currentPlatform],
  )

  const displayStore = (record: PlatformProduct) => {
    if (record.storeName) return record.storeName
    if (record.storeId) return storeNameById.get(record.storeId) ?? record.storeId
    return '--'
  }

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const goPublishPage = (state?: Record<string, unknown>) =>
    navigate('/product/management/manual', state ? { state: { platform: currentPlatform, ...state } } : { state: { platform: currentPlatform } })

  /** 编辑：仅本地草稿可回填（采集快照不是上架草稿，如实告知）。 */
  const handleEdit = (record: PlatformProduct) => {
    if (record.source !== 'draft') {
      Message.warning('采集快照不是本地上架草稿，无法编辑；请先从「发布商品」发起上架')
      return
    }
    goPublishPage({ draftId: record.id })
  }

  /** 发布：进入上架页并回填该草稿，由用户确认后提交（不静默直发）。 */
  const handlePublish = (record: PlatformProduct) => {
    if (record.source !== 'draft') {
      Message.warning('采集快照不支持再次发布；请新建上架草稿')
      return
    }
    goPublishPage({ draftId: record.id })
  }

  /** 上下架：平台真实接口未接入，如实提示，不伪造切换成功。 */
  const handleToggleListing = () => {
    Message.warning('上下架需要平台真实接口，当前未接入，无法变更线上状态')
  }

  /** 同步商品：仅重新拉取本地平台商品数据（平台侧同步接口未接入）。 */
  const handleSync = async () => {
    await listQuery.refetch()
    Message.info('已刷新本地平台商品数据（平台侧同步接口未接入）')
  }

  const handlePlatformClick = (code: string) => {
    setActivePlatform(code)
    setDraft((prev) => ({ ...prev, storeId: '' }))
    setApplied((prev) => ({ ...prev, storeId: '' }))
    setPage(1)
    setExpanded(new Set())
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader breadcrumbs={[{ label: '商品' }, { label: '平台商品' }]} className="mb-2" />

      {/* 平台 Tab（旧版样式：蓝色文字 + 2px 下划线） */}
      <div className="mb-2 flex border-b border-[#e6e9ef]">
        {platformTabs.length === 0 ? (
          <span className="px-1 py-2 text-[13px] text-[#86909C]">
            {platformsQuery.isLoading || probeQuery.isLoading ? '平台加载中…' : '暂无可用平台'}
          </span>
        ) : (
          platformTabs.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handlePlatformClick(code)}
              className={`relative cursor-pointer border-0 bg-transparent px-5 py-2 text-[14px] font-bold transition-colors ${
                currentPlatform === code ? 'text-[#409eff]' : 'text-[#0A1B39] hover:text-[#409eff]'
              }`}
            >
              {platformLabel(code)}
              {currentPlatform === code && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#409eff]" />}
            </button>
          ))
        )}
      </div>

      {/* 查询卡（旧版 4 列单行 + 第二行） */}
      <div className="mb-4 rounded-xl bg-white p-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">店铺</label>
            <div className="relative min-w-0 flex-1">
              <select
                value={draft.storeId}
                onChange={(event) => setDraft((prev) => ({ ...prev, storeId: event.target.value }))}
                className={`${INPUT_CLASS} appearance-none pr-7 ${!draft.storeId ? 'text-[#c0c4cc]' : ''}`}
              >
                <option value="">请选择</option>
                {storeOptions.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
              {draft.storeId && (
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, storeId: '' }))}
                  className="absolute right-7 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">商品标题</label>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
              <input
                type="text"
                placeholder="请输入"
                value={draft.keyword}
                onChange={(event) => setDraft((prev) => ({ ...prev, keyword: event.target.value }))}
                className={`${INPUT_CLASS} pl-8 pr-7`}
              />
              {draft.keyword && (
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, keyword: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">商品编码</label>
            <input
              type="text"
              placeholder="多个用逗号分隔"
              value={draft.productCode}
              onChange={(event) => setDraft((prev) => ({ ...prev, productCode: event.target.value }))}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">商品ID</label>
            <input
              type="text"
              placeholder="多个用逗号分隔"
              value={draft.externalId}
              onChange={(event) => setDraft((prev) => ({ ...prev, externalId: event.target.value }))}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">状态</label>
            <div className="relative min-w-0 flex-1">
              <select
                value={draft.status}
                onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))}
                className={`${INPUT_CLASS} appearance-none pr-7 ${!draft.status ? 'text-[#c0c4cc]' : ''}`}
              >
                <option value="">请选择</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">更新时间</label>
            <DatePicker.RangePicker
              className="min-w-0 flex-1"
              value={draft.updateRange.length === 2 ? [dayjs(draft.updateRange[0]), dayjs(draft.updateRange[1])] : []}
              onChange={(dateString) => setDraft((prev) => ({ ...prev, updateRange: dateString ?? [] }))}
              placeholder={['开始日期', '结束日期']}
              allowClear
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setApplied({ ...draft })
                setPage(1)
              }}
              className="h-8 shrink-0 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff]"
            >
              查询
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY_FILTERS)
                setApplied(EMPTY_FILTERS)
                setPage(1)
              }}
              className="h-8 shrink-0 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {/* 操作条 */}
      <div className="mb-4 flex gap-3">
        <Can code="product:listing:create">
          <button
            type="button"
            onClick={() => goPublishPage()}
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#409eff] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#66b1ff]"
          >
            <Plus className="h-4 w-4" />
            发布商品
          </button>
        </Can>
        <button
          type="button"
          onClick={() => void handleSync()}
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e6e9ef] bg-white px-4 text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]"
        >
          <RotateCcw className="h-4 w-4" /> 同步商品
        </button>
      </div>

      {/* 列表 */}
      {listQuery.isError && (
        <div className="mb-3 rounded-xl border border-[#ffd2d2] bg-[#fff3f3] px-4 py-3 text-[13px] text-[#d93026]">
          平台商品加载失败：{errorText(listQuery.error)}
        </div>
      )}
      <div className="overflow-hidden rounded-xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-[14px]">
            <thead>
              <tr className="border-b border-[#f0f2f5] bg-[#fafbfc]">
                <th className="w-10 py-3 pl-4 pr-2 text-center text-[13px] font-normal text-[#86909C]"></th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品图片</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品名称</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品编码</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品ID</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品类目</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">价格</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">店铺</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">发布状态</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">上下架状态</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">更新时间</th>
                <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">创建时间</th>
                <th className="py-3 pr-4 text-left text-[13px] font-normal text-[#86909C]">操作</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[14px] text-[#86909C]">
                    加载中…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[14px] text-[#86909C]">
                    暂无数据
                  </td>
                </tr>
              ) : (
                items.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isExpanded={expanded.has(product.id)}
                    onToggleExpand={() => toggleExpand(product.id)}
                    onEdit={() => handleEdit(product)}
                    onPublish={() => handlePublish(product)}
                    onToggleListing={handleToggleListing}
                    storeLabel={displayStore(product)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页（旧版：卡片内部） */}
        <div className="flex items-center justify-between border-t border-[#f0f2f5] px-4 py-3">
          <div className="text-[13px] text-[#86909C]">共 {total} 条</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="h-7 w-7 rounded-md border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] transition-colors hover:bg-[#f5f6f8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`h-7 w-7 rounded-md text-[13px] transition-colors ${
                  page === pageNumber ? 'bg-[#409eff] text-white' : 'border border-[#e6e9ef] bg-white text-[#0A1B39] hover:bg-[#f5f6f8]'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="h-7 w-7 rounded-md border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] transition-colors hover:bg-[#f5f6f8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
