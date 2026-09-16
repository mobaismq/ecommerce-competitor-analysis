import { useEffect, useState } from 'react'
import { ImageEditPage } from './ImageEditPage'

export function App() {
  const [retentionDays, setRetentionDays] = useState(7)
  const [stats, setStats] = useState<{ tempFileCount: number; tempBytes: number } | null>(null)
  const [message, setMessage] = useState('')

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
