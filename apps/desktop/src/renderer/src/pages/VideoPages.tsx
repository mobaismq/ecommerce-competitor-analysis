import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface VideoAsset {
  id: string
  sourceType: string
  storageKey: string
  mimeType: string
  size: number
  sourceUrl: string | null
  originalName: string | null
}

export function VideoReplicatePage() {
  const [sourceUrl, setSourceUrl] = useState('')
  const [title, setTitle] = useState('')
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')
    try {
      const { data } = await api.post('/api/videos/replicate', { sourceUrl, title })
      setJobId(data.jobId as string)
      setMessage(`任务已创建：${data.jobId}`)
    } catch {
      setMessage('创建失败，请检查服务端')
    }
  }
  return (
    <section className="panel">
      <h2>视频复刻</h2>
      <form className="form-grid" onSubmit={submit}>
        <label>
          源视频地址
          <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
        </label>
        <label>
          标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <button type="submit">创建复刻任务</button>
      </form>
      {message && <p className="form-message">{message}</p>}
      {jobId && <p className="muted">任务 ID：{jobId}</p>}
    </section>
  )
}

export function VideoGalleryPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['videos'],
    queryFn: async () => (await api.get<VideoAsset[]>('/api/videos')).data,
  })
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>视频库</h2>
        <button className="ghost" onClick={() => void refetch()}>刷新</button>
      </div>
      {isLoading ? <p>加载中...</p> : (
        <table>
          <thead>
            <tr><th>类型</th><th>存储键</th><th>格式</th><th>大小</th><th>源地址</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((video) => (
              <tr key={video.id}>
                <td>{video.sourceType}</td>
                <td>{video.storageKey}</td>
                <td>{video.mimeType}</td>
                <td>{video.size}</td>
                <td>{video.sourceUrl ?? video.originalName ?? '-'}</td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={5}>暂无数据</td></tr>}
          </tbody>
        </table>
      )}
    </section>
  )
}
