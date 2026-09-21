import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, ChevronDown, ChevronRight, Plus, Search, Upload, X } from 'lucide-react'
import { nanoid } from 'nanoid'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'

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

  // 查询条件
  const [searchCode, setSearchCode] = useState('')
  const [searchName, setSearchName] = useState('')
  const [searchBrand, setSearchBrand] = useState('')
  const [searchStore, setSearchStore] = useState('')
  const [searchUpdateTimeStart, setSearchUpdateTimeStart] = useState('')
  const [searchUpdateTimeEnd, setSearchUpdateTimeEnd] = useState('')
  const [searchCreateTimeStart, setSearchCreateTimeStart] = useState('')
  const [searchCreateTimeEnd, setSearchCreateTimeEnd] = useState('')
  const [filterCode, setFilterCode] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [filterUpdateTimeStart, setFilterUpdateTimeStart] = useState('')
  const [filterUpdateTimeEnd, setFilterUpdateTimeEnd] = useState('')
  const [filterCreateTimeStart, setFilterCreateTimeStart] = useState('')
  const [filterCreateTimeEnd, setFilterCreateTimeEnd] = useState('')
  const [showUpdateTimeRange, setShowUpdateTimeRange] = useState(false)
  const [showCreateTimeRange, setShowCreateTimeRange] = useState(false)
  const updateTimeBtnRef = useRef<HTMLButtonElement>(null)
  const createTimeBtnRef = useRef<HTMLButtonElement>(null)
  const [updateTimePopupPos, setUpdateTimePopupPos] = useState({ top: 0, left: 0 })
  const [createTimePopupPos, setCreateTimePopupPos] = useState({ top: 0, left: 0 })

  const toggleUpdateTimeRange = () => {
    if (!showUpdateTimeRange && updateTimeBtnRef.current) {
      const rect = updateTimeBtnRef.current.getBoundingClientRect()
      setUpdateTimePopupPos({ top: rect.bottom + 4, left: rect.left })
    }
    setShowUpdateTimeRange(!showUpdateTimeRange)
  }

  const toggleCreateTimeRange = () => {
    if (!showCreateTimeRange && createTimeBtnRef.current) {
      const rect = createTimeBtnRef.current.getBoundingClientRect()
      setCreateTimePopupPos({ top: rect.bottom + 4, left: rect.left })
    }
    setShowCreateTimeRange(!showCreateTimeRange)
  }

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
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

  // 数据流：GET /api/products/master，空态/失败态诚实呈现，不做假数据兜底
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/products/master')
      const items: Product[] = Array.isArray(data) ? data : []
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
      if (filterStore && !(p.storeId || '').toLowerCase().includes(filterStore.toLowerCase())) return false
      if (filterUpdateTimeStart && (p.updateTime || '') < filterUpdateTimeStart) return false
      if (filterUpdateTimeEnd && (p.updateTime || '') > filterUpdateTimeEnd + ' 23:59:59') return false
      if (filterCreateTimeStart && (p.createTime || '') < filterCreateTimeStart) return false
      if (filterCreateTimeEnd && (p.createTime || '') > filterCreateTimeEnd + ' 23:59:59') return false
      return true
    })
  }, [displayProducts, filterCode, filterName, filterBrand, filterStore, filterUpdateTimeStart, filterUpdateTimeEnd, filterCreateTimeStart, filterCreateTimeEnd])

  const handleSearch = () => {
    setFilterCode(searchCode)
    setFilterName(searchName)
    setFilterBrand(searchBrand)
    setFilterStore(searchStore)
    setFilterUpdateTimeStart(searchUpdateTimeStart)
    setFilterUpdateTimeEnd(searchUpdateTimeEnd)
    setFilterCreateTimeStart(searchCreateTimeStart)
    setFilterCreateTimeEnd(searchCreateTimeEnd)
  }

  const handleReset = () => {
    setSearchCode('')
    setSearchName('')
    setSearchBrand('')
    setSearchStore('')
    setSearchUpdateTimeStart('')
    setSearchUpdateTimeEnd('')
    setSearchCreateTimeStart('')
    setSearchCreateTimeEnd('')
    setFilterCode('')
    setFilterName('')
    setFilterBrand('')
    setFilterStore('')
    setFilterUpdateTimeStart('')
    setFilterUpdateTimeEnd('')
    setFilterCreateTimeStart('')
    setFilterCreateTimeEnd('')
  }

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
        await api.patch(`/api/products/master/${editingProduct.id}`, payload)
        setProducts((prev) => prev.map((item) => (item.id === editingProduct.id ? ({ ...item, ...payload, status: item.status } as Product) : item)))
      } else {
        const { data } = await api.post('/api/products/master', payload)
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
      await api.delete(`/api/products/master/${p.id}`)
    } catch {}
    setProducts((prev) => prev.filter((item) => item.id !== p.id))
    setShowDeleteModal(false)
    setDeletingProduct(null)
  }

  const toggleStatus = async (p: Product) => {
    const next: 'enabled' | 'disabled' = p.status === 'enabled' ? 'disabled' : 'enabled'
    try {
      await api.patch(`/api/products/master/${p.id}`, { status: next })
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
            {/* 更新时间 */}
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">更新时间</label>
              <div className="relative flex-1">
                <button
                  ref={updateTimeBtnRef}
                  type="button"
                  onClick={toggleUpdateTimeRange}
                  className="flex h-8 w-full min-w-0 items-center justify-between rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-left text-[13px] outline-none focus:border-[#409eff]"
                >
                  <span
                    className={`truncate ${searchUpdateTimeStart || searchUpdateTimeEnd ? 'text-[#0A1B39]' : 'text-[#c0c4cc]'}`}
                    title={searchUpdateTimeStart && searchUpdateTimeEnd ? `${searchUpdateTimeStart} 至 ${searchUpdateTimeEnd}` : ''}
                  >
                    {searchUpdateTimeStart && searchUpdateTimeEnd
                      ? `${searchUpdateTimeStart} 至 ${searchUpdateTimeEnd}`
                      : searchUpdateTimeStart
                        ? `${searchUpdateTimeStart} 至`
                        : searchUpdateTimeEnd
                          ? `至 ${searchUpdateTimeEnd}`
                          : '请选择日期范围'}
                  </span>
                  <Calendar className="ml-1 h-3.5 w-3.5 shrink-0 text-[#c0c4cc]" />
                </button>
                {(searchUpdateTimeStart || searchUpdateTimeEnd) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchUpdateTimeStart('')
                      setSearchUpdateTimeEnd('')
                    }}
                    className="absolute right-7 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {showUpdateTimeRange && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUpdateTimeRange(false)} />
                    <div
                      className="fixed z-50 w-80 rounded-lg border border-[#e6e9ef] bg-white p-3 shadow-lg"
                      style={{ top: `${updateTimePopupPos.top}px`, left: `${updateTimePopupPos.left}px` }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="mb-1 block text-[11px] text-[#86909C]">开始日期</label>
                          <input
                            type="date"
                            value={searchUpdateTimeStart}
                            onChange={(e) => setSearchUpdateTimeStart(e.target.value)}
                            className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                          />
                        </div>
                        <span className="mt-4 text-[12px] text-[#86909C]">至</span>
                        <div className="flex-1">
                          <label className="mb-1 block text-[11px] text-[#86909C]">结束日期</label>
                          <input
                            type="date"
                            value={searchUpdateTimeEnd}
                            onChange={(e) => setSearchUpdateTimeEnd(e.target.value)}
                            className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchUpdateTimeStart('')
                            setSearchUpdateTimeEnd('')
                            setShowUpdateTimeRange(false)
                          }}
                          className="h-6 rounded border border-[#dcdfe6] px-3 text-[12px] text-[#606266] hover:border-[#409eff] hover:text-[#409eff]"
                        >
                          清除
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUpdateTimeRange(false)}
                          className="h-6 rounded bg-[#409eff] px-3 text-[12px] text-white hover:bg-[#66b1ff]"
                        >
                          确定
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* 第二行：创建时间 + 按钮 */}
          <div className="mt-3 grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">创建时间</label>
              <div className="relative flex-1">
                <button
                  ref={createTimeBtnRef}
                  type="button"
                  onClick={toggleCreateTimeRange}
                  className="flex h-8 w-full min-w-0 items-center justify-between rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-left text-[13px] outline-none focus:border-[#409eff]"
                >
                  <span
                    className={`truncate ${searchCreateTimeStart || searchCreateTimeEnd ? 'text-[#0A1B39]' : 'text-[#c0c4cc]'}`}
                    title={searchCreateTimeStart && searchCreateTimeEnd ? `${searchCreateTimeStart} 至 ${searchCreateTimeEnd}` : ''}
                  >
                    {searchCreateTimeStart && searchCreateTimeEnd
                      ? `${searchCreateTimeStart} 至 ${searchCreateTimeEnd}`
                      : searchCreateTimeStart
                        ? `${searchCreateTimeStart} 至`
                        : searchCreateTimeEnd
                          ? `至 ${searchCreateTimeEnd}`
                          : '请选择日期范围'}
                  </span>
                  <Calendar className="ml-1 h-3.5 w-3.5 shrink-0 text-[#c0c4cc]" />
                </button>
                {(searchCreateTimeStart || searchCreateTimeEnd) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchCreateTimeStart('')
                      setSearchCreateTimeEnd('')
                    }}
                    className="absolute right-7 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {showCreateTimeRange && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCreateTimeRange(false)} />
                    <div
                      className="fixed z-50 w-80 rounded-lg border border-[#e6e9ef] bg-white p-3 shadow-lg"
                      style={{ top: `${createTimePopupPos.top}px`, left: `${createTimePopupPos.left}px` }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="mb-1 block text-[11px] text-[#86909C]">开始日期</label>
                          <input
                            type="date"
                            value={searchCreateTimeStart}
                            onChange={(e) => setSearchCreateTimeStart(e.target.value)}
                            className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                          />
                        </div>
                        <span className="mt-4 text-[12px] text-[#86909C]">至</span>
                        <div className="flex-1">
                          <label className="mb-1 block text-[11px] text-[#86909C]">结束日期</label>
                          <input
                            type="date"
                            value={searchCreateTimeEnd}
                            onChange={(e) => setSearchCreateTimeEnd(e.target.value)}
                            className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchCreateTimeStart('')
                            setSearchCreateTimeEnd('')
                            setShowCreateTimeRange(false)
                          }}
                          className="h-6 rounded border border-[#dcdfe6] px-3 text-[12px] text-[#606266] hover:border-[#409eff] hover:text-[#409eff]"
                        >
                          清除
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateTimeRange(false)}
                          className="h-6 rounded bg-[#409eff] px-3 text-[12px] text-white hover:bg-[#66b1ff]"
                        >
                          确定
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
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
          <button
            type="button"
            className="relative h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[14px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8]"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.xlsx,.xls'
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) {
                  alert(`已选择文件：${file.name}`)
                }
              }
              input.click()
            }}
          >
            <div className="flex items-center gap-1.5">
              <Upload className="h-4 w-4" />
              导入商品
            </div>
          </button>
        </div>

        {/* 表单信息 */}
        <div className="rounded-xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="border-b border-[#e9edf3] text-left">
                  <th className="py-3 pl-4 pr-2 text-[13px] font-medium text-[#86909C]"></th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">商品图片</th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">商品编码</th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">商品名称</th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">品牌</th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">店铺</th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">成本价</th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">标准售价</th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">状态</th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">更新时间</th>
                  <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">创建时间</th>
                  <th className="py-3 pr-4 text-[13px] font-medium text-[#86909C]">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={12} className="py-12 text-center">
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#e6e9ef] border-t-[#409eff]" />
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredProducts.map((product) => {
                    const isExpanded = expandedRows.has(product.id)
                    const minPrice = product.skus.length ? Math.min(...product.skus.map((s) => s.costPrice)) : 0
                    const maxPrice = product.skus.length ? Math.max(...product.skus.map((s) => s.costPrice)) : 0
                    const minStandardPrice = product.skus.length ? Math.min(...product.skus.map((s) => s.standardPrice)) : 0
                    const maxStandardPrice = product.skus.length ? Math.max(...product.skus.map((s) => s.standardPrice)) : 0

                    return (
                      <ProductRow
                        key={product.id}
                        product={product}
                        isExpanded={isExpanded}
                        minPrice={minPrice}
                        maxPrice={maxPrice}
                        minStandardPrice={minStandardPrice}
                        maxStandardPrice={maxStandardPrice}
                        onToggle={() => toggleExpand(product.id)}
                        onEdit={() => openEdit(product)}
                        onDelete={() => handleDelete(product)}
                        onPublish={() => handleGoPublish(product)}
                        onToggleStatus={() => void toggleStatus(product)}
                      />
                    )
                  })}
                {!loading && filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-[13px] text-[#86909C]">暂无数据</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 分页器 */}
          <div className="flex items-center justify-between border-t border-[#f0f2f5] px-4 py-3">
            <div className="text-[13px] text-[#86909C]">共 {filteredProducts.length} 条</div>
            <div className="flex items-center gap-1">
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8]">&lt;</button>
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[#409eff] text-[13px] text-white">1</button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]">2</button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8]">&gt;</button>
            </div>
          </div>
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

/** 单行（含展开 SKU 子表），对照旧版行结构 */
function ProductRow({
  product,
  isExpanded,
  minPrice,
  maxPrice,
  minStandardPrice,
  maxStandardPrice,
  onToggle,
  onEdit,
  onDelete,
  onPublish,
  onToggleStatus,
}: {
  product: Product
  isExpanded: boolean
  minPrice: number
  maxPrice: number
  minStandardPrice: number
  maxStandardPrice: number
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onPublish: () => void
  onToggleStatus: () => void
}) {
  return (
    <>
      <tr className="border-b border-[#f0f2f5] hover:bg-[#fafafa]">
        <td className="py-3 pl-4 pr-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[#e9edf3]"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4 text-[#86909C]" /> : <ChevronRight className="h-4 w-4 text-[#86909C]" />}
          </button>
        </td>
        <td className="py-3 pr-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2f4f7]">
            <svg className="h-5 w-5 text-[#c0c4cc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        </td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productCode}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productName}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.brand}</td>
        <td className="py-3 pr-2 text-[14px] text-[#86909C]">{product.storeId || '—'}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{minPrice === maxPrice ? `¥${minPrice}` : `¥${minPrice}-¥${maxPrice}`}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">
          {minStandardPrice === maxStandardPrice ? `¥${minStandardPrice}` : `¥${minStandardPrice}-¥${maxStandardPrice}`}
        </td>
        <td className="whitespace-nowrap py-3 pr-2">
          <span className="inline-block rounded-full px-3 py-0.5 text-[12px] text-black">{product.status === 'enabled' ? '启用' : '停用'}</span>
        </td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.updateTime || ''}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.createTime || ''}</td>
        <td className="whitespace-nowrap py-3 pr-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onEdit} className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">
              编辑
            </button>
            <button type="button" onClick={onToggleStatus} className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">
              {product.status === 'enabled' ? '停用' : '启用'}
            </button>
            <button type="button" onClick={onPublish} className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">
              去发布
            </button>
            <button type="button" onClick={onDelete} className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">
              删除
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <>
          <tr className="border-b border-[#f0f2f5] bg-[#fafbfc]">
            <td className="py-2 pl-4 pr-2"></td>
            <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">sku图片</td>
            <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">sku编码</td>
            <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">规格</td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">成本价</td>
            <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">标准售价</td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-4"></td>
          </tr>
          {product.skus.map((sku, i) => (
            <tr key={sku.id || sku.skuCode || i} className="border-b border-[#f0f2f5] bg-[#fafbfc]">
              <td className="py-3 pl-4 pr-2"></td>
              <td className="py-3 pr-2">
                <div className="h-8 w-8 rounded bg-[#e9edf3]"></div>
              </td>
              <td className="py-3 pr-2 text-[13px] text-[#86909C]">{sku.skuCode}</td>
              <td className="py-3 pr-2 text-[13px] text-[#86909C]">{sku.specName}</td>
              <td className="py-3 pr-2"></td>
              <td className="py-3 pr-2"></td>
              <td className="py-3 pr-2 text-[13px] text-[#86909C]">¥{sku.costPrice}</td>
              <td className="py-3 pr-2 text-[13px] text-[#86909C]">¥{sku.standardPrice}</td>
              <td className="py-3 pr-2"></td>
              <td className="py-3 pr-2"></td>
              <td className="py-3 pr-2"></td>
              <td className="py-3 pr-4"></td>
            </tr>
          ))}
        </>
      )}
    </>
  )
}