import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Message, Select, Switch } from '@arco-design/web-react'
import { api } from '../api/client'

const PROVIDER_TYPES = ['mock', 'ark', 'openrouter', 'openai-compatible']

interface SelfConfig {
  selfEnabled: boolean
  providerType: string | null
  baseUrl: string | null
  apiKeyConfigured: boolean
  model: string | null
  timeoutMs: number | null
  hasDefaultProvider: boolean
  usingDefault: boolean
}

export function AiConfigPage() {
  const [cfg, setCfg] = useState<SelfConfig | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [providerType, setProviderType] = useState('openai-compatible')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [timeoutMs, setTimeoutMs] = useState('120000')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api.get<SelfConfig>('/api/ai/self-config').then(({ data }) => {
      setCfg(data)
      setEnabled(data.selfEnabled)
      if (data.providerType) setProviderType(data.providerType)
      if (data.baseUrl) setBaseUrl(data.baseUrl)
      if (data.model) setModel(data.model)
      if (data.timeoutMs) setTimeoutMs(String(data.timeoutMs))
    })
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.put<SelfConfig>('/api/ai/self-config', {
        enabled,
        providerType,
        baseUrl: baseUrl || undefined,
        apiKey: apiKey || undefined,
        model: model || undefined,
        timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
      })
      setCfg(data)
      setApiKey('')
      Message.success('AI 配置已保存')
    } catch {
      Message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const needReminder = cfg ? !cfg.selfEnabled && !cfg.hasDefaultProvider : false

  return (
    <section className="panel" style={{ maxWidth: 640 }}>
      <h2>AI 供应商配置（个人自配）</h2>
      <p className="muted">
        优先级：个人自配 &gt; 组织的 AI 供应商 &gt; 系统默认。未配置时沿用默认；若无默认可用，需先在此页配置。
      </p>

      {needReminder && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} content="当前未配置个人 AI Key，且系统无默认供应商可用。为避免 AI 功能不可用，请先在下方向体验并配置 Key。" />
      )}

      <Form layout="vertical" style={{ marginTop: 8 }}>
        <Form.Item label="启用个人自配">
          <Switch checked={enabled} onChange={setEnabled} checkedText="开" uncheckedText="关" />
        </Form.Item>
        <Form.Item label="供应商类型">
          <Select value={providerType} onChange={setProviderType} options={PROVIDER_TYPES.map((t) => ({ label: t, value: t }))} style={{ width: 260 }} />
        </Form.Item>
        <Form.Item label="Base URL（OpenAI 兼容，可选）">
          <Input value={baseUrl} onChange={setBaseUrl} placeholder="https://api.openai.com/v1" />
        </Form.Item>
        <Form.Item label="模型（可选）">
          <Input value={model} onChange={setModel} placeholder="gpt-4o-mini" />
        </Form.Item>
        <Form.Item label="超时(ms)">
          <Input value={timeoutMs} onChange={setTimeoutMs} />
        </Form.Item>
        <Form.Item label={`API Key（${cfg?.apiKeyConfigured ? '已配置，留空则不修改' : '未配置'}）`}>
          <Input.Password value={apiKey} onChange={setApiKey} placeholder="sk-..." />
        </Form.Item>
        <Button type="primary" loading={saving} onClick={save}>
          保存
        </Button>
      </Form>
    </section>
  )
}