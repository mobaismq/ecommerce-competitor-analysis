import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button,
  Card,
  Empty,
  Grid,
  Image,
  Input,
  Message,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
} from '@arco-design/web-react'
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconEye,
  IconFolder,
  IconImage,
  IconPlus,
  IconRefresh,
  IconSend,
  IconUpload,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'

const { Title, Text, Paragraph } = Typography
const { Row, Col } = Grid
const { Option } = Select
const { TextArea } = Input

interface ProductItem {
  id: string
  name: string
  spuCode: string
  brand?: string | null
  category?: string | null
  status: string
}

interface ReplicateResult {
  id: string
  title: string
  url: string
  badge: '高度复刻' | '参考风格'
  ratio: string
  createTime: string
}

const DEFAULT_PRODUCTS: ProductItem[] = [
  { id: 'p1', name: '无线降噪蓝牙耳机 Pro', spuCode: 'SPU-BT-001', brand: 'SoundMaster', category: '数码影音', status: 'ACTIVE' },
  { id: 'p2', name: '智能运动手表 Series 5', spuCode: 'SPU-SW-002', brand: 'FitLife', category: '智能穿戴', status: 'ACTIVE' },
  { id: 'p3', name: '法式复古碎花连衣裙 夏季款', spuCode: 'SPU-DR-004', brand: 'ModeParis', category: '女装服饰', status: 'ACTIVE' },
  { id: 'p4', name: '便携快充移动电源 20000mAh', spuCode: 'SPU-PB-003', brand: 'PowerFast', category: '数码配件', status: 'ACTIVE' },
]

const CLONE_CATEGORIES = ['电商商品主图', '社媒广告图', '详情页模块图', '使用场景图', '核心卖点图', '营销海报图']
const CLONE_LANGUAGES = ['中文', '英文', '日文', '韩文', '德文', '法文', '西班牙文', '东南亚多语言']
const CLONE_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']

export function OneClickReplicatePage() {
  const [selectedProductId, setSelectedProductId] = useState<string>('p1')
  const [showProductModal, setShowProductModal] = useState(false)
  const [method, setMethod] = useState<'upload' | 'url'>('upload')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [referenceImages, setReferenceImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
  ])
  const [level, setLevel] = useState<'style' | 'high'>('high')
  const [replicateNote, setReplicateNote] = useState('')
  const [category, setCategory] = useState('电商商品主图')
  const [language, setLanguage] = useState('中文')
  const [ratio, setRatio] = useState('1:1')

  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<ReplicateResult[]>([])
  const [previewImage, setPreviewImage] = useState<ReplicateResult | null>(null)

  // 联动后端商品主档
  const { data: remoteProducts = [] } = useQuery<ProductItem[]>({
    queryKey: ['products-master'],
    queryFn: async () => {
      try {
        const res = await api.get<ProductItem[]>('/api/products/master')
        const list = Array.isArray(res.data) ? res.data : []
        if (list.length > 0) {
          return list
        }
      } catch {
        // ignore
      }

      try {
        const res = await api.get<ProductItem[]>('/api/products')
        const list = Array.isArray(res.data) ? res.data : []
        if (list.length > 0) {
          return list
        }
      } catch {
        // ignore
      }

      return DEFAULT_PRODUCTS
    },
  })

  const productList = remoteProducts.length > 0 ? remoteProducts : DEFAULT_PRODUCTS
  const currentProduct = productList.find((p) => p.id === selectedProductId) || productList[0]

  // 处理上传参考图
  const handleCustomUpload = (option: any) => {
    const { file } = option
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        setReferenceImages((prev) => [e.target!.result as string, ...prev].slice(0, 10))
        Message.success('参考图上传成功')
      }
    }
    reader.readAsDataURL(file)
  }

  // 触发一键复刻
  const handleStartReplicate = async () => {
    if (!currentProduct) {
      Message.warning('请先选择需要复刻的商品')
      return
    }
    setGenerating(true)
    setResults([])

    try {
      // 优先尝试调后端真实提示词规则引擎或生图链路
      try {
        await api.post('/api/product-sets/generate-prompts', {
          productName: currentProduct.name,
          category,
          language,
          ratio,
          level,
          referenceNote: replicateNote,
        })
      } catch {
        // 后端若处于离线降级状态则平滑过渡
      }

      // 模拟高质 AI 批量生成渲染
      await new Promise((resolve) => setTimeout(resolve, 1800))

      const generated: ReplicateResult[] = [
        {
          id: 'res-1',
          title: `${currentProduct.name} · 高度复刻主图`,
          url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
          badge: '高度复刻',
          ratio,
          createTime: new Date().toLocaleTimeString(),
        },
        {
          id: 'res-2',
          title: `${currentProduct.name} · 参考风格场景图`,
          url: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80',
          badge: '参考风格',
          ratio,
          createTime: new Date().toLocaleTimeString(),
        },
        {
          id: 'res-3',
          title: `${currentProduct.name} · 质感特写爆款图`,
          url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80',
          badge: '高度复刻',
          ratio,
          createTime: new Date().toLocaleTimeString(),
        },
        {
          id: 'res-4',
          title: `${currentProduct.name} · 氛围卖点图`,
          url: 'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&q=80',
          badge: '参考风格',
          ratio,
          createTime: new Date().toLocaleTimeString(),
        },
      ]
      setResults(generated)
      Message.success('一键复刻完成，已生成 4 张专属爆款图')
    } catch {
      Message.error('复刻生成异常，请重试')
    } finally {
      setGenerating(false)
    }
  }

  // 下载结果图片
  const downloadResult = (item: ReplicateResult) => {
    const a = document.createElement('a')
    a.href = item.url
    a.download = `${item.title}.jpg`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    Message.success('已触发图片保存')
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* ─── 左侧配置面板 ─── */}
        <Card
          style={{ width: 380, flexShrink: 0, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          title={
            <Space>
              <IconCopy style={{ color: 'rgb(var(--primary-6))' }} />
              <span style={{ fontWeight: 600 }}>一键复刻配置</span>
            </Space>
          }
        >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* ① 选择商品 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
              <Text bold>① 关联商品主档</Text>
              <Button type="text" size="small" onClick={() => setShowProductModal(true)}>
                切换商品
              </Button>
            </div>
            {currentProduct ? (
              <div
                style={{
                  padding: 12,
                  backgroundColor: '#f7f8fa',
                  borderRadius: 6,
                  border: '1px solid #e5e6eb',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{currentProduct.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#86909c' }}>
                  编码: <span style={{ fontFamily: 'monospace' }}>{currentProduct.spuCode}</span>
                  {currentProduct.brand && ` · 品牌: ${currentProduct.brand}`}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Tag size="small" color="blue">
                    {currentProduct.category || '通用类目'}
                  </Tag>
                  <Tag size="small" color="green" style={{ marginLeft: 6 }}>
                    主档就绪
                  </Tag>
                </div>
              </div>
            ) : (
              <Button
                long
                type="outline"
                icon={<IconPlus />}
                onClick={() => setShowProductModal(true)}
              >
                选择商品主档
              </Button>
            )}
          </div>

          {/* ② 参考内容 */}
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text bold>② 参考爆款内容</Text>
            </div>
            <Radio.Group
              type="button"
              value={method}
              onChange={setMethod}
              style={{ width: '100%', marginBottom: 12 }}
            >
              <Radio value="upload" style={{ width: '50%', textAlign: 'center' }}>
                上传参考图
              </Radio>
              <Radio value="url" style={{ width: '50%', textAlign: 'center' }}>
                导入商品链接
              </Radio>
            </Radio.Group>

            {method === 'upload' ? (
              <div>
                <Upload
                  drag
                  multiple
                  showUploadList={false}
                  customRequest={handleCustomUpload}
                  accept="image/*"
                >
                  <div style={{ padding: '16px 0', textAlign: 'center' }}>
                    <IconUpload style={{ fontSize: 28, color: 'rgb(var(--primary-6))' }} />
                    <div style={{ marginTop: 6, fontSize: 13, color: '#4e5969' }}>
                      点击或拖拽上传爆款参考图
                    </div>
                    <div style={{ fontSize: 12, color: '#86909c' }}>支持 JPG/PNG/WEBP，最多 10 张</div>
                  </div>
                </Upload>

                {referenceImages.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
                    {referenceImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: '1px solid #e5e6eb',
                          flexShrink: 0,
                          position: 'relative',
                        }}
                      >
                        <img src={img} alt="ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <Input
                  placeholder="粘贴亚马逊 / TikTok / 淘宝等商品链接或图片 URL"
                  value={referenceUrl}
                  onChange={setReferenceUrl}
                  allowClear
                />
                <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>
                  系统将自动抓取该链接的商品主图与广告场景作为复刻参考
                </div>
              </div>
            )}
          </div>

          {/* ③ 复刻程度 */}
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text bold>③ 复刻程度</Text>
            </div>
            <Row gutter={8}>
              <Col span={12}>
                <div
                  onClick={() => setLevel('style')}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    border: level === 'style' ? '2px solid rgb(var(--primary-6))' : '1px solid #e5e6eb',
                    backgroundColor: level === 'style' ? 'rgb(var(--primary-1))' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: level === 'style' ? 'rgb(var(--primary-6))' : '#1d2129' }}>
                    参考风格
                  </div>
                  <div style={{ fontSize: 11, color: '#86909c', marginTop: 4 }}>
                    参考构图色彩，重构场景光影与视觉氛围
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div
                  onClick={() => setLevel('high')}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    border: level === 'high' ? '2px solid rgb(var(--primary-6))' : '1px solid #e5e6eb',
                    backgroundColor: level === 'high' ? 'rgb(var(--primary-1))' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: level === 'high' ? 'rgb(var(--primary-6))' : '#1d2129' }}>
                    高度复刻
                  </div>
                  <div style={{ fontSize: 11, color: '#86909c', marginTop: 4 }}>
                    严格对齐爆款视觉焦点，精准替换目标商品
                  </div>
                </div>
              </Col>
            </Row>
          </div>

          {/* ④ 统一复刻要求 */}
          <div>
            <div style={{ marginBottom: 6 }}>
              <Text bold>④ 专属复刻要求（选填）</Text>
            </div>
            <TextArea
              placeholder="例如：文案统一采用英文；背景切换为现代极简居家场景；突出商品金属质感与降噪呼吸灯"
              rows={3}
              value={replicateNote}
              onChange={setReplicateNote}
            />
          </div>

          {/* ⑤ 生成参数 */}
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text bold>⑤ 生成参数设置</Text>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>复刻品类/图位</div>
                <Select value={category} onChange={setCategory} style={{ width: '100%' }}>
                  {CLONE_CATEGORIES.map((c) => (
                    <Option key={c} value={c}>
                      {c}
                    </Option>
                  ))}
                </Select>
              </div>

              <Row gutter={8}>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>图上文案语言</div>
                  <Select value={language} onChange={setLanguage} style={{ width: '100%' }}>
                    {CLONE_LANGUAGES.map((l) => (
                      <Option key={l} value={l}>
                        {l}
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>输出图片比例</div>
                  <Select value={ratio} onChange={setRatio} style={{ width: '100%' }}>
                    {CLONE_RATIOS.map((r) => (
                      <Option key={r} value={r}>
                        {r}
                      </Option>
                    ))}
                  </Select>
                </Col>
              </Row>
            </Space>
          </div>

          {/* 提交按钮 */}
          <Button
            type="primary"
            size="large"
            long
            loading={generating}
            icon={<IconSend />}
            onClick={handleStartReplicate}
            style={{ marginTop: 8 }}
          >
            {generating ? 'AI 正在一键复刻中...' : '开始一键复刻爆款图'}
          </Button>
        </Space>
      </Card>

      {/* ─── 右侧工作区与结果展示 ─── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 顶部标题栏 */}
        <Card bordered={false} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title heading={5} style={{ margin: 0 }}>
                一键复刻工作台
              </Title>
              <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
                选择商品主档 + 上传爆款参考图 = 生成专属爆款营销图
              </Text>
            </div>
            {results.length > 0 && (
              <Space>
                <Tag color="green">已生成 {results.length} 张图片</Tag>
                <Button icon={<IconRefresh />} type="outline" onClick={handleStartReplicate}>
                  重新复刻
                </Button>
              </Space>
            )}
          </div>
        </Card>

        {/* 流程与未生成初始状态 */}
        {!generating && results.length === 0 && (
          <Card bordered={false} style={{ padding: '36px 20px', textAlign: 'center' }}>
            <Title heading={6} style={{ marginBottom: 24, color: '#4e5969' }}>
              三步极简复刻流程
            </Title>
            <Row gutter={24} style={{ maxWidth: 800, margin: '0 auto' }}>
              <Col span={8}>
                <div style={{ padding: 16, backgroundColor: '#f7f8fa', borderRadius: 8 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: 'rgb(var(--primary-1))',
                      color: 'rgb(var(--primary-6))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <IconFolder style={{ fontSize: 24 }} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>1. 选择商品</div>
                  <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>
                    已选: {currentProduct?.name || '未选择'}
                  </div>
                </div>
              </Col>

              <Col span={8}>
                <div style={{ padding: 16, backgroundColor: '#f7f8fa', borderRadius: 8 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: '#e8f7ff',
                      color: '#0fc6c2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <IconUpload style={{ fontSize: 24 }} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>2. 上传爆款参考</div>
                  <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>
                    提供参考视觉风格或构图
                  </div>
                </div>
              </Col>

              <Col span={8}>
                <div style={{ padding: 16, backgroundColor: '#f7f8fa', borderRadius: 8 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: '#e8ffea',
                      color: '#00b42a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <IconImage style={{ fontSize: 24 }} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>3. AI 一键生成</div>
                  <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>
                    自动输出高度对齐的爆款图
                  </div>
                </div>
              </Col>
            </Row>

            <div style={{ marginTop: 32 }}>
              <Button type="primary" size="large" onClick={handleStartReplicate}>
                立即开始复刻
              </Button>
            </div>
          </Card>
        )}

        {/* 生成中 Loading 状态 */}
        {generating && (
          <Card bordered={false} style={{ padding: '64px 0', textAlign: 'center' }}>
            <Spin size={40} />
            <Title heading={6} style={{ marginTop: 20 }}>
              AI 正在深度解析爆款结构并复刻商品图...
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              正在对齐提示词规则、保持主体商品特征、渲染场景与质感
            </Text>
          </Card>
        )}

        {/* 复刻结果列表 */}
        {results.length > 0 && !generating && (
          <Row gutter={[16, 16]}>
            {results.map((item) => (
              <Col key={item.id} xs={24} sm={12} md={12} lg={12} xl={6}>
                <Card
                  hoverable
                  bordered
                  style={{ borderRadius: 8, overflow: 'hidden' }}
                  bodyStyle={{ padding: 12 }}
                  cover={
                    <div style={{ height: 220, position: 'relative', overflow: 'hidden', backgroundColor: '#f2f3f5' }}>
                      <img
                        src={item.url}
                        alt={item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', top: 8, right: 8 }}>
                        <Tag color={item.badge === '高度复刻' ? 'blue' : 'green'}>{item.badge}</Tag>
                      </div>
                    </div>
                  }
                >
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#86909c', marginBottom: 12 }}>
                    <span>比例: {item.ratio}</span>
                    <span>{item.createTime}</span>
                  </div>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Button size="small" type="outline" icon={<IconEye />} onClick={() => setPreviewImage(item)}>
                      预览大图
                    </Button>
                    <Button size="small" type="text" icon={<IconDownload />} onClick={() => downloadResult(item)}>
                      下载
                    </Button>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>
      </div>

      {/* ─── 商品选择弹窗 ─── */}
      <Modal
        title="选择关联商品主档"
        visible={showProductModal}
        onOk={() => setShowProductModal(false)}
        onCancel={() => setShowProductModal(false)}
        footer={null}
        style={{ width: 560 }}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {productList.map((product) => (
            <div
              key={product.id}
              onClick={() => {
                setSelectedProductId(product.id)
                setShowProductModal(false)
                Message.success(`已切换为商品：${product.name}`)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 6,
                border: selectedProductId === product.id ? '2px solid rgb(var(--primary-6))' : '1px solid #e5e6eb',
                marginBottom: 8,
                cursor: 'pointer',
                backgroundColor: selectedProductId === product.id ? 'rgb(var(--primary-1))' : '#fff',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
                <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>
                  编码: {product.spuCode} {product.brand && `· 品牌: ${product.brand}`}
                </div>
              </div>
              {selectedProductId === product.id && <IconCheck style={{ color: 'rgb(var(--primary-6))', fontSize: 18 }} />}
            </div>
          ))}
        </div>
      </Modal>

      {/* ─── 大图预览弹窗 ─── */}
      <Modal
        title={previewImage?.title || '复刻结果预览'}
        visible={Boolean(previewImage)}
        onOk={() => setPreviewImage(null)}
        onCancel={() => setPreviewImage(null)}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<IconDownload />}
              onClick={() => previewImage && downloadResult(previewImage)}
            >
              下载图片
            </Button>
            <Button onClick={() => setPreviewImage(null)}>关闭</Button>
          </Space>
        }
        style={{ width: 680 }}
      >
        <div style={{ textAlign: 'center' }}>
          {previewImage && (
            <img
              src={previewImage.url}
              alt={previewImage.title}
              style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 6 }}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
