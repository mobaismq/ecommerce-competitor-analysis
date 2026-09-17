import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Checkbox, Form, Input, Message, Progress, Select, Space, Typography } from '@arco-design/web-react'
import { useParams } from 'react-router-dom'

interface CollectionStatus {
  jobId: string
  status: string
  type: string | null
  createdAt: string
  finishedAt: string | null
  errorMessage: string | null
  resultJson: unknown
}

const MODES = [
  { label: '下载并入库', value: 'download-and-import' },
  { label: '仅下载不入库', value: 'download-only' },
  { label: '仅导入已有文件', value: 'import-only' },
]

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中',
  collecting: '采集中',
  uploading: '上传中',
  success: '已完成',
  failure: '失败',
  cancelled: '已取消',
  running: '执行中',
}

export function DataDownloadPage() {
  const { id } = useParams<{ id: string }>()
  const [form] = Form.useForm()
  const [status, setStatus] = useState<CollectionStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [probe, setProbe] = useState<{ python: string; hasDownloadScript: boolean; downloadScript: string } | null>(null)

  const refresh = useCallback(async () => {
    if (!window.desktop?.collection) {
      setStatus(null)
      return
    }
    const s = await window.desktop.collection.status(id)
    setStatus(s)
  }, [id])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 2000)
    return () => clearInterval(timer)
  }, [refresh])

  const start = async () => {
    const v = await form.validate()
    setStarting(true)
    try {
      const r = await window.desktop?.collection.start({ productName: v.productName, mode: v.mode, fake: Boolean(v.fake) })
      Message.success(r ? `已启动采集任务：${r.jobId}` : '启动失败')
      await refresh()
    } catch {
      Message.error('启动失败')
    } finally {
      setStarting(false)
    }
  }
  const cancel = async () => {
    const r = await window.desktop?.collection.cancel()
    Message.info(r?.reason ?? '已发送取消')
    await refresh()
  }

  if (!window.desktop?.collection) {
    return <div className="page"><Card title="数据下载"><Typography.Text type="secondary">当前不在桌面端环境，数据下载需在桌面客户端内使用。</Typography.Text></Card></div>
  }

  const statusText = status ? STATUS_LABEL[status.status] ?? status.status : '—'

  return (
    <div className="page">
      <Card title="数据下载（店透视 RPA 采集）" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" style={{ maxWidth: 520 }}>
          <Form.Item label="商品名称 / 关键词" field="productName" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="例如：无线蓝牙耳机" />
          </Form.Item>
          <Form.Item label="采集模式" field="mode" initialValue="download-and-import">
            <Select options={MODES} />
          </Form.Item>
          <Form.Item field="fake" initialValue={true}>
            <Checkbox>演示模式（不触发真实店透视采集，本地演示）</Checkbox>
          </Form.Item>
          <Space>
            <Button type="primary" loading={starting} onClick={() => void start()}>启动采集</Button>
            <Button status="danger" onClick={() => void cancel()}>停止</Button>
            <Button onClick={() => void refresh()}>刷新</Button>
          </Space>
        </Form>
      </Card>

      <Card title="任务状态" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>任务：{status?.jobId ?? '—'} ｜ 状态：<strong>{statusText}</strong></Typography.Text>
          {status?.status === 'collecting' && <Progress percent={45} status="active" text="采集中" />}
          {status?.errorMessage && <Typography.Text type="danger">{status.errorMessage}</Typography.Text>}
          {status?.resultJson && (
            <pre style={{ fontSize: 12, maxHeight: 160, overflow: 'auto', background: '#f6f8fa', padding: 8, borderRadius: 6 }}>
              {JSON.stringify(status.resultJson, null, 2)}
            </pre>
          )}
        </Space>
      </Card>

      <Card title="环境探测">
        <Button size="small" onClick={async () => setProbe(await window.desktop?.collection.probe())}>探测 Python/脚本</Button>
        {probe && (
          <pre style={{ fontSize: 12, marginTop: 8, background: '#f6f8fa', padding: 8, borderRadius: 6 }}>
            {JSON.stringify(probe, null, 2)}
          </pre>
        )}
      </Card>
    </div>
  )
}