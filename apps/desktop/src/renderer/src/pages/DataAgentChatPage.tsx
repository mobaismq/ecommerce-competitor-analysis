import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Database, Loader2, MessageSquareText, RefreshCw, Search, Send, Sparkles } from 'lucide-react'
import { Message } from '@arco-design/web-react'
import { nanoid } from 'nanoid'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { X } from 'lucide-react'

interface Dataset {
  id: string
  source?: string
  keyword?: string
  title?: string
  priceRange?: string
  competitorCount?: number
  collectTime?: string
  status?: string
  description?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  time?: string
}

const QUICK_QUESTIONS = [
  '这个数据里最值得做的价格带是什么？',
  '高销量商品共同卖点有哪些？',
  '我应该优先做哪几张主图？',
  '这个品类有什么差异化机会？',
]

function statusText(status?: string) {
  if (status === 'generated' || status === 'completed' || status === 'success') return '已生成报告'
  if (status === 'not_generated') return '原始数据'
  if (status === 'generating' || status === 'running') return '生成中'
  return status || '数据集'
}

function formatDate(value?: string) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

export function DataAgentChatPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [search, setSearch] = useState('')
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [datasetError, setDatasetError] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [answerError, setAnswerError] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const selectedDataset = useMemo(
    () => datasets.find((item) => item.id === datasetId) || null,
    [datasets, datasetId],
  )

  // 数据流保持桌面端现状：GET /api/data-agent/datasets
  const loadDatasets = async (kw = search) => {
    setLoadingDatasets(true)
    setDatasetError('')
    try {
      const params = new URLSearchParams()
      if (kw.trim()) params.set('keyword', kw.trim())
      const res = await api.get<{ datasets?: Dataset[]; ok?: boolean }>(
        `/api/data-agent/datasets${params.toString() ? `?${params.toString()}` : ''}`,
      )
      const list = Array.isArray(res.data?.datasets)
        ? res.data.datasets
        : Array.isArray(res.data)
        ? (res.data as unknown as Dataset[])
        : []
      setDatasets(list)
      setDatasetId((curr) =>
        curr && list.some((item) => item.id === curr) ? curr : list[0]?.id || '',
      )
    } catch {
      setDatasetError('数据集加载失败，请检查网络或后端服务')
    } finally {
      setLoadingDatasets(false)
    }
  }

  useEffect(() => {
    void loadDatasets('')
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, asking])

  // 数据流保持桌面端现状：POST /api/data-agent/chat
  const handleAsk = async (queryText?: string) => {
    const finalQuestion = (queryText || question).trim()
    if (!finalQuestion || !selectedDataset || asking) return

    const userMsg: ChatMessage = {
      id: `user-${nanoid(6)}`,
      role: 'user',
      content: finalQuestion,
    }

    setMessages((prev) => [...prev, userMsg])
    setQuestion('')
    setAsking(true)
    setAnswerError('')

    try {
      const res = await api.post<{ ok?: boolean; answer?: string; error?: string }>(
        '/api/data-agent/chat',
        {
          datasetId: selectedDataset.id,
          question: finalQuestion,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        },
      )

      const answer = res.data?.answer || '没有得到可用回答。'
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${nanoid(6)}`,
          role: 'assistant',
          content: answer,
        },
      ])
    } catch {
      setAnswerError('智能助手响应异常，请稍后重试')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="min-h-full bg-[#f6f8fb] px-6 py-5">
      <PageHeader
        breadcrumbs={[{ label: '市场' }, { label: '竞品分析' }, { label: '数据智能体' }]}
        trailing={
          <button
            type="button"
            onClick={() => void loadDatasets()}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#d8e0ea] bg-white px-3 text-[13px] font-bold text-[#0A1B39] hover:border-[#3388ff] hover:text-[#3388ff]"
          >
            <RefreshCw className={`h-4 w-4 ${loadingDatasets ? 'animate-spin' : ''}`} />
            刷新数据
          </button>
        }
      />

      <div className="grid h-[calc(100vh-116px)] min-h-[620px] grid-cols-[340px_minmax(0,1fr)] gap-4">
        {/* 左：数据集选择抽屉 */}
        <aside className="flex min-h-0 flex-col rounded-xl border border-[#e5eaf2] bg-white">
          <div className="border-b border-[#eef1f5] p-4">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e8f3ff] text-[#3388ff]">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h1 className="m-0 text-[16px] font-extrabold text-[#0A1B39]">数据选择</h1>
                <p className="m-0 text-[12px] font-bold text-[#86909C]">{datasets.length} 个可用数据集</p>
              </div>
            </div>
            <div className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-[#d8e0ea] bg-[#fbfcfe] px-3">
              <Search className="h-4 w-4 text-[#98A2B3]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void loadDatasets()
                }}
                placeholder="搜索关键词"
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-[13px] font-semibold text-[#0A1B39] outline-none placeholder:text-[#98A2B3]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="清空"
                  className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-[#c0c4cc] hover:bg-[#f2f4f7] hover:text-[#86909C]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {datasetError ? (
              <div className="mb-3 rounded-lg bg-[#fff1f0] px-3 py-2 text-[12px] font-bold text-[#c62828]">{datasetError}</div>
            ) : null}
            {loadingDatasets ? (
              <div className="grid h-40 place-items-center text-[#86909C]">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : datasets.length ? (
              <div className="flex flex-col gap-2">
                {datasets.map((item) => {
                  const active = item.id === datasetId
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDatasetId(item.id)
                        setMessages([])
                        setAnswerError('')
                      }}
                      className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                        active ? 'border-[#3388ff] bg-[#f0f7ff]' : 'border-[#eef1f5] bg-white hover:border-[#c9ddff] hover:bg-[#f8fbff]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="m-0 line-clamp-2 text-[13px] font-extrabold leading-5 text-[#0A1B39]">
                          {item.title || item.keyword || '未命名数据'}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                            active ? 'bg-[#3388ff] text-white' : 'bg-[#f2f4f7] text-[#667085]'
                          }`}
                        >
                          {statusText(item.status)}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold text-[#667085]">
                        <span>{item.competitorCount || 0} 个商品</span>
                        <span className="truncate">价格 {item.priceRange || '-'}</span>
                        <span className="col-span-2 truncate">{formatDate(item.collectTime)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg bg-[#f8fafc] px-3 py-6 text-center text-[13px] font-bold text-[#86909C]">暂无可问答数据</div>
            )}
          </div>
        </aside>

        {/* 右：对话主体 */}
        <main className="flex min-h-0 flex-col rounded-xl border border-[#e5eaf2] bg-white">
          <div className="border-b border-[#eef1f5] p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f3edff] text-[#7c3aed]">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="m-0 truncate text-[18px] font-extrabold text-[#0A1B39]">数据智能体问答</h2>
                  <p className="m-0 truncate text-[12px] font-bold text-[#86909C]">
                    {selectedDataset?.description || '选择一个数据集后开始提问'}
                  </p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-full bg-[#f8fafc] px-3 py-2 text-[12px] font-bold text-[#667085] md:flex">
                <Sparkles className="h-4 w-4 text-[#3388ff]" />
                {selectedDataset?.keyword || '未选择'}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {!messages.length ? (
              <div className="flex h-full flex-col justify-center">
                <div className="mx-auto max-w-2xl text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e8f3ff] text-[#3388ff]">
                    <MessageSquareText className="h-7 w-7" />
                  </div>
                  <h3 className="m-0 mt-4 text-[22px] font-extrabold text-[#0A1B39]">选择数据后直接提问</h3>
                  <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {QUICK_QUESTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => void handleAsk(item)}
                        disabled={!selectedDataset || asking}
                        className="cursor-pointer rounded-lg border border-[#d8e0ea] bg-white px-4 py-3 text-left text-[13px] font-bold text-[#0A1B39] hover:border-[#3388ff] hover:text-[#3388ff] disabled:cursor-not-allowed disabled:text-[#c0c4cc]"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-4xl flex-col gap-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[14px] leading-7 ${
                        message.role === 'user'
                          ? 'bg-[#3388ff] font-bold text-white'
                          : 'border border-[#eef1f5] bg-[#f8fafc] font-medium text-[#0A1B39]'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {asking ? (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-[#eef1f5] bg-[#f8fafc] px-4 py-3 text-[13px] font-bold text-[#667085]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在读取数据并回答
                    </div>
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-[#eef1f5] p-4">
            {answerError ? (
              <div className="mb-3 rounded-lg bg-[#fff1f0] px-3 py-2 text-[12px] font-bold text-[#c62828]">{answerError}</div>
            ) : null}
            <div className="flex items-end gap-3">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleAsk()
                  }
                }}
                placeholder={selectedDataset ? '输入你想问这个数据集的问题' : '请先选择数据集'}
                disabled={!selectedDataset || asking}
                rows={2}
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-[#d8e0ea] bg-[#fbfcfe] px-4 py-3 text-[14px] font-semibold leading-6 text-[#0A1B39] outline-none placeholder:text-[#98A2B3] focus:border-[#3388ff] disabled:bg-[#f2f4f7]"
              />
              <button
                type="button"
                onClick={() => void handleAsk()}
                disabled={!selectedDataset || !question.trim() || asking}
                className="grid h-[52px] w-[52px] cursor-pointer place-items-center rounded-xl border-0 bg-[#3388ff] text-white shadow-[0_8px_20px_rgba(47,130,255,.28)] hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:bg-[#c9d2df] disabled:shadow-none"
                title="发送"
              >
                {asking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
