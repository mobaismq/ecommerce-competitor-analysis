import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import {
  Badge,
  Button,
  Card,
  Cascader,
  Checkbox,
  Divider,
  Empty,
  Form,
  Grid,
  Input,
  InputNumber,
  Message,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from '@arco-design/web-react'
import {
  IconCheck,
  IconCheckCircle,
  IconCopy,
  IconDelete,
  IconEdit,
  IconEye,
  IconFileImage,
  IconImage,
  IconLink,
  IconList,
  IconLoading,
  IconMinus,
  IconPlus,
  IconRefresh,
  IconSave,
  IconSend,
  IconSettings,
  IconCommon,
  IconStar,
  IconTag,
  IconUpload,
} from '@arco-design/web-react/icon'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { nanoid } from 'nanoid'

const { Row, Col } = Grid
const TabPane = Tabs.TabPane

// 平台 Tabs 体系定义
const PLATFORM_TABS: Record<string, string[]> = {
  '淘宝': ['基础信息', '图文信息', '销售规格(SKU)', '物流服务'],
  '天猫': ['基础信息', '图文信息', '销售规格(SKU)', '物流服务'],
  '京东': ['基础信息', '图文信息', '价格库存', '服务与资质'],
  '拼多多': ['基础信息', '图文信息', '价格库存', '服务与资质'],
  '抖店': ['基础信息', '图文信息', '价格库存', '服务与资质'],
  '小红书': ['基础信息', '图文信息', '价格库存', '服务与资质'],
}

const PLATFORM_LIST = ['淘宝', '天猫', '京东', '拼多多', '抖店', '小红书']

// 平台中文名 -> 后端 platform code（提交 /api/platform-adapters/:code/publish）
const PLATFORM_CODE: Record<string, string> = {
  '淘宝': 'taobao',
  '天猫': 'tmall',
  '京东': 'jd',
  '拼多多': 'pdd',
  '抖店': 'douyin',
  '小红书': 'xhs',
}

// Cascader 选中路径（数组）规整为字符串
const joinPath = (v: unknown): string | undefined =>
  Array.isArray(v) && v.length > 0 ? (v as string[]).join('/') : (v as string | undefined)

// 级联电商类目树
interface CategoryNode {
  value: string
  label: string
  isLeaf?: boolean
  children?: CategoryNode[]
}

interface PlatformCategory {
  externalId: string
  parentExternalId?: string | null
  name: string
  isParent?: boolean
}

const CATEGORY_OPTIONS: CategoryNode[] = [
  {
    value: '服饰鞋包',
    label: '服饰鞋包',
    children: [
      {
        value: '女装',
        label: '女装',
        children: [
          { value: '连衣裙', label: '连衣裙' },
          { value: 'T恤', label: 'T恤' },
          { value: '针织衫', label: '针织衫' },
        ],
      },
      {
        value: '男装',
        label: '男装',
        children: [
          { value: '短袖T恤', label: '短袖T恤' },
          { value: '休闲衬衫', label: '休闲衬衫' },
          { value: '工装裤', label: '工装裤' },
        ],
      },
    ],
  },
  {
    value: '数码3C',
    label: '数码3C',
    children: [
      {
        value: '手机配件',
        label: '手机配件',
        children: [
          { value: '蓝牙耳机', label: '蓝牙耳机' },
          { value: '保护壳/膜', label: '保护壳/膜' },
          { value: '充电器/数据线', label: '充电器/数据线' },
        ],
      },
      {
        value: '智能穿戴',
        label: '智能穿戴',
        children: [
          { value: '智能手表', label: '智能手表' },
          { value: '运动手环', label: '运动手环' },
        ],
      },
      {
        value: '五金工具',
        label: '五金仪器',
        children: [
          { value: '激光水平仪', label: '激光水平仪' },
          { value: '测距仪', label: '测距仪' },
        ],
      },
    ],
  },
  {
    value: '家居日用',
    label: '家居日用',
    children: [
      {
        value: '厨房用品',
        label: '厨房用品',
        children: [
          { value: '不粘锅具', label: '不粘锅具' },
          { value: '刀剪餐具', label: '刀剪餐具' },
        ],
      },
      {
        value: '居家收纳',
        label: '居家收纳',
        children: [
          { value: '收纳箱/盒', label: '收纳箱/盒' },
          { value: '置物架', label: '置物架' },
        ],
      },
    ],
  },
  {
    value: '宠物生活',
    label: '宠物生活',
    children: [
      {
        value: '猫咪用品',
        label: '猫咪用品',
        children: [
          { value: '猫粮/主食罐', label: '猫粮/主食罐' },
          { value: '猫砂/清洁', label: '猫砂/清洁' },
        ],
      },
    ],
  },
]

// 全国发货地省市区级联树
const SHIPPING_ORIGIN_OPTIONS: CategoryNode[] = [
  {
    value: '广东省',
    label: '广东省',
    children: [
      {
        value: '深圳市',
        label: '深圳市',
        children: [
          { value: '南山区', label: '南山区' },
          { value: '福田区', label: '福田区' },
          { value: '宝安区', label: '宝安区' },
          { value: '龙岗区', label: '龙岗区' },
        ],
      },
      {
        value: '广州市',
        label: '广州市',
        children: [
          { value: '天河区', label: '天河区' },
          { value: '海珠区', label: '海珠区' },
          { value: '白云区', label: '白云区' },
        ],
      },
      {
        value: '东莞市',
        label: '东莞市',
        children: [
          { value: '长安镇', label: '长安镇' },
          { value: '虎门镇', label: '虎门镇' },
        ],
      },
    ],
  },
  {
    value: '浙江省',
    label: '浙江省',
    children: [
      {
        value: '杭州市',
        label: '杭州市',
        children: [
          { value: '余杭区', label: '余杭区' },
          { value: '滨江区', label: '滨江区' },
          { value: '西湖区', label: '西湖区' },
        ],
      },
      {
        value: '金华市',
        label: '金华市',
        children: [
          { value: '义乌市', label: '义乌市' },
          { value: '东阳市', label: '东阳市' },
        ],
      },
    ],
  },
  {
    value: '江苏省',
    label: '江苏省',
    children: [
      {
        value: '苏州市',
        label: '苏州市',
        children: [
          { value: '昆山市', label: '昆山市' },
          { value: '吴江区', label: '吴江区' },
        ],
      },
      {
        value: '无锡市',
        label: '无锡市',
        children: [
          { value: '锡山区', label: '锡山区' },
        ],
      },
    ],
  },
  {
    value: '北京市',
    label: '北京市',
    children: [
      {
        value: '北京市',
        label: '北京市',
        children: [
          { value: '朝阳区', label: '朝阳区' },
          { value: '海淀区', label: '海淀区' },
        ],
      },
    ],
  },
  {
    value: '上海市',
    label: '上海市',
    children: [
      {
        value: '上海市',
        label: '上海市',
        children: [
          { value: '浦东新区', label: '浦东新区' },
          { value: '闵行区', label: '闵行区' },
        ],
      },
    ],
  },
]

// SKU 规格条目定义
interface SkuItem {
  id: string
  specName: string
  specImage?: string
  price: number
  originPrice: number
  stock: number
  skuCode: string
  barcode?: string
  isListed: boolean
}

// 主图条目
interface ImageItem {
  id: string
  url: string
  isMain?: boolean
  isWhiteBg?: boolean
}

export function ManualListingPage() {
  const [form] = Form.useForm()
  const location = useLocation()
  const navigate = useNavigate()

  // 当前所选平台与 Tab
  const [currentPlatform, setCurrentPlatform] = useState<string>('淘宝')
  const [activeTabKey, setActiveTabKey] = useState<string>('0')

  // 店铺列表
  const [stores, setStores] = useState<Array<{ id: string; name: string; platform?: string }>>([])
  const [loadingStores, setLoadingStores] = useState(false)

  // 商品主档列表（供一键引用）
  const [masterProducts, setMasterProducts] = useState<Array<{ id: string; name: string; code: string; defaultPrice?: number }>>([])

  // SKU 矩阵列表（不再预置伪造样图/假数据；由用户真实上传或留空）
  const [skus, setSkus] = useState<SkuItem[]>([
    {
      id: 'sku-1',
      specName: '',
      price: 299,
      originPrice: 399,
      stock: 500,
      skuCode: 'ECA-BK-001',
      isListed: true,
    },
    {
      id: 'sku-2',
      specName: '',
      price: 349,
      originPrice: 459,
      stock: 300,
      skuCode: 'ECA-WH-002',
      isListed: true,
    },
  ])

  // 主图列表（最多 5 张，空态诚实呈现，不预置样图）
  const [mainImages, setMainImages] = useState<ImageItem[]>([])

  // 批量填充 Modal 控制
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [batchPrice, setBatchPrice] = useState<number | undefined>(undefined)
  const [batchStock, setBatchStock] = useState<number | undefined>(undefined)

  // 发布中
  const [submitting, setSubmitting] = useState(false)

  // 1. 加载店铺列表
  const loadStores = useCallback(async () => {
    setLoadingStores(true)
    try {
      const { data } = await api.get('/api/stores')
      const list = Array.isArray(data) ? data : []
      setStores(list.map((s: { id: string; name?: string; storeName?: string; platform?: string }) => ({
        id: s.id,
        name: s.name || s.storeName || `店铺 #${s.id}`,
        platform: s.platform || '淘宝',
      })))
    } catch {
      // 加载失败：诚实空态，不伪造店铺列表
      setStores([])
    } finally {
      setLoadingStores(false)
    }
  }, [])

  // 2. 按平台加载真实类目树；接口失败时回落本地树（对齐旧版容错策略）
  const [categoryOptions, setCategoryOptions] = useState<CategoryNode[]>(CATEGORY_OPTIONS)
  const [categoryLabelById, setCategoryLabelById] = useState<Record<string, string>>({})
  const [loadingCategories, setLoadingCategories] = useState(false)

  const toCategoryNodes = (rows: PlatformCategory[]): CategoryNode[] =>
    rows.map((item) => ({
      value: String(item.externalId || ''),
      label: String(item.name || item.externalId || ''),
      isLeaf: !item.isParent,
    }))

  const loadCategories = useCallback(async (platform: string, parentId = '0') => {
    const code = PLATFORM_CODE[platform] ?? 'taobao'
    const params = new URLSearchParams({ parentId })
    const { data } = await api.get<PlatformCategory[]>(`/api/platform-adapters/${code}/categories?${params.toString()}`)
    const rows = Array.isArray(data) ? data : []
    const nodes = toCategoryNodes(rows)
    setCategoryLabelById((current) => ({
      ...current,
      ...Object.fromEntries(nodes.map((node) => [node.value, node.label])),
    }))
    return nodes
  }, [])

  const loadRootCategories = useCallback(async (platform: string) => {
    setLoadingCategories(true)
    try {
      const nodes = await loadCategories(platform, '0')
      if (!nodes.length) throw new Error('empty categories')
      setCategoryOptions(nodes)
    } catch {
      // 旧版行为：真实类目接口失败时回落本地树，不伪造“接口成功”
      setCategoryOptions(CATEGORY_OPTIONS)
      setCategoryLabelById({})
      Message.warning('平台类目接口暂不可用，已回落本地类目树')
    } finally {
      setLoadingCategories(false)
    }
  }, [loadCategories])

  const handleLoadMoreCategories = async (pathValue: string[]): Promise<CategoryNode[]> => {
    const parentId = pathValue[pathValue.length - 1]
    if (!parentId) return []
    try {
      return await loadCategories(currentPlatform, parentId)
    } catch {
      Message.error('子类目加载失败，请重试')
      return []
    }
  }

  const categoryPathFromValue = (value: unknown): string | undefined => {
    if (!Array.isArray(value) || value.length === 0) return value as string | undefined
    return value.map((id) => categoryLabelById[String(id)] ?? String(id)).join('/')
  }

  // 2. 加载商品主档
  const loadMasterProducts = useCallback(async () => {
    try {
      const { data } = await api.get('/api/products/master')
      const list = Array.isArray(data) ? data : []
      setMasterProducts(list.map((p: { id: string; name: string; code?: string; defaultPrice?: number }) => ({
        id: p.id,
        name: p.name,
        code: p.code || p.id,
        defaultPrice: p.defaultPrice,
      })))
    } catch {
      // 加载失败：诚实空态，不伪造商品主档
      setMasterProducts([])
    }
  }, [])

  useEffect(() => {
    void loadStores()
    void loadMasterProducts()
  }, [loadStores, loadMasterProducts])

  useEffect(() => {
    void loadRootCategories(currentPlatform)
    form.setFieldValue('categoryPath', undefined)
  }, [currentPlatform, loadRootCategories, form])

  // 处理从主档或其他页面传入的 state 参数
  useEffect(() => {
    const passedState = location.state as { fromMaster?: boolean; name?: string; price?: number; category?: string[] } | null
    if (passedState) {
      if (passedState.name) form.setFieldValue('title', passedState.name)
      if (passedState.price) {
        setSkus((prev) => prev.map((sku) => ({ ...sku, price: passedState.price! })))
      }
      if (passedState.category) form.setFieldValue('categoryPath', passedState.category)
      Message.info(`已从商品主档带入「${passedState.name || '商品'}」信息`)
    }
  }, [location.state, form])

  // 切换关联主档
  const handleSelectMaster = (masterId: string) => {
    const found = masterProducts.find((p) => p.id === masterId)
    if (found) {
      form.setFieldsValue({
        title: found.name,
        brand: '自主品牌',
      })
      if (found.defaultPrice) {
        setSkus((prev) => prev.map((s) => ({ ...s, price: found.defaultPrice! })))
      }
      Message.success(`已应用主档「${found.name}」基础属性`)
    }
  }

  // 切换平台
  const handlePlatformChange = (p: string) => {
    setCurrentPlatform(p)
    setActiveTabKey('0')
    Message.info(`已切换至「${p}」上架规范`)
  }

  // 添加 SKU
  const handleAddSku = () => {
    const newId = `sku-${nanoid(8)}`
    setSkus((prev) => [
      ...prev,
      {
        id: newId,
        specName: `规格属性 #${prev.length + 1}`,
        price: 299,
        originPrice: 399,
        stock: 100,
        skuCode: `SKU-${Date.now().toString().slice(-4)}`,
        isListed: true,
      },
    ])
  }

  // 删除 SKU
  const handleDeleteSku = (id: string) => {
    if (skus.length <= 1) {
      Message.warning('至少保留一个销售规格')
      return
    }
    setSkus((prev) => prev.filter((s) => s.id !== id))
  }

  // 批量更新 SKU
  const handleApplyBatch = () => {
    setSkus((prev) =>
      prev.map((s) => ({
        ...s,
        price: batchPrice !== undefined ? batchPrice : s.price,
        stock: batchStock !== undefined ? batchStock : s.stock,
      })),
    )
    setBatchModalVisible(false)
    Message.success('已完成全规格批量更新！')
  }

  // 添加主图
  const handleUploadMainImage = (file: File) => {
    if (mainImages.length >= 5) {
      Message.warning('主图最多上传 5 张')
      return false
    }
    const reader = new FileReader()
    reader.onload = () => {
      setMainImages((prev) => [
        ...prev,
        {
          id: `img-${nanoid(8)}`,
          url: reader.result as string,
          isMain: prev.length === 0,
        },
      ])
      Message.success('主图添加成功')
    }
    reader.readAsDataURL(file)
    return false
  }

  // 设为第一张主图
  const setAsCover = (id: string) => {
    setMainImages((prev) =>
      prev.map((img) => ({
        ...img,
        isMain: img.id === id,
      })),
    )
    Message.info('已设为首图')
  }

  // 移除主图
  const removeMainImage = (id: string) => {
    setMainImages((prev) => {
      const next = prev.filter((img) => img.id !== id)
      if (next.length > 0 && !next.some((img) => img.isMain)) {
        next[0].isMain = true
      }
      return next
    })
  }

  const buildListingPayload = async () => {
    const values = await form.validate()
    return {
      platform: currentPlatform,
      storeId: values.storeId,
      title: values.title,
      subTitle: values.subTitle,
      categoryPath: categoryPathFromValue(values.categoryPath),
      categoryId: Array.isArray(values.categoryPath) ? values.categoryPath[values.categoryPath.length - 1] : undefined,
      brand: values.brand,
      origin: joinPath(values.shippingOrigin),
      freightTemplate: values.freightTemplate,
      skus,
      mainImages: mainImages.map((img) => img.url),
      detailContent: values.detailContent,
      originPlace: values.originPlace,
      warranty: values.warranty,
      shippingTime: values.shippingTime,
      serviceGuarantees: values.serviceGuarantees,
    }
  }

  // 保存服务端草稿（新架构落 ListingDraft，替代旧版本地 mockDrafts）
  const handleSaveDraft = async () => {
    try {
      const payload = await buildListingPayload()
      const platformCode = PLATFORM_CODE[currentPlatform] ?? 'taobao'
      const { data } = await api.post<{ draftId?: string }>(`/api/platform-adapters/${platformCode}/draft`, payload)
      Message.success(`草稿已保存${data?.draftId ? `（${data.draftId}）` : ''}`)
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      Message.error(msg ?? '草稿保存失败，请检查必填项')
    }
  }

  // 最终提交发布
  const handleSubmitPublish = async () => {
    setSubmitting(true)
    try {
      const payload = await buildListingPayload()
      const platformCode = PLATFORM_CODE[currentPlatform] ?? 'taobao'

      const res = await api.post(`/api/platform-adapters/${platformCode}/publish`, payload)
      Message.success(`商品已成功发布至「${currentPlatform}」！`)
      Modal.success({
        title: '发布成功',
        content: `商品「${payload.title}」已成功提交至${currentPlatform}，已生成平台草稿或上架记录。`,
      })
    } catch (error: unknown) {
      // 发布失败：诚实报错，不伪造「演示环境建档成功」
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      Message.error(msg ?? '发布失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 表格定义
  const skuColumns = [
    {
      title: '规格图片',
      dataIndex: 'specImage',
      width: 90,
      render: (img: string | undefined, record: SkuItem) => (
        <div style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e8ef', background: '#f8fafc' }}>
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
      title: '规格名称 / 属性值',
      dataIndex: 'specName',
      render: (val: string, record: SkuItem) => (
        <Input
          value={val}
          size="small"
          onChange={(text) => {
            setSkus((prev) => prev.map((s) => (s.id === record.id ? { ...s, specName: text } : s)))
          }}
        />
      ),
    },
    {
      title: '销售价 (元)',
      dataIndex: 'price',
      width: 140,
      render: (val: number, record: SkuItem) => (
        <InputNumber
          value={val}
          size="small"
          min={0.01}
          precision={2}
          prefix="¥"
          onChange={(num) => {
            setSkus((prev) => prev.map((s) => (s.id === record.id ? { ...s, price: Number(num || 0) } : s)))
          }}
        />
      ),
    },
    {
      title: '划线原价 (元)',
      dataIndex: 'originPrice',
      width: 140,
      render: (val: number, record: SkuItem) => (
        <InputNumber
          value={val}
          size="small"
          min={0.01}
          precision={2}
          prefix="¥"
          onChange={(num) => {
            setSkus((prev) => prev.map((s) => (s.id === record.id ? { ...s, originPrice: Number(num || 0) } : s)))
          }}
        />
      ),
    },
    {
      title: '库存',
      dataIndex: 'stock',
      width: 120,
      render: (val: number, record: SkuItem) => (
        <InputNumber
          value={val}
          size="small"
          min={0}
          onChange={(num) => {
            setSkus((prev) => prev.map((s) => (s.id === record.id ? { ...s, stock: Number(num || 0) } : s)))
          }}
        />
      ),
    },
    {
      title: '商家编码 (SKU Code)',
      dataIndex: 'skuCode',
      width: 160,
      render: (val: string, record: SkuItem) => (
        <Input
          value={val}
          size="small"
          onChange={(text) => {
            setSkus((prev) => prev.map((s) => (s.id === record.id ? { ...s, skuCode: text } : s)))
          }}
        />
      ),
    },
    {
      title: '上架销售',
      dataIndex: 'isListed',
      width: 90,
      render: (val: boolean, record: SkuItem) => (
        <Switch
          checked={val}
          size="small"
          onChange={(checked) => {
            setSkus((prev) => prev.map((s) => (s.id === record.id ? { ...s, isListed: checked } : s)))
          }}
        />
      ),
    },
    {
      title: '操作',
      width: 70,
      render: (_: unknown, record: SkuItem) => (
        <Button
          size="mini"
          type="text"
          status="danger"
          icon={<IconDelete />}
          onClick={() => handleDeleteSku(record.id)}
        />
      ),
    },
  ]

  const currentTabs = PLATFORM_TABS[currentPlatform] || PLATFORM_TABS['淘宝']

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-5 custom-scrollbar">
      <PageHeader
        breadcrumbs={[
          { label: '商品', to: '/product/master-data' },
          { label: '平台商品', to: '/product/management' },
          { label: '发布商品' },
        ]}
        className="mb-3"
      />

      {/* 顶部标题与平台切换工具条 */}
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
              手动发布商品 (多平台完整上架工作台)
            </Typography.Title>
            <Tag color="arcoblue" icon={<IconCommon />}>
              全平台适配
            </Tag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
            针对不同电商平台自动加载专有规范、类目树、图文标准与规格矩阵，支持从主档一键带入并多店铺上架。
          </Typography.Paragraph>
        </div>

        <Space>
          <Button icon={<IconSave />} onClick={() => void handleSaveDraft()}>保存为草稿</Button>
          <Button
            type="primary"
            status="success"
            icon={<IconSend />}
            loading={submitting}
            onClick={() => void handleSubmitPublish()}
          >
            确认发布至 {currentPlatform}
          </Button>
        </Space>
      </div>

      {/* 平台选择栏 */}
      <Card bordered={false} style={{ marginBottom: 16, borderRadius: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space size="medium" align="center">
            <span style={{ fontWeight: 700, fontSize: 13, color: '#4e5969' }}>选择目标电商平台：</span>
            <Radio.Group
              type="button"
              value={currentPlatform}
              onChange={handlePlatformChange}
              options={PLATFORM_LIST}
            />
          </Space>

          {/* 关联主档快速填充 */}
          <Space align="center">
            <span style={{ fontSize: 12, color: '#86909c' }}>关联商品主档自动填充：</span>
            <Select
              placeholder="选择已有商品主档..."
              style={{ width: 220 }}
              size="small"
              allowClear
              onChange={(val) => {
                if (val) handleSelectMaster(String(val))
              }}
            >
              {masterProducts.map((p) => (
                <Select.Option key={p.id} value={p.id}>
                  {p.name}
                </Select.Option>
              ))}
            </Select>
          </Space>
        </div>
      </Card>

      {/* 平台专属分步 Tabs 表单卡片 */}
      <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            // 不再预置伪造的示例商品数据；各字段留空，由用户填写（旧版亦为平台各自空默认）
            title: '',
            subTitle: '',
            categoryPath: undefined,
            brand: '',
            shippingOrigin: undefined,
            freightTemplate: '',
            serviceGuarantees: [],
            detailContent: '',
          }}
        >
          <Tabs activeTab={activeTabKey} onChange={setActiveTabKey} type="rounded">
            {/* Tab 0: 基础信息 */}
            <TabPane key="0" title={currentTabs[0] || '基础信息'}>
              <div style={{ maxWidth: 880, paddingTop: 16 }}>
                <Row gutter={20}>
                  <Col span={12}>
                    <Form.Item label="授权上架店铺" field="storeId" rules={[{ required: true, message: '请选择店铺' }]}>
                      <Select placeholder="选择绑定的店铺账号" loading={loadingStores} options={stores.map((s) => ({ label: `${s.name} (${s.platform || '全网'})`, value: s.id }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="平台标准类目" field="categoryPath" rules={[{ required: true, message: '请选择类目' }]}>
                      <Cascader
                          options={categoryOptions}
                          placeholder="请逐级选择所属电商叶子类目"
                          allowClear
                          loading={loadingCategories}
                          loadMore={handleLoadMoreCategories}
                        />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="商品主标题 (核心引流词)"
                  field="title"
                  rules={[{ required: true, message: '请输入商品标题' }]}
                  extra="推荐规范：品牌 + 核心卖点 + 品类词 + 核心属性（限 30~60 个字，不得含夸大虚假宣传词）"
                >
                  <Input placeholder="输入商品上架主标题" allowClear maxLength={60} showWordLimit />
                </Form.Item>

                <Form.Item label="商品卖点 / 副标题" field="subTitle">
                  <Input placeholder="一两句话突出核心卖点，展示在标题下方" allowClear maxLength={100} showWordLimit />
                </Form.Item>

                <Row gutter={20}>
                  <Col span={8}>
                    <Form.Item
                      label="商品品牌"
                      field="brand"
                      rules={currentPlatform === '京东' ? [{ required: true, message: '京东必填字段：请填写品牌' }] : []}
                    >
                      <Input placeholder="输入品牌名称" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="产地 / 货源地" field="originPlace" initialValue="中国大陆">
                      <Input placeholder="如：中国大陆" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="保修期限" field="warranty" initialValue="12个月官方联保">
                      <Input placeholder="如：12个月" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </TabPane>

            {/* Tab 1: 图文信息 */}
            <TabPane key="1" title={currentTabs[1] || '图文信息'}>
              <div style={{ maxWidth: 960, paddingTop: 16 }}>
                {/* 5 张主图管理 */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <Typography.Text bold style={{ fontSize: 14 }}>
                        商品主图 ({mainImages.length}/5)
                      </Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                        首张为主图封面；支持 1:1 / 3:4 比例，单张建议 800x800 以上无水印。
                      </Typography.Paragraph>
                    </div>

                    <Upload showUploadList={false} accept="image/*" beforeUpload={handleUploadMainImage}>
                      <Button size="small" type="outline" icon={<IconPlus />} disabled={mainImages.length >= 5}>
                        上传主图
                      </Button>
                    </Upload>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
                    {mainImages.map((img, idx) => (
                      <div
                        key={img.id}
                        style={{
                          height: 150,
                          borderRadius: 8,
                          overflow: 'hidden',
                          border: img.isMain ? '2px solid #165dff' : '1px solid #e5e8ef',
                          position: 'relative',
                          background: '#000',
                        }}
                      >
                        <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: 6, left: 6 }}>
                          {img.isMain ? (
                            <Tag color="arcoblue" size="small">主封面</Tag>
                          ) : (
                            <Tag size="small">图 {idx + 1}</Tag>
                          )}
                        </div>

                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.65)',
                            display: 'flex',
                            justifyContent: 'space-around',
                            padding: '4px 0',
                          }}
                        >
                          {!img.isMain && (
                            <Tooltip content="设为首图">
                              <Button
                                size="mini"
                                type="text"
                                style={{ color: '#fff' }}
                                icon={<IconStar />}
                                onClick={() => setAsCover(img.id)}
                              />
                            </Tooltip>
                          )}
                          <Tooltip content="移除">
                            <Button
                              size="mini"
                              type="text"
                              status="danger"
                              icon={<IconDelete />}
                              onClick={() => removeMainImage(img.id)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Divider />

                {/* 详情图文内容 */}
                <Form.Item
                  label="商品详情排版文案 / 特性阐述"
                  field="detailContent"
                  extra="支持富文本输入，可在此粘贴商品功能亮点、适用范围、包装清单与售后须知"
                >
                  <Input.TextArea rows={8} placeholder="输入商品详情页描述文案..." />
                </Form.Item>
              </div>
            </TabPane>

            {/* Tab 2: 销售规格与 SKU 矩阵 */}
            <TabPane key="2" title={currentTabs[2] || '销售规格(SKU)'}>
              <div style={{ paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <Typography.Text bold style={{ fontSize: 14 }}>
                      SKU 规格属性与价格库存矩阵 ({skus.length} 个规格)
                    </Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                      配置不同的颜色、容量、版本及其各自独立的售价、原价与实际仓储库存。
                    </Typography.Paragraph>
                  </div>

                  <Space>
                    <Button
                      size="small"
                      type="outline"
                      icon={<IconSettings />}
                      onClick={() => setBatchModalVisible(true)}
                    >
                      批量填充价格/库存
                    </Button>
                    <Button size="small" type="primary" icon={<IconPlus />} onClick={handleAddSku}>
                      添加新规格
                    </Button>
                  </Space>
                </div>

                <Table
                  rowKey="id"
                  columns={skuColumns}
                  data={skus}
                  pagination={false}
                  size="small"
                  border={{ wrapper: true, cell: true }}
                />
              </div>
            </TabPane>

            {/* Tab 3: 物流与服务 */}
            <TabPane key="3" title={currentTabs[3] || '物流服务'}>
              <div style={{ maxWidth: 880, paddingTop: 16 }}>
                <Row gutter={20}>
                  <Col span={12}>
                    <Form.Item label="发货地址 / 仓储始发地" field="shippingOrigin" rules={[{ required: true }]}>
                      <Cascader options={SHIPPING_ORIGIN_OPTIONS} placeholder="请选择省 / 市 / 区" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="运费计价模板" field="freightTemplate" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { label: '全国包邮 (偏远地区除外)', value: '全国包邮模板' },
                          { label: '首重10元，续重5元/kg', value: '标准重货模板' },
                          { label: '同城极速达 8元', value: '同城专送' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="发货时效承诺" field="shippingTime" initialValue="24小时内极速发货">
                  <Radio.Group
                    type="button"
                    options={['24小时内极速发货', '48小时内发货', '预售 7 天内发货']}
                  />
                </Form.Item>

                <Form.Item label="官方售后承诺与权益保障" field="serviceGuarantees">
                  <Checkbox.Group
                    options={[
                      '7天无理由退换',
                      '正品保障',
                      '极速退款',
                      '坏损包赔',
                      '假一赔十',
                      '运费险赠送',
                    ]}
                  />
                </Form.Item>
              </div>
            </TabPane>
          </Tabs>
        </Form>
      </Card>

      {/* 批量修改 Modal */}
      <Modal
        title="批量填充 SKU 销售价与库存"
        visible={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleApplyBatch}
        style={{ width: 420 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="medium">
          <div>
            <Typography.Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
              统一销售价 (元)：
            </Typography.Text>
            <InputNumber
              placeholder="如不修改请留空"
              min={0.01}
              precision={2}
              style={{ width: '100%' }}
              value={batchPrice}
              onChange={setBatchPrice}
            />
          </div>
          <div>
            <Typography.Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
              统一库存量 (件)：
            </Typography.Text>
            <InputNumber
              placeholder="如不修改请留空"
              min={0}
              style={{ width: '100%' }}
              value={batchStock}
              onChange={setBatchStock}
            />
          </div>
        </Space>
      </Modal>
    </div>
  )
}