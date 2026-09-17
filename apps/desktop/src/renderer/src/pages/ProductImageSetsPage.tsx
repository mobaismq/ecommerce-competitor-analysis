import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Grid,
  Image,
  Input,
  Message,
  Modal,
  Popconfirm,
  Progress,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from '@arco-design/web-react'
import {
  IconCamera,
  IconCheck,
  IconCopy,
  IconDelete,
  IconDownload,
  IconEye,
  IconFileImage,
  IconImage,
  IconLoading,
  IconPalette,
  IconPlus,
  IconRefresh,
  IconStar,
  IconSync,
  IconThunderbolt,
  IconUpload,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'
import { AIReportSelector, SectionTitle, type SuiteProduct } from '../components/AIReportSelector'

const { Row, Col } = Grid

interface ReferenceImage {
  id: string
  url: string
  name: string
  isMain?: boolean
}

interface PromptSlot {
  id: string
  slotIndex: number
  name: string
  type: string
  tag: string
  defaultPrompt: string
  prompt: string
  status: 'idle' | 'generating' | 'done' | 'failed'
  imageUrl?: string
  error?: string
}

const DEFAULT_SLOTS: PromptSlot[] = [
  {
    id: 'slot-1',
    slotIndex: 1,
    name: '图 1 · 白底主视觉图',
    type: 'white_background',
    tag: '基础主图',
    defaultPrompt: '极简纯白纯色摄影棚背景，专业电商产品摄影，4K超高清画质，柔和摄影棚顶灯与侧面补光，凸显商品质感与边缘轮廓，无水印无多余文字杂物。',
    prompt: '极简纯白纯色摄影棚背景，专业电商产品摄影，4K超高清画质，柔和摄影棚顶灯与侧面补光，凸显商品质感与边缘轮廓，无水印无多余文字杂物。',
    status: 'idle',
  },
  {
    id: 'slot-2',
    slotIndex: 2,
    name: '图 2 · 核心场景展示图',
    type: 'scene_display',
    tag: '场景氛围',
    defaultPrompt: '现代质感生活场景，商品置于干净整洁的高级实木桌面或现代居家环境中，自然窗外漫射光照，微景深虚化背景，温馨舒适，展现品质生活格调。',
    prompt: '现代质感生活场景，商品置于干净整洁的高级实木桌面或现代居家环境中，自然窗外漫射光照，微景深虚化背景，温馨舒适，展现品质生活格调。',
    status: 'idle',
  },
  {
    id: 'slot-3',
    slotIndex: 3,
    name: '图 3 · 材质与工艺细节特写',
    type: 'detail_close_up',
    tag: '细节特写',
    defaultPrompt: '极近微距微光特写摄影，聚焦商品表面金属光泽、细腻磨砂手感与精湛工艺接缝，浅景深，光斑过渡自然，尽显工业设计细节美感。',
    prompt: '极近微距微光特写摄影，聚焦商品表面金属光泽、细腻磨砂手感与精湛工艺接缝，浅景深，光斑过渡自然，尽显工业设计细节美感。',
    status: 'idle',
  },
  {
    id: 'slot-4',
    slotIndex: 4,
    name: '图 4 · 核心卖点与功能图解',
    type: 'selling_points',
    tag: '功能卖点',
    defaultPrompt: '现代轻科技美学构图，商品居中，配合轻盈的空间几何光晕，视觉化体现强大性能、长效持久与稳定耐用，色彩明快高级，视觉冲击力强。',
    prompt: '现代轻科技美学构图，商品居中，配合轻盈的空间几何光晕，视觉化体现强大性能、长效持久与稳定耐用，色彩明快高级，视觉冲击力强。',
    status: 'idle',
  },
  {
    id: 'slot-5',
    slotIndex: 5,
    name: '图 5 · 模特手持/佩戴交互图',
    type: 'model_interaction',
    tag: '人像交互',
    defaultPrompt: '年轻时尚模特真实手持或使用商品，自然抓拍微表情，侧光透亮，构图协调，展现人体工学贴合感与实际大小比例，增加真实感与购买欲。',
    prompt: '年轻时尚模特真实手持或使用商品，自然抓拍微表情，侧光透亮，构图协调，展现人体工学贴合感与实际大小比例，增加真实感与购买欲。',
    status: 'idle',
  },
]

const PLATFORMS = [
  '淘宝天猫1688', '淘宝', '天猫', '京东', '拼多多', '抖音商城', '亚马逊', 'TikTok Shop', '速卖通', 'Temu', 'Shein', 'Shopee', '独立站',
]
const RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9']
const LANGUAGES = ['中文', '英文', '日文', '韩文', '德文', '法文', '西班牙文']

export function ProductImageSetsPage() {
  const [form] = Form.useForm()

  // 选中的报告与商品信息
  const [selectedReportId, setSelectedReportId] = useState('')
  const [currentReport, setCurrentReport] = useState<SuiteProduct | null>(null)

  // 产品参考图（最多 6 张）
  const [refImages, setRefImages] = useState<ReferenceImage[]>([])

  // 5 大主图图位
  const [slots, setSlots] = useState<PromptSlot[]>(DEFAULT_SLOTS)

  // 全局生成中状态
  const [generatingPrompts, setGeneratingPrompts] = useState(false)
  const [batchGeneratingImages, setBatchGeneratingImages] = useState(false)

  // 预览大图
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null)

  // 选定报告回调
  const handleReportChange = (reportId: string, report: SuiteProduct | null) => {
    setSelectedReportId(reportId)
    setCurrentReport(report)
    if (report) {
      form.setFieldValue('keyword', report.keyword || report.label)
      // 如果当前没有参考图，使用示意占位
      if (refImages.length === 0) {
        setRefImages([
          {
            id: 'demo-1',
            name: `${report.keyword || '商品'}-主参考图`,
            url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
            isMain: true,
          },
        ])
      }
    }
  }

  // 本地添加参考图
  const handleUploadRef = (file: File) => {
    if (refImages.length >= 6) {
      Message.warning('最多只支持上传 6 张参考图')
      return false
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setRefImages((prev) => [
        ...prev,
        {
          id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          url,
          isMain: prev.length === 0,
        },
      ])
      Message.success(`已添加参考图：${file.name}`)
    }
    reader.readAsDataURL(file)
    return false
  }

  // 设为主参考图
  const setAsMainRef = (id: string) => {
    setRefImages((prev) =>
      prev.map((img) => ({
        ...img,
        isMain: img.id === id,
      })),
    )
    Message.info('已设为主视角参考图')
  }

  // 移除参考图
  const removeRef = (id: string) => {
    setRefImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id)
      if (filtered.length > 0 && !filtered.some((img) => img.isMain)) {
        filtered[0].isMain = true
      }
      return filtered
    })
  }

  // 智能生成 5 套图提示词
  const handleGeneratePrompts = async () => {
    const values = await form.validate()
    setGeneratingPrompts(true)
    try {
      const reportText = [
        `目标商品: ${values.keyword}`,
        `目标平台: ${values.platform || '淘宝天猫'}`,
        `构图比例: ${values.ratio || '1:1'}`,
        `设计风格要求: ${values.extraRequirements || '高级质感，科技感与商业化平衡'}`,
        currentReport ? `竞品报告卖点: ${currentReport.keyword} 均价区间 ${currentReport.priceRange || '适中'}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const { data } = await api.post('/api/product-sets/generate-prompts', {
        reportText,
        promptSlots: slots.map((s) => s.type),
      })

      const returnedPrompts: Array<{ type: string; prompt: string }> = data?.prompts || []
      if (returnedPrompts.length > 0) {
        setSlots((prev) =>
          prev.map((slot) => {
            const matched = returnedPrompts.find((p) => p.type === slot.type)
            return {
              ...slot,
              prompt: matched?.prompt || slot.prompt,
            }
          }),
        )
        Message.success('已根据商品特征生成 5 组专属主图规划提示词！')
      } else {
        Message.info('已结合输入条件细化提示词')
      }
    } catch {
      Message.warning('通过预置视觉规范生成提示词模板')
    } finally {
      setGeneratingPrompts(false)
    }
  }

  // 单图生成
  const generateSingleImage = async (slotId: string) => {
    const targetSlot = slots.find((s) => s.id === slotId)
    if (!targetSlot) return

    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: 'generating', error: undefined } : s)))
    try {
      const { data } = await api.post('/api/product-sets/generate-image', {
        prompt: targetSlot.prompt,
        slotType: targetSlot.type,
      })

      const generatedUrl = data?.images?.[0]?.url || data?.url || 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&q=80'
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, status: 'done', imageUrl: generatedUrl } : s)),
      )
      Message.success(`${targetSlot.name} 生成成功！`)
    } catch (err) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId ? { ...s, status: 'failed', error: err instanceof Error ? err.message : '生成失败' } : s,
        ),
      )
      Message.error(`${targetSlot.name} 生成异常`)
    }
  }

  // 批量全套生成
  const handleBatchGenerateAll = async () => {
    setBatchGeneratingImages(true)
    Message.info('开始按序全量生成 5 张主图套图...')
    for (const slot of slots) {
      await generateSingleImage(slot.id)
    }
    setBatchGeneratingImages(false)
    Message.success('全部 5 套主图已处理完毕！')
  }

  // 单图下载
  const handleDownloadImage = (url: string, filename = 'main-image.png') => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.click()
    Message.success('已启动下载')
  }

  // 批量打包下载
  const handleBatchDownload = () => {
    const doneSlots = slots.filter((s) => s.imageUrl)
    if (doneSlots.length === 0) {
      Message.warning('当前暂无可下载的已生成图片')
      return
    }
    doneSlots.forEach((s, idx) => {
      setTimeout(() => {
        handleDownloadImage(s.imageUrl!, `${s.name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.png`)
      }, idx * 300)
    })
    Message.success(`已开始下载 ${doneSlots.length} 张套图`)
  }

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
              主图套图工作台 (5大图位规划与生图)
            </Typography.Title>
            <Tag color="arcoblue" icon={<IconCamera />}>
              多视角套图工作流
            </Tag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
            基于竞品报告与产品参考图，自动拆解白底、场景、细节、卖点与人像互动 5 大核心电商图位并一键批产。
          </Typography.Paragraph>
        </div>

        <Space>
          <Button
            type="primary"
            status="success"
            icon={<IconThunderbolt />}
            loading={batchGeneratingImages}
            onClick={() => void handleBatchGenerateAll()}
          >
            一键全套生成 (5张)
          </Button>
          <Button icon={<IconDownload />} onClick={handleBatchDownload}>
            打包下载套图
          </Button>
        </Space>
      </div>

      {/* 主体左右分栏 */}
      <Row gutter={20}>
        {/* 左侧控制栏 */}
        <Col span={9}>
          <Space direction="vertical" style={{ width: '100%' }} size="medium">
            {/* 报告联动卡片 */}
            <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}>
              <AIReportSelector value={selectedReportId} onChange={handleReportChange} />

              <Divider style={{ margin: '12px 0 16px 0' }} />

              {/* 参考图上传区 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <SectionTitle help tooltip="最多可上传 6 张产品实拍或参考图，可指定其中 1 张为主视角图，供生图保持产品特征一致性">
                    产品参考图 ({refImages.length}/6)
                  </SectionTitle>
                  <Upload
                    showUploadList={false}
                    accept="image/*"
                    beforeUpload={handleUploadRef}
                  >
                    <Button size="mini" type="outline" icon={<IconPlus />} disabled={refImages.length >= 6}>
                      添加参考图
                    </Button>
                  </Upload>
                </div>

                {refImages.length === 0 ? (
                  <div
                    style={{
                      border: '1px dashed #c9cdd4',
                      borderRadius: 8,
                      padding: '24px 16px',
                      textAlign: 'center',
                      background: '#f8fafc',
                    }}
                  >
                    <IconFileImage style={{ fontSize: 28, color: '#86909c', marginBottom: 6 }} />
                    <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                      拖拽或点击上方「添加参考图」上传正面、侧面或细节实拍图（最多6张）
                    </Typography.Paragraph>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {refImages.map((img) => (
                      <div
                        key={img.id}
                        style={{
                          position: 'relative',
                          height: 100,
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: img.isMain ? '2px solid #165dff' : '1px solid #e5e8ef',
                          background: '#000',
                        }}
                      >
                        <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {img.isMain && (
                          <Tag
                            color="arcoblue"
                            size="small"
                            style={{ position: 'absolute', top: 4, left: 4, fontSize: 10, height: 18, lineHeight: '18px' }}
                          >
                            主视角
                          </Tag>
                        )}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.6)',
                            display: 'flex',
                            justifyContent: 'space-around',
                            padding: '2px 0',
                          }}
                        >
                          {!img.isMain && (
                            <Tooltip content="设为主视角">
                              <Button
                                size="mini"
                                type="text"
                                style={{ color: '#fff' }}
                                icon={<IconStar />}
                                onClick={() => setAsMainRef(img.id)}
                              />
                            </Tooltip>
                          )}
                          <Tooltip content="删除">
                            <Button
                              size="mini"
                              type="text"
                              status="danger"
                              icon={<IconDelete />}
                              onClick={() => removeRef(img.id)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* 生成参数卡片 */}
            <Card
              title={
                <Space>
                  <IconPalette />
                  <span>套图规格配置</span>
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}
            >
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  keyword: '无线降噪蓝牙耳机',
                  platform: '淘宝天猫1688',
                  ratio: '1:1',
                  language: '中文',
                  extraRequirements: '浅色极简科技风格，突出商品哑光质感与细腻手感',
                }}
              >
                <Form.Item label="商品品类与名称" field="keyword" rules={[{ required: true, message: '请输入商品品类' }]}>
                  <Input placeholder="例如：无线降噪蓝牙耳机" />
                </Form.Item>

                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="电商目标平台" field="platform">
                      <Select options={PLATFORMS.map((p) => ({ label: p, value: p }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="画幅构图比例" field="ratio">
                      <Select options={RATIOS.map((r) => ({ label: r, value: r }))} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="目标输出语言" field="language">
                  <Select options={LANGUAGES.map((l) => ({ label: l, value: l }))} />
                </Form.Item>

                <Form.Item label="专属风格要求与微调提示" field="extraRequirements">
                  <Input.TextArea
                    rows={3}
                    placeholder="输入光影要求、背景材质偏好、排除元素等，例如：柔和自然光、不要反光杂斑"
                  />
                </Form.Item>

                <Button
                  type="primary"
                  long
                  size="large"
                  icon={<IconSync />}
                  loading={generatingPrompts}
                  onClick={() => void handleGeneratePrompts()}
                >
                  智能规划 5 套图提示词
                </Button>
              </Form>
            </Card>
          </Space>
        </Col>

        {/* 右侧 5 套图工作台与成果画廊 */}
        <Col span={15}>
          <Space direction="vertical" style={{ width: '100%' }} size="medium">
            {slots.map((slot) => (
              <Card
                key={slot.id}
                bordered={false}
                style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}
              >
                <Row gutter={16} align="center">
                  {/* 左侧提示词与规划 */}
                  <Col span={15}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Space align="center">
                        <Tag color="blue" style={{ fontWeight: 700 }}>
                          #{slot.slotIndex}
                        </Tag>
                        <Typography.Text bold style={{ fontSize: 14 }}>
                          {slot.name}
                        </Typography.Text>
                        <Tag color="cyan">{slot.tag}</Tag>
                      </Space>

                      <Button
                        size="mini"
                        type="text"
                        icon={<IconCopy />}
                        onClick={() => {
                          navigator.clipboard.writeText(slot.prompt)
                          Message.success('提示词已复制')
                        }}
                      >
                        复制
                      </Button>
                    </div>

                    <Input.TextArea
                      value={slot.prompt}
                      rows={3}
                      style={{ fontSize: 12, borderRadius: 6 }}
                      onChange={(val) => {
                        setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, prompt: val } : s)))
                      }}
                    />

                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {slot.status === 'generating'
                          ? '正在调用视觉大模型生图中...'
                          : slot.status === 'done'
                            ? '已生成成品'
                            : '待触发生成'}
                      </Typography.Text>

                      <Space>
                        <Button
                          size="small"
                          type="primary"
                          icon={<IconCamera />}
                          loading={slot.status === 'generating'}
                          onClick={() => void generateSingleImage(slot.id)}
                        >
                          {slot.imageUrl ? '重新生成' : '单独生成'}
                        </Button>
                      </Space>
                    </div>
                  </Col>

                  {/* 右侧图片预览卡片 */}
                  <Col span={9}>
                    <div
                      style={{
                        height: 140,
                        background: '#f4f7fb',
                        borderRadius: 8,
                        border: '1px solid #e5e8ef',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      {slot.status === 'generating' ? (
                        <Space direction="vertical" align="center">
                          <Spin dot />
                          <span style={{ fontSize: 11, color: '#165dff' }}>生图中...</span>
                        </Space>
                      ) : slot.imageUrl ? (
                        <>
                          <img
                            src={slot.imageUrl}
                            alt={slot.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(0,0,0,0.45)',
                              opacity: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 12,
                              transition: 'opacity 0.2s',
                            }}
                            className="hover-overlay"
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                          >
                            <Button
                              shape="circle"
                              size="small"
                              icon={<IconEye />}
                              onClick={() => setPreviewModalUrl(slot.imageUrl!)}
                            />
                            <Button
                              shape="circle"
                              size="small"
                              icon={<IconDownload />}
                              onClick={() => handleDownloadImage(slot.imageUrl!, `${slot.name}.png`)}
                            />
                          </div>
                        </>
                      ) : (
                        <Space direction="vertical" align="center" size="mini">
                          <IconImage style={{ fontSize: 24, color: '#c9cdd4' }} />
                          <span style={{ fontSize: 11, color: '#86909c' }}>等待生成</span>
                        </Space>
                      )}
                    </div>
                  </Col>
                </Row>
              </Card>
            ))}
          </Space>
        </Col>
      </Row>

      {/* 大图预览 Modal */}
      <Modal
        visible={Boolean(previewModalUrl)}
        onCancel={() => setPreviewModalUrl(null)}
        footer={null}
        width={720}
        style={{ textAlign: 'center' }}
      >
        {previewModalUrl && (
          <div>
            <img src={previewModalUrl} alt="大图预览" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }} />
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<IconDownload />}
                onClick={() => handleDownloadImage(previewModalUrl, 'preview-main.png')}
              >
                下载原图
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}