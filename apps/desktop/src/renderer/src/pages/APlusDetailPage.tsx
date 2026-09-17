import { useState } from 'react'
import { Button, Card, Form, Input, Message, Select, Space, Typography } from '@arco-design/web-react'
import { api } from '../api/client'

interface DetailPrompt {
  id: string
  name: string
  type: string
  prompt: string
}

const MODULE_OPTIONS = [
  'hero_banner', 'specs', 'selling_points', 'usage_scene', 'package_photo', 'detail_1', 'detail_2', 'detail_3',
]

export function APlusDetailPage() {
  const [form] = Form.useForm()
  const [prompts, setPrompts] = useState<DetailPrompt[]>([])
  const [loading, setLoading] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [reportText, setReportText] = useState('')

  const run = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/api/product-sets/generate-detail-workflow', {
        reportText,
        promptSlots: (form.getFieldValue('modules') ?? []) as string[],
      })
      setPrompts(data?.data ?? [])
      Message.success(`生成 ${data?.data?.length ?? 0} 个模块提示词`)
    } catch {
      Message.error('生成详情工作流失败')
    } finally {
      setLoading(false)
    }
  }
  const genImage = async (prompt: string) => {
    setImgLoading(true)
    try {
      const { data } = await api.post('/api/product-sets/generate-image', { prompt })
      setPreview(data?.images?.[0]?.url ?? null)
      Message.success('详情图生成完成')
    } catch {
      Message.error('生成失败')
    } finally {
      setImgLoading(false)
    }
  }

  return (
    <div className="page">
      <Card title="详情图（APlus）工作流" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item label="详情图文案/卖点" field="reportText">
            <Input.TextArea rows={3} placeholder="粘贴详情图文案或报告卖点文本" value={reportText} onChange={setReportText} />
          </Form.Item>
          <Form.Item label="选择详情模块（多选，按序生成）" field="modules">
            <Select mode="multiple" allowClear placeholder="选择模块" options={MODULE_OPTIONS.map((m) => ({ label: m, value: m }))} />
          </Form.Item>
          <Button type="primary" loading={loading} onClick={() => void run()}>生成详情工作流</Button>
        </Form>
      </Card>

      <Card title="模块提示词">
        {prompts.length === 0 ? (
          <Typography.Text type="secondary">点击"生成详情工作流"按模块产出提示词</Typography.Text>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {prompts.map((p) => (
              <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{p.name}</strong>
                  <Button size="small" type="primary" loading={imgLoading} onClick={() => void genImage(p.prompt)}>生成图</Button>
                </div>
                <Typography.Paragraph style={{ fontSize: 12, marginTop: 6, whiteSpace: 'pre-wrap' }}>{p.prompt}</Typography.Paragraph>
              </div>
            ))}
          </Space>
        )}
        {preview && (
          <div style={{ marginTop: 14 }}>
            <img src={preview} alt="详情图" style={{ maxHeight: 200, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
        )}
      </Card>
    </div>
  )
}