import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Grid,
  Input,
  InputNumber,
  Message,
  Progress,
  Radio,
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
  IconClockCircle,
  IconCloseCircle,
  IconCopy,
  IconDelete,
  IconDownload,
  IconEmpty,
  IconEye,
  IconFile,
  IconFolder,
  IconHistory,
  IconLoading,
  IconPlayArrow,
  IconRefresh,
  IconSettings,
  IconStop,
  IconSync,
} from '@arco-design/web-react/icon'
import { useNavigate, useParams } from 'react-router-dom'
import { parseRpaProgress } from '../utils/rpaProgress'

const { Row, Col } = Grid

interface CollectionJobItem {
  id: string
  jobId: string
  type: string
  status: string
  pid?: number | null
  createdAt: string
  finishedAt: string | null
  errorMessage: string | null
  input?: Record<string, unknown>
}

interface CollectionStatus {
  jobId: string
  status: string
  type: string | null
  pid?: number | null
  runDir?: string
  logFile?: string
  logTail?: string
  input?: Record<string, unknown>
  createdAt: string
  finishedAt: string | null
  errorMessage: string | null
  resultJson: unknown
  stages: Array<{ status?: string; detail?: string }>
  sync: unknown[]
}

const PRESETS = [
  { label: '手表 300-500', productName: '手表', minPrice: 300, maxPrice: 500, topN: 100 },
  { label: '水平仪', productName: '水平仪', minPrice: undefined, maxPrice: undefined, topN: 100 },
  { label: '猫粮', productName: '猫粮', minPrice: undefined, maxPrice: undefined, topN: 100 },
  { label: '电脑', productName: '电脑', minPrice: undefined, maxPrice: undefined, topN: 100 },
]

const MODES = [
  { label: '下载并入库（推荐）', value: 'download-and-import' },
  { label: '仅下载不入库', value: 'download-only' },
  { label: '仅导入已有文件', value: 'import-only' },
]

const SPEED_PROFILES = [
  { label: '快速：更少等待，保留 20s 导出冷却', value: 'fast' },
  { label: '均衡：默认加速，保留安全冷却', value: 'balanced' },
  { label: '保守：更慢，风控更稳', value: 'conservative' },
]

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; statusBadge?: 'success' | 'processing' | 'error' | 'default' | 'warning' }
> = {
  running: { label: '运行中', color: 'arcoblue', statusBadge: 'processing' },
  collecting: { label: '采集中', color: 'arcoblue', statusBadge: 'processing' },
  uploading: { label: '同步中', color: 'cyan', statusBadge: 'processing' },
  queued: { label: '排队中', color: 'orange', statusBadge: 'warning' },
  success: { label: '已完成', color: 'green', statusBadge: 'success' },
  failure: { label: '执行失败', color: 'red', statusBadge: 'error' },
  cancelled: { label: '已停止', color: 'gray', statusBadge: 'default' },
  stopped: { label: '已停止', color: 'gray', statusBadge: 'default' },
}

export function DataDownloadPage() {
  const { id: routeJobId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(routeJobId)
  const [status, setStatus] = useState<CollectionStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyList, setHistoryList] = useState<CollectionJobItem[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [clearedTail, setClearedTail] = useState(false)
  const [probe, setProbe] = useState<{ python: string; hasDownloadScript: boolean; downloadScript: string } | null>(null)
  const [probing, setProbing] = useState(false)

  const logContainerRef = useRef<HTMLPreElement>(null)

  // 路由参数变化时同步选中任务
  useEffect(() => {
    setSelectedJobId(routeJobId)
  }, [routeJobId])

  // 刷新状态
  const refreshStatus = useCallback(async () => {
    if (!window.desktop?.collection) return
    try {
      const s = await window.desktop.collection.status(selectedJobId)
      setStatus(s)
    } catch {
      // 忽略轮询偶发报错
    }
  }, [selectedJobId])

  // 刷新历史列表
  const refreshHistory = useCallback(async () => {
    if (!window.desktop?.collection) return
    try {
      const list = await window.desktop.collection.list(30)
      setHistoryList(list)
    } catch {}
  }, [])

  const isRunning = status?.status === 'running' || status?.status === 'collecting'

  // 定时刷新状态
  useEffect(() => {
    void refreshStatus()
    const interval = isRunning ? 2000 : 6000
    const timer = setInterval(() => void refreshStatus(), interval)
    return () => clearInterval(timer)
  }, [refreshStatus, isRunning])

  // 自动滚动日志
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [status?.logTail, autoScroll, clearedTail])

  // 提取输入参数与解析进度
  const currentParams = useMemo(() => {
    const input = status?.input?.input as Record<string, unknown> | undefined
    const innerParams = (input?.params as Record<string, unknown> | undefined) || {}
    return {
      productName: (input?.productName as string) || (status?.input?.productName as string) || '',
      topN: (innerParams.topN as number) || (status?.input?.topN as number) || 100,
      searchPages: (innerParams.searchPages as number) || (status?.input?.searchPages as number) || 8,
      minPrice: innerParams.minPrice ?? status?.input?.minPrice,
      maxPrice: innerParams.maxPrice ?? status?.input?.maxPrice,
      speedProfile: (innerParams.speedProfile as string) || 'fast',
      importMysql: innerParams.importMysql !== false,
      mode: (status?.input?.mode as string) || 'download-and-import',
    }
  }, [status])

  const effectiveTopN = isRunning ? currentParams.topN : Number(form.getFieldValue('topN') || 100)
  const displayLog = clearedTail ? '' : status?.logTail || ''
  const progress = useMemo(() => parseRpaProgress(displayLog, effectiveTopN), [displayLog, effectiveTopN])

  // 启动采集
  const handleStart = async () => {
    const values = await form.validate()
    setStarting(true)
    setClearedTail(false)
    try {
      const res = await window.desktop?.collection.start({
        productName: values.productName,
        minPrice: values.minPrice,
        maxPrice: values.maxPrice,
        topN: values.topN,
        searchPages: values.searchPages,
        speedProfile: values.speedProfile,
        importMysql: values.importMysql,
        mode: values.mode,
        fake: Boolean(values.fake),
      })
      if (res?.jobId) {
        Message.success(`已成功启动采集任务：${res.jobId}`)
        setSelectedJobId(res.jobId)
        void refreshStatus()
        void refreshHistory()
      } else {
        Message.warning('未能启动任务')
      }
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '启动采集失败')
    } finally {
      setStarting(false)
    }
  }

  // 停止任务
  const handleStop = async () => {
    setStopping(true)
    try {
      const res = await window.desktop?.collection.cancel()
      if (res?.cancelled) {
        Message.info('采集任务已停止')
      } else {
        Message.warning(res?.reason || '停止请求未能执行')
      }
      await refreshStatus()
      await refreshHistory()
    } catch (err) {
      Message.error(err instanceof Error ? err.message : '停止任务失败')
    } finally {
      setStopping(false)
    }
  }

  // 快捷预设
  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    form.setFieldsValue({
      productName: preset.productName,
      minPrice: preset.minPrice,
      maxPrice: preset.maxPrice,
      topN: preset.topN,
    })
    Message.info(`已载入预设「${preset.label}」`)
  }

  // 复制文字工具
  const copyText = (text?: string, tip = '已复制到剪贴板') => {
    if (!text) return
    navigator.clipboard.writeText(text)
    Message.success(tip)
  }

  // 探测 Python 环境
  const handleProbe = async () => {
    setProbing(true)
    try {
      const res = await window.desktop?.collection.probe()
      setProbe(res || null)
      if (res?.hasDownloadScript) {
        Message.success('Python 与采集脚本环境就绪')
      } else {
        Message.warning('店透视采集脚本未就绪，可使用演示模式运行')
      }
    } catch {
      Message.error('环境探测失败')
    } finally {
      setProbing(false)
    }
  }

  const currentStatusConfig = STATUS_CONFIG[status?.status || ''] || {
    label: status?.status ? status.status : '未启动',
    color: 'default',
    statusBadge: 'default' as const,
  }

  // 历史任务表格列
  const historyColumns = [
    {
      title: '任务编号',
      dataIndex: 'jobId',
      render: (jobId: string) => (
        <Space>
          <Typography.Text copyable={{ orientation: 'right' }} style={{ fontSize: 12 }}>
            {jobId.replace('local-collection-', '')}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '商品',
      dataIndex: 'input',
      render: (input?: Record<string, unknown>) => {
        const pName = (input?.input as Record<string, unknown>)?.productName || input?.productName || '—'
        return <Typography.Text bold>{String(pName)}</Typography.Text>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (st: string) => {
        const conf = STATUS_CONFIG[st] || { label: st, color: 'default' }
        return <Tag color={conf.color}>{conf.label}</Tag>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (t: string) => (
        <span style={{ fontSize: 12, color: '#86909c' }}>
          {new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      ),
    },
    {
      title: '操作',
      render: (_: unknown, record: CollectionJobItem) => (
        <Button
          type="text"
          size="mini"
          icon={<IconEye />}
          onClick={() => {
            setSelectedJobId(record.jobId)
            navigate(`/data/downloads/${record.jobId}`)
            setHistoryOpen(false)
          }}
        >
          查看
        </Button>
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
              商品数据下载与采集
            </Typography.Title>
            <Tag color="arcoblue" icon={<IconDownload />}>
              店透视 RPA
            </Tag>
            {selectedJobId && (
              <Tag
                closable
                onClose={() => {
                  setSelectedJobId(undefined)
                  navigate('/data/downloads')
                }}
              >
                查看任务: {selectedJobId.replace('local-collection-', '')}
              </Tag>
            )}
          </Space>
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
            配置商品关键词与价格过滤，通过店透视 RPA 自动化下载竞品多维数据并支持自动入库。
          </Typography.Paragraph>
        </div>

        <Space>
          <Button
            icon={<IconHistory />}
            onClick={() => {
              void refreshHistory()
              setHistoryOpen(true)
            }}
          >
            任务历史记录
          </Button>
          <Button icon={<IconRefresh />} onClick={() => void refreshStatus()}>
            刷新状态
          </Button>
        </Space>
      </div>

      {/* 主体两栏布局 */}
      <Row gutter={20}>
        {/* 左侧配置栏 */}
        <Col span={10}>
          <Card
            title={
              <Space>
                <IconSettings />
                <span>任务配置</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}
          >
            {/* 预设快捷标签 */}
            <div style={{ marginBottom: 16 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                常用商品快捷预设：
              </Typography.Text>
              <Space wrap>
                {PRESETS.map((preset) => (
                  <Tag
                    key={preset.label}
                    color="blue"
                    style={{ cursor: 'pointer', borderRadius: 6 }}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.label}
                  </Tag>
                ))}
              </Space>
            </div>

            <Divider style={{ margin: '12px 0 16px 0' }} />

            <Form form={form} layout="vertical" initialValues={{ topN: 100, searchPages: 8, speedProfile: 'fast', mode: 'download-and-import', importMysql: true, fake: true }}>
              <Form.Item
                label="商品名称 / 搜索词"
                field="productName"
                rules={[{ required: true, message: '请输入商品名称' }]}
                extra="将作为淘系/店透视采集的主搜索词"
              >
                <Input placeholder="例如：手表、水平仪、猫粮" allowClear />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="最低价 (元)" field="minPrice">
                    <InputNumber placeholder="可为空" min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="最高价 (元)" field="maxPrice">
                    <InputNumber placeholder="可为空" min={0} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="下载 TopN" field="topN" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { label: 'Top 50', value: 50 },
                        { label: 'Top 100', value: 100 },
                        { label: 'Top 200', value: 200 },
                        { label: 'Top 500', value: 500 },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="搜索翻页数" field="searchPages" rules={[{ required: true }]}>
                    <InputNumber min={1} max={50} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="采集模式" field="mode">
                <Select options={MODES} />
              </Form.Item>

              <Form.Item label="下载速率档位" field="speedProfile">
                <Select options={SPEED_PROFILES} />
              </Form.Item>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e5e8ef',
                  borderRadius: 6,
                  padding: '12px 14px',
                  marginBottom: 16,
                }}
              >
                <Form.Item field="importMysql" style={{ marginBottom: 8 }}>
                  <Checkbox defaultChecked>下载完成后自动清洗并结构化入库</Checkbox>
                </Form.Item>
                <Form.Item field="fake" style={{ marginBottom: 0 }}>
                  <Checkbox defaultChecked>
                    <span style={{ color: '#165dff', fontWeight: 600 }}>演示模式（离线样本仿真，防封号推荐）</span>
                  </Checkbox>
                </Form.Item>
              </div>

              <Space style={{ width: '100%', marginTop: 8 }} size="medium">
                <Button
                  type="primary"
                  status="success"
                  size="large"
                  icon={<IconPlayArrow />}
                  loading={starting}
                  disabled={isRunning}
                  onClick={() => void handleStart()}
                  style={{ flex: 1 }}
                >
                  {isRunning ? '任务正在运行' : '启动采集脚本'}
                </Button>

                <Button
                  status="danger"
                  size="large"
                  icon={<IconStop />}
                  loading={stopping}
                  disabled={!isRunning}
                  onClick={() => void handleStop()}
                  style={{ minWidth: 100 }}
                >
                  停止
                </Button>
              </Space>
            </Form>

            {/* 环境探测小贴士 */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f2f3f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  采集执行环境探测
                </Typography.Text>
                <Button size="mini" type="text" loading={probing} icon={<IconSync />} onClick={() => void handleProbe()}>
                  探测 Python
                </Button>
              </div>
              {probe && (
                <div
                  style={{
                    background: '#f7f8fa',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#4e5969',
                    fontFamily: 'monospace',
                  }}
                >
                  <div>Python: {probe.python || '未检测到内嵌Python'}</div>
                  <div>采集脚本: {probe.hasDownloadScript ? '已就绪' : '缺失（可走演示模式）'}</div>
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* 右侧实时监控与暗黑终端栏 */}
        <Col span={14}>
          <Space direction="vertical" style={{ width: '100%' }} size="medium">
            {/* 任务状态卡片 */}
            <Card
              bordered={false}
              style={{ borderRadius: 8, boxShadow: '0 4px 16px rgba(29,38,52,0.06)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Space align="center">
                  <Badge status={currentStatusConfig.statusBadge} />
                  <Typography.Title heading={6} style={{ margin: 0 }}>
                    任务状态：{currentStatusConfig.label}
                  </Typography.Title>
                  <Tag color={currentStatusConfig.color}>{currentStatusConfig.label}</Tag>
                  {status?.pid && <Tag color="gray">PID {status.pid}</Tag>}
                </Space>

                {status?.jobId && (
                  <Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {status.createdAt ? `启动于 ${new Date(status.createdAt).toLocaleTimeString()}` : ''}
                    </Typography.Text>
                    <Tooltip content="复制任务编号">
                      <Button
                        size="mini"
                        type="text"
                        icon={<IconCopy />}
                        onClick={() => copyText(status.jobId, '任务编号已复制')}
                      />
                    </Tooltip>
                  </Space>
                )}
              </div>

              {/* 核心指标看板 */}
              <Row gutter={12} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #edf1f6' }}>
                    <div style={{ fontSize: 12, color: '#86909c', marginBottom: 2 }}>目标商品</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1d2129' }} className="truncate">
                      {currentParams.productName || '—'}
                    </div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #edf1f6' }}>
                    <div style={{ fontSize: 12, color: '#86909c', marginBottom: 2 }}>价格区间</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1d2129' }}>
                      {currentParams.minPrice ?? '—'} ~ {currentParams.maxPrice ?? '—'} 元
                    </div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #edf1f6' }}>
                    <div style={{ fontSize: 12, color: '#86909c', marginBottom: 2 }}>TopN / 页数</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1d2129' }}>
                      Top {currentParams.topN} / {currentParams.searchPages} 页
                    </div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #edf1f6' }}>
                    <div style={{ fontSize: 12, color: '#86909c', marginBottom: 2 }}>当前阶段</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#165dff' }}>{progress.label}</div>
                  </div>
                </Col>
              </Row>

              {/* 进度指示条 */}
              <div
                style={{
                  background: '#f8fafc',
                  padding: '12px 14px',
                  borderRadius: 6,
                  border: '1px solid #edf1f6',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Typography.Text bold style={{ fontSize: 13, color: '#1d2129' }}>
                    {progress.detail}
                  </Typography.Text>
                  <Tag color="arcoblue">{progress.label}</Tag>
                </div>
                <Progress
                  percent={progress.percent ?? (isRunning ? 15 : 0)}
                  status={status?.status === 'failure' ? 'error' : progress.percent === 100 ? 'success' : 'active'}
                  animation
                />
              </div>

              {/* 工作目录 */}
              {status?.runDir && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #edf1f6',
                    fontSize: 12,
                    color: '#4e5969',
                  }}
                >
                  <Space size="small">
                    <IconFolder style={{ color: '#165dff' }} />
                    <span style={{ fontWeight: 600 }}>运行目录:</span>
                    <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{status.runDir}</span>
                  </Space>
                  <Button
                    size="mini"
                    type="text"
                    icon={<IconCopy />}
                    onClick={() => copyText(status.runDir, '运行目录已复制')}
                  >
                    复制路径
                  </Button>
                </div>
              )}
            </Card>

            {/* 暗黑终端实时日志窗口 */}
            <div
              style={{
                background: '#0b1220',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(29,38,52,0.12)',
                border: '1px solid #202938',
              }}
            >
              {/* 终端顶部栏 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#111927',
                  padding: '10px 16px',
                  borderBottom: '1px solid #202938',
                }}
              >
                <Space align="center">
                  <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                  </div>
                  <Typography.Text bold style={{ color: '#fff', fontSize: 13 }}>
                    实时控制台日志 (run.log)
                  </Typography.Text>
                  {status?.logFile && (
                    <Typography.Text type="secondary" style={{ color: '#64748b', fontSize: 11 }}>
                      {status.logFile}
                    </Typography.Text>
                  )}
                </Space>

                <Space size="small">
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>自动滚动</span>
                  <Switch size="small" checked={autoScroll} onChange={setAutoScroll} />
                  <Button
                    size="mini"
                    type="text"
                    icon={<IconDelete />}
                    style={{ color: '#94a3b8' }}
                    onClick={() => setClearedTail(true)}
                  >
                    清屏
                  </Button>
                  <Button
                    size="mini"
                    type="text"
                    icon={<IconRefresh />}
                    style={{ color: '#94a3b8' }}
                    onClick={() => {
                      setClearedTail(false)
                      void refreshStatus()
                    }}
                  >
                    刷新
                  </Button>
                  <Button
                    size="mini"
                    type="text"
                    icon={<IconCopy />}
                    style={{ color: '#94a3b8' }}
                    onClick={() => copyText(status?.logTail, '终端日志已复制')}
                  >
                    复制
                  </Button>
                </Space>
              </div>

              {/* 终端日志内容 */}
              <pre
                ref={logContainerRef}
                style={{
                  height: 440,
                  margin: 0,
                  padding: '16px',
                  overflowY: 'auto',
                  fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
                  fontSize: 12,
                  lineHeight: '20px',
                  color: '#93c5fd',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {displayLog || (
                  <span style={{ color: '#64748b' }}>
                    暂无日志输出。点击左侧「启动采集脚本」后，这里将实时输出 RPA 与数据入库的完整执行流。
                  </span>
                )}
              </pre>
            </div>
          </Space>
        </Col>
      </Row>

      {/* 历史采集任务抽屉 */}
      <Drawer
        title="采集任务历史记录 (最近30条)"
        visible={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        width={680}
        footer={null}
      >
        <Table
          columns={historyColumns}
          data={historyList}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          size="small"
        />
      </Drawer>
    </div>
  )
}