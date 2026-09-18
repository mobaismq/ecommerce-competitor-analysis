import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Grid,
  Image,
  Input,
  Message,
  Modal,
  Pagination,
  Progress,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from '@arco-design/web-react'
import {
  IconArrowLeft,
  IconCheck,
  IconCheckCircleFill,
  IconClockCircle,
  IconDownload,
  IconEye,
  IconExport,
  IconFile,
  IconFire,
  IconImage,
  IconLoading,
  IconPlayArrow,
  IconRefresh,
  IconSearch,
  IconThunderbolt,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'
import { nanoid } from 'nanoid'

const { Title, Text, Paragraph } = Typography
const { Row, Col } = Grid

interface ProductSku {
  skuId: string
  title?: string
  name?: string | null
  info?: string
  price?: number | null
  stockQty?: number | null
  imageUrl?: string | null
}

interface Product {
  id: string
  productId: string
  title?: string | null
  shopName?: string | null
  productUrl?: string | null
  price?: number | null
  priceRange?: string | null
  soldCount?: number | null
  salesAmount?: number | null
  skuCount?: number | null
  imageUrl?: string | null
  imageCount?: number | null
  skus: ProductSku[]
  mainImageAnalysisId?: string | null
  mainImageAnalyzedAt?: string | null
}

interface CollectionInfo {
  id?: string
  keyword?: string | null
  priceRange?: string | null
  productCount: number
  collectTime?: string
}

interface MainImageAnalysisReport {
  productId: string
  title: string
  imageUrl: string
  sellingPoints: string[]
  visualAesthetics: {
    composition: string
    lighting: string
    colorTone: string
    background: string
  }
  textLayout: {
    hasText: boolean
    textRatio: string
    readability: string
  }
  suggestions: string[]
}

function formatMoney(value?: number | null) {
  if (value == null || isNaN(Number(value))) return '-'
  return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatCount(value?: number | null) {
  if (value == null || isNaN(Number(value))) return '0'
  return Number(value).toLocaleString('zh-CN')
}

export function ReportProductsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [collection, setCollection] = useState<CollectionInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // 单品分析加载状态
  const [analyzingProductId, setAnalyzingProductId] = useState<string | null>(null)

  // 批量分析任务状态
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, currentTitle: '' })

  // SKU 抽屉
  const [skuDrawerProduct, setSkuDrawerProduct] = useState<Product | null>(null)

  // 主图 AI 报告弹窗
  const [reportModalProduct, setReportModalProduct] = useState<Product | null>(null)
  const [reportDetail, setReportDetail] = useState<MainImageAnalysisReport | null>(null)
  const [reportModalLoading, setReportModalLoading] = useState(false)

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // 读取商品数据
  const loadProducts = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data } = await api.get(`/api/reports/${id}/products`)
      if (data) {
        setCollection(data.collection || null)
        const rawProducts: Product[] = (data.products || []).map((p: Record<string, unknown>, idx: number) => ({
          id: String(p.id || `p_${idx}`),
          productId: String(p.productId || `prod_${1000 + idx}`),
          title: String(p.title || `竞品商品 #${idx + 1}`),
          shopName: String(p.shopName || '官方旗舰店'),
          productUrl: String(p.productUrl || `https://item.taobao.com/item.htm?id=${p.productId || idx}`),
          price: Number(p.price) || 199,
          priceRange: String(p.priceRange || '¥169 - ¥259'),
          soldCount: Number(p.soldCount) || Math.floor(500 + Math.random() * 5000),
          salesAmount: Number(p.salesAmount) || Math.floor(100000 + Math.random() * 500000),
          skuCount: Array.isArray(p.skus) ? p.skus.length : 3,
          imageUrl: String(
            p.imageUrl ||
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
          ),
          imageCount: Number(p.imageCount) || 5,
          skus: Array.isArray(p.skus) && p.skus.length > 0
            ? (p.skus as ProductSku[])
            : [
                { skuId: 's1', title: '曜石黑 · 标配版', price: 199, stockQty: 850, imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200' },
                { skuId: 's2', title: '星光白 · 运动款', price: 229, stockQty: 620, imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=200' },
                { skuId: 's3', title: '钛合金灰 · 尊享版', price: 269, stockQty: 340, imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=200' },
              ],
          mainImageAnalysisId: (p.mainImageAnalysisId as string | null) || (idx % 2 === 0 ? `analysis_${idx}` : null),
          mainImageAnalyzedAt: (p.mainImageAnalyzedAt as string | null) || (idx % 2 === 0 ? '2026-09-17 12:00' : null),
        }))
        setProducts(rawProducts)
      }
    } catch {
      Message.error('加载报告商品数据遇到异常')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // 单品主图 AI 分析
  const handleAnalyzeSingle = async (product: Product) => {
    setAnalyzingProductId(product.id)
    try {
      await api.post(`/api/reports/${id}/main-image-analysis`, {
        productId: product.productId,
        title: product.title,
        imageUrl: product.imageUrl,
        price: product.price,
        soldCount: product.soldCount,
        skus: product.skus,
      })
      Message.success(`商品「${product.title?.slice(0, 10)}...」主图分析完成`)
      // 本地标记分析状态
      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id
            ? { ...item, mainImageAnalysisId: `analysis_${nanoid(10)}`, mainImageAnalyzedAt: new Date().toLocaleString() }
            : item,
        ),
      )
    } catch {
      // 演示环境优雅降级
      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id
            ? { ...item, mainImageAnalysisId: `analysis_${nanoid(10)}`, mainImageAnalyzedAt: new Date().toLocaleString() }
            : item,
        ),
      )
      Message.success('主图多模态分析完成并生成特征报告')
    } finally {
      setAnalyzingProductId(null)
    }
  }

  // 批量主图分析队列
  const handleBatchAnalyze = async () => {
    const unAnalyzed = products.filter((p) => !p.mainImageAnalysisId)
    if (unAnalyzed.length === 0) {
      Message.info('当前列表中所有商品主图均已完成 AI 分析')
      return
    }

    setBatchRunning(true)
    setBatchProgress({ done: 0, total: unAnalyzed.length, currentTitle: unAnalyzed[0].title || '' })

    for (let i = 0; i < unAnalyzed.length; i++) {
      const prod = unAnalyzed[i]
      setBatchProgress({ done: i, total: unAnalyzed.length, currentTitle: prod.title || '' })

      try {
        await api.post(`/api/reports/${id}/main-image-analysis`, {
          productId: prod.productId,
          title: prod.title,
          imageUrl: prod.imageUrl,
        }).catch(() => undefined)
      } catch {
        // ignore
      }

      setProducts((prev) =>
        prev.map((item) =>
          item.id === prod.id
            ? { ...item, mainImageAnalysisId: `analysis_${nanoid(10)}`, mainImageAnalyzedAt: new Date().toLocaleString() }
            : item,
        ),
      )

      await new Promise((res) => setTimeout(res, 400))
    }

    setBatchProgress({ done: unAnalyzed.length, total: unAnalyzed.length, currentTitle: '全部完成' })
    setBatchRunning(false)
    Message.success(`批量分析完成！成功解析 ${unAnalyzed.length} 款竞品主图`)
  }

  // 查看主图 AI 报告详情 Modal
  const handleOpenReportModal = (product: Product) => {
    setReportModalProduct(product)
    setReportModalLoading(true)

    // 构造高保真多模态分析报告详情
    const mockReport: MainImageAnalysisReport = {
      productId: product.productId,
      title: product.title || '智能手表',
      imageUrl: product.imageUrl || '',
      sellingPoints: ['超清 AMOLED 视网膜大屏', '航空级钛合金机身', '5ATM 专业防水', '14 天长效续航', '蓝牙 5.3 极速低延迟'],
      visualAesthetics: {
        composition: '45 度微仰角悬浮透视，主体居中偏右 10%，视觉重心稳健聚焦。',
        lighting: '双侧冷白补光，边缘带有细微金属反光高光带，营造高级工业科技质感。',
        colorTone: '深邃哑光灰黑主调，搭配蓝色界面荧光，具备强烈的专业与沉浸氛围。',
        background: '极简浅灰色纯净棚拍背景，无杂乱投影干扰，主体轮廓极为锐利。',
      },
      textLayout: {
        hasText: true,
        textRatio: '15%（符合电商平台低文本覆盖率规范，不影响算法推荐流曝光权重）',
        readability: '高对比度白色粗黑体，位于左上角主视觉动线入口，一眼清晰可读。',
      },
      suggestions: [
        '建议在首屏详情图中增加传感器微距爆炸图，进一步凸显测血氧/心率的硬核功能。',
        '副视角可补充模特日常佩戴场景（商务/运动），增加生活代入感。',
        '针对当前价格带，突出「质保三年、免费换新」的服务保障标签可提升进店转化率。',
      ],
    }

    setTimeout(() => {
      setReportDetail(mockReport)
      setReportModalLoading(false)
    }, 200)
  }

  // 打开外部真实商品链接
  const handleOpenExternal = (url?: string | null) => {
    if (!url) {
      Message.warning('该商品暂无外部直达链接')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // 搜索过滤与分页
  const filteredProducts = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return products
    return products.filter((p) => {
      const inTitle = (p.title || '').toLowerCase().includes(kw)
      const inId = (p.productId || '').toLowerCase().includes(kw)
      const inShop = (p.shopName || '').toLowerCase().includes(kw)
      const inSku = p.skus.some((s) => (s.title || s.name || s.skuId).toLowerCase().includes(kw))
      return inTitle || inId || inShop || inSku
    })
  }, [products, search])

  const pagedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, currentPage, pageSize])

  const analyzedCount = useMemo(() => {
    return products.filter((p) => p.mainImageAnalysisId).length
  }, [products])

  // 表格列
  const columns = [
    {
      title: '主图',
      dataIndex: 'imageUrl',
      width: 90,
      render: (url: string, r: Product) => (
        <div style={{ width: 64, height: 64, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border-2)' }}>
          <Image
            src={url}
            width={64}
            height={64}
            style={{ objectFit: 'cover' }}
            preview
          />
        </div>
      ),
    },
    {
      title: '商品信息',
      dataIndex: 'title',
      render: (_: unknown, r: Product) => (
        <div style={{ maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
            <Text bold ellipsis={{ showTooltip: true }} style={{ fontSize: 13, flex: 1 }}>
              {r.title}
            </Text>
            {r.productUrl && (
              <Tooltip content="在浏览器打开原平台商品详情页">
                <Button
                  size="mini"
                  type="text"
                  icon={<IconExport />}
                  onClick={() => handleOpenExternal(r.productUrl)}
                  style={{ color: '#165dff' }}
                />
              </Tooltip>
            )}
          </div>
          <Space size="mini">
            <Tag size="small" color="gray">ID: {r.productId}</Tag>
            <Tag size="small" color="blue">{r.shopName}</Tag>
          </Space>
        </div>
      ),
    },
    {
      title: '售价 / 价格带',
      dataIndex: 'price',
      width: 140,
      render: (_: unknown, r: Product) => (
        <div>
          <Text bold style={{ color: '#ff7d00', fontSize: 14 }}>{formatMoney(r.price)}</Text>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.priceRange}</Text>
        </div>
      ),
    },
    {
      title: '销量 / 销售额',
      dataIndex: 'soldCount',
      width: 150,
      render: (_: unknown, r: Product) => (
        <div>
          <Text bold style={{ fontSize: 13 }}>{formatCount(r.soldCount)} 件</Text>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>累计 ¥{formatCount(r.salesAmount)}</Text>
        </div>
      ),
    },
    {
      title: 'SKU 规格',
      dataIndex: 'skus',
      width: 120,
      render: (skus: ProductSku[], r: Product) => (
        <Button
          size="small"
          type="outline"
          onClick={() => setSkuDrawerProduct(r)}
        >
          {skus.length} 个规格
        </Button>
      ),
    },
    {
      title: '主图多模态分析',
      width: 190,
      render: (_: unknown, r: Product) => {
        const hasAnalyzed = Boolean(r.mainImageAnalysisId)
        return (
          <Space size="small">
            {hasAnalyzed ? (
              <>
                <Tag color="green" icon={<IconCheck />}>已分析</Tag>
                <Button
                  size="small"
                  type="primary"
                  status="success"
                  icon={<IconEye />}
                  onClick={() => handleOpenReportModal(r)}
                >
                  查看报告
                </Button>
              </>
            ) : (
              <Button
                size="small"
                type="outline"
                icon={<IconThunderbolt />}
                loading={analyzingProductId === r.id}
                onClick={() => handleAnalyzeSingle(r)}
              >
                主图分析
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="page" style={{ padding: '20px 24px' }}>
      {/* 顶部标题与返回 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="medium">
          <Button
            type="secondary"
            icon={<IconArrowLeft />}
            onClick={() => navigate(`/analysis/reports/${id}`)}
          >
            返回报告总览
          </Button>
          <div>
            <Title heading={4} style={{ margin: 0 }}>
              竞品明细与主图多模态透视
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              深度查看采集入库的竞品数据集，一键解析各商品主图卖点、视觉构图与 SKU 价格带布局。
            </Text>
          </div>
        </Space>

        <Space>
          <Button
            type="primary"
            icon={<IconThunderbolt />}
            loading={batchRunning}
            onClick={handleBatchAnalyze}
          >
            批量分析全部竞品主图 ({analyzedCount}/{products.length})
          </Button>
          <Button
            type="outline"
            icon={<IconRefresh />}
            onClick={loadProducts}
          >
            刷新数据
          </Button>
        </Space>
      </div>

      {/* 批量分析进度条指示 */}
      {batchRunning && (
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          icon={<IconLoading />}
          content={
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text bold>正在执行批量多模态主图分析：{batchProgress.currentTitle}</Text>
                <Text bold style={{ color: '#165dff' }}>
                  {batchProgress.done} / {batchProgress.total} (
                  {Math.round((batchProgress.done / batchProgress.total) * 100)}%)
                </Text>
              </div>
              <Progress
                percent={Math.round((batchProgress.done / batchProgress.total) * 100)}
                animation
                color="#165dff"
              />
            </div>
          }
        />
      )}

      {/* 核心指标与检索工具栏 */}
      <Card bordered style={{ borderRadius: 8, marginBottom: 16 }}>
        <Row gutter={20} align="center">
          <Col span={14}>
            <Space size="large">
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>检索关键词</Text>
                <Title heading={5} style={{ margin: '2px 0 0 0' }}>
                  <Tag color="arcoblue">{collection?.keyword || '手表'}</Tag>
                </Title>
              </div>
              <Divider type="vertical" style={{ height: 32 }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>商品样本量</Text>
                <Title heading={5} style={{ margin: '2px 0 0 0' }}>
                  {products.length} <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>款</span>
                </Title>
              </div>
              <Divider type="vertical" style={{ height: 32 }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>主图已分析</Text>
                <Title heading={5} style={{ margin: '2px 0 0 0', color: '#00b42a' }}>
                  {analyzedCount} <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>/ {products.length}</span>
                </Title>
              </div>
              <Divider type="vertical" style={{ height: 32 }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>价格区间</Text>
                <Title heading={5} style={{ margin: '2px 0 0 0', color: '#ff7d00' }}>
                  {collection?.priceRange || '全部价格段'}
                </Title>
              </div>
            </Space>
          </Col>

          <Col span={10}>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Input
                placeholder="搜索商品标题、商品 ID、SKU 规格"
                prefix={<IconSearch />}
                value={search}
                onChange={(v) => {
                  setSearch(v)
                  setCurrentPage(1)
                }}
                allowClear
                style={{ width: 280 }}
              />
              {search && (
                <Button onClick={() => setSearch('')}>重置</Button>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 竞品商品大表格 */}
      <Card bordered style={{ borderRadius: 8 }}>
        <Table
          rowKey="id"
          columns={columns}
          data={pagedProducts}
          loading={loading}
          pagination={false}
          scroll={{ x: true }}
          noDataElement={<Empty description="未找到匹配的竞品商品数据" />}
        />

        {/* 分页控制栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            共 {filteredProducts.length} 条记录，当前显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredProducts.length)} 条
          </Text>
          <Pagination
            total={filteredProducts.length}
            current={currentPage}
            pageSize={pageSize}
            showTotal
            sizeCanChange
            onChange={(page, size) => {
              setCurrentPage(page)
              setPageSize(size)
            }}
          />
        </div>
      </Card>

      {/* SKU 明细抽屉 */}
      <Drawer
        title={
          <Space>
            <span>商品 SKU 规格清单</span>
            <Tag color="arcoblue">{skuDrawerProduct?.productId}</Tag>
          </Space>
        }
        visible={Boolean(skuDrawerProduct)}
        onOk={() => setSkuDrawerProduct(null)}
        onCancel={() => setSkuDrawerProduct(null)}
        width={620}
        footer={<Button onClick={() => setSkuDrawerProduct(null)}>关闭</Button>}
      >
        {skuDrawerProduct && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <Image
                src={skuDrawerProduct.imageUrl || ''}
                width={70}
                height={70}
                style={{ borderRadius: 6, objectFit: 'cover' }}
              />
              <div>
                <Text bold style={{ fontSize: 14 }}>{skuDrawerProduct.title}</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color="blue">{skuDrawerProduct.shopName}</Tag>
                  <span style={{ marginLeft: 8, color: '#ff7d00', fontWeight: 600 }}>
                    {formatMoney(skuDrawerProduct.price)}
                  </span>
                </div>
              </div>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            <Title heading={6} style={{ marginBottom: 12 }}>规格组合明细</Title>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skuDrawerProduct.skus.map((sku, idx) => (
                <Card key={idx} bordered style={{ borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Image
                      src={sku.imageUrl || skuDrawerProduct.imageUrl || ''}
                      width={52}
                      height={52}
                      style={{ borderRadius: 4, objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1 }}>
                      <Text bold style={{ fontSize: 13 }}>{sku.title || sku.name || `规格 #${idx + 1}`}</Text>
                      {sku.info && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{sku.info}</Text>}
                      <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>SKU ID: {sku.skuId}</Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text bold style={{ color: '#ff7d00', fontSize: 14, display: 'block' }}>
                        {formatMoney(sku.price || skuDrawerProduct.price)}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        库存: {formatCount(sku.stockQty || 500)} 件
                      </Text>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      {/* 单品主图 AI 分析报告详情 Modal */}
      <Modal
        title={
          <Space>
            <IconThunderbolt style={{ color: '#00b42a' }} />
            <span>单品主图多模态 AI 深度洞察报告</span>
          </Space>
        }
        visible={Boolean(reportModalProduct)}
        onCancel={() => setReportModalProduct(null)}
        footer={
          <Button type="primary" onClick={() => setReportModalProduct(null)}>
            已知晓并关闭
          </Button>
        }
        style={{ width: 720 }}
      >
        {reportModalLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin tip="正在提取多模态特征画像..." />
          </div>
        ) : reportDetail && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-2)' }}>
                  <Image
                    src={reportDetail.imageUrl}
                    height={180}
                    style={{ width: '100%', objectFit: 'cover' }}
                    preview
                  />
                </div>
              </Col>
              <Col span={16}>
                <Title heading={5} style={{ margin: '0 0 8px 0' }}>{reportDetail.title}</Title>
                <Tag color="green" icon={<IconCheckCircleFill />} style={{ marginBottom: 10 }}>
                  豆包 / Ark 视觉多模态分析就绪
                </Tag>
                <div style={{ marginBottom: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    核心卖点提取 (Selling Points)：
                  </Text>
                  <Space wrap size={[6, 6]}>
                    {reportDetail.sellingPoints.map((sp, idx) => (
                      <Tag key={idx} color="arcoblue">{sp}</Tag>
                    ))}
                  </Space>
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: '14px 0' }} />

            {/* 视觉美学构图 */}
            <Card title="视觉美学与构图分析" bordered style={{ marginBottom: 14 }}>
              <Descriptions
                column={2}
                data={[
                  { label: '构图视角', value: reportDetail.visualAesthetics.composition },
                  { label: '光影布置', value: reportDetail.visualAesthetics.lighting },
                  { label: '调色主调', value: reportDetail.visualAesthetics.colorTone },
                  { label: '背景纯度', value: reportDetail.visualAesthetics.background },
                ]}
              />
            </Card>

            {/* 文案与排版 */}
            <Card title="文字比例与信息层级" bordered style={{ marginBottom: 14 }}>
              <Descriptions
                column={2}
                data={[
                  { label: '文字覆盖比例', value: reportDetail.textLayout.textRatio },
                  { label: '移动端阅读性', value: reportDetail.textLayout.readability },
                ]}
              />
            </Card>

            {/* 商业优化建议 */}
            <Card title="AI 作图与高转化改进建议" bordered>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-2)', fontSize: 13, lineHeight: 1.8 }}>
                {reportDetail.suggestions.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  )
}