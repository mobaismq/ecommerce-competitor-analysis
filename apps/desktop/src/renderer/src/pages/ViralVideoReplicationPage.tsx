import React, { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Grid,
  Image,
  Input,
  InputNumber,
  Message,
  Modal,
  Progress,
  Radio,
  Select,
  Space,
  Spin,
  Steps,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from '@arco-design/web-react'
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconEye,
  IconFire,
  IconFolder,
  IconLink,
  IconLoading,
  IconPlayArrow,
  IconPlus,
  IconRefresh,
  IconThunderbolt,
  IconUpload,
  IconVideoCamera,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'

// 导入我们在 Phase 9.1 中提取的 8 种类型封面图片
import imgUgc from '../assets/video-types/image-11.png'
import imgDrama from '../assets/video-types/image-26.png'
import imgOral from '../assets/video-types/image-27.png'
import imgDemo from '../assets/video-types/image-13.png'
import imgUnbox from '../assets/video-types/image-9.png'
import imgScene from '../assets/video-types/image-10.png'
import imgCompare from '../assets/video-types/image-12.png'
import imgTutorial from '../assets/video-types/image-1.png'

const { Title, Text, Paragraph } = Typography
const { Row, Col } = Grid
const { TabPane } = Tabs
const { TextArea } = Input
const { Step } = Steps

interface VideoTypeCard {
  id: string
  label: string
  desc: string
  image: string
}

const VIDEO_TYPES: VideoTypeCard[] = [
  { id: 'ugc', label: 'UGC 种草', desc: '用户视角真实分享，高亲和力极速种草', image: imgUgc },
  { id: 'drama', label: '带货短剧', desc: '微短剧反转剧情，软植入高转化', image: imgDrama },
  { id: 'oral', label: '产品口播', desc: '达人正脸对镜讲解，直击痛点', image: imgOral },
  { id: 'demo', label: '产品演示', desc: '核心功能近景实操与硬核特性展现', image: imgDemo },
  { id: 'unbox', label: '开箱测评', desc: '真实拆箱仪式感，包装与配件全览', image: imgUnbox },
  { id: 'scene', label: '场景种草', desc: '沉浸式生活场景自然融入商品', image: imgScene },
  { id: 'compare', label: '对比评测', desc: '硬核竞品实测对比，凸显绝对优势', image: imgCompare },
  { id: 'tutorial', label: '教程视频', desc: '保姆级新手上手技巧与使用攻略', image: imgTutorial },
]

const MARKETS = ['北美市场', '欧洲市场', '东南亚市场', '日韩市场', '中东市场', '拉美市场', '澳洲市场', '全球通用']
const LANGUAGES = ['英语', '中文', '日语', '韩语', '德语', '法语', '西班牙语', '葡萄牙语', '阿拉伯语', '泰语', '越南语']
const RATIOS = [
  { label: 'TikTok / Reels · 9:16', value: '9:16' },
  { label: '抖音 / 快手 · 9:16', value: '9:16' },
  { label: '小红书笔记 · 3:4', value: '3:4' },
  { label: '淘宝/天猫主图 · 1:1', value: '1:1' },
  { label: 'YouTube / 亚马逊 · 16:9', value: '16:9' },
]

interface GeneratedVideoItem {
  id: string
  title: string
  type: string
  ratio: string
  duration: string
  coverUrl: string
  videoUrl: string
  fissionIndex: number
  scriptSummary: string
  createTime: string
}

export function ViralVideoReplicationPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'replicate'>('generate')

  // 表单状态
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['ugc'])
  const [market, setMarket] = useState('北美市场')
  const [language, setLanguage] = useState('英语')
  const [ratio, setRatio] = useState('9:16')
  const [sellingPoints, setSellingPoints] = useState(
    '1. 航空铝合金高刚性机身，轻薄亲肤佩戴\n2. 智能 AI 睡眠与心率全天候精准追踪\n3. 5ATM 深度防水，强劲续航达 14 天',
  )
  const [replicateUrl, setReplicateUrl] = useState('')
  const [fissionCount, setFissionCount] = useState(2)
  const [productImage, setProductImage] = useState<string>(
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
  )

  // 生成状态
  const [generating, setGenerating] = useState(false)
  const [generateStep, setGenerateStep] = useState(0)
  const [results, setResults] = useState<GeneratedVideoItem[]>([])
  const [previewVideo, setPreviewVideo] = useState<GeneratedVideoItem | null>(null)

  // 切换类型
  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((t) => t !== id) : prev) : [...prev, id],
    )
  }

  // 启动生成/复刻
  const handleStart = async () => {
    setGenerating(true)
    setGenerateStep(0)

    try {
      // 尝试调用后端任务接口
      await api.post('/api/videos/replicate', {
        sourceUrl: replicateUrl || 'https://www.tiktok.com/demo-hot-video',
        title: activeTab === 'generate' ? `原创爆款视频 (${selectedTypes.join(',')})` : '竞品爆款复刻视频',
      }).catch(() => undefined)
    } catch {
      // ignore
    }

    // 步骤动画模拟
    const s1 = setTimeout(() => setGenerateStep(1), 1000)
    const s2 = setTimeout(() => setGenerateStep(2), 2200)
    const s3 = setTimeout(() => setGenerateStep(3), 3600)
    const s4 = setTimeout(() => {
      setGenerateStep(4)
      setGenerating(false)

      const activeTypeName = VIDEO_TYPES.find((t) => t.id === selectedTypes[0])?.label || 'UGC 种草'
      const generatedList: GeneratedVideoItem[] = Array.from({ length: fissionCount }).map((_, i) => ({
        id: `vid_${Date.now()}_${i + 1}`,
        title: `${activeTypeName} · 变体裂变 #${i + 1} (${market}定制)`,
        type: activeTypeName,
        ratio,
        duration: ratio === '9:16' ? '0:35' : '1:00',
        coverUrl: VIDEO_TYPES.find((t) => t.id === selectedTypes[i % selectedTypes.length])?.image || imgUgc,
        videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        fissionIndex: i + 1,
        scriptSummary: `【分镜1】前3秒视觉冲突：痛点暴击与特写展示\n【分镜2】核心功能演示：${sellingPoints.split('\n')[0] || '核心卖点'}\n【分镜3】行动号召 CTA：限时折扣抢购`,
        createTime: new Date().toLocaleTimeString(),
      }))

      setResults(generatedList)
      Message.success(`视频${activeTab === 'generate' ? '生成' : '复刻'}完成！成功输出 ${fissionCount} 条高画质成品`)
    }, 4800)

    return () => {
      clearTimeout(s1)
      clearTimeout(s2)
      clearTimeout(s3)
      clearTimeout(s4)
    }
  }

  // 复制分镜脚本
  const handleCopyScript = (txt: string) => {
    navigator.clipboard.writeText(txt)
    Message.success('分镜脚本已复制')
  }

  return (
    <div className="page" style={{ padding: '20px 24px' }}>
      {/* 顶部标题区 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title heading={4} style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>爆款视频生成与复刻工作台</span>
            <Tag color="magenta" icon={<IconVideoCamera />}>AI 视频大模型</Tag>
          </Title>
          <Text type="secondary">
            针对 TikTok、抖音、小红书与天猫电商平台，提供 8 类高转化视频脚本规划、多国语言本地化与爆款短剧一键裂变。
          </Text>
        </div>

        <Tabs
          type="capsule"
          activeTab={activeTab}
          onChange={(k) => setActiveTab(k as 'generate' | 'replicate')}
        >
          <TabPane key="generate" title="原创生成爆款" />
          <TabPane key="replicate" title="竞品爆款复刻" />
        </Tabs>
      </div>

      <Row gutter={20}>
        {/* 左侧配置栏 (380px) */}
        <Col span={9}>
          <Card bordered style={{ borderRadius: 8, marginBottom: 16 }}>
            {/* 产品图预览与上传 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text bold style={{ fontSize: 13 }}>产品原图基准</Text>
                <Tag color="arcoblue" size="small">主视角</Tag>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border-2)' }}>
                  <Image src={productImage} width={72} height={72} style={{ objectFit: 'cover' }} preview />
                </div>
                <div style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: 'var(--color-text-3)', display: 'block', marginBottom: 6 }}>
                    有实拍图时建议上传，视频大模型将严格参照原图结构进行材质与形变对齐。
                  </Text>
                  <Button size="mini" icon={<IconUpload />}>更换实物图</Button>
                </div>
              </div>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            {/* 8 种爆款视频类型选择池 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text bold style={{ fontSize: 13 }}>视频类型矩阵 (可多选)</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>已选 {selectedTypes.length} 类</Text>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {VIDEO_TYPES.map((type) => {
                  const isSelected = selectedTypes.includes(type.id)
                  return (
                    <div
                      key={type.id}
                      onClick={() => toggleType(type.id)}
                      style={{
                        border: isSelected ? '2px solid #165dff' : '1px solid var(--color-border-2)',
                        background: isSelected ? '#f2f7ff' : 'var(--color-fill-2)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative',
                      }}
                    >
                      <div style={{ height: 90, overflow: 'hidden', position: 'relative' }}>
                        <img src={type.image} alt={type.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
                        {isSelected && (
                          <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: '#165dff', display: 'grid', placeItems: 'center' }}>
                            <IconCheck style={{ color: '#fff', fontSize: 12 }} />
                          </div>
                        )}
                        <span style={{ position: 'absolute', bottom: 6, left: 8, color: '#fff', fontWeight: 600, fontSize: 13 }}>
                          {type.label}
                        </span>
                      </div>
                      <div style={{ padding: '6px 8px' }}>
                        <Text type="secondary" ellipsis style={{ fontSize: 11, display: 'block' }}>
                          {type.desc}
                        </Text>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            {/* 国际化与画幅配置 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>目标市场</Text>
                <Select value={market} onChange={setMarket}>
                  {MARKETS.map((m) => (
                    <Select.Option key={m} value={m}>{m}</Select.Option>
                  ))}
                </Select>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>配音与文字</Text>
                <Select value={language} onChange={setLanguage}>
                  {LANGUAGES.map((l) => (
                    <Select.Option key={l} value={l}>{l}</Select.Option>
                  ))}
                </Select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>画幅比例</Text>
              <Select value={ratio} onChange={setRatio}>
                {RATIOS.map((r) => (
                  <Select.Option key={r.label} value={r.value}>{r.label}</Select.Option>
                ))}
              </Select>
            </div>

            {/* 复刻链接 (仅复刻 Tab) */}
            {activeTab === 'replicate' && (
              <div style={{ marginBottom: 14 }}>
                <Text bold style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                  参考爆款视频链接
                </Text>
                <Input
                  prefix={<IconLink />}
                  placeholder="支持粘贴 TikTok / 抖音 / YouTube 视频链接"
                  value={replicateUrl}
                  onChange={setReplicateUrl}
                  allowClear
                />
              </div>
            )}

            {/* 核心卖点输入 */}
            <div style={{ marginBottom: 14 }}>
              <Text bold style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                商品核心卖点（大纲故事板）
              </Text>
              <TextArea
                rows={3}
                placeholder="请输入要重点展现的 3 个卖点"
                value={sellingPoints}
                onChange={setSellingPoints}
              />
            </div>

            {/* 裂变数量 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Text bold style={{ fontSize: 13 }}>一次生成裂变数量</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>生成不同分镜角度与节奏的成品</Text>
              </div>
              <InputNumber
                min={1}
                max={5}
                value={fissionCount}
                onChange={(v) => setFissionCount(v || 1)}
                style={{ width: 100 }}
              />
            </div>

            <Button
              type="primary"
              size="large"
              icon={<IconPlayArrow />}
              loading={generating}
              onClick={handleStart}
              style={{ width: '100%' }}
            >
              {generating ? '大模型渲染生成中...' : activeTab === 'generate' ? '一键生成原创爆款短视频' : '一键高精复刻视频'}
            </Button>
          </Card>
        </Col>

        {/* 右侧展示与视频画廊 */}
        <Col span={15}>
          {/* 生成进行中提示 */}
          {generating && (
            <Card bordered style={{ borderRadius: 8, marginBottom: 16, textAlign: 'center', padding: '24px 0' }}>
              <Steps current={generateStep} style={{ maxWidth: 640, margin: '0 auto 20px auto' }}>
                <Step title="卖点分析" description="拆解分镜痛点" />
                <Step title="脚本生成" description="多语言母语化" />
                <Step title="画面渲染" description="主体运动生成" />
                <Step title="音频对齐" description="AI 旁白与配乐" />
              </Steps>
              <Spin tip="Sora / Hunyuan 多模态视频大模型渲染中，请稍候..." />
            </Card>
          )}

          {/* 结果画廊 */}
          {results.length > 0 ? (
            <div>
              <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title heading={5} style={{ margin: 0 }}>
                  生成成果列表 ({results.length} 条成品)
                </Title>
                <Button size="small" icon={<IconDownload />}>打包下载全部 MP4</Button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {results.map((vid) => (
                  <Card key={vid.id} bordered style={{ borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ position: 'relative', height: 200, background: '#000', borderRadius: 6, overflow: 'hidden' }}>
                      <img src={vid.coverUrl} alt={vid.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                      <div
                        onClick={() => setPreviewVideo(vid)}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          background: 'rgba(0,0,0,0.25)',
                        }}
                      >
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(22,93,255,0.9)', display: 'grid', placeItems: 'center' }}>
                          <IconPlayArrow style={{ color: '#fff', fontSize: 24, marginLeft: 2 }} />
                        </div>
                      </div>
                      <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
                        {vid.duration}
                      </span>
                      <span style={{ position: 'absolute', top: 8, left: 8, background: '#165dff', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>
                        {vid.type}
                      </span>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <Text bold ellipsis style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                        {vid.title}
                      </Text>
                      <Paragraph
                        type="secondary"
                        ellipsis={{ rows: 2 }}
                        style={{ fontSize: 12, marginBottom: 8, background: 'var(--color-fill-2)', padding: '6px 8px', borderRadius: 4 }}
                      >
                        {vid.scriptSummary}
                      </Paragraph>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>画幅: {vid.ratio} ｜ {vid.createTime}</Text>
                        <Space size="mini">
                          <Button size="mini" type="text" icon={<IconCopy />} onClick={() => handleCopyScript(vid.scriptSummary)}>
                            脚本
                          </Button>
                          <Button size="mini" type="primary" icon={<IconDownload />}>
                            下载
                          </Button>
                        </Space>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            !generating && (
              <Card bordered style={{ borderRadius: 8, minHeight: 480, display: 'grid', placeItems: 'center' }}>
                <Empty
                  description={
                    <div style={{ maxWidth: 420 }}>
                      <Title heading={5} style={{ margin: '8px 0 4px 0' }}>暂无已生成的爆款短视频</Title>
                      <Paragraph type="secondary" style={{ fontSize: 13 }}>
                        在左侧选择视频类型矩阵、设定目标市场语言后点击「生成」，即可在此处获得包含分镜故事板的多条带货成片。
                      </Paragraph>
                    </div>
                  }
                />
              </Card>
            )
          )}
        </Col>
      </Row>

      {/* 视频播放 Modal */}
      <Modal
        title={previewVideo?.title || '视频播放预览'}
        visible={Boolean(previewVideo)}
        onCancel={() => setPreviewVideo(null)}
        footer={<Button type="primary" onClick={() => setPreviewVideo(null)}>关闭预览</Button>}
        style={{ width: 680 }}
      >
        {previewVideo && (
          <div>
            <video
              src={previewVideo.videoUrl}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: 420, borderRadius: 8, background: '#000' }}
            />
            <div style={{ marginTop: 12, background: 'var(--color-fill-2)', padding: 12, borderRadius: 6 }}>
              <Text bold style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>分镜脚本与旁白文案：</Text>
              <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--color-text-2)' }}>
                {previewVideo.scriptSummary}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
