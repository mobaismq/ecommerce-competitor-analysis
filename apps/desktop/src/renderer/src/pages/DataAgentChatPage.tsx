import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Database, Loader2, MessageSquareText, RefreshCw, Search, Send, Sparkles, Trash2 } from 'lucide-react'
import { Message, Modal } from '@arco-design/web-react'
import { nanoid } from 'nanoid'
import { PageHeader } from '../components/PageHeader'
import { ReportMarkdown } from '../components/SkillProductReports'
import { useAuth } from '../store/auth'

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
}

const QUICK_QUESTIONS = [
  '这个数据里最值得做的价格带是什么？',
  '高销量商品共同卖点有哪些？',
  '我应该优先做哪几张主图？',
  '这个品类有什么差异化机会？',
]

function statusText(status?: string) {
  if (status === 'generated') return '已生成报告'
  if (status === 'not_generated') return '原始数据'
  if (status === 'generating') return '生成中'
  return status || '数据集'
}

function formatDate(value?: string) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

const CHAT_STORAGE_PREFIX = 'data-agent-chat-history:'

function loadChatHistory(id: string): ChatMessage[] {
  if (!id) return []
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${id}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((m) => m && typeof m.id === 'string' && typeof m.content === 'string') : []
  } catch {
    return []
  }
}

function saveChatHistory(id: string, list: ChatMessage[]) {
  if (!id) return
  try {
    if (!list.length) localStorage.removeItem(`${CHAT_STORAGE_PREFIX}${id}`)
    else localStorage.setItem(`${CHAT_STORAGE_PREFIX}${id}`, JSON.stringify(list.slice(-100)))
  } catch {
    // Ignore storage quota errors.
  }
}

export function DataAgentChatPage() {
  const currentUserId = useAuth((state) => state.user?.id ?? '')
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

  // 数据流保持桌面端现状：IPC dataAgent.datasets
  const loadDatasets = async (kw = search) => {
    setLoadingDatasets(true)
    setDatasetError('')
    try {
      const res = await window.desktop?.capabilities.invoke('dataAgent.datasets', { tenantId: 'local', keyword: kw.trim() || undefined }) as { datasets?: Dataset[] } | undefined
      const list = Array.isArray(res?.datasets) ? res.datasets : []
      setDatasets(list)
      setDatasetId((curr) =>
        curr && list.some((item) => item.id === curr) ? curr : list[0]?.id || '',
      )
    } catch (error) {
      setDatasetError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoadingDatasets(false)
    }
  }

  useEffect(() => {
    void loadDatasets('')
  }, [])

  useEffect(() => {
    setMessages(loadChatHistory(datasetId))
    setAnswerError('')
  }, [datasetId])

  useEffect(() => {
    if (datasetId) saveChatHistory(datasetId, messages)
  }, [datasetId, messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, asking])

  const handleClearHistory = () => {
    if (!datasetId || !messages.length) return
    Modal.confirm({
      title: '清空当前对话记录？',
      content: `将删除「${selectedDataset?.keyword || '当前数据集'}」的所有本地历史问答记录，删除后不可恢复。`,
      okText: '确认清空',
      okButtonProps: { status: 'danger' },
      onOk: () => {
        setMessages([])
        saveChatHistory(datasetId, [])
        Message.success('已清空对话记录')
      },
    })
  }

  // 数据流保持桌面端现状：IPC dataAgent.chat
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
      const res = await window.desktop?.capabilities.invoke('dataAgent.chat', {
        userId: currentUserId,
        tenantId: 'local',
        datasetId: selectedDataset.id,
        keyword: selectedDataset.keyword || undefined,
        question: finalQuestion,
        history: messages.slice(-8).map((item) => ({ role: item.role, content: item.content })),
      }) as { answer?: string } | undefined

      const answer = res?.answer || '没有得到可用回答。'
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${nanoid(6)}`,
          role: 'assistant',
          content: answer,
        },
      ])
    } catch (error) {
      setAnswerError(error instanceof Error ? error.message : String(error))
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f6f8fb] px-6 py-5">
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

      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] gap-4">
        {/* 左：数据集选择抽屉 */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#e5eaf2] bg-white">
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
        <main className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#e5eaf2] bg-white">
          <div className="shrink-0 border-b border-[#eef1f5] p-4">
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
              <div className="flex shrink-0 items-center gap-2">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e5eaf2] bg-white px-2.5 text-[12px] font-semibold text-[#667085] hover:border-[#fda29b] hover:text-[#d92d20]"
                    title="清空当前数据集历史对话"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清空对话
                  </button>
                )}
                <div className="hidden items-center gap-2 rounded-full bg-[#f8fafc] px-3 py-2 text-[12px] font-bold text-[#667085] md:flex">
                  <Sparkles className="h-4 w-4 text-[#3388ff]" />
                  {selectedDataset?.keyword || '未选择'}
                </div>
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
                  <div key={message.id} className={`group flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'user' && (
                      <button
                        type="button"
                        onClick={() => setMessages((prev) => prev.filter((item) => item.id !== message.id))}
                        className="mt-2 hidden cursor-pointer border-0 bg-transparent p-1 text-[#98A2B3] hover:text-[#d92d20] group-hover:inline-flex"
                        title="删除这条消息"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 text-[14px] leading-7 ${
                        message.role === 'user'
                          ? 'whitespace-pre-wrap bg-[#3388ff] font-bold text-white'
                          : 'border border-[#eef1f5] bg-[#f8fafc] font-medium text-[#0A1B39]'
                      }`}
                    >
                      {message.role === 'assistant' ? <ReportMarkdown text={message.content} /> : message.content}
                    </div>
                    {message.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => setMessages((prev) => prev.filter((item) => item.id !== message.id))}
                        className="mt-2 hidden cursor-pointer border-0 bg-transparent p-1 text-[#98A2B3] hover:text-[#d92d20] group-hover:inline-flex"
                        title="删除这条回答"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
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

          <div className="shrink-0 border-t border-[#eef1f5] p-4">
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
