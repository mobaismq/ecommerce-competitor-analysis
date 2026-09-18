import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Form, Input, InputNumber, Message, Modal, Select } from '@arco-design/web-react'
import { ChevronDown, ChevronLeft, ChevronRight, FileImage, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react'
import { nanoid } from 'nanoid'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'

interface Sku {
  id?: string
  skuCode: string
  specName: string
  standardPrice: number
  costPrice?: number
  stock: number
}

interface Product {
  id: string
  productCode: string
  productName: string
  brand: string | null
  categoryName?: string | null
  productImage?: string
  images?: string[]
  status: string
  skus: Sku[]
}

const DEMO_FALLBACK: Product[] = [
  {
    id: 'prod-001',
    productCode: 'SP2026001',
    productName: '12线绿光激光水平仪',
    brand: '科迈斯',
    categoryName: '五金工具/激光仪器',
    productImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&q=80',
    images: [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&q=80',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80',
    ],
    status: 'enabled',
    skus: [
      { id: 'sku-01', skuCode: 'SP2026001-A', specName: '12线绿光 · 标配单电', standardPrice: 268, costPrice: 130, stock: 200 },
      { id: 'sku-02', skuCode: 'SP2026001-B', specName: '12线绿光 · 双电豪华版', standardPrice: 328, costPrice: 160, stock: 150 },
    ],
  },
  {
    id: 'prod-002',
    productCode: 'SP2026002',
    productName: '主动降噪无线头戴蓝牙耳机',
    brand: '声阔灵动',
    categoryName: '数码3C/影音数码',
    productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80'],
    status: 'enabled',
    skus: [
      { id: 'sku-03', skuCode: 'SP2026002-BK', specName: '极夜黑 · 标准版', standardPrice: 299, costPrice: 120, stock: 500 },
      { id: 'sku-04', skuCode: 'SP2026002-WH', specName: '极光白 · 空间音频版', standardPrice: 349, costPrice: 145, stock: 350 },
    ],
  },
  {
    id: 'prod-003',
    productCode: 'SP2026003',
    productName: '全价无谷高鲜肉天然成猫粮 5kg',
    brand: '喵之鲜',
    categoryName: '宠物生活/主粮主食',
    productImage: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=300&q=80',
    images: ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&q=80'],
    status: 'enabled',
    skus: [{ id: 'sku-05', skuCode: 'SP2026003-5K', specName: '鸡肉三文鱼配方 5kg', standardPrice: 188, costPrice: 85, stock: 400 }],
  },
]

function priceRange(skus: Sku[], key: 'costPrice' | 'standardPrice') {
  const values = skus.map((s) => Number(s[key] || 0)).filter((v) => v > 0)
  if (values.length === 0) return '—'
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? `¥${min}` : `¥${min}-¥${max}`
}

function statusBadge(status: string) {
  return status === 'enabled' ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f5e9] px-2.5 py-1 text-[12px] font-bold text-[#2e7d32]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#2e7d32]" />
      启用中
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f4f7] px-2.5 py-1 text-[12px] font-bold text-[#86909C]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#d0d5dd]" />
      已停用
    </span>
  )
}

export function ProductMasterDataPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [list, setList] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // 查询条件（应用态，对照旧版查询/重置）
  const [codeFilter, setCodeFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [applied, setApplied] = useState({ code: '', name: '', brand: '', status: 'all' })

  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [skus, setSkus] = useState<Sku[]>([{ skuCode: '', specName: '标配版', standardPrice: 199, stock: 100 }])

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // 数据流保持桌面端现状：GET /api/products/master + 演示兜底
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/products/master')
      const items: Product[] = Array.isArray(data) ? data : []
      if (items.length > 0) {
        setList(items)
      } else {
        setList(DEMO_FALLBACK)
      }
    } catch {
      Message.warning('加载商品主档失败，已载入本地示范主档')
      setList(DEMO_FALLBACK)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setSkus([{ skuCode: `SP-${Date.now().toString().slice(-6)}`, specName: '标准款', standardPrice: 199, stock: 100 }])
    form.resetFields()
    form.setFieldsValue({
      productCode: `SP${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'enabled',
    })
    setModalVisible(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setSkus(p.skus.length ? p.skus : [{ skuCode: `${p.productCode}-01`, specName: '标配', standardPrice: 199, stock: 100 }])
    form.setFieldsValue({
      productCode: p.productCode,
      productName: p.productName,
      brand: p.brand,
      categoryName: p.categoryName,
      status: p.status,
    })
    setModalVisible(true)
  }

  // 保存（数据流保持桌面端现状：PATCH/POST + 本地容错）
  const handleSave = async () => {
    const values = await form.validate()
    const payload = {
      productCode: values.productCode,
      productName: values.productName,
      brand: values.brand || undefined,
      status: values.status ?? 'enabled',
      skus,
    }
    try {
      if (editing) {
        await api.patch(`/api/products/master/${editing.id}`, payload)
        setList((prev) => prev.map((item) => (item.id === editing.id ? { ...item, ...values, skus } : item)))
      } else {
        const { data } = await api.post('/api/products/master', payload)
        const createdId = data?.id || `prod-${nanoid(8)}`
        setList((prev) => [
          { id: createdId, ...values, skus, productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80' },
          ...prev,
        ])
      }
      Message.success(editing ? '主档商品已更新' : '主档商品已创建')
      setModalVisible(false)
    } catch {
      // 容错更新本地
      if (editing) {
        setList((prev) => prev.map((item) => (item.id === editing.id ? { ...item, ...values, skus } : item)))
      } else {
        setList((prev) => [
          { id: `prod-${nanoid(8)}`, ...values, skus, productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80' },
          ...prev,
        ])
      }
      setModalVisible(false)
      Message.success('已保存至主档')
    }
  }

  // 删除（数据流保持桌面端现状：DELETE + 本地移除）
  const handleRemove = async (p: Product) => {
    try {
      await api.delete(`/api/products/master/${p.id}`)
    } catch {}
    setList((prev) => prev.filter((item) => item.id !== p.id))
    setDeleteTarget(null)
    Message.success(`已删除主档商品：${p.productName}`)
  }

  const handleViewSkus = (p: Product) => {
    setDrawerProduct(p)
  }

  const handleViewGallery = (p: Product) => {
    setGalleryImages(p.images && p.images.length > 0 ? p.images : [p.productImage || ''])
  }

  // 一键去发布（业务逻辑保持桌面端现状）
  const handleGoPublish = (p: Product) => {
    const avgPrice = p.skus.length > 0 ? p.skus[0].standardPrice : undefined
    navigate('/products/management/manual', {
      state: {
        fromMaster: true,
        name: p.productName,
        price: avgPrice,
        category: p.categoryName ? p.categoryName.split('/') : ['数码3C', '智能硬件'],
      },
    })
  }

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const code = applied.code.trim().toLowerCase()
      const name = applied.name.trim().toLowerCase()
      const brand = applied.brand.trim().toLowerCase()
      if (code && !item.productCode.toLowerCase().includes(code)) return false
      if (name && !item.productName.toLowerCase().includes(name)) return false
      if (brand && !(item.brand || '').toLowerCase().includes(brand)) return false
      if (applied.status !== 'all' && item.status !== applied.status) return false
      return true
    })
  }, [list, applied])

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pageList = filteredList.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const searchInput = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <div className="relative min-w-0 flex-1">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="请输入"
        className={`h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 text-[13px] outline-none focus:border-[#409eff] ${value ? 'pr-7' : 'pr-3'}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清空"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        <PageHeader breadcrumbs={[{ label: '商品' }, { label: '商品主档' }]} className="mb-2" />

        {/* 查询条件卡（对照旧版两行） */}
        <div className="mb-4 rounded-xl bg-white p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">商品编码</label>
              {searchInput(codeFilter, setCodeFilter, '请输入')}
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">商品名称</label>
              {searchInput(nameFilter, setNameFilter, '请输入')}
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">品牌</label>
              {searchInput(brandFilter, setBrandFilter, '请输入')}
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">主档状态</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] outline-none focus:border-[#409eff] ${filterStatus === 'all' ? 'text-[#98A2B3]' : 'text-[#0A1B39]'}`}
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c0c4cc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                <option value="all">请选择</option>
                <option value="enabled">启用中</option>
                <option value="disabled">已停用</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setApplied({ code: codeFilter, name: nameFilter, brand: brandFilter, status: filterStatus })
                setCurrentPage(1)
              }}
              className="h-8 shrink-0 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff]"
            >
              查询
            </button>
            <button
              type="button"
              onClick={() => {
                setCodeFilter('')
                setNameFilter('')
                setBrandFilter('')
                setFilterStatus('all')
                setApplied({ code: '', name: '', brand: '', status: 'all' })
                setCurrentPage(1)
              }}
              className="h-8 shrink-0 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-4 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
            >
              重置
            </button>
            <span className="ml-auto text-[13px] text-[#86909C]">
              共检索到 <strong className="text-[#0A1B39]">{filteredList.length}</strong> 件标准主档商品
            </span>
          </div>
        </div>

        {/* 操作按钮行（对照旧版 flex gap-3；导入商品依赖旧契约，桌面端无接口不私造） */}
        <div className="mb-4 flex gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-[#409eff] px-4 text-[13px] font-bold text-white hover:bg-[#66b1ff]"
          >
            <Plus className="h-4 w-4" />
            新增商品
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e6e9ef] bg-white px-4 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* 表格卡（对照旧版：展开 SKU 子表 + 分页 footer） */}
        <div className="overflow-hidden rounded-xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead>
                <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                  <th className="w-10 px-3 py-3" />
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">商品图片</th>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">商品编码</th>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">商品名称</th>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">品牌</th>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">成本价</th>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">标准售价</th>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">状态</th>
                  <th className="px-4 py-3 text-left text-[13px] font-medium text-[#86909C]">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[14px] text-[#86909C]">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      加载中…
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageList.map((product) => {
                    const expanded = expandedIds.has(product.id)
                    return (
                      <ProductRow
                        key={product.id}
                        product={product}
                        expanded={expanded}
                        onToggle={() => toggleExpand(product.id)}
                        onViewSkus={handleViewSkus}
                        onViewGallery={handleViewGallery}
                        onEdit={openEdit}
                        onDelete={(p) => setDeleteTarget(p)}
                        onPublish={handleGoPublish}
                        searchInput={searchInput}
                      />
                    )
                  })}
                {!loading && pageList.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-14 text-center text-[14px] text-[#86909C]">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#eef1f5] px-4 py-3">
            <span className="text-[13px] text-[#86909C]">共 {filteredList.length} 条</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#eef1f5] bg-white text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`flex h-8 min-w-[32px] cursor-pointer items-center justify-center rounded-lg px-2 text-[13px] transition-colors ${
                    safePage === page ? 'border-0 bg-[#409eff] text-white' : 'border border-[#eef1f5] bg-white text-[#344054] hover:bg-[#f9fafb]'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#eef1f5] bg-white text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 新增/编辑 Modal（对照旧版 w-600） */}
      <Modal
        title={editing ? `编辑主档商品：${editing.productName}` : '新建标准主档商品'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => void handleSave()}
        okText="保存"
        style={{ width: 600 }}
        unmountOnExit
      >
        <Form form={form} layout="vertical">
          <div className="mb-3 grid grid-cols-2 gap-4">
            <Form.Item label="商品标准编码" field="productCode" rules={[{ required: true, message: '请输入编码' }]}>
              <Input placeholder="例如：SP2026008" />
            </Form.Item>
            <Form.Item label="主档状态" field="status" initialValue="enabled">
              <Select
                options={[
                  { label: '启用', value: 'enabled' },
                  { label: '停用', value: 'disabled' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item label="商品名称" field="productName" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="输入商品通用标准全名" allowClear />
          </Form.Item>

          <div className="mb-3 grid grid-cols-2 gap-4">
            <Form.Item label="品牌名称" field="brand">
              <Input placeholder="例如：科迈斯 / 自主品牌" />
            </Form.Item>
            <Form.Item label="品类归属" field="categoryName">
              <Input placeholder="例如：数码3C/五金仪器" />
            </Form.Item>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#0A1B39]">SKU 规格细分 ({skus.length}项)</span>
            <Button
              size="mini"
              type="text"
              icon={<Plus className="h-3 w-3" />}
              onClick={() =>
                setSkus((prev) => [
                  ...prev,
                  { skuCode: `SP-${Date.now().toString().slice(-4)}`, specName: `规格 #${prev.length + 1}`, standardPrice: 199, stock: 100 },
                ])
              }
            >
              添加规格
            </Button>
          </div>

          <div className="max-h-[220px] overflow-y-auto">
            {skus.map((sku, index) => (
              <div key={sku.id || index} className="mb-2 grid grid-cols-[140px_1fr_100px_70px_40px] items-center gap-2.5 rounded-lg bg-[#f8fafc] px-2 py-1.5">
                <Input
                  size="small"
                  value={sku.skuCode}
                  placeholder="编码"
                  onChange={(val) => {
                    const next = [...skus]
                    next[index].skuCode = val
                    setSkus(next)
                  }}
                />
                <Input
                  size="small"
                  value={sku.specName}
                  placeholder="规格名（如：标配版）"
                  onChange={(val) => {
                    const next = [...skus]
                    next[index].specName = val
                    setSkus(next)
                  }}
                />
                <InputNumber
                  size="small"
                  value={sku.standardPrice ?? undefined}
                  prefix="¥"
                  placeholder="售价"
                  onChange={(val) => {
                    const next = [...skus]
                    next[index].standardPrice = Number(val || 0)
                    setSkus(next)
                  }}
                />
                <InputNumber
                  size="small"
                  value={sku.stock ?? undefined}
                  placeholder="库存"
                  onChange={(val) => {
                    const next = [...skus]
                    next[index].stock = Number(val || 0)
                    setSkus(next)
                  }}
                />
                <Button
                  size="mini"
                  type="text"
                  status="danger"
                  icon={<X className="h-3 w-3" />}
                  disabled={skus.length <= 1}
                  onClick={() => setSkus((prev) => prev.filter((_, i) => i !== index))}
                />
              </div>
            ))}
          </div>
        </Form>
      </Modal>

      {/* SKU 明细抽屉（业务保留桌面端交互） */}
      <Modal
        title={drawerProduct ? `「${drawerProduct.productName}」规格明细清单` : 'SKU 清单'}
        visible={Boolean(drawerProduct)}
        onCancel={() => setDrawerProduct(null)}
        footer={null}
        style={{ width: 560 }}
      >
        {drawerProduct && (
          <div>
            <div className="mb-4 rounded-lg bg-[#f8fafc] p-3">
              <p className="m-0 text-[13px] font-bold text-[#0A1B39]">商品编码: {drawerProduct.productCode}</p>
              <p className="m-0 mt-1 text-[12px] text-[#86909C]">
                品牌: {drawerProduct.brand || '自主品牌'} ｜ 状态: {drawerProduct.status === 'enabled' ? '启用中' : '已停用'}
              </p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eef1f5] bg-[#f9fafb] text-left text-[12px] text-[#86909C]">
                  <th className="px-3 py-2 font-medium">SKU 编码</th>
                  <th className="px-3 py-2 font-medium">规格名称</th>
                  <th className="px-3 py-2 font-medium">售价</th>
                  <th className="px-3 py-2 font-medium">成本价</th>
                  <th className="px-3 py-2 font-medium">库存</th>
                </tr>
              </thead>
              <tbody>
                {drawerProduct.skus.map((sku, i) => (
                  <tr key={sku.id || sku.skuCode || i} className="border-b border-[#f0f2f5] text-[13px] text-[#344054]">
                    <td className="px-3 py-2 font-mono">{sku.skuCode}</td>
                    <td className="px-3 py-2">{sku.specName || '标准规格'}</td>
                    <td className="px-3 py-2">¥{Number(sku.standardPrice || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{sku.costPrice ? `¥${Number(sku.costPrice).toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2">{sku.stock || 0} 件</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* 相册弹窗（业务保留） */}
      <Modal title="商品主图与画廊" visible={galleryImages.length > 0} onCancel={() => setGalleryImages([])} footer={null} style={{ width: 680 }}>
        <div className="grid grid-cols-2 gap-3.5">
          {galleryImages.map((src, i) => (
            <div key={i} className="h-[220px] overflow-hidden rounded-lg border border-[#e5e8ef]">
              <img src={src} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </Modal>

      {/* 删除确认（对照旧版独立 Modal 红钮） */}
      <Modal title="提示" visible={Boolean(deleteTarget)} onCancel={() => setDeleteTarget(null)} footer={null} style={{ width: 400 }}>
        <p className="m-0 mb-5 text-[14px] text-[#344054]">
          确认删除主档商品「{deleteTarget?.productName}」？删除后不可恢复。
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="h-10 flex-1 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white text-[14px] text-[#0A1B39] hover:bg-[#f5f6f8]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => deleteTarget && void handleRemove(deleteTarget)}
            className="h-10 flex-1 cursor-pointer rounded-lg border-0 bg-[#f56c6c] text-[14px] font-bold text-white hover:bg-[#e04b4b]"
          >
            确认删除
          </button>
        </div>
      </Modal>
    </div>
  )
}

/** 单行（含展开 SKU 子表），对照旧版行结构 */
function ProductRow({
  product,
  expanded,
  onToggle,
  onViewSkus,
  onViewGallery,
  onEdit,
  onDelete,
  onPublish,
}: {
  product: Product
  expanded: boolean
  onToggle: () => void
  onViewSkus: (p: Product) => void
  onViewGallery: (p: Product) => void
  onEdit: (p: Product) => void
  onDelete: (p: Product) => void
  onPublish: (p: Product) => void
  searchInput: (value: string, onChange: (v: string) => void, placeholder: string) => React.ReactNode
}) {
  return (
    <>
      <tr className="border-b border-[#eef1f5] transition-colors hover:bg-[#fafafa]">
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-[#86909C] hover:bg-[#e9edf3]"
            title={expanded ? '收起 SKU' : '展开 SKU'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <div
            className="h-12 w-12 cursor-pointer overflow-hidden rounded-md border border-[#e5e8ef] bg-[#f7f8fa]"
            onClick={() => onViewGallery(product)}
            title="查看相册"
          >
            {product.productImage ? (
              <img src={product.productImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-[#86909C]">
                <FileImage className="h-4 w-4" />
              </div>
            )}
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] font-bold text-[#0A1B39]">{product.productCode}</td>
        <td className="px-4 py-3">
          <p className="m-0 text-[13px] font-semibold text-[#0A1B39]">{product.productName}</p>
          {product.categoryName && <p className="m-0 mt-0.5 text-[11px] text-[#86909C]">{product.categoryName}</p>}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-[13px] text-[#344054]">{product.brand || '—'}</td>
        <td className="whitespace-nowrap px-4 py-3 text-[13px] text-[#344054]">{priceRange(product.skus, 'costPrice')}</td>
        <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-[#344054]">{priceRange(product.skus, 'standardPrice')}</td>
        <td className="whitespace-nowrap px-4 py-3">{statusBadge(product.status)}</td>
        <td className="whitespace-nowrap px-4 py-3">
          <div className="flex items-center gap-3 text-[13px]">
            <button type="button" onClick={() => onEdit(product)} className="cursor-pointer border-0 bg-transparent p-0 text-[#3388ff] hover:text-[#1a6fe8]">
              编辑
            </button>
            <button
              type="button"
              onClick={() => onViewSkus(product)}
              className="cursor-pointer border-0 bg-transparent p-0 text-[#3388ff] hover:text-[#1a6fe8]"
            >
              {product.skus.length} 个规格
            </button>
            <button type="button" onClick={() => onPublish(product)} className="cursor-pointer border-0 bg-transparent p-0 text-[#3388ff] hover:text-[#1a6fe8]">
              去发布
            </button>
            <button type="button" onClick={() => onDelete(product)} className="cursor-pointer border-0 bg-transparent p-0 text-[#c62828] hover:text-[#a02020]">
              删除
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[#fafbfc]">
          <td colSpan={9} className="px-4 py-3">
            <p className="m-0 mb-2 text-[12px] font-bold text-[#4e5969]">规格明细（{product.skus.length} 组）：</p>
            <div className="overflow-hidden rounded-lg border border-[#edf0f5] bg-white">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#fafbfc] text-left text-[12px] text-[#86909C]">
                    <th className="px-3 py-2 font-medium">SKU 编码</th>
                    <th className="px-3 py-2 font-medium">规格名称</th>
                    <th className="px-3 py-2 font-medium">标准售价</th>
                    <th className="px-3 py-2 font-medium">成本价</th>
                    <th className="px-3 py-2 font-medium">可用库存</th>
                  </tr>
                </thead>
                <tbody>
                  {product.skus.map((sku, i) => (
                    <tr key={sku.id || sku.skuCode || i} className="border-t border-[#f0f2f5] text-[13px] text-[#344054]">
                      <td className="px-3 py-2 font-mono">{sku.skuCode}</td>
                      <td className="px-3 py-2">{sku.specName || '标准规格'}</td>
                      <td className="px-3 py-2">¥{Number(sku.standardPrice || 0).toFixed(2)}</td>
                      <td className="px-3 py-2">{sku.costPrice ? `¥${Number(sku.costPrice).toFixed(2)}` : '—'}</td>
                      <td className="px-3 py-2">{sku.stock || 0} 件</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
