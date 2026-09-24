import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Message, Select } from '@arco-design/web-react'
import { useAuth } from '../store/auth'

interface SelfConfig {
  selfEnabled: boolean
  protocol: 'openai' | 'anthropic'
  baseUrl: string | null
  apiKeyConfigured: boolean
  textModel: string | null
  imageModel: string | null
  timeoutMs: number | null
  hasDefaultProvider: boolean
  usingDefault: boolean
  defaultBaseUrl: string | null
  defaultTextModel: string | null
  defaultImageModel: string | null
}

const PROTOCOLS = [
  { label: 'OpenAI 兼容（/chat/completions）', value: 'openai' },
  { label: 'Anthropic 兼容（/messages）', value: 'anthropic' },
]

export function AiConfigPage() {
  const currentUserId = useAuth((state) => state.user?.id ?? '')
  const [cfg, setCfg] = useState<SelfConfig | null>(null)
  const [protocol, setProtocol] = useState<'openai' | 'anthropic'>('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [textModel, setTextModel] = useState('')
  const [imageModel, setImageModel] = useState('')
  const [timeoutMs, setTimeoutMs] = useState('120000')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const result = await window.desktop?.capabilities.invoke('ai.selfConfig.get', { userId: currentUserId }) as SelfConfig | undefined
        if (!result) return
        setCfg(result)
        setProtocol(result.protocol ?? 'openai')
        if (result.baseUrl) setBaseUrl(result.baseUrl)
        if (result.textModel) setTextModel(result.textModel)
        if (result.imageModel) setImageModel(result.imageModel)
        if (result.timeoutMs) setTimeoutMs(String(result.timeoutMs))
      } catch {
        Message.error('AI 配置读取失败')
      }
    })()
  }, [currentUserId])

  const save = async (clear = false) => {
    setSaving(true)
    try {
      const data = await window.desktop?.capabilities.invoke('ai.selfConfig.save', {
        userId: currentUserId,
        ...(clear ? { clear: true } : {}),
        protocol,
        baseUrl: baseUrl || undefined,
        apiKey: apiKey || undefined,
        textModel: textModel || undefined,
        imageModel: imageModel || undefined,
        timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
      }) as SelfConfig | undefined
      if (data) setCfg(data)
      setApiKey('')
      if (clear) {
        setBaseUrl('')
        setTextModel('')
        setImageModel('')
        Message.success('已清除个人 AI 配置，使用系统默认供应商')
      } else {
        Message.success('AI 配置已保存')
      }
    } catch {
      Message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const needReminder = cfg ? !cfg.selfEnabled && !cfg.hasDefaultProvider : false

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#f4f7fb] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 m-0">AI 供应商配置</h1>
          <p className="text-xs text-gray-500 mt-1 mb-0">
            可配置个人 AI 供应商（OpenAI/Anthropic 兼容）；未配置时使用系统默认供应商。
          </p>
        </div>
      </div>

      <Card bordered className="rounded-lg shadow-sm bg-white max-w-2xl">
        {needReminder && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            content="当前无可用 AI 供应商。为避免 AI 生图或大模型功能不可用，请在下方配置 Key。"
          />
        )}

        <Form layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="接口协议">
            <Select
              value={protocol}
              onChange={setProtocol}
              options={PROTOCOLS}
              style={{ width: 280 }}
            />
          </Form.Item>
          <Form.Item label="Base URL">
            <Input value={baseUrl} onChange={setBaseUrl} placeholder="https://openrouter.ai/api/v1 或 https://api.openai.com/v1 或 https://api.anthropic.com/v1" />
          </Form.Item>
          <Form.Item label="文本模型">
            <Input value={textModel} onChange={setTextModel} placeholder="deepseek/deepseek-chat / gpt-4o-mini / claude-sonnet-4-5" />
          </Form.Item>
          <Form.Item label="生图模型">
            <Input value={imageModel} onChange={setImageModel} placeholder="openai/gpt-image-2 / gpt-image-1" />
          </Form.Item>
          <Form.Item label="超时 (ms)">
            <Input value={timeoutMs} onChange={setTimeoutMs} />
          </Form.Item>
          <Form.Item label={`API Key（${cfg?.apiKeyConfigured ? '已配置，留空则不修改' : '未配置'}）`}>
            <Input.Password value={apiKey} onChange={setApiKey} placeholder="sk-..." />
          </Form.Item>
          <div className="flex gap-3">
            <Button type="primary" loading={saving} onClick={() => save(false)} style={{ width: 120 }}>
              保存配置
            </Button>
            {cfg?.selfEnabled && (
              <Button status="danger" disabled={saving} onClick={() => save(true)} style={{ width: 120 }}>
                清除个人配置
              </Button>
            )}
          </div>
        </Form>
      </Card>
    </div>
  )
}