import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Message, Table, Typography } from '@arco-design/web-react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'

interface Sku {
  skuId: string
  name?: string | null
  price?: number | null
  imageUrl?: string | null
}

interface Product {
  id: string
  productId: string
  title?: string | null
  shopName?: string | null
  price?: number | null
  imageUrl?: string | null
  skus: Sku[]
  mainImageAnalysisId?: string | null
  mainImageAnalyzedAt?: string | null
}

function formatPrice(v?: number | null) {
  return v == null ? '-' : `¥${v.toFixed(2)}`
}

export function ReportProductsPage() {
  const { id } = useParams<{ id: string }>()
  const [collection, setCollection] = useState<{ keyword?: string | null; priceRange?: string | null; productCount: number; collectTime?: string } | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data } = await api.get(`/api/reports/${id}/products`)
      setCollection(data.collection)
      setProducts(data.products ?? [])
    } catch {
      Message.error('加载报告商品失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const analyze = async (product: Product) => {
    setAnalyzingId(product.id)
    try {
      await api.post(`/api/reports/${id}/main-image-analysis`, {
        productId: product.productId,
        title: product.title,
        imageUrl: product.imageUrl,
      })
      Message.success('主图分析完成')
      await load()
    } catch {
      Message.error('主图分析失败')
    } finally {
      setAnalyzingId(null)
    }
  }

  const columns = [
    { title: '商品', dataIndex: 'title', render: (_: unknown, r: Product) => <Typography.Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 300 }}>{r.title ?? '-'}</Typography.Text> },
    { title: '店铺', dataIndex: 'shopName', render: (v: unknown) => (v ? String(v) : '-') },
    { title: '价格', dataIndex: 'price', width: 110, render: (v: unknown, r: Product) => formatPrice(r.price) },
    { title: 'SKU', dataIndex: 'skus', width: 180, render: (_: unknown, r: Product) => <span>{r.skus.length} 个</span> },
    {
      title: '操作', width: 120, render: (_: unknown, r: Product) =>
        r.mainImageAnalysisId ? (
          <Typography.Text type="success" style={{ fontSize: 12 }}>已分析</Typography.Text>
        ) : (
          <Button size="small" loading={analyzingId === r.id} onClick={() => void analyze(r)}>主图分析</Button>
        ),
    },
  ] as never

  return (
    <div className="page">
      <Card title="报告商品" style={{ marginBottom: 16 }}>
        <Typography.Paragraph style={{ margin: 0 }}>
          关键词：{collection?.keyword ?? '-'} ｜ 区间：{collection?.priceRange ?? '-'} ｜ 商品数：{collection?.productCount ?? 0}
        </Typography.Paragraph>
      </Card>
      <Card>
        <Table rowKey="id" loading={loading} columns={columns} data={products} pagination={false} scroll={{ x: true }} />
      </Card>
    </div>
  )
}