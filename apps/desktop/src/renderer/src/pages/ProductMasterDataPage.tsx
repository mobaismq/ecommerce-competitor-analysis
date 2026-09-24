import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Upload, X } from 'lucide-react'
import { nanoid } from 'nanoid'
import { DatePicker, Table } from '@arco-design/web-react'
import dayjs from 'dayjs'
import { PageHeader } from '../components/PageHeader'

function desktopInvoke(capability: string, payload?: unknown): Promise<unknown> {
  if (!window.desktop?.capabilities) throw new Error('当前环境未接入本地能力（window.desktop 缺失），无法调用该能力')
  return window.desktop.capabilities.invoke(capability, payload)
}

function ImageUpload({
  size = 'md',
  value,
  onChange,
}: {
  size?: 'sm' | 'md'
  value: string | null
  onChange: (url: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dim = size === 'sm' ? 'h-16 w-16' : 'h-20 w-20'
  const iconSize = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'

  const handleClick = () => inputRef.current?.click()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    onChange(url)
    e.target.value = ''
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      {value ? (
        <div
          className={`${dim} cursor-pointer overflow-hidden rounded-lg border border-[#e6e9ef] hover:border-[#409eff]`}
          onClick={handleClick}
        >
          <img src={value} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className={`${dim} flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#e6e9ef] bg-[#f9fafb] hover:border-[#409eff]`}
          onClick={handleClick}
        >
          <Upload className={`${iconSize} text-[#86909C]`} />
        </div>
      )}
    </div>
  )
}

interface Sku {
  id?: string
  skuCode: string
  specName: string
  specImage: string | null
  costPrice: number
  standardPrice: number
}

interface Product {
  id: string
  productCode: string
  productName: string
  brand: string | null
  productImage?: string | null
  storeId?: string | null
  storeName?: string | null
  status: 'enabled' | 'disabled'
  skus: Sku[]
  createdAt: string
  updatedAt: string
  // 展示用（格式化后的时间，源于 API 的 createdAt/updatedAt）
  updateTime?: string
  createTime?: string
}

function formatDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function ProductMasterDataPage() {
  const navigate = useNavigate()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // 查询条件（时间范围统一用 [开始, 结束] 数组承载，YYYY-MM-DD）
  const [searchCode, setSearchCode] = useState('')
  const [searchName, setSearchName] = useState('')
  const [searchBrand, setSearchBrand] = useState('')
  const [searchStore, setSearchStore] = useState('')
  const [searchUpdateTimeRange, setSearchUpdateTimeRange] = useState<string[]>([])
  const [searchCreateTimeRange, setSearchCreateTimeRange] = useState<string[]>([])
  const [filterCode, setFilterCode] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [filterUpdateTimeRange, setFilterUpdateTimeRange] = useState<string[]>([])
  const [filterCreateTimeRange, setFilterCreateTimeRange] = useState<string[]>([])

  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)

  // 弹窗表单状态
  const [productCode, setProductCode] = useState('')
  const [productName, setProductName] = useState('')
  const [productBrand, setProductBrand] = useState('')
  const [productImage, setProductImage] = useState<string | null>(null)
  const [skus, setSkus] = useState<Sku[]>([{ id: 'new-1', skuCode: '', specName: '', specImage: null, costPrice: 0, standardPrice: 0 }])

  // 数据流：商品主档走 worker 本地 SQLite product.list，空态/失败态诚实呈现，不做假数据兜底
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await desktopInvoke('product.list', { tenantId: 'local' })
      const items: Product[] = Array.isArray(data) ? (data as Product[]) : []
      setProducts(items)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const displayProducts = useMemo(
    () =>
      products.map((p) => ({
        ...p,
        updateTime: formatDateTime(p.updatedAt),
        createTime: formatDateTime(p.createdAt),
      })),
    [products],
  )

  const filteredProducts = useMemo(() => {
    return displayProducts.filter((p) => {
      if (filterCode && !p.productCode.toLowerCase().includes(filterCode.toLowerCase())) return false
      if (filterName && !p.productName.toLowerCase().includes(filterName.toLowerCase())) return false
      if (filterBrand && !(p.brand || '').toLowerCase().includes(filterBrand.toLowerCase())) return false
      if (filterStore && !(p.storeName || p.storeId || '').toLowerCase().includes(filterStore.toLowerCase())) return false
      const [uStart, uEnd] = filterUpdateTimeRange
      if (uStart && (p.updateTime || '') < uStart) return false
      if (uEnd && (p.updateTime || '') > uEnd + ' 23:59:59') return false
      const [cStart, cEnd] = filterCreateTimeRange
      if (cStart && (p.createTime || '') < cStart) return false
      if (cEnd && (p.createTime || '') > cEnd + ' 23:59:59') return false
      return true
    })
  }, [displayProducts, filterCode, filterName, filterBrand, filterStore, filterUpdateTimeRange, filterCreateTimeRange])

  const handleSearch = () => {
    setFilterCode(searchCode)
    setFilterName(searchName)
    setFilterBrand(searchBrand)
    setFilterStore(searchStore)
    setFilterUpdateTimeRange(searchUpdateTimeRange)
    setFilterCreateTimeRange(searchCreateTimeRange)
  }

  const handleReset = () => {
    setSearchCode('')
    setSearchName('')
    setSearchBrand('')
    setSearchStore('')
    setSearchUpdateTimeRange([])
    setSearchCreateTimeRange([])
    setFilterCode('')
    setFilterName('')
    setFilterBrand('')
    setFilterStore('')
    setFilterUpdateTimeRange([])
    setFilterCreateTimeRange([])
  }

  const openCreate = () => {
    setEditingProduct(null)
    setProductCode('')
    setProductName('')
    setProductBrand('')
    setProductImage(null)
    setSkus([{ id: 'new-1', skuCode: '', specName: '', specImage: null, costPrice: 0, standardPrice: 0 }])
    setShowAddModal(true)
  }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setProductCode(p.productCode)
    setProductName(p.productName)
    setProductBrand(p.brand || '')
    setProductImage(p.productImage || null)
    setSkus(
      p.skus.map((s) => ({
        id: s.id,
        skuCode: s.skuCode,
        specName: s.specName || '',
        specImage: s.specImage || null,
        costPrice: Number(s.costPrice || 0),
        standardPrice: Number(s.standardPrice || 0),
      })),
    )
    setShowAddModal(true)
  }

  const addSku = () => {
    setSkus((prev) => [...prev, { id: `new-${Date.now()}`, skuCode: '', specName: '', specImage: null, costPrice: 0, standardPrice: 0 }])
  }

  const updateSku = (index: number, field: keyof Sku, value: string | number | null) => {
    setSkus((prev) => prev.map((sku, i) => (i === index ? { ...sku, [field]: value } : sku)))
  }

  const removeSku = (index: number) => {
    setSkus((prev) => prev.filter((_, i) => i !== index))
  }

  // 保存（数据流保持桌面端现状：PATCH/POST + 本地容错）
  const handleSave = async () => {
    const payload: {
      productCode: string
      productName: string
      brand: string | null
      productImage?: string
      skus: { skuCode: string; specName: string; specImage?: string; costPrice: number; standardPrice: number }[]
    } = {
      productCode,
      productName,
      brand: productBrand || null,
      productImage: productImage || undefined,
      skus: skus.map((s) => ({
        skuCode: s.skuCode,
        specName: s.specName,
        specImage: s.specImage || undefined,
        costPrice: s.costPrice,
        standardPrice: s.standardPrice,
      })),
    }
    try {
      if (editingProduct) {
        await desktopInvoke('product.update', { id: editingProduct.id, tenantId: 'local', ...payload })
        setProducts((prev) => prev.map((item) => (item.id === editingProduct.id ? ({ ...item, ...payload, status: item.status } as Product) : item)))
      } else {
        const data = await desktopInvoke('product.create', { tenantId: 'local', ...payload }) as { id?: string } | undefined
        const createdId = data?.id || `prod-${nanoid(8)}`
        setProducts((prev) => [
          { id: createdId, ...payload, status: 'enabled', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), brand: payload.brand ?? null } as Product,
          ...prev,
        ])
      }
      setShowAddModal(false)
    } catch {
      // 容错更新本地
      if (editingProduct) {
        setProducts((prev) => prev.map((item) => (item.id === editingProduct.id ? ({ ...item, ...payload, status: item.status } as Product) : item)))
      } else {
        setProducts((prev) => [
          {
            id: `prod-${nanoid(8)}`,
            ...payload,
            status: 'enabled',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            brand: payload.brand ?? null,
          } as Product,
          ...prev,
        ])
      }
      setShowAddModal(false)
    }
  }

  const handleRemove = async (p: Product) => {
    try {
      await desktopInvoke('product.delete', { id: p.id, tenantId: 'local' })
    } catch {}
    setProducts((prev) => prev.filter((item) => item.id !== p.id))
    setShowDeleteModal(false)
    setDeletingProduct(null)
  }

  const toggleStatus = async (p: Product) => {
    const next: 'enabled' | 'disabled' = p.status === 'enabled' ? 'disabled' : 'enabled'
    try {
      await desktopInvoke('product.update', { id: p.id, tenantId: 'local', status: next })
    } catch {}
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next, updatedAt: new Date().toISOString() } : x)))
  }

  // 一键去发布（业务逻辑保持桌面端现状）
  const handleGoPublish = (p: Product) => {
    const avgPrice = p.skus.length > 0 ? p.skus[0].standardPrice : undefined
    navigate('/products/management/manual', {
      state: {
        fromMaster: true,
        name: p.productName,
        price: avgPrice,
        category: ['数码3C', '智能硬件'],
      },
    })
  }

  const handleDelete = (p: Product) => {
    setDeletingProduct(p)
    setShowDeleteModal(true)
  }

  const priceRangeText = (skus: Sku[], field: 'costPrice' | 'standardPrice') => {
    if (!skus.length) return '¥0'
    const min = Math.min(...skus.map((s) => s[field]))
    const max = Math.max(...skus.map((s) => s[field]))
    return min === max ? `¥${min}` : `¥${min}-¥${max}`
  }

  const columns = [
    {
      title: '商品图片',
      dataIndex: 'productImage',
      width: 90,
      render: () => (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2f4f7]">
          <svg className="h-5 w-5 text-[#c0c4cc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
        </div>
      ),
    },
    { title: '商品编码', dataIndex: 'productCode', width: 120 },
    { title: '商品名称', dataIndex: 'productName', width: 160 },
    { title: '品牌', dataIndex: 'brand', width: 90, render: (brand: string | null) => brand || '—' },
    {
      title: '店铺',
      dataIndex: 'storeName',
      width: 110,
      render: (_: unknown, record: Product) => <span className="text-[#86909C]">{record.storeName || record.storeId || '—'}</span>,
    },
    {
      title: '成本价',
      dataIndex: 'skus',
      width: 100,
      render: (_: unknown, record: Product) => <span className="whitespace-nowrap">{priceRangeText(record.skus, 'costPrice')}</span>,
    },
    {
      title: '标准售价',
      dataIndex: 'standardPrice',
      width: 110,
      render: (_: unknown, record: Product) => <span className="whitespace-nowrap">{priceRangeText(record.skus, 'standardPrice')}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: Product['status']) => (
        <span className="inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-[12px] text-black">
          {status === 'enabled' ? '启用' : '停用'}
        </span>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      width: 160,
      render: (v: string) => <span className="whitespace-nowrap">{v || ''}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      width: 160,
      render: (v: string) => <span className="whitespace-nowrap">{v || ''}</span>,
    },
    {
      title: '操作',
      dataIndex: 'op',
      width: 200,
      render: (_: unknown, record: Product) => (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => openEdit(record)} className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">
            编辑
          </button>
          <button type="button" onClick={() => void toggleStatus(record)} className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">
            {record.status === 'enabled' ? '停用' : '启用'}
          </button>
          <button type="button" onClick={() => handleGoPublish(record)} className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">
            去发布
          </button>
          <button type="button" onClick={() => handleDelete(record)} className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">
            删除
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        <PageHeader breadcrumbs={[{ label: '商品' }, { label: '商品主档' }]} className="mb-2" />

        {/* 查询条件 */}
        <div className="mb-4 rounded-xl bg-white p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">商品编码</label>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
                <input
                  type="text"
                  placeholder="请输入"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                />
                {searchCode && (
                  <button
                    type="button"
                    onClick={() => setSearchCode('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">商品名称</label>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
                <input
                  type="text"
                  placeholder="请输入"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                />
                {searchName && (
                  <button
                    type="button"
                    onClick={() => setSearchName('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">品牌</label>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
                <input
                  type="text"
                  placeholder="请输入"
                  value={searchBrand}
                  onChange={(e) => setSearchBrand(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                />
                {searchBrand && (
                  <button
                    type="button"
                    onClick={() => setSearchBrand('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">店铺</label>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
                <input
                  type="text"
                  placeholder="请输入"
                  value={searchStore}
                  onChange={(e) => setSearchStore(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                />
                {searchStore && (
                  <button
                    type="button"
                    onClick={() => setSearchStore('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {/* 更新时间（Arco RangePicker） */}
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">更新时间</label>
              <DatePicker.RangePicker
                className="min-w-0 flex-1"
                value={
                  searchUpdateTimeRange.length === 2
                    ? [dayjs(searchUpdateTimeRange[0]), dayjs(searchUpdateTimeRange[1])]
                    : []
                }
                onChange={(dateString) => setSearchUpdateTimeRange(dateString ?? [])}
                allowClear
              />
            </div>
          </div>
          {/* 第二行：创建时间 + 按钮 */}
          <div className="mt-3 grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">创建时间</label>
              <DatePicker.RangePicker
                className="min-w-0 flex-1"
                value={
                  searchCreateTimeRange.length === 2
                    ? [dayjs(searchCreateTimeRange[0]), dayjs(searchCreateTimeRange[1])]
                    : []
                }
                onChange={(dateString) => setSearchCreateTimeRange(dateString ?? [])}
                allowClear
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSearch}
                className="h-8 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff]"
              >
                查询
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="h-8 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]"
              >
                重置
              </button>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mb-4 flex gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="h-9 rounded-lg bg-[#409eff] px-5 text-[14px] font-bold text-white hover:bg-[#66b1ff]"
          >
            <div className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              新增商品
            </div>
          </button>
        </div>

        {/* 表单信息（Arco Table：展开 SKU 子表 / loading / 空态 / 分页内建） */}
        <div className="rounded-xl bg-white">
          <Table
            columns={columns}
            data={filteredProducts}
            rowKey="id"
            loading={loading}
            border={false}
            scroll={{ x: 1080 }}
            expandedRowRender={(record: Product) => <SkuSubTable skus={record.skus} />}
            pagination={filteredProducts.length > 0 ? { pageSize: 10, showTotal: true } : false}
          />
        </div>
      </div>

      {/* 新增/编辑弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[600px] max-h-[80vh] overflow-auto rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0A1B39]">{editingProduct ? '商品编辑' : '新增商品'}</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-[#86909C] hover:text-[#0A1B39]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-[15px] font-bold text-[#0A1B39]">商品信息</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">商品编码</label>
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder="商品编码请保持与ERP一致"
                    className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">商品名称</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="请输入"
                    className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">品牌</label>
                  <input
                    type="text"
                    value={productBrand}
                    onChange={(e) => setProductBrand(e.target.value)}
                    placeholder="请输入"
                    className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">商品图片</label>
                  <ImageUpload size="md" value={productImage} onChange={setProductImage} />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-[15px] font-bold text-[#0A1B39]">规格信息</h3>
              <div className="space-y-4">
                {skus.map((sku, index) => (
                  <div key={sku.id || index} className="relative rounded-lg border border-[#e6e9ef] p-4">
                    {skus.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSku(index)}
                        className="absolute right-2 top-2 text-[#c0c4cc] hover:text-[#f56c6c]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">SKU编码</label>
                        <input
                          type="text"
                          value={sku.skuCode}
                          onChange={(e) => updateSku(index, 'skuCode', e.target.value)}
                          placeholder="sku编码请保持与ERP一致"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">规格名称</label>
                        <input
                          type="text"
                          value={sku.specName}
                          onChange={(e) => updateSku(index, 'specName', e.target.value)}
                          placeholder="请输入"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">成本价（元）</label>
                        <input
                          type="number"
                          value={sku.costPrice || ''}
                          onChange={(e) => updateSku(index, 'costPrice', Number(e.target.value))}
                          placeholder="请输入"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">标准售价（元）</label>
                        <input
                          type="number"
                          value={sku.standardPrice || ''}
                          onChange={(e) => updateSku(index, 'standardPrice', Number(e.target.value))}
                          placeholder="请输入"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">规格图片</label>
                        <ImageUpload size="sm" value={sku.specImage} onChange={(url) => updateSku(index, 'specImage', url)} />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addSku} className="flex items-center gap-1 text-[14px] text-[#409eff] hover:text-[#66b1ff]">
                  <Plus className="h-4 w-4" />
                  添加规格
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[14px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="h-9 rounded-lg bg-[#409eff] px-5 text-[14px] font-bold text-white hover:bg-[#66b1ff]"
              >
                {editingProduct ? '保存' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteModal && deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[400px] rounded-xl bg-white p-6">
            <h2 className="mb-3 text-[18px] font-bold text-[#0A1B39]">提示</h2>
            <p className="mb-6 text-[14px] text-[#0A1B39]">确认删除该商品，删除后不可恢复？</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[14px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => deletingProduct && void handleRemove(deletingProduct)}
                className="h-9 rounded-lg bg-[#f56c6c] px-5 text-[14px] font-bold text-white hover:bg-[#f78989]"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** SKU 子表（展开行内嵌，对照旧版 sku图片/sku编码/规格/成本价/标准售价 列） */
const SKU_COLUMNS = [
  {
    title: 'sku图片',
    dataIndex: 'specImage',
    width: 90,
    render: () => <div className="h-8 w-8 rounded bg-[#e9edf3]" />,
  },
  {
    title: 'sku编码',
    dataIndex: 'skuCode',
    render: (v: string) => <span className="text-[13px] text-[#86909C]">{v}</span>,
  },
  {
    title: '规格',
    dataIndex: 'specName',
    render: (v: string) => <span className="text-[13px] text-[#86909C]">{v}</span>,
  },
  {
    title: '成本价',
    dataIndex: 'costPrice',
    render: (v: number) => <span className="text-[13px] text-[#86909C]">¥{v}</span>,
  },
  {
    title: '标准售价',
    dataIndex: 'standardPrice',
    render: (v: number) => <span className="text-[13px] text-[#86909C]">¥{v}</span>,
  },
]

function SkuSubTable({ skus }: { skus: Sku[] }) {
  return (
    <Table
      columns={SKU_COLUMNS}
      data={skus}
      rowKey={(s) => s.id || s.skuCode || 'sku'}
      pagination={false}
      size="small"
      border={false}
      className="mb-2"
    />
  )
}