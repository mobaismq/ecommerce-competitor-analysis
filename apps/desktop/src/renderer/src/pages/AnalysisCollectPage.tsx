import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Form,
  Grid,
  Input,
  InputNumber,
  Message,
  Progress,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from '@arco-design/web-react'
import {
  IconArrowRight,
  IconCheckCircleFill,
  IconClockCircle,
  IconCloseCircleFill,
  IconCode,
  IconCopy,
  IconDelete,
  IconPlayArrow,
  IconRefresh,
  IconStop,
  IconThunderbolt,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'
import { parseRpaProgress } from '../utils/rpaProgress'

const { Title, Text, Paragraph } = Typography
const { Row, Col } = Grid

type CollectionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped'

interface PresetItem {
  label: string
  keyword: string
  minPrice?: number
  maxPrice?: number
  count: number
}

const PRESETS: PresetItem[] = [
  { label: '智能手表 300-500', keyword: '智能手表', minPrice: 300, maxPrice: 500, count: 20 },
  { label: '蓝牙耳机', keyword: '蓝牙耳机', minPrice: 50, maxPrice: 300, count: 30 },
  { label: '猫粮', keyword: '猫粮', minPrice: 80, maxPrice: 300, count: 20 },
  { label: '冲锋衣', keyword: '冲锋衣', minPrice: 200, maxPrice: 800, count: 20 },
]

export function AnalysisCollectPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  // 状态控制
  const [status, setStatus] = useState<CollectionStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [jobId, setJobId] = useState<string>('')
  const [pid, setPid] = useState<number | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // 运行参数记录
  const [activeParams, setActiveParams] = useState<{
    keyword: string
    minPrice?: number
    maxPrice?: number
    competitorCount: number
    autoParse: boolean
  } | null>(null)

  const logContainerRef = useRef<HTMLPreElement | null>(null)
  const demoTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 基于日志与目标数量计算解析进度
  const parsedProgress = useMemo(() => {
    return parseRpaProgress(logs, activeParams?.competitorCount || 20)
  }, [logs, activeParams?.competitorCount])

  const total = parsedProgress.total || activeParams?.competitorCount || 20
  const collected = parsedProgress.current ?? (status === 'completed' ? total : 0)
  const percent =
    parsedProgress.percent ??
    (total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0)

  // 自动滚动控制台
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // 轮询刷新状态与日志 (当非 demoMode 且处于 running 时)
  useEffect(() => {
    if (demoMode || status !== 'running' || !jobId) return

    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/jobs/${jobId}`)
        if (data) {
          if (data.status === 'success' || data.status === 'completed') {
            setStatus('completed')
            setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ✅ 采集任务已成功完成并入库！`)
          } else if (data.status === 'failure' || data.status === 'failed') {
            setStatus('failed')
            setErrorMessage(data.errorMessage || '采集任务执行失败')
            setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ❌ 任务执行失败: ${data.errorMessage || '未知错误'}`)
          }
        }
      } catch {
        // 忽略网络抖动
      }
    }, 3000)

    return () => clearInterval(timer)
  }, [demoMode, status, jobId])

  // 清理 demo 定时器
  useEffect(() => {
    return () => {
      if (demoTimerRef.current) clearInterval(demoTimerRef.current)
    }
  }, [])

  // 快速套用预设
  const applyPreset = (preset: PresetItem) => {
    form.setFieldsValue({
      keyword: preset.keyword,
      minPrice: preset.minPrice,
      maxPrice: preset.maxPrice,
      competitorCount: preset.count,
    })
    Message.info(`已套用预设「${preset.label}」`)
  }

  // 启动采集
  const handleStart = async () => {
    try {
      const values = await form.validate()
      setErrorMessage('')
      setLoading(true)

      const targetCount = Number(values.competitorCount) || 20
      const newParams = {
        keyword: String(values.keyword).trim(),
        minPrice: values.minPrice !== undefined && values.minPrice !== null ? Number(values.minPrice) : undefined,
        maxPrice: values.maxPrice !== undefined && values.maxPrice !== null ? Number(values.maxPrice) : undefined,
        competitorCount: targetCount,
        autoParse: values.autoParse !== false,
      }
      setActiveParams(newParams)

      const nowStr = new Date().toLocaleTimeString()
      const initLog = `[${nowStr}] 🚀 正在启动竞品数据采集任务...\n[${nowStr}] 目标关键词: ${newParams.keyword} | 计划采集数: ${targetCount} | 价格区间: ${newParams.minPrice ?? '不限'} ~ ${newParams.maxPrice ?? '不限'}\n`
      setLogs(initLog)
      setStatus('running')

      if (demoMode) {
        // 演示模式：模拟采集流式日志与进度推进，避免高频请求触发爬虫风控
        const generatedJobId = `job_demo_${Date.now().toString(36)}`
        setJobId(generatedJobId)
        setPid(Math.floor(10000 + Math.random() * 80000))
        setLoading(false)

        let step = 0
        if (demoTimerRef.current) clearInterval(demoTimerRef.current)
        demoTimerRef.current = setInterval(() => {
          step += 1
          const time = new Date().toLocaleTimeString()
          if (step <= targetCount) {
            setLogs(
              (prev) =>
                prev +
                `[${time}] === batch item ${step}/${targetCount} 抓取竞品商品ID: p_${1000 + step} | 标题: ${newParams.keyword}热销款 #${step} | 售价: ¥${((newParams.minPrice || 100) + Math.random() * 50).toFixed(2)}\n`,
            )
          } else if (step === targetCount + 1) {
            setLogs((prev) => prev + `[${time}] === batch summary 采集完毕，开始生成特征快照与图片本地化...\n`)
          } else if (step === targetCount + 2) {
            setLogs((prev) => prev + `[${time}] === mysql import 正在写入竞品主图、SKU及问大家数据集...\n`)
          } else {
            if (demoTimerRef.current) clearInterval(demoTimerRef.current)
            setLogs((prev) => prev + `[${time}] === market analysis 采集完成！全部 ${targetCount} 个竞品已入库。\n`)
            setStatus('completed')
            Message.success('演示模式采集已圆满完成！')
          }
        }, 600)
        return
      }

      // 真实服务端模式
      try {
        const { data } = await api.post('/api/jobs', {
          type: 'analysis',
          keyword: newParams.keyword,
          storeId: values.storeId || 'default',
          analysisType: 'market',
          minPrice: newParams.minPrice,
          maxPrice: newParams.maxPrice,
          topN: targetCount,
          searchPages: values.searchPages || 8,
          autoParse: newParams.autoParse,
        })
        const nextJobId = data.jobId || data.id || `job_${Date.now().toString(36)}`
        setJobId(nextJobId)
        setPid(data.pid || null)
        setLogs((prev) => prev + `[${new Date().toLocaleTimeString()}] ✅ 任务创建成功，Job ID: ${nextJobId}\n[${new Date().toLocaleTimeString()}] 正在等待 Worker 进程分配调度...\n`)
        Message.success('采集任务已启动')
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '创建任务失败，建议开启「离线演示模式」验证'
        setErrorMessage(msg)
        setStatus('failed')
        setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ❌ 接口调用异常: ${msg}\n`)
      } finally {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  // 停止采集
  const handleStop = async () => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current)
      demoTimerRef.current = null
    }
    setStatus('stopped')
    setLogs((prev) => prev + `\n[${new Date().toLocaleTimeString()}] ⚠️ 用户手动停止了当前采集任务。`)
    Message.warning('采集任务已停止')
  }

  // 复制日志
  const handleCopyLogs = () => {
    if (!logs) {
      Message.warning('暂无日志可复制')
      return
    }
    navigator.clipboard.writeText(logs)
    Message.success('日志已复制到剪贴板')
  }

  // 状态显示配置
  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return <Badge status="processing" text="采集中" />
      case 'completed':
        return <Badge status="success" text="采集完成" />
      case 'failed':
        return <Badge status="error" text="执行失败" />
      case 'stopped':
        return <Badge status="default" text="已停止" />
      default:
        return <Badge status="default" text="就绪待发" />
    }
  }

  return (
    <div className="page" style={{ padding: '20px 24px' }}>
      {/* 顶部标题区 */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title heading={4} style={{ margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>AI 数据采集工作台</span>
            <Tag color="arcoblue" icon={<IconThunderbolt />}>RPA 自动化</Tag>
            {demoMode && <Tag color="orange">离线演示模式</Tag>}
          </Title>
          <Text type="secondary">
            针对电商平台进行竞品深度检索，自动抓取商品详情、SKU 规格、主图切片并清洗入库，为市场报告提供数据基石。
          </Text>
        </div>
        <Space>
          <Switch
            checked={demoMode}
            onChange={(checked) => setDemoMode(checked)}
            checkedText="演示"
            uncheckedText="实时"
          />
          <Tooltip content="开启演示模式可在无爬虫代理或测试环境下模拟完整流程，避免账号封禁">
            <Text type="secondary" style={{ fontSize: 13, cursor: 'help' }}>演示模式说明</Text>
          </Tooltip>
        </Space>
      </div>

      <Row gutter={20}>
        {/* 左侧：采集配置面板 */}
        <Col span={10}>
          <Card
            title={
              <Space>
                <IconThunderbolt style={{ color: '#165dff' }} />
                <span style={{ fontWeight: 600 }}>采集条件配置</span>
              </Space>
            }
            extra={
              <Button
                size="mini"
                type="text"
                onClick={() => {
                  form.resetFields()
                  setStatus('idle')
                  setLogs('')
                  setActiveParams(null)
                }}
              >
                重置表单
              </Button>
            }
            bordered
            style={{ borderRadius: 8 }}
          >
            {/* 预设快捷选区 */}
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                推荐预设行业关键词：
              </Text>
              <Space wrap size={[8, 8]}>
                {PRESETS.map((preset) => (
                  <Tag
                    key={preset.label}
                    color="gray"
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.label}
                  </Tag>
                ))}
              </Space>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            <Form
              form={form}
              layout="vertical"
              initialValues={{
                keyword: '智能手表',
                competitorCount: 20,
                searchPages: 8,
                autoParse: true,
              }}
            >
              <Form.Item
                label="竞品关键词"
                field="keyword"
                rules={[{ required: true, message: '请输入要采集的商品关键词' }]}
                help="关键词将直接用于平台搜索检索"
              >
                <Input
                  placeholder="例如：智能手表、颈椎按摩仪"
                  allowClear
                  disabled={status === 'running'}
                />
              </Form.Item>

              <Form.Item label="价格区间筛选（可选）">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Form.Item field="minPrice" noStyle>
                    <InputNumber
                      placeholder="最低价 ¥"
                      min={0}
                      precision={2}
                      style={{ flex: 1 }}
                      disabled={status === 'running'}
                    />
                  </Form.Item>
                  <span style={{ color: 'var(--color-text-3)' }}>—</span>
                  <Form.Item field="maxPrice" noStyle>
                    <InputNumber
                      placeholder="最高价 ¥"
                      min={0}
                      precision={2}
                      style={{ flex: 1 }}
                      disabled={status === 'running'}
                    />
                  </Form.Item>
                </div>
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    label="采集数量 (Top N)"
                    field="competitorCount"
                    rules={[{ required: true, message: '请输入采集数量' }]}
                  >
                    <InputNumber
                      min={1}
                      max={100}
                      style={{ width: '100%' }}
                      disabled={status === 'running'}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="搜索翻页深度" field="searchPages">
                    <InputNumber
                      min={1}
                      max={20}
                      style={{ width: '100%' }}
                      disabled={status === 'running'}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="自动入库与切片处理"
                field="autoParse"
                tooltip="自动清洗并持久化写入 MySQL，同步解析主图、SKU 及问大家数据"
              >
                <Switch defaultChecked disabled={status === 'running'} />
              </Form.Item>

              {errorMessage && (
                <Alert
                  type="error"
                  content={errorMessage}
                  style={{ marginBottom: 16 }}
                  closable
                  onClose={() => setErrorMessage('')}
                />
              )}

              <Space style={{ width: '100%', marginTop: 8 }}>
                <Button
                  type="primary"
                  icon={<IconPlayArrow />}
                  loading={loading || status === 'running'}
                  disabled={status === 'running'}
                  onClick={handleStart}
                  style={{ flex: 1 }}
                  size="large"
                >
                  {status === 'running' ? '正在采集...' : '开始采集任务'}
                </Button>
                <Button
                  type="outline"
                  status="danger"
                  icon={<IconStop />}
                  disabled={status !== 'running'}
                  onClick={handleStop}
                  size="large"
                >
                  停止
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>

        {/* 右侧：监控、进度指示与暗黑代码控制台 */}
        <Col span={14}>
          {/* 实时监控仪表盘 */}
          <Card
            title={
              <Space>
                <IconCode style={{ color: '#00b42a' }} />
                <span style={{ fontWeight: 600 }}>任务监控看板</span>
              </Space>
            }
            extra={getStatusBadge()}
            bordered
            style={{ borderRadius: 8, marginBottom: 16 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--color-fill-2)', padding: '10px 14px', borderRadius: 6 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>关键词</Text>
                <Text bold style={{ fontSize: 14 }}>
                  {activeParams?.keyword ? <Tag color="arcoblue">{activeParams.keyword}</Tag> : '未设定'}
                </Text>
              </div>
              <div style={{ background: 'var(--color-fill-2)', padding: '10px 14px', borderRadius: 6 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>采集进度</Text>
                <Text bold style={{ fontSize: 16, color: '#165dff' }}>
                  {collected} <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>/ {total}</span>
                </Text>
              </div>
              <div style={{ background: 'var(--color-fill-2)', padding: '10px 14px', borderRadius: 6 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>当前阶段</Text>
                <Text bold style={{ fontSize: 13, color: '#00b42a' }}>
                  {status === 'running' ? parsedProgress.label || '正在抓取' : status === 'completed' ? '已完成' : '待机就绪'}
                </Text>
              </div>
              <div style={{ background: 'var(--color-fill-2)', padding: '10px 14px', borderRadius: 6 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>任务标识</Text>
                <Text bold style={{ fontSize: 13, fontFamily: 'monospace' }}>
                  {jobId ? jobId.slice(0, 12) : pid ? `PID: ${pid}` : '-'}
                </Text>
              </div>
            </div>

            {/* 动态进度条 */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12 }}>{parsedProgress.detail || '准备采集任务数据'}</Text>
                <Text bold style={{ fontSize: 13, color: '#165dff' }}>{percent}%</Text>
              </div>
              <Progress
                percent={percent}
                status={status === 'failed' ? 'error' : status === 'completed' ? 'success' : 'normal'}
                animation={status === 'running'}
                color="#165dff"
              />
            </div>
          </Card>

          {/* 任务完成后的下一步引导 */}
          {status === 'completed' && (
            <Alert
              type="success"
              style={{ marginBottom: 16 }}
              icon={<IconCheckCircleFill />}
              title="竞品数据采集与切片入库已完成！"
              content={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span>已成功获取并清洗入库 {collected} 个竞品数据集，可直接开启价格带测算与大模型报告分析。</span>
                  <Button
                    type="primary"
                    size="small"
                    icon={<IconArrowRight />}
                    onClick={() => {
                      const kw = activeParams?.keyword || ''
                      navigate(`/analysis/market-reports?keyword=${encodeURIComponent(kw)}`)
                    }}
                  >
                    前往生成市场报告
                  </Button>
                </div>
              }
            />
          )}

          {/* 暗黑代码控制台终端 */}
          <Card
            title={
              <Space>
                <IconCode />
                <span style={{ fontWeight: 600 }}>运行控制台输出（Console Terminal）</span>
              </Space>
            }
            extra={
              <Space size="mini">
                <Switch
                  size="small"
                  checked={autoScroll}
                  onChange={setAutoScroll}
                  checkedText="滚屏"
                  uncheckedText="固定"
                />
                <Button size="mini" type="text" icon={<IconCopy />} onClick={handleCopyLogs}>
                  复制
                </Button>
                <Button
                  size="mini"
                  type="text"
                  icon={<IconDelete />}
                  onClick={() => setLogs('')}
                >
                  清屏
                </Button>
              </Space>
            }
            bordered
            bodyStyle={{ padding: 0 }}
            style={{ borderRadius: 8, overflow: 'hidden' }}
          >
            <pre
              ref={logContainerRef}
              style={{
                margin: 0,
                padding: 16,
                background: '#0d1117',
                color: '#58a6ff',
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                fontSize: 12,
                lineHeight: 1.6,
                minHeight: 280,
                maxHeight: 420,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {logs ||
                `> 终端就绪。配置左侧条件后点击「开始采集任务」，即可在此处实时查看运行进程日志与商品流水。`}
            </pre>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
