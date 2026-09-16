import { useEffect, useState } from 'react'
import { ImageEditPage } from './ImageEditPage'

interface CollectionStatus {
  jobId: string
  status: string
  type: string | null
  errorMessage: string | null
  resultJson: unknown
}

export function App() {
  const [retentionDays, setRetentionDays] = useState(7)
  const [stats, setStats] = useState<{ tempFileCount: number; tempBytes: number } | null>(null)
  const [message, setMessage] = useState('')
  const [productName, setProductName] = useState('')
  const [fakeMode, setFakeMode] = useState(true)
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus | null>(null)

  const refresh = async () => {
    const next = await window.desktop?.local.getStats()
    if (next) {
      setRetentionDays(next.retentionDays)
      setStats(next)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const refreshCollection = async () => {
    const status = await window.desktop?.collection.status()
    if (status) {
      setCollectionStatus({ ...status, resultJson: status.resultJson })
    }
  }

  const startCollection = async () => {
    if (!productName.trim()) {
      setMessage('请先输入商品名称')
      return
    }
    const result = await window.desktop?.collection.start({
      productName: productName.trim(),
      mode: fakeMode ? 'download-and-import' : 'download-and-import',
      fake: fakeMode,
    })
    setMessage(result ? `已启动采集任务：${result.jobId}` : '启动失败')
    await refreshCollection()
  }

  const save = async () => {
    await window.desktop?.store.setConfig('localRetentionDays', Number(retentionDays))
    setMessage('已保存')
    await refresh()
  }

  const cleanup = async () => {
    const result = await window.desktop?.local.runCleanup()
    setMessage(result ? `已清理：${result.deletedJobFileCount + result.deletedExpiredFiles + result.deletedCapFiles} 个文件` : '')
    await refresh()
  }

  return (
    <main style={{ fontFamily: 'system-ui', padding: 40, maxWidth: 720 }}>
      <h1>电商竞品分析</h1>
      <p>桌面端基础壳已启动</p>
      <ImageEditPage />

      <section style={{ marginTop: 24, border: '1px solid #ddd', borderRadius: 8, padding: 16, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>RPA 采集</h2>
        <label>
          商品名称
          <input
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            placeholder="例如：电脑"
            style={{ marginLeft: 8 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={fakeMode} onChange={(event) => setFakeMode(event.target.checked)} />
          演示模式（不触发真实店透视采集）
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={startCollection}>启动采集</button>
          <button onClick={refreshCollection}>刷新状态</button>
        </div>
        {collectionStatus && (
          <div>
            <p>
              任务 {collectionStatus.jobId}：状态 <strong>{collectionStatus.status}</strong>
            </p>
            {collectionStatus.errorMessage && <p style={{ color: '#c00' }}>错误：{collectionStatus.errorMessage}</p>}
            {collectionStatus.resultJson && <pre style={{ fontSize: 12, overflow: 'auto' }}>{JSON.stringify(collectionStatus.resultJson, null, 2)}</pre>}
          </div>
        )}
      </section>

      <section style={{ marginTop: 24, display: 'grid', gap: 12 }}>
        <label>
          本地临时文件保留时间
          <select value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))}>
            <option value={1}>1 天</option>
            <option value={3}>3 天</option>
            <option value={7}>7 天</option>
            <option value={30}>30 天</option>
          </select>
        </label>
        <div>
          <button onClick={save}>保存</button>
          <button onClick={cleanup}>立即清理</button>
        </div>
        {stats && <p>临时文件 {stats.tempFileCount} 个，占用 {(stats.tempBytes / 1024 / 1024).toFixed(1)} MB</p>}
        {message && <p>{message}</p>}
      </section>
    </main>
  )
}
