import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
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
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconCopy,
  IconDelete,
  IconDownload,
  IconDragDotVertical,
  IconEye,
  IconFileImage,
  IconLayout,
  IconPalette,
  IconPlus,
  IconRefresh,
  IconStar,
  IconSync,
  IconThunderbolt,
  IconUpload,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'
import { saveAs } from 'file-saver'
import { nanoid } from 'nanoid'
import { AIReportSelector, SectionTitle, type SuiteProduct } from '../components/AIReportSelector'

const { Row, Col } = Grid

interface DetailModuleDef {
  key: string
  title: string
  desc: string
  category: 'core' | 'scene' | 'spec' | 'service'
  defaultPrompt: string
}

const ALL_MODULES: DetailModuleDef[] = [
  {
    key: 'hero_banner',
    title: '首屏主视觉',
    desc: '传递核心品牌价值与最强视觉冲击',
    category: 'core',
    defaultPrompt: '电商详情页首屏大Banner，宽幅现代轻奢科技构图，主体高清居中，极具张力的氛围光效，标杆质感。',
  },
  {
    key: 'core_selling_point',
    title: '核心卖点图',
    desc: '突出产品最核心的差异化优势',
    category: 'core',
    defaultPrompt: '图解核心功能与差异化卖点，虚实结合展现强劲性能或精工材质，色彩鲜明有条理。',
  },
  {
    key: 'usage_scene',
    title: '使用场景图',
    desc: '呈现真实生动的使用生活场景',
    category: 'scene',
    defaultPrompt: '自然温馨的高品质居家或现代办公日常场景，商品融入其中，光线柔和，极具真实代入感。',
  },
  {
    key: 'multi_angles',
    title: '多角度图',
    desc: '全方位多角度呈现商品外观',
    category: 'scene',
    defaultPrompt: '前视图、45度立体侧视图与顶视图三联排布，多视角展示整体结构与比例线条。',
  },
  {
    key: 'scene_atmosphere',
    title: '场景氛围图',
    desc: '营造高端精致的品质生活格调',
    category: 'scene',
    defaultPrompt: '电影级景深虚化与自然暖光侧照，商品置于优雅静谧空间中，展现尊贵生活美学。',
  },
  {
    key: 'detail_close_up',
    title: '商品细节特写',
    desc: '微距放大表面材质与精湛工艺',
    category: 'spec',
    defaultPrompt: '超近微距微光特写，极尽展现表面精美纹理、圆润倒角与接缝做工，金属质感细腻。',
  },
  {
    key: 'brand_story',
    title: '品牌故事图',
    desc: '传达品牌理念与匠心研发初心',
    category: 'core',
    defaultPrompt: '品牌视觉沉淀，极简留白风格，手稿线条与实物交叠，传递专业研发精神。',
  },
  {
    key: 'dimension_size',
    title: '尺寸/容量/尺码图',
    desc: '标明精确规格尺寸与空间占比',
    category: 'spec',
    defaultPrompt: '干净纯色背景，清晰直观的微标尺与数字标注，直观呈现长宽高尺寸与容量比例。',
  },
  {
    key: 'effect_compare',
    title: '效果对比图',
    desc: '使用前后对比或同类对比',
    category: 'core',
    defaultPrompt: '左右分屏强烈对比，左侧普通传统痛点，右侧使用本商品后的惊艳体验，视觉冲击力显著。',
  },
  {
    key: 'spec_table',
    title: '详细参数/规格表',
    desc: '专业详尽的产品电气/物理数据',
    category: 'spec',
    defaultPrompt: '规整高级的参数排版底图，搭配清晰的指标区域划分，专业严谨有说服力。',
  },
  {
    key: 'craft_process',
    title: '工艺制作图',
    desc: '展示核心制造工艺与层层把控',
    category: 'spec',
    defaultPrompt: '分层爆炸图或工匠精细打磨视觉，展示内部核心部件结构与尖端工艺组合。',
  },
  {
    key: 'accessories_list',
    title: '配件/赠品全家福',
    desc: '收货清单清晰明了，避免售后纠纷',
    category: 'service',
    defaultPrompt: '全套开箱全家福俯视平铺陈列，主机、配件、连接线、说明书及赠品规整摆放。',
  },
  {
    key: 'series_display',
    title: '系列/多色展示图',
    desc: '展示多款色彩与组合可选',
    category: 'scene',
    defaultPrompt: '多种经典配色商品一字排开或阶梯式陈列，展现丰富多选的色彩质感与潮流风格。',
  },
  {
    key: 'ingredients_material',
    title: '材质/成分安全图',
    desc: '展现用料考究与权威安全认证',
    category: 'spec',
    defaultPrompt: '环保材质、母婴级安全或国际认证标章展示，绿色自然轻奢调性，令人安心信赖。',
  },
  {
    key: 'after_sales',
    title: '售后保障图',
    desc: '质保无忧政策打消购买顾虑',
    category: 'service',
    defaultPrompt: '官方正品、全国联保、闪电发货、无忧退换售后服务专区标识图，专业可信赖。',
  },
  {
    key: 'usage_guide',
    title: '使用建议/操作指导',
    desc: '轻松上手指导与避坑贴心说明',
    category: 'service',
    defaultPrompt: '1-2-3 极简操作步序指引示意图，图文简明易懂，展现贴心用户关怀。',
  },
]

interface SelectedModuleItem {
  instanceId: string
  key: string
  title: string
  prompt: string
  status: 'idle' | 'generating' | 'done' | 'failed'
  imageUrl?: string
  error?: string
}

export function APlusDetailPage() {
  const [form] = Form.useForm()

  // 联动报告
  const [selectedReportId, setSelectedReportId] = useState('')
  const [currentReport, setCurrentReport] = useState<SuiteProduct | null>(null)

  // 选中的模块列表（有序）
  const [selectedModules, setSelectedModules] = useState<SelectedModuleItem[]>([
    {
      instanceId: 'mod-hero',
      key: 'hero_banner',
      title: '首屏主视觉',
      prompt: ALL_MODULES[0].defaultPrompt,
      status: 'idle',
    },
    {
      instanceId: 'mod-selling',
      key: 'core_selling_point',
      title: '核心卖点图',
      prompt: ALL_MODULES[1].defaultPrompt,
      status: 'idle',
    },
    {
      instanceId: 'mod-scene',
      key: 'usage_scene',
      title: '使用场景图',
      prompt: ALL_MODULES[2].defaultPrompt,
      status: 'idle',
    },
    {
      instanceId: 'mod-detail',
      key: 'detail_close_up',
      title: '商品细节特写',
      prompt: ALL_MODULES[5].defaultPrompt,
      status: 'idle',
    },
    {
      instanceId: 'mod-params',
      key: 'spec_table',
      title: '详细参数/规格表',
      prompt: ALL_MODULES[9].defaultPrompt,
      status: 'idle',
    },
    {
      instanceId: 'mod-after',
      key: 'after_sales',
      title: '售后保障图',
      prompt: ALL_MODULES[14].defaultPrompt,
      status: 'idle',
    },
  ])

  // 批量生成状态
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [workflowPlanning, setWorkflowPlanning] = useState(false)
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null)

  // 报告联动
  const handleReportChange = (reportId: string, report: SuiteProduct | null) => {
    setSelectedReportId(reportId)
    setCurrentReport(report)
    if (report) {
      form.setFieldValue('keyword', report.keyword || report.label)
    }
  }

  // 点击选择/取消某个模块
  const toggleModuleKey = (def: DetailModuleDef) => {
    const existingIndex = selectedModules.findIndex((m) => m.key === def.key)
    if (existingIndex >= 0) {
      if (selectedModules.length <= 1) {
        Message.warning('至少保留 1 个详情图模块')
        return
      }
      setSelectedModules((prev) => prev.filter((_, i) => i !== existingIndex))
    } else {
      setSelectedModules((prev) => [
        ...prev,
        {
          instanceId: `mod-${nanoid(8)}`,
          key: def.key,
          title: def.title,
          prompt: def.defaultPrompt,
          status: 'idle',
        },
      ])
    }
  }

  // 模块上移
  const moveUp = (index: number) => {
    if (index === 0) return
    setSelectedModules((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  // 模块下移
  const moveDown = (index: number) => {
    if (index === selectedModules.length - 1) return
    setSelectedModules((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  // 移除单个模块
  const removeModule = (instanceId: string) => {
    if (selectedModules.length <= 1) {
      Message.warning('至少保留 1 个详情图模块')
      return
    }
    setSelectedModules((prev) => prev.filter((m) => m.instanceId !== instanceId))
  }

  // 智能生成详情工作流与提示词
  const handlePlanWorkflow = async () => {
    const values = await form.validate()
    setWorkflowPlanning(true)
    try {
      const reportText = [
        `商品名称: ${values.keyword}`,
        `目标平台: ${values.platform || '淘宝天猫'}`,
        `设计风格要求: ${values.extraRequirements || '现代轻奢，信息层级分明，专业视觉指引'}`,
        currentReport ? `竞品核心卖点: ${currentReport.keyword}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const { data } = await api.post('/api/product-sets/generate-detail-workflow', {
        reportText,
        promptSlots: selectedModules.map((m) => m.key),
      })

      const returnedItems: Array<{ type: string; prompt: string; name?: string }> = data?.data || []
      if (returnedItems.length > 0) {
        setSelectedModules((prev) =>
          prev.map((mod) => {
            const matched = returnedItems.find((p) => p.type === mod.key)
            return {
              ...mod,
              prompt: matched?.prompt || mod.prompt,
            }
          }),
        )
        Message.success(`已规划 ${selectedModules.length} 个详情切片图专属提示词！`)
      } else {
        Message.info('已应用通用电商详情图排版优化')
      }
    } catch {
      Message.warning('使用预设模板完成工作流规划')
    } finally {
      setWorkflowPlanning(false)
    }
  }

  // 单图生成
  const generateSingleModuleImage = async (instanceId: string) => {
    const target = selectedModules.find((m) => m.instanceId === instanceId)
    if (!target) return

    setSelectedModules((prev) =>
      prev.map((m) => (m.instanceId === instanceId ? { ...m, status: 'generating', error: undefined } : m)),
    )

    try {
      const { data } = await api.post('/api/product-sets/generate-image', {
        prompt: target.prompt,
        slotType: target.key,
      })

      const generatedUrl =
        data?.images?.[0]?.url || data?.url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'

      setSelectedModules((prev) =>
        prev.map((m) => (m.instanceId === instanceId ? { ...m, status: 'done', imageUrl: generatedUrl } : m)),
      )
      Message.success(`${target.title} 绘制完成！`)
    } catch (err) {
      setSelectedModules((prev) =>
        prev.map((m) =>
          m.instanceId === instanceId
            ? { ...m, status: 'failed', error: err instanceof Error ? err.message : '生成失败' }
            : m,
        ),
      )
      Message.error(`${target.title} 生成失败`)
    }
  }

  // 批量一键生成整套详情图
  const handleBatchGenerateAll = async () => {
    setBatchGenerating(true)
    Message.info(`开始顺次生成 ${selectedModules.length} 张详情图模块...`)
    for (const mod of selectedModules) {
      await generateSingleModuleImage(mod.instanceId)
    }
    setBatchGenerating(false)
    Message.success('全部详情切片图已生成完毕！')
  }

  // 单图下载
  const handleDownloadImage = (url: string, filename = 'detail-image.png') => {
    saveAs(url, filename)
    Message.success('已下载')
  }

  // 批量下载所有切片图
  const handleBatchDownload = () => {
    const doneMods = selectedModules.filter((m) => m.imageUrl)
    if (doneMods.length === 0) {
      Message.warning('当前暂无可下载的已生成详情图')
      return
    }
    doneMods.forEach((m, idx) => {
      setTimeout(() => {
        handleDownloadImage(m.imageUrl!, `${idx + 1}_${m.title}.png`)
      }, idx * 300)
    })
    Message.success(`已开始下载 ${doneMods.length} 张详情长图模块`)
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
              详情图 (APlus) 编排与生图工作台
            </Typography.Title>
            <Tag color="cyan" icon={<IconLayout />}>
              16大经典电商模块编排
            </Tag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
            自由组合 16 种电商详情图模块，编排视觉大纲并顺次输出完整无缝的高转化率商品详情长图。
          </Typography.Paragraph>
        </div>

        <Space>
          <Button
            type="primary"
            status="success"
            icon={<IconThunderbolt />}
            loading={batchGenerating}
            onClick={() => void handleBatchGenerateAll()}
          >
            一键全量生成 ({selectedModules.length}张)
          </Button>
          <Button icon={<IconDownload />} onClick={handleBatchDownload}>
            打包下载详情图
          </Button>
        </Space>
      </div>

      <Row gutter={20}>
        {/* 左侧：16 模块选择器与基础表单 */}
        <Col span={9}>
          <Space direction="vertical" style={{ width: '100%' }} size="medium">
            {/* 报告联动卡片 */}
            <Card bordered={false} style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}>
              <AIReportSelector value={selectedReportId} onChange={handleReportChange} />

              <Divider style={{ margin: '12px 0 16px 0' }} />

              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  keyword: '无线降噪运动耳机',
                  platform: '淘宝天猫1688',
                  extraRequirements: '浅色极简轻奢风，文字信息与视觉留白舒适平衡，高档感十足',
                }}
              >
                <Form.Item label="商品名称与核心定位" field="keyword" rules={[{ required: true, message: '请输入商品名称' }]}>
                  <Input placeholder="例如：高端无线降噪蓝牙耳机" />
                </Form.Item>

                <Form.Item label="投放电商平台" field="platform">
                  <Select
                    options={[
                      { label: '淘宝天猫1688', value: '淘宝天猫1688' },
                      { label: '京东商城', value: '京东商城' },
                      { label: '抖音电商', value: '抖音电商' },
                      { label: '拼多多', value: '拼多多' },
                      { label: '亚马逊 (A+ 页面)', value: '亚马逊' },
                      { label: 'TikTok Shop', value: 'TikTok Shop' },
                    ]}
                  />
                </Form.Item>

                <Form.Item label="专属视觉调性要求" field="extraRequirements">
                  <Input.TextArea rows={2} placeholder="如：背景采用质感微水泥，排版呼吸感强，无多余大色块" />
                </Form.Item>
              </Form>
            </Card>

            {/* 16 模块选择器 */}
            <Card
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <IconPalette />
                    <span>电商详情模块池 (16大类)</span>
                  </Space>
                  <Tag color="arcoblue">已选 {selectedModules.length} 块</Tag>
                </div>
              }
              bordered={false}
              style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}
            >
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
                点击下方标签即可在右侧编排流中快速添加或取消对应详情模块：
              </Typography.Paragraph>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {ALL_MODULES.map((mod) => {
                  const isSelected = selectedModules.some((m) => m.key === mod.key)
                  return (
                    <div
                      key={mod.key}
                      onClick={() => toggleModuleKey(mod)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        transition: 'all 0.2s',
                        border: isSelected ? '1px solid #165dff' : '1px solid #e5e8ef',
                        background: isSelected ? '#e8f3ff' : '#f8fafc',
                        color: isSelected ? '#165dff' : '#4e5969',
                        fontWeight: isSelected ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {isSelected && <IconCheck style={{ fontSize: 12 }} />}
                      <span>{mod.title}</span>
                    </div>
                  )
                })}
              </div>

              <Button
                type="primary"
                long
                size="large"
                icon={<IconSync />}
                loading={workflowPlanning}
                style={{ marginTop: 16 }}
                onClick={() => void handlePlanWorkflow()}
              >
                生成详情工作流与提示词
              </Button>
            </Card>
          </Space>
        </Col>

        {/* 右侧：有序大纲编排与详情图切片成果画廊 */}
        <Col span={15}>
          <Space direction="vertical" style={{ width: '100%' }} size="medium">
            {selectedModules.map((mod, index) => (
              <Card
                key={mod.instanceId}
                bordered={false}
                style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}
              >
                <Row gutter={16} align="center">
                  {/* 左侧模块信息与提示词 */}
                  <Col span={15}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Space align="center">
                        <Tag color="cyan" style={{ fontWeight: 700 }}>
                          #{index + 1}
                        </Tag>
                        <Input
                          value={mod.title}
                          size="small"
                          style={{ width: 140, fontWeight: 700 }}
                          onChange={(val) => {
                            setSelectedModules((prev) =>
                              prev.map((m) => (m.instanceId === mod.instanceId ? { ...m, title: val } : m)),
                            )
                          }}
                        />
                        <Tag size="small">{mod.key}</Tag>
                      </Space>

                      {/* 排序与操作 */}
                      <Space size="mini">
                        <Button
                          size="mini"
                          shape="circle"
                          icon={<IconArrowUp />}
                          disabled={index === 0}
                          onClick={() => moveUp(index)}
                        />
                        <Button
                          size="mini"
                          shape="circle"
                          icon={<IconArrowDown />}
                          disabled={index === selectedModules.length - 1}
                          onClick={() => moveDown(index)}
                        />
                        <Button
                          size="mini"
                          shape="circle"
                          status="danger"
                          icon={<IconDelete />}
                          onClick={() => removeModule(mod.instanceId)}
                        />
                      </Space>
                    </div>

                    <Input.TextArea
                      value={mod.prompt}
                      rows={3}
                      style={{ fontSize: 12, borderRadius: 6 }}
                      onChange={(val) => {
                        setSelectedModules((prev) =>
                          prev.map((m) => (m.instanceId === mod.instanceId ? { ...m, prompt: val } : m)),
                        )
                      }}
                    />

                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {mod.status === 'generating'
                          ? '正在渲染切片大图中...'
                          : mod.status === 'done'
                            ? '切片图已生成'
                            : '待生成'}
                      </Typography.Text>

                      <Button
                        size="small"
                        type="primary"
                        icon={<IconThunderbolt />}
                        loading={mod.status === 'generating'}
                        onClick={() => void generateSingleModuleImage(mod.instanceId)}
                      >
                        {mod.imageUrl ? '重新渲染' : '单独渲染'}
                      </Button>
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
                      {mod.status === 'generating' ? (
                        <Space direction="vertical" align="center">
                          <Spin dot />
                          <span style={{ fontSize: 11, color: '#165dff' }}>渲染中...</span>
                        </Space>
                      ) : mod.imageUrl ? (
                        <>
                          <img
                            src={mod.imageUrl}
                            alt={mod.title}
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
                              onClick={() => setPreviewModalUrl(mod.imageUrl!)}
                            />
                            <Button
                              shape="circle"
                              size="small"
                              icon={<IconDownload />}
                              onClick={() => handleDownloadImage(mod.imageUrl!, `${index + 1}_${mod.title}.png`)}
                            />
                          </div>
                        </>
                      ) : (
                        <Space direction="vertical" align="center" size="mini">
                          <IconFileImage style={{ fontSize: 24, color: '#c9cdd4' }} />
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

      {/* 大图查看 Modal */}
      <Modal
        visible={Boolean(previewModalUrl)}
        onCancel={() => setPreviewModalUrl(null)}
        footer={null}
        style={{ width: 800, textAlign: 'center' }}
      >
        {previewModalUrl && (
          <div>
            <img src={previewModalUrl} alt="详情大图" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 8 }} />
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<IconDownload />}
                onClick={() => handleDownloadImage(previewModalUrl, 'detail-preview.png')}
              >
                下载原画切片图
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}