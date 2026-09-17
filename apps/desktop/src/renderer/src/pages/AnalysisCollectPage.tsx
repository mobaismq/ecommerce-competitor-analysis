import { useState } from 'react'
import { api } from '../api/client'

export function AnalysisCollectPage() {
  const [storeId, setStoreId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [analysisType, setAnalysisType] = useState('market')
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')
    try {
      const { data } = await api.post('/api/jobs', { type: 'analysis', storeId, keyword, analysisType })
      setMessage(`任务已创建：${data.jobId}（重复创建返回 ${data.created ? '新建' : '已有'}）`)
    } catch (error) {
      setMessage('创建失败，请确认服务端可用')
    }
  }

  return (
    <section className="panel">
      <h2>AI 数据采集</h2>
      <form className="form-grid" onSubmit={submit}>
        <label>
          店铺
          <input value={storeId} onChange={(event) => setStoreId(event.target.value)} placeholder="storeId" />
        </label>
        <label>
          关键词
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="竞品关键词" />
        </label>
        <label>
          分析类型
          <select value={analysisType} onChange={(event) => setAnalysisType(event.target.value)}>
            <option value="market">市场分析</option>
          </select>
        </label>
        <button type="submit">创建采集任务</button>
      </form>
      {message && <p className="form-message">{message}</p>}
    </section>
  )
}
