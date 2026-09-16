import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface Asset {
  id: string
  storageKey: string
  mimeType: string
  size: number
  runId: string | null
}

export function AssetsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get<Asset[]>('/api/assets')).data,
  })
  const [preview, setPreview] = useState<string | null>(null)

  const open = async (assetId: string, mimeType: string) => {
    const token = localStorage.getItem('eca.token')
    const response = await fetch(`http://127.0.0.1:8787/api/assets/${assetId}/raw`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) return
    const blob = await response.blob()
    setPreview(URL.createObjectURL(new Blob([blob], { type: mimeType })))
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>资产库</h2>
        <button className="ghost" onClick={() => void refetch()}>刷新</button>
      </div>
      {preview && (
        <div className="preview">
          <img src={preview} alt="资产预览" />
          <button className="ghost" onClick={() => setPreview(null)}>关闭</button>
        </div>
      )}
      {isLoading ? <p>加载中...</p> : (
        <table>
          <thead>
            <tr><th>存储键</th><th>类型</th><th>大小</th><th>运行</th><th></th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((asset) => (
              <tr key={asset.id}>
                <td>{asset.storageKey}</td>
                <td>{asset.mimeType}</td>
                <td>{asset.size}</td>
                <td>{asset.runId ?? '-'}</td>
                <td><button className="ghost" onClick={() => void open(asset.id, asset.mimeType)}>查看</button></td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={5}>暂无数据</td></tr>}
          </tbody>
        </table>
      )}
    </section>
  )
}
