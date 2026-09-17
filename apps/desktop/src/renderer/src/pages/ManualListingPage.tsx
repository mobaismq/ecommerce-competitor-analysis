import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Message, Select } from '@arco-design/web-react'
import { api } from '../api/client'

interface PlatformCategory {
  externalId: string
  parentExternalId?: string
  name: string
  isParent?: boolean
}

interface PlatformNode {
  code: string
  name: string
}

export function ManualListingPage() {
  const [form] = Form.useForm()
  const [platforms, setPlatforms] = useState<PlatformNode[]>([])
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [cats, setCats] = useState<PlatformCategory[]>([])
  const [catPath, setCatPath] = useState<PlatformCategory[]>([])
  const [publishing, setPublishing] = useState(false)
  const platform = Form.useWatch('platform', form)

  const loadPlatforms = useCallback(async () => {
    try {
      const { data } = await api.get('/api/platform-adapters')
      setPlatforms(Array.isArray(data) ? data.map((p) => ({ code: p.code ?? p.id, name: p.name ?? p.code })) : [])
    } catch {
      Message.error('加载平台失败')
    }
  }, [])
  const loadStores = useCallback(async () => {
    try {
      const { data } = await api.get('/api/stores')
      setStores(Array.isArray(data) ? data.map((s) => ({ id: s.id, name: s.name ?? s.storeName })) : [])
    } catch {
      Message.error('加载店铺失败')
    }
  }, [])

  useEffect(() => {
    void loadPlatforms()
    void loadStores()
  }, [loadPlatforms, loadStores])

  const loadCats = useCallback(async (code: string, parent: string) => {
    try {
      const { data } = await api.get(`/api/platform-adapters/${code}/categories`, { params: { parent_cid: parent } })
      const list = Array.isArray(data) ? data : Array.isArray(data?.categories) ? data.categories : []
      setCats(list)
    } catch {
      setCats([])
    }
  }, [])

  const onPlatform = (code: string) => {
    form.setFieldsValue({ categoryId: undefined })
    setCatPath([])
    setCats([])
    if (code) void loadCats(code, '0')
  }

  const pickCat = (cat: PlatformCategory) => {
    if (cat.isParent) {
      const next = [...catPath, cat]
      setCatPath(next)
      void loadCats(platform, cat.externalId)
    } else {
      setCatPath([...catPath, cat])
      form.setFieldValue('categoryId', cat.externalId)
    }
  }

  const publish = async () => {
    const v = await form.validate()
    const code = v.platform as string
    if (!code) { Message.error('请选择平台'); return }
    setPublishing(true)
    try {
      await api.post(`/api/platform-adapters/${code}/publish`, {
        title: v.title,
        storeId: v.storeId,
        categoryId: v.categoryId,
        price: v.price,
        skus: v.skus ? [v.skus] : undefined,
      })
      Message.success('已提交发布')
      form.resetFields()
      setCatPath([])
      setCats([])
    } catch (e: unknown) {
      Message.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="page">
      <Card title="手动发布">
        <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item label="平台" field="platform" rules={[{ required: true, message: '请选择平台' }]}>
            <Select placeholder="选择平台" onChange={(v) => onPlatform(v as string)} options={platforms.map((p) => ({ label: p.name, value: p.code }))} />
          </Form.Item>
          <Form.Item label="店铺" field="storeId">
            <Select placeholder="选择店铺" allowClear options={stores.map((s) => ({ label: s.name, value: s.id }))} />
          </Form.Item>
          <Form.Item label="类目（逐级点选叶子节点）">
            {catPath.map((c) => (
              <Button key={c.externalId} type="text" size="small" style={{ marginRight: 6 }} onClick={() => {}}>{c.name} ›</Button>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {cats.map((c) => (
                <Button key={c.externalId} size="small" onClick={() => pickCat(c)}>{c.name}</Button>
              ))}
            </div>
            {catPath.length === 0 && cats.length === 0 && <span style={{ fontSize: 12, color: '#999' }}>选择平台后加载类目</span>}
          </Form.Item>
          <Form.Item label="商品标题" field="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="商品标题" />
          </Form.Item>
          <Form.Item label="价格" field="price">
            <InputNumber style={{ width: '100%' }} placeholder="价格" />
          </Form.Item>
          <Form.Item label="SKU 编码" field="skus">
            <Input placeholder="SKU 编码（可选）" />
          </Form.Item>
          <Button type="primary" long loading={publishing} onClick={() => void publish()}>提交发布</Button>
        </Form>
      </Card>
    </div>
  )
}