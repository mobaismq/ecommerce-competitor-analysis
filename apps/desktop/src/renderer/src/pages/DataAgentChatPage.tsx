import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Card,
  Empty,
  Input,
  Message,
  Spin,
  Tag,
  Typography,
} from '@arco-design/web-react'
import {
  IconApps,
  IconClockCircle,
  IconMessage,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconSend,
  IconThunderbolt,
  IconUser,
} from '@arco-design/web-react/icon'
import { api } from '../api/client'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

export interface Dataset {
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

export function DataAgentChatPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [search, setSearch] = useState('')
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const selectedDataset = useMemo(
    () => datasets.find((item) => item.id === datasetId) || null,
    [datasets, datasetId],
  )

  const loadDatasets = async (keyword = search) => {
    setLoadingDatasets(true)
    try {
      const params = new URLSearchParams()
      if (keyword.trim()) params.set('keyword', keyword.trim())
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
    } catch (err) {
      Message.error('数据集加载失败，请检查网络或后端服务')
    } finally {
      setLoadingDatasets(false)
    }
  }

  useEffect(() => {
    void loadDatasets('')
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking])

  const handleAsk = async (queryText?: string) => {
    const finalQuestion = (queryText || question).trim()
    if (!finalQuestion || !selectedDataset || asking) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: finalQuestion,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setQuestion('')
    setAsking(true)

    try {
      const res = await api.post<{ ok?: boolean; answer?: string; error?: string }>(
        '/api/data-agent/chat',
        {
          datasetId: selectedDataset.id,
          question: finalQuestion,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        },
      )

      const answer = res.data?.answer || '没有获取到有效回答'
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch (err) {
      Message.error('智能助手响应异常，请稍后重试')
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: '抱歉，当前数据分析助手遇到了网络异常，未能成功生成回答。',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setAsking(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)', gap: 16 }}>
      {/* 头部导航与标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title heading={5} style={{ margin: 0 }}>
            数据智能体（AI 对话分析）
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            选择已采集的竞品数据集或报告，基于大模型进行多维深度洞察、商机发现与策略咨询
          </Text>
        </div>
        <Button
          icon={<IconRefresh />}
          loading={loadingDatasets}
          onClick={() => void loadDatasets()}
        >
          刷新数据集
        </Button>
      </div>

      {/* 主体两栏布局 */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        {/* 左侧：数据集选择 */}
        <Card
          title="选择数据集"
          extra={<Tag color="arcoblue">{datasets.length} 个</Tag>}
          style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 12, minHeight: 0 }}
        >
          <Input
            prefix={<IconSearch />}
            placeholder="搜索关键词..."
            value={search}
            onChange={(v) => setSearch(v)}
            onPressEnter={() => void loadDatasets()}
            style={{ marginBottom: 12 }}
            allowClear
          />

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingDatasets ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin dot />
              </div>
            ) : datasets.length === 0 ? (
              <Empty description="暂无可用的数据集，请先进行数据采集" />
            ) : (
              datasets.map((item) => {
                const isSelected = item.id === datasetId
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setDatasetId(item.id)
                      setMessages([])
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: isSelected ? '1px solid #165dff' : '1px solid #e5e6eb',
                      backgroundColor: isSelected ? '#f2f7ff' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <Text bold style={{ color: isSelected ? '#165dff' : '#1d2129' }}>
                        {item.title || item.keyword || '竞品数据集'}
                      </Text>
                      <Tag size="small" color={isSelected ? 'arcoblue' : 'gray'}>
                        {item.status === 'generated' ? '已出报告' : item.status || '已就绪'}
                      </Tag>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#86909c' }}>
                      <span><IconApps /> {item.competitorCount ?? 0} 个商品</span>
                      {item.priceRange && <span>价格: {item.priceRange}</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* 右侧：聊天主视窗 */}
        <Card
          style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 0, minHeight: 0 }}
        >
          {/* 对话窗口顶部信息 */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid #f2f3f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fafafa',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #165dff 0%, #722ed1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <IconRobot style={{ fontSize: 18 }} />
              </div>
              <div>
                <Text bold style={{ fontSize: 14 }}>
                  {selectedDataset ? `${selectedDataset.keyword || selectedDataset.title} · 数据洞察助手` : '请先在左侧选择数据集'}
                </Text>
                <div style={{ fontSize: 12, color: '#86909c' }}>
                  基于统一 AI Provider 驱动，深入挖掘市场价格带、核心卖点与蓝海机会
                </div>
              </div>
            </div>
            {selectedDataset && (
              <Tag icon={<IconThunderbolt />} color="purple">
                数据集 ID: {selectedDataset.id.slice(0, 8)}...
              </Tag>
            )}
          </div>

          {/* 消息滚动流 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 540 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: '#e8f3ff',
                    color: '#165dff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    margin: '0 auto 16px',
                  }}
                >
                  <IconMessage />
                </div>
                <Title heading={5} style={{ marginBottom: 8 }}>
                  问问数据智能体
                </Title>
                <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 24 }}>
                  可以直接针对当前数据集提问，也可以点击下方推荐的快捷问题快速开始：
                </Paragraph>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {QUICK_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      size="large"
                      style={{ textAlign: 'left', height: 'auto', padding: '10px 14px', whiteSpace: 'normal', borderRadius: 8 }}
                      disabled={!selectedDataset || asking}
                      onClick={() => void handleAsk(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === 'user'
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      gap: 12,
                    }}
                  >
                    {!isUser && (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: '#722ed1',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconRobot />
                      </div>
                    )}
                    <div style={{ maxWidth: '75%' }}>
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          backgroundColor: isUser ? '#165dff' : '#f2f3f5',
                          color: isUser ? '#fff' : '#1d2129',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          boxShadow: isUser ? '0 4px 12px rgba(22,93,255,0.2)' : 'none',
                        }}
                      >
                        {m.content}
                      </div>
                      {m.time && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#86909c',
                            marginTop: 4,
                            textAlign: isUser ? 'right' : 'left',
                          }}
                        >
                          {m.time}
                        </div>
                      )}
                    </div>
                    {isUser && (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: '#165dff',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconUser />
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {asking && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: '#722ed1',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconRobot />
                </div>
                <div
                  style={{
                    padding: '10px 16px',
                    borderRadius: 16,
                    backgroundColor: '#f2f3f5',
                    color: '#4e5969',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Spin size={14} /> 正在深度分析数据集并生成结论...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 底部输入框 */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #f2f3f5', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <TextArea
                value={question}
                onChange={(v) => setQuestion(v)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault()
                    void handleAsk()
                  }
                }}
                placeholder={
                  selectedDataset
                    ? '输入你想针对此数据集提出的分析问题（Enter 发送，Shift+Enter 换行）...'
                    : '请先在左侧选择一个数据集'
                }
                disabled={!selectedDataset || asking}
                autoSize={{ minRows: 2, maxRows: 4 }}
                style={{ flex: 1, borderRadius: 8 }}
              />
              <Button
                type="primary"
                icon={<IconSend />}
                disabled={!selectedDataset || !question.trim() || asking}
                loading={asking}
                onClick={() => void handleAsk()}
                style={{ height: 52, padding: '0 20px', borderRadius: 8 }}
              >
                发送
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
