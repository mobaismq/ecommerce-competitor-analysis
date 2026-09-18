import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
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
import { nanoid } from 'nanoid'

const { Title, Text, Paragraph } = Typography

type CollectionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped'

interface PresetItem {
  label: string
  keyword: string
  minPrice?: number
  maxPrice?: number
  count: number
}

const PRESETS: PresetItem[] = [
  { label: '智能手表', keyword: '智能手表', minPrice: 300, maxPrice: 500, count: 20 },
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

  const total = activeParams?.competitorCount || 20
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
        const generatedJobId = `job_demo_${nanoid(10)}`
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
        }, 500)
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
        const nextJobId = data.jobId || data.id || `job_${nanoid(10)}`
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

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#f4f7fb]">
      {/* 顶部标题区 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 m-0 flex items-center gap-2">
            <span>AI 数据采集</span>
            <Tag color="arcoblue" icon={<IconThunderbolt />}>RPA 自动化</Tag>
            {demoMode && <Tag color="orange">离线演示模式</Tag>}
          </h1>
          <p className="text-xs text-gray-500 mt-1 mb-0">
            根据关键词与筛选条件自动化爬取电商平台竞品数据，清洗入库并生成分析特征
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={demoMode}
            onChange={(checked) => setDemoMode(checked)}
            checkedText="演示"
            uncheckedText="实时"
          />
          <Tooltip content="开启演示模式可在离线环境模拟完整数据流，防止触发平台风控">
            <span className="text-xs text-gray-400 cursor-help">离线演示模式</span>
          </Tooltip>
        </div>
      </div>

      {/* 左右并排双卡片 (模式 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ─── 左卡片：采集条件 ─── */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">采集条件</span>
            </div>
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
              重置
            </Button>
          }
          bordered
          className="rounded-lg shadow-sm bg-white"
        >
          {/* 预设快捷选区 */}
          <div className="mb-4">
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              快捷热门行业关键词：
            </Text>
            <Space wrap size={[6, 6]}>
              {PRESETS.map((preset) => (
                <Tag
                  key={preset.label}
                  color="gray"
                  style={{ cursor: 'pointer', userSelect: 'none', borderRadius: 4 }}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </Tag>
              ))}
            </Space>
          </div>

          <Divider style={{ margin: '12px 0 16px 0' }} />

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
              rules={[{ required: true, message: '请输入竞品关键词' }]}
            >
              <Input
                placeholder="如：手机支架、蓝牙耳机、智能手表"
                allowClear
                disabled={status === 'running'}
                size="large"
              />
            </Form.Item>

            <Form.Item label="价格区间 (元)">
              <div className="flex items-center gap-2">
                <Form.Item field="minPrice" noStyle>
                  <InputNumber
                    placeholder="最低价 ¥"
                    min={0}
                    precision={2}
                    className="flex-1"
                    disabled={status === 'running'}
                  />
                </Form.Item>
                <span className="text-gray-400 font-medium">—</span>
                <Form.Item field="maxPrice" noStyle>
                  <InputNumber
                    placeholder="最高价 ¥"
                    min={0}
                    precision={2}
                    className="flex-1"
                    disabled={status === 'running'}
                  />
                </Form.Item>
              </div>
            </Form.Item>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label="竞品数量 (Top N)"
                field="competitorCount"
                rules={[{ required: true, message: '请输入采集数量' }]}
                help="限制 1 ~ 100 件商品"
              >
                <InputNumber
                  min={1}
                  max={100}
                  className="w-full"
                  disabled={status === 'running'}
                />
              </Form.Item>

              <Form.Item label="翻页深度 (页数)" field="searchPages" help="默认检索前 8 页">
                <InputNumber
                  min={1}
                  max={20}
                  className="w-full"
                  disabled={status === 'running'}
                />
              </Form.Item>
            </div>

            <Form.Item field="autoParse">
              <Checkbox defaultChecked disabled={status === 'running'}>
                <span className="text-xs text-gray-700">竞品数据采集后自动入库并保存图片</span>
              </Checkbox>
            </Form.Item>

            {errorMessage && (
              <Alert
                type="error"
                content={errorMessage}
                className="mb-4"
                closable
                onClose={() => setErrorMessage('')}
              />
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="primary"
                icon={<IconPlayArrow />}
                loading={loading || status === 'running'}
                disabled={status === 'running'}
                onClick={handleStart}
                className="flex-1"
                size="large"
                style={{ height: 40, borderRadius: 6 }}
              >
                {status === 'running' ? '正在采集中...' : '开始采集'}
              </Button>
              <Button
                type="outline"
                status="danger"
                icon={<IconStop />}
                disabled={status !== 'running'}
                onClick={handleStop}
                size="large"
                style={{ width: 100, height: 40, borderRadius: 6 }}
              >
                停止
              </Button>
            </div>
          </Form>
        </Card>

        {/* ─── 右卡片：采集进度 ─── */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">采集进度</span>
            </div>
          }
          extra={
            <div>
              {status === 'running' ? (
                <Badge status="processing" text="采集中" />
              ) : status === 'completed' ? (
                <Badge status="success" text="已完成" />
              ) : status === 'failed' ? (
                <Badge status="error" text="失败" />
              ) : status === 'stopped' ? (
                <Badge status="default" text="已停止" />
              ) : (
                <Badge status="default" text="待开始" />
              )}
            </div>
          }
          bordered
          className="rounded-lg shadow-sm bg-white"
        >
          {/* 顶部指标与进度条 (严格对照截图 2) */}
          <div className="mb-5 bg-[#fafafa] p-4 rounded-lg border border-gray-100">
            <div className="flex justify-between items-baseline mb-2">
              <div>
                <span className="text-2xl font-bold text-gray-900 font-mono">
                  {status === 'idle' ? '0 / -' : `${collected} / ${total}`}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {activeParams?.keyword ? `[${activeParams.keyword}]` : ''}
                </span>
              </div>
              <div className="text-base font-bold text-[#165dff] font-mono">
                {percent}%
              </div>
            </div>

            <Progress
              percent={percent}
              status={status === 'failed' ? 'error' : status === 'completed' ? 'success' : 'normal'}
              animation={status === 'running'}
              color="#165dff"
              size="small"
              showText={false}
            />

            <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
              <span>{parsedProgress.label || (status === 'running' ? '正在连接平台并解析商品流水...' : '等待执行')}</span>
              <span>{jobId ? `任务ID: ${jobId.slice(0, 10)}` : '空闲中'}</span>
            </div>
          </div>

          {/* 下部：「>_ 进度流」控制台黑框 (严格对照截图 2) */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <IconCode style={{ fontSize: 13, color: '#165dff' }} />
                <span>&gt;_ 进度流</span>
              </span>
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
                <Button size="mini" type="text" icon={<IconDelete />} onClick={() => setLogs('')}>
                  清空
                </Button>
              </Space>
            </div>

            <pre
              ref={logContainerRef}
              className="m-0 p-3 bg-[#13161a] text-[#58a6ff] rounded-lg font-mono text-xs leading-relaxed border border-gray-800 shadow-inner overflow-y-auto"
              style={{
                minHeight: 240,
                maxHeight: 320,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {logs ||
                `> 终端就绪。\n> 在左侧配置条件后点击「开始采集」，在此处查看实时采集日志与商品流水。`}
            </pre>
          </div>

          {/* 任务完成引导条 */}
          {status === 'completed' && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
              <span className="text-xs text-green-800 font-medium flex items-center gap-1.5">
                <IconCheckCircleFill className="text-green-600" />
                已成功抓取并入库 {collected} 件竞品数据！
              </span>
              <Button
                type="primary"
                size="mini"
                icon={<IconArrowRight />}
                onClick={() => {
                  const kw = activeParams?.keyword || ''
                  navigate(`/market/competitive/report?keyword=${encodeURIComponent(kw)}`)
                }}
              >
                生成市场报告
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
