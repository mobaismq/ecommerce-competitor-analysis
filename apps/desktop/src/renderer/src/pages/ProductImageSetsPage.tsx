import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Form, Input, Message, Select, Space, Typography } from '@arco-design/web-react'
import { api } from '../api/client'

interface PromptItem {
  id: string
  name: string
  type: string
  prompt: string
}

interface GeneratedImage {
  id: string
  storageKey: string
  sourceUrl?: string | null
  originalName?: string | null
  createdAt: string
}

export function ProductImageSetsPage() {
  const [form] = Form.useForm()
  const [prompts, setPrompts] = useState<PromptItem[]>([])
  const [genLoading, setGenLoading] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [generated, setGenerated] = useState<GeneratedImage[]>([])
  const [reportText, setReportText] = useState('')

  const loadGenerated = useCallback(async () => {
    try {
      const { data } = await api.get('/api/product-sets/generated-images')
      setGenerated(data?.generatedImages ?? [])
    } catch {
      /* 忽略 */
    }
  }, [])

  useEffect(() => {
    void loadGenerated()
  }, [loadGenerated])

  const genPrompts = async () => {
    setGenLoading(true)
    try {
      const { data } = await api.post('/api/product-sets/generate-prompts', {
        reportText,
        promptSlots: [],
      })
      setPrompts(data?.prompts ?? [])
      Message.success(`生成 ${data?.prompts?.length ?? 0} 组提示词`)
    } catch {
      Message.error('生成提示词失败')
    } finally {
      setGenLoading(false)
    }
  }

  const genImage = async (prompt: string) => {
    setImgLoading(true)
    try {
      const { data } = await api.post('/api/product-sets/generate-image', { prompt })
      setPreview(data?.images?.[0]?.url ?? null)
      Message.success('主图生成完成')
      await loadGenerated()
    } catch {
      Message.error('生成主图失败')
    } finally {
      setImgLoading(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api.delete(`/api/product-sets/generated-images/${id}`)
      Message.success('已删除')
      await loadGenerated()
    } catch {
      Message.error('删除失败')
    }
  }

  return (
    <div className="page">
      <Card title="图片生成（主图套图工作台）" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item label="报告/卖点文本" field="reportText">
            <Input.TextArea
              rows={3}
              placeholder="粘贴报告卖点或商品信息文本（可选，用于生成提示词）"
              value={reportText}
              onChange={setReportText}
            />
          </Form.Item>
          <Space>
            <Button type="primary" loading={genLoading} onClick={() => void genPrompts()}>生成提示词</Button>
          </Space>
        </Form>
      </Card>

      <Card title="提示词结果" style={{ marginBottom: 16 }}>
        {prompts.length === 0 ? (
          <Typography.Text type="secondary">点击"生成提示词"产出各图位提示词</Typography.Text>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {prompts.map((p) => (
              <div key={p.id} style={{ border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{p.name}</strong>
                  <Button size="small" type="primary" loading={imgLoading} onClick={() => void genImage(p.prompt)}>生成主图</Button>
                </div>
                <Typography.Paragraph style={{ fontSize: 12, marginTop: 6, whiteSpace: 'pre-wrap' }}>{p.prompt}</Typography.Paragraph>
              </div>
            ))}
          </Space>
        )}
        {preview && (
          <div style={{ marginTop: 14 }}>
            <Typography.Text>最新生成结果：</Typography.Text>
            <img src={preview} alt="生成结果" style={{ maxHeight: 200, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
        )}
      </Card>

      <Card title="已生成图片" extra={<Button size="small" onClick={() => void loadGenerated()}>刷新</Button>}>
        {generated.length === 0 ? (
          <Typography.Text type="secondary">暂无生成记录</Typography.Text>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {generated.map((g) => (
              <div key={g.id} style={{ width: 140, border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
                <div style={{ height: 100, background: '#f6f8fa', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {g.sourceUrl?.startsWith('http') ? <img src={g.sourceUrl} style={{ maxWidth: 120, maxHeight: 96 }} alt="" /> : <Typography.Text type="secondary" style={{ fontSize: 12 }}>{g.storageKey}</Typography.Text>}
                </div>
                <Button type="text" size="small" status="danger" onClick={() => void remove(g.id)} style={{ marginTop: 4 }}>删除</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}