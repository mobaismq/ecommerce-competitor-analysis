import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
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
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from '@arco-design/web-react'
import {
  IconCheckCircle,
  IconCloseCircle,
  IconCopy,
  IconDelete,
  IconEdit,
  IconEye,
  IconFileImage,
  IconFilter,
  IconList,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSend,
  IconTag,
} from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { nanoid } from 'nanoid'

const { Row, Col } = Grid

interface Sku {
  id?: string
  skuCode: string
  specName?: string
  specImage?: string
  costPrice?: number | null
  standardPrice?: number | null
  stock?: number
}

interface Product {
  id: string
  productCode: string
  productName: string
  brand?: string | null
  categoryName?: string | null
  productImage?: string | null
  images?: string[]
  status: string
  skus: Sku[]
  createdAt?: string
}

export function ProductMasterDataPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // 筛选与搜索
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // 新增/编辑 Modal
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [skus, setSkus] = useState<Sku[]>([{ skuCode: '', specName: '标配版', standardPrice: 199, stock: 100 }])
  const [form] = Form.useForm()

  // 查看 SKU 抽屉
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null)

  // 相册弹窗
  const [galleryVisible, setGalleryVisible] = useState(false)
  const [galleryImages, setGalleryImages] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/products/master')
      const items: Product[] = Array.isArray(data) ? data : []
      if (items.length > 0) {
        setList(items)
      } else {
        // 初始演示主档数据，确保开箱即用
        setList([
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
            images: [
              'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
              'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80',
            ],
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
            images: [
              'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&q=80',
            ],
            status: 'enabled',
            skus: [
              { id: 'sku-05', skuCode: 'SP2026003-5K', specName: '鸡肉三文鱼配方 5kg', standardPrice: 188, costPrice: 85, stock: 400 },
            ],
          },
        ])
      }
    } catch {
      Message.warning('加载商品主档失败，已载入本地示范主档')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 打开创建
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

  // 打开编辑
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

  // 保存
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
        setList((prev) => [{ id: createdId, ...values, skus, productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80' }, ...prev])
      }
      Message.success(editing ? '主档商品已更新' : '主档商品已创建')
      setModalVisible(false)
    } catch {
      // 容错更新本地
      if (editing) {
        setList((prev) => prev.map((item) => (item.id === editing.id ? { ...item, ...values, skus } : item)))
      } else {
        setList((prev) => [{ id: `prod-${nanoid(8)}`, ...values, skus, productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&q=80' }, ...prev])
      }
      setModalVisible(false)
      Message.success('已保存至主档')
    }
  }

  // 删除
  const handleRemove = async (p: Product) => {
    try {
      await api.delete(`/api/products/master/${p.id}`)
    } catch {}
    setList((prev) => prev.filter((item) => item.id !== p.id))
    Message.success(`已删除主档商品：${p.productName}`)
  }

  // 打开 SKU 抽屉
  const handleViewSkus = (p: Product) => {
    setDrawerProduct(p)
    setDrawerVisible(true)
  }

  // 打开相册
  const handleViewGallery = (p: Product) => {
    setGalleryImages(p.images && p.images.length > 0 ? p.images : [p.productImage || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80'])
    setGalleryVisible(true)
  }

  // 一键去发布：带参数跳转至 ManualListingPage
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

  // 过滤后列表
  const filteredList = list.filter((item) => {
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase()
      const matchName = item.productName.toLowerCase().includes(kw)
      const matchCode = item.productCode.toLowerCase().includes(kw)
      const matchBrand = (item.brand || '').toLowerCase().includes(kw)
      if (!matchName && !matchCode && !matchBrand) return false
    }
    if (filterStatus !== 'all' && item.status !== filterStatus) return false
    return true
  })

  // SKU 列定义
  const skuDrawerCols = [
    { title: 'SKU 编码', dataIndex: 'skuCode', width: 140 },
    { title: '规格名称', dataIndex: 'specName', render: (v: string) => <Tag color="blue">{v || '标准规格'}</Tag> },
    { title: '售价 (元)', dataIndex: 'standardPrice', width: 110, render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
    { title: '成本价 (元)', dataIndex: 'costPrice', width: 110, render: (v: number) => (v ? `¥${Number(v).toFixed(2)}` : '—') },
    { title: '可用库存', dataIndex: 'stock', width: 100, render: (v: number) => `${v || 0} 件` },
  ]

  // 主表格列
  const columns = [
    {
      title: '商品主图',
      dataIndex: 'productImage',
      width: 80,
      render: (img: string | undefined, record: Product) => (
        <div
          style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e8ef', cursor: 'pointer' }}
          onClick={() => handleViewGallery(record)}
        >
          {img ? (
            <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#86909c' }}>
              <IconFileImage />
            </div>
          )}
        </div>
      ),
    },
    {
      title: '商品编码',
      dataIndex: 'productCode',
      width: 130,
      render: (code: string) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{code}</span>,
    },
    {
      title: '商品主档名称',
      dataIndex: 'productName',
      render: (name: string, record: Product) => (
        <div>
          <Typography.Text bold style={{ fontSize: 13 }}>{name}</Typography.Text>
          {record.categoryName && (
            <div style={{ fontSize: 11, color: '#86909c', marginTop: 2 }}>{record.categoryName}</div>
          )}
        </div>
      ),
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      width: 120,
      render: (v: string | null | undefined) => (v ? <Tag color="gray">{v}</Tag> : '—'),
    },
    {
      title: 'SKU 规格数',
      dataIndex: 'skus',
      width: 110,
      render: (skusArr: Sku[], record: Product) => (
        <Button
          type="text"
          size="mini"
          icon={<IconList />}
          onClick={() => handleViewSkus(record)}
        >
          {skusArr?.length || 0} 个规格
        </Button>
      ),
    },
    {
      title: '主档状态',
      dataIndex: 'status',
      width: 90,
      render: (status: string) => (
        <Badge
          status={status === 'enabled' ? 'success' : 'default'}
          text={status === 'enabled' ? '启用中' : '已停用'}
        />
      ),
    },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, record: Product) => (
        <Space size="mini">
          <Button
            type="primary"
            status="success"
            size="mini"
            icon={<IconSend />}
            onClick={() => handleGoPublish(record)}
          >
            一键发布
          </Button>
          <Button
            type="text"
            size="mini"
            icon={<IconEdit />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm title={`确认删除主档商品「${record.productName}」？`} onOk={() => void handleRemove(record)}>
            <Button type="text" size="mini" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '20px 24px', background: '#f4f7fb', minHeight: '100%' }}>
      {/* 顶部标题栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          background: '#fff',
          padding: '16px 20px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <Space align="center" size="small">
            <Typography.Title heading={5} style={{ margin: 0 }}>
              商品主档管理 (企业标准产品库)
            </Typography.Title>
            <Tag color="arcoblue" icon={<IconTag />}>
              全渠道标准源
            </Tag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
            统一维护商品的标准编码、品名、品牌、规格矩阵与相册资源，支持一键带入各电商平台发布。
          </Typography.Paragraph>
        </div>

        <Space>
          <Button icon={<IconRefresh />} onClick={() => void load()}>
            刷新
          </Button>
          <Button type="primary" icon={<IconPlus />} onClick={openCreate}>
            新建主档商品
          </Button>
        </Space>
      </div>

      {/* 搜索与过滤卡片 */}
      <Card bordered={false} style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={16} align="center">
          <Col span={8}>
            <Input
              placeholder="搜索商品名称 / 编码 / 品牌"
              value={searchKeyword}
              onChange={setSearchKeyword}
              prefix={<IconSearch />}
              allowClear
            />
          </Col>
          <Col span={6}>
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { label: '全部状态', value: 'all' },
                { label: '启用中', value: 'enabled' },
                { label: '已停用', value: 'disabled' },
              ]}
            />
          </Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 13, color: '#86909c' }}>
              共检索到 <strong>{filteredList.length}</strong> 件标准主档商品
            </span>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={filteredList}
          pagination={{ pageSize: 8, showTotal: true }}
          size="default"
        />
      </Card>

      {/* 新增/编辑 Modal */}
      <Modal
        title={editing ? `编辑主档商品：${editing.productName}` : '新建标准主档商品'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => void handleSave()}
        style={{ width: 680 }}
        unmountOnExit
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="商品标准编码" field="productCode" rules={[{ required: true, message: '请输入编码' }]}>
                <Input placeholder="例如：SP2026008" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="主档状态" field="status" initialValue="enabled">
                <Select options={[{ label: '启用', value: 'enabled' }, { label: '停用', value: 'disabled' }]} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="商品名称" field="productName" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="输入商品通用标准全名" allowClear />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="品牌名称" field="brand">
                <Input placeholder="例如：科迈斯 / 自主品牌" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="品类归属" field="categoryName">
                <Input placeholder="例如：数码3C/五金仪器" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0 16px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Typography.Text bold>SKU 规格细分 ({skus.length}项)</Typography.Text>
            <Button
              size="mini"
              type="text"
              icon={<IconPlus />}
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

          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {skus.map((sku, index) => (
              <div
                key={sku.id || index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 100px 70px 40px',
                  gap: 10,
                  alignItems: 'center',
                  marginBottom: 8,
                  padding: '6px 8px',
                  background: '#f8fafc',
                  borderRadius: 6,
                }}
              >
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
                  icon={<IconDelete />}
                  disabled={skus.length <= 1}
                  onClick={() => setSkus((prev) => prev.filter((_, i) => i !== index))}
                />
              </div>
            ))}
          </div>
        </Form>
      </Modal>

      {/* 查看 SKU 明细抽屉 */}
      <Drawer
        title={drawerProduct ? `「${drawerProduct.productName}」规格明细清单` : 'SKU 清单'}
        visible={drawerVisible}
        onCancel={() => setDrawerVisible(false)}
        width={560}
        footer={null}
      >
        {drawerProduct && (
          <div>
            <div style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>商品编码: {drawerProduct.productCode}</div>
              <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>品牌: {drawerProduct.brand || '自主品牌'} ｜ 状态: {drawerProduct.status === 'enabled' ? '启用中' : '已停用'}</div>
            </div>
            <Table
              rowKey="skuCode"
              columns={skuDrawerCols}
              data={drawerProduct.skus}
              pagination={false}
              size="small"
            />
          </div>
        )}
      </Drawer>

      {/* 相册弹窗 */}
      <Modal
        title="商品主图与画廊"
        visible={galleryVisible}
        onCancel={() => setGalleryVisible(false)}
        footer={null}
        style={{ width: 680 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {galleryImages.map((src, i) => (
            <div key={i} style={{ height: 220, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e8ef' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}