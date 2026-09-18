import React, { useState } from 'react'
import {
  Button,
  Card,
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
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconDelete,
  IconDownload,
  IconEye,
  IconImage,
  IconLink,
  IconPlus,
  IconQuestionCircle,
  IconSend,
  IconThunderbolt,
  IconUpload,
} from '@arco-design/web-react/icon'

import referenceAd from '../assets/video-types/image-26.png'
import highCopyAd from '../assets/video-types/image-27.png'
import productCloth from '../assets/video-types/image-1.png'
import styleCopyAd from '../assets/viral/image.png'
import suiteArrow from '../assets/viral/arrow.svg'
import { saveAs } from 'file-saver'
import { nanoid } from 'nanoid'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input

const CLONE_CATEGORIES = [
  '电商商品图',
  '社媒广告图',
  '详情页模块',
  '主图',
  '场景图',
  '卖点图',
  '海报图',
]

const CLONE_LANGUAGES = [
  '中文',
  '英文',
  '日文',
  '韩文',
  '德文',
  '法文',
  '意大利文',
  '西班牙文',
  '葡萄牙文',
  '荷兰文',
  '波兰文',
  '泰文',
  '越南文',
  '印尼文',
]

const CLONE_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']

export interface GeneratedImageItem {
  id: string
  title: string
  url: string
  badge: '高度复刻' | '参考风格'
  ratio: string
  createTime: string
}

export function ViralReplicationPage() {
  const [productImage, setProductImage] = useState<string | null>(productCloth)
  const [referenceMethod, setReferenceMethod] = useState<'upload' | 'link'>('upload')
  const [referenceImages, setReferenceImages] = useState<string[]>([referenceAd])
  const [referenceLink, setReferenceLink] = useState('')
  const [replicateLevel, setReplicateLevel] = useState<'style' | 'exact'>('exact')
  const [customRequirements, setCustomRequirements] = useState(
    '文案统一用英文、模特保持完全不变、参考图不变只替换商品',
  )
  const [category, setCategory] = useState('电商商品图')
  const [language, setLanguage] = useState('英文')
  const [ratio, setRatio] = useState('1:1')

  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<GeneratedImageItem[]>([])
  const [previewImage, setPreviewImage] = useState<GeneratedImageItem | null>(null)

  // 处理开始一键复刻
  const handleStartReplicate = async () => {
    if (referenceMethod === 'upload' && referenceImages.length === 0) {
      Message.warning('请至少上传一张参考爆款图')
      return
    }
    if (referenceMethod === 'link' && !referenceLink.trim()) {
      Message.warning('请输入要导入的参考爆款链接')
      return
    }

    setGenerating(true)
    try {
      // 模拟高精度生图等待
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const generated: GeneratedImageItem[] = [
        {
          id: `res-${nanoid(8)}-1`,
          title: '爆款复刻 · 高度还原营销图',
          url: highCopyAd,
          badge: '高度复刻',
          ratio,
          createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: `res-${nanoid(8)}-2`,
          title: '爆款复刻 · 风格化场景融合图',
          url: styleCopyAd,
          badge: '参考风格',
          ratio,
          createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: `res-${nanoid(8)}-3`,
          title: '爆款复刻 · 核心卖点强化图',
          url: referenceAd,
          badge: '高度复刻',
          ratio,
          createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: `res-${nanoid(8)}-4`,
          title: '爆款复刻 · 氛围感变体展示图',
          url: productCloth,
          badge: '参考风格',
          ratio,
          createTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]
      setResults(generated)
      Message.success('爆款图复刻完成，已生成 4 张专属爆款图')
    } catch {
      Message.error('复刻生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  // 下载单张图片
  const handleDownload = (item: GeneratedImageItem) => {
    saveAs(item.url, `${item.title}.png`)
    Message.success('已触发保存')
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* ─── 左侧配置工作台 ─── */}
        <Card
          style={{ width: 380, flexShrink: 0, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          title={
            <Space>
              <IconCopy style={{ color: 'rgb(var(--primary-6))' }} />
              <span style={{ fontWeight: 600 }}>爆款图文复刻配置</span>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="medium">
            {/* ① 产品原图 (可选) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                <Text bold>① 产品原图（可选）</Text>
                <Tag size="small" color="arcoblue">有商品时替换</Tag>
              </div>
              <div
                style={{
                  border: '1px dashed #c9cdd4',
                  borderRadius: 8,
                  padding: 12,
                  textAlign: 'center',
                  background: '#fafafa',
                  position: 'relative',
                }}
              >
                {productImage ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <Image
                      src={productImage}
                      alt="产品原图"
                      width={100}
                      height={100}
                      style={{ borderRadius: 6, objectFit: 'contain', background: '#fff', border: '1px solid #e5e6eb' }}
                    />
                    <Button
                      size="mini"
                      status="danger"
                      shape="circle"
                      icon={<IconDelete />}
                      style={{ position: 'absolute', top: -6, right: -6 }}
                      onClick={() => setProductImage(null)}
                    />
                  </div>
                ) : (
                  <div>
                    <Button
                      type="outline"
                      size="small"
                      icon={<IconUpload />}
                      onClick={() => setProductImage(productCloth)}
                    >
                      上传产品图
                    </Button>
                    <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>
                      有商品需替换时上传，无商品可跳过
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ② 参考内容 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                <Text bold>② 参考内容</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>最多 20 张</Text>
              </div>
              <Radio.Group
                type="button"
                value={referenceMethod}
                onChange={(v) => setReferenceMethod(v)}
                style={{ width: '100%', marginBottom: 8 }}
              >
                <Radio value="upload" style={{ width: '50%', textAlign: 'center' }}>上传参考图</Radio>
                <Radio value="link" style={{ width: '50%', textAlign: 'center' }}>导入链接</Radio>
              </Radio.Group>

              {referenceMethod === 'upload' ? (
                <div
                  style={{
                    border: '1px dashed #c9cdd4',
                    borderRadius: 8,
                    padding: 12,
                    textAlign: 'center',
                    background: '#fafafa',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
                    {referenceImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <Image
                          src={img}
                          width={72}
                          height={72}
                          style={{ borderRadius: 6, objectFit: 'cover', border: '1px solid #e5e6eb' }}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    type="outline"
                    size="small"
                    icon={<IconUpload />}
                    onClick={() => {
                      if (referenceImages.length < 20) {
                        setReferenceImages((prev) => [...prev, referenceAd])
                        Message.success('已添加参考爆款样本')
                      }
                    }}
                  >
                    添加参考图 ({referenceImages.length}/20)
                  </Button>
                </div>
              ) : (
                <Input
                  prefix={<IconLink />}
                  placeholder="粘贴淘宝/天猫/小红书爆款链接..."
                  value={referenceLink}
                  onChange={setReferenceLink}
                  allowClear
                />
              )}
            </div>

            {/* ③ 复刻程度 */}
            <div>
              <div style={{ marginBottom: 6 }}><Text bold>③ 复刻程度</Text></div>
              <Grid.Row gutter={10}>
                <Grid.Col span={12}>
                  <div
                    onClick={() => setReplicateLevel('style')}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: replicateLevel === 'style' ? '2px solid rgb(var(--primary-6))' : '1px solid #e5e6eb',
                      background: replicateLevel === 'style' ? '#f2f7ff' : '#fff',
                      cursor: 'pointer',
                      height: '100%',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: replicateLevel === 'style' ? '#165dff' : '#1d2129' }}>
                      参考风格
                    </div>
                    <div style={{ fontSize: 12, color: '#86909c', marginTop: 4, lineHeight: 1.4 }}>
                      参考整体风格和结构，自动调整色彩和重构场景
                    </div>
                  </div>
                </Grid.Col>
                <Grid.Col span={12}>
                  <div
                    onClick={() => setReplicateLevel('exact')}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: replicateLevel === 'exact' ? '2px solid rgb(var(--primary-6))' : '1px solid #e5e6eb',
                      background: replicateLevel === 'exact' ? '#f2f7ff' : '#fff',
                      cursor: 'pointer',
                      height: '100%',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: replicateLevel === 'exact' ? '#165dff' : '#1d2129' }}>
                      高度复刻
                    </div>
                    <div style={{ fontSize: 12, color: '#86909c', marginTop: 4, lineHeight: 1.4 }}>
                      参照参考图视觉结构替换产品和文案，场景细节略有差异
                    </div>
                  </div>
                </Grid.Col>
              </Grid.Row>
            </div>

            {/* ④ 统一复刻要求 */}
            <div>
              <div style={{ marginBottom: 6 }}><Text bold>④ 统一复刻要求（选填）</Text></div>
              <TextArea
                rows={3}
                placeholder="例如：文案统一用英文、模特保持完全不变、参考图不变只替换商品..."
                value={customRequirements}
                onChange={setCustomRequirements}
                style={{ fontSize: 13 }}
              />
            </div>

            {/* ⑤ 生成设置 */}
            <div>
              <div style={{ marginBottom: 6 }}><Text bold>⑤ 生成设置</Text></div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>图文类目</div>
                <Select value={category} onChange={setCategory} style={{ width: '100%' }}>
                  {CLONE_CATEGORIES.map((c) => (
                    <Option key={c} value={c}>{c}</Option>
                  ))}
                </Select>
              </div>
              <Grid.Row gutter={10}>
                <Grid.Col span={12}>
                  <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>图上文案语言</div>
                  <Select value={language} onChange={setLanguage} style={{ width: '100%' }}>
                    {CLONE_LANGUAGES.map((l) => (
                      <Option key={l} value={l}>{l}</Option>
                    ))}
                  </Select>
                </Grid.Col>
                <Grid.Col span={12}>
                  <div style={{ fontSize: 12, color: '#86909c', marginBottom: 4 }}>输出图片比例</div>
                  <Select value={ratio} onChange={setRatio} style={{ width: '100%' }}>
                    {CLONE_RATIOS.map((r) => (
                      <Option key={r} value={r}>{r}</Option>
                    ))}
                  </Select>
                </Grid.Col>
              </Grid.Row>
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
              {generating ? 'AI 正在复刻爆款图中...' : '一键复刻爆款图'}
            </Button>
          </Space>
        </Card>

        {/* ─── 右侧工作区 ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 顶部标题横幅 */}
          <div
            style={{
              background: '#fff',
              padding: '16px 20px',
              borderRadius: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Title heading={5} style={{ margin: 0 }}>
                爆款图复刻工作台
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                想参考的爆款 + 你的产品图 = 属于你的高转化专属爆款营销图
              </Text>
            </div>
            <Tag color="purple" icon={<IconThunderbolt />}>
              基于 Ark 视觉大模型深度重构
            </Tag>
          </div>

          {/* 中央可视化流转演示卡片 */}
          <Card style={{ borderRadius: 8, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ textAlign: 'center', padding: '16px 0 24px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1d2129', marginBottom: 4 }}>
                全流程 AI 智能复刻拓扑
              </div>
              <div style={{ fontSize: 12, color: '#86909c', marginBottom: 20 }}>
                自动提取参考图的构图光影与卖点排版，无缝嵌入你的商品主视觉
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 24,
                  flexWrap: 'wrap',
                }}
              >
                {/* 1. 输入源 */}
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      position: 'relative',
                      width: 200,
                      height: 180,
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '1px solid #e5e6eb',
                      background: '#f7f8fa',
                      margin: '0 auto 8px',
                    }}
                  >
                    <img src={referenceAd} alt="参考爆款" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'rgba(255,255,255,0.9)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      参考爆款
                    </span>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#fff',
                        borderRadius: '50%',
                        width: 56,
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        border: '2px solid #165dff',
                      }}
                    >
                      <img src={productCloth} alt="原图" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#4e5969' }}>参考爆款 + 真实产品</div>
                </div>

                {/* 2. 转换箭头 */}
                <div style={{ color: '#165dff', fontSize: 24 }}>
                  <IconArrowRight style={{ fontSize: 28 }} />
                </div>

                {/* 3. 输出效果 */}
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        position: 'relative',
                        width: 170,
                        height: 180,
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid #e5e6eb',
                        margin: '0 auto 8px',
                      }}
                    >
                      <img src={highCopyAd} alt="高度复刻" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: '#165dff',
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        高度复刻
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#4e5969' }}>严格还原视觉结构</div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        position: 'relative',
                        width: 170,
                        height: 180,
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid #e5e6eb',
                        margin: '0 auto 8px',
                      }}
                    >
                      <img src={styleCopyAd} alt="参考风格" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: '#00b42a',
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        参考风格
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#4e5969' }}>重构色彩与场景</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 生成结果画廊区 */}
          <Card
            style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <IconImage style={{ color: 'rgb(var(--primary-6))' }} />
                  <span style={{ fontWeight: 600 }}>复刻生成成果画廊</span>
                  {results.length > 0 && <Tag color="arcoblue">{results.length} 张已生成</Tag>}
                </Space>
              </div>
            }
          >
            {generating ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Spin dot />
                <div style={{ marginTop: 16, color: '#4e5969', fontSize: 14 }}>
                  AI 正在深度解析参考图视觉特征并融合产品原图，请稍候...
                </div>
              </div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#86909c' }}>
                <IconImage style={{ fontSize: 44, color: '#c9cdd4', marginBottom: 12 }} />
                <div style={{ fontSize: 14 }}>暂无生成的复刻结果</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  请在左侧配置并点击「一键复刻爆款图」开始生成
                </div>
              </div>
            ) : (
              <Grid.Row gutter={[16, 16]}>
                {results.map((item) => (
                  <Grid.Col key={item.id} span={12}>
                    <Card
                      hoverable
                      style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e6eb' }}
                      bodyStyle={{ padding: 12 }}
                    >
                      <div style={{ position: 'relative', height: 220, borderRadius: 6, overflow: 'hidden', background: '#f2f3f5' }}>
                        <img
                          src={item.url}
                          alt={item.title}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                        <Tag
                          color={item.badge === '高度复刻' ? 'arcoblue' : 'green'}
                          style={{ position: 'absolute', top: 8, right: 8, fontWeight: 600 }}
                        >
                          {item.badge}
                        </Tag>
                        <Tag
                          style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                        >
                          比例 {item.ratio}
                        </Tag>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1d2129', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>
                          生成时间: {item.createTime}
                        </div>
                      </div>
                      <Space style={{ marginTop: 10, width: '100%', justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          icon={<IconEye />}
                          onClick={() => setPreviewImage(item)}
                        >
                          查看大图
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          icon={<IconDownload />}
                          onClick={() => handleDownload(item)}
                        >
                          保存图片
                        </Button>
                      </Space>
                    </Card>
                  </Grid.Col>
                ))}
              </Grid.Row>
            )}
          </Card>
        </div>
      </div>

      {/* ─── 大图预览弹窗 ─── */}
      <Modal
        title={previewImage?.title || '复刻结果大图预览'}
        visible={Boolean(previewImage)}
        onOk={() => setPreviewImage(null)}
        onCancel={() => setPreviewImage(null)}
        footer={
          <Space>
            <Button
              type="primary"
              icon={<IconDownload />}
              onClick={() => previewImage && handleDownload(previewImage)}
            >
              保存图片
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
              style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 8 }}
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
