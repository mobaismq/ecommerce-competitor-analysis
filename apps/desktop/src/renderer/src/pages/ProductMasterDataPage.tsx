import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Message, Modal, Select, Table, Typography } from '@arco-design/web-react'
import { api } from '../api/client'

interface Sku {
  id?: string
  skuCode: string
  specName?: string
  costPrice?: number | null
  standardPrice?: number | null
}

interface Product {
  id: string
  productCode: string
  productName: string
  brand?: string | null
  productImage?: string | null
  status: string
  skus: Sku[]
}

export function ProductMasterDataPage() {
  const [list, setList] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [skus, setSkus] = useState<Sku[]>([{ skuCode: '' }])
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/products/master')
      setList(data ?? [])
    } catch {
      Message.error('加载商品主档失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setSkus([{ skuCode: '' }])
    form.resetFields()
    setVisible(true)
  }
  const openEdit = (p: Product) => {
    setEditing(p)
    setSkus(p.skus.length ? p.skus : [{ skuCode: '' }])
    form.setFieldsValue({ productCode: p.productCode, productName: p.productName, brand: p.brand, status: p.status })
    setVisible(true)
  }
  const save = async () => {
    const values = await form.validate()
    const payload = {
      productCode: values.productCode,
      productName: values.productName,
      brand: values.brand || undefined,
      status: (values.status as string) ?? 'enabled',
      skus,
    }
    try {
      if (editing) await api.patch(`/api/products/master/${editing.id}`, payload)
      else await api.post('/api/products/master', payload)
      Message.success(editing ? '已更新' : '已创建')
      setVisible(false)
      await load()
    } catch {
      Message.error('保存失败')
    }
  }
  const remove = async (p: Product) => {
    try {
      await api.delete(`/api/products/master/${p.id}`)
      Message.success('已删除')
      await load()
    } catch {
      Message.error('删除失败')
    }
  }

  const columns = [
    { title: '编码', dataIndex: 'productCode' },
    { title: '名称', dataIndex: 'productName' },
    { title: '品牌', dataIndex: 'brand', render: (v: unknown) => (v ? String(v) : '-') },
    { title: 'SKU', dataIndex: 'skus', width: 90, render: (_: unknown, r: Product) => <span>{r.skus.length}</span> },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: unknown) => <Typography.Text type={(v as string) === 'enabled' ? 'success' : 'error'}>{(v as string) === 'enabled' ? '启用' : '停用'}</Typography.Text> },
    {
      title: '操作', width: 150,
      render: (_: unknown, r: Product) => (
        <span><Button type="text" size="small" onClick={() => openEdit(r)}>编辑</Button><Button type="text" size="small" status="danger" onClick={() => void remove(r)}>删除</Button></span>
      ),
    },
  ] as never

  const skuCols = [
    { title: 'SKU 编码', dataIndex: 'skuCode', width: 140, render: (_: unknown, r: Sku, i: number) => <Input size="small" value={r.skuCode} onChange={(v) => setSku(i, 'skuCode', v)} /> },
    { title: '规格', dataIndex: 'specName', render: (_: unknown, r: Sku, i: number) => <Input size="small" value={r.specName} onChange={(v) => setSku(i, 'specName', v)} /> },
    { title: '成本价', dataIndex: 'costPrice', width: 120, render: (_: unknown, r: Sku, i: number) => <InputNumber size="small" style={{ width: '100%' }} value={r.costPrice ?? undefined} onChange={(v) => setSku(i, 'costPrice', Number(v))} /> },
    { title: '操作', width: 70, render: (_: unknown, _r: Sku, i: number) => <Button type="text" size="small" status="danger" onClick={() => setSkus(skus.filter((_, j) => j !== i))}>删</Button> },
  ] as never

  function setSku(i: number, k: keyof Sku, v: string | number) {
    const next = [...skus]
    ;(next[i] as Record<string, unknown>)[k] = v
    setSkus(next)
  }

  return (
    <div className="page">
      <Card title="商品主档" extra={<Button type="primary" onClick={openCreate}>新增商品</Button>}>
        <Table rowKey="id" loading={loading} columns={columns} data={list} pagination={false} scroll={{ x: true }} />
      </Card>
      <Modal title={editing ? '编辑商品' : '新增商品'} visible={visible} onCancel={() => setVisible(false)} onOk={() => void save()} unmountOnExit>
        <Form form={form} layout="vertical">
          <Form.Item label="商品编码" field="productCode" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="商品编码" />
          </Form.Item>
          <Form.Item label="商品名称" field="productName" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="商品名称" />
          </Form.Item>
          <Form.Item label="品牌" field="brand">
            <Input placeholder="品牌" />
          </Form.Item>
          <Form.Item label="状态" field="status" initialValue="enabled">
            <Select options={[{ label: '启用', value: 'enabled' }, { label: '停用', value: 'disabled' }]} />
          </Form.Item>
          <Form.Item label="SKU 列表">
            <Table rowKey={(_, i) => String(i)} columns={skuCols} data={skus} pagination={false} />
            <Button type="text" size="small" onClick={() => setSkus([...skus, { skuCode: '' }])} style={{ marginTop: 8 }}>+ 添加 SKU</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}