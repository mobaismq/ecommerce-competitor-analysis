import type { ReactNode } from 'react'
import { Popover } from '@arco-design/web-react'
import { Lightbulb, Loader2, X } from 'lucide-react'

interface AiHelpPopoverProps {
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  busy: boolean
  text: string
  onTextChange: (value: string) => void
  onStart: () => void
  onRetry: () => void
  onConfirm: () => void
  trigger?: ReactNode
  triggerDisabled?: boolean
  triggerLabel?: string
  onDisabledClick?: () => void
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2" aria-label="AI 深度思考中">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#AEB4BC]"
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </div>
  )
}

export function AiHelpPopover({
  visible,
  onVisibleChange,
  busy,
  text,
  onTextChange,
  onStart,
  onRetry,
  onConfirm,
  trigger,
  triggerDisabled = false,
  triggerLabel = 'AI 帮写',
  onDisabledClick,
}: AiHelpPopoverProps) {
  const waitingForContent = busy && !text.trim()

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (triggerDisabled) {
      onDisabledClick?.()
      return
    }
    if (busy) return
    if (visible) {
      onVisibleChange(false)
      return
    }
    onVisibleChange(true)
    // 只有在当前内容为空时才触发首次转写；已有转写内容仅打开展示，绝不重复调用接口
    if (!text.trim()) {
      onStart()
    }
  }

  const content = (
    <div className="flex w-[300px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] flex-col rounded-[8px] border border-[#E6EAF0] bg-white p-4 text-[13px] text-[#171A1D] shadow-[0_16px_48px_rgba(15,23,42,.16)]">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h3 className="m-0 text-[14px] font-semibold">AI 帮写</h3>
        <button
          type="button"
          onClick={() => onVisibleChange(false)}
          className="grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[#8B949E] hover:bg-[#F2F3F5] hover:text-[#171A1D]"
          aria-label="关闭 AI 帮写"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 rounded-[8px] border border-[#DDE3EC] bg-white p-3">
        {waitingForContent ? (
          <div className="flex h-[240px] max-h-[calc(100vh-220px)] flex-col items-center justify-center gap-3 text-[#8E9299]">
            <ThinkingDots />
            <p className="m-0 text-[13px] font-medium">AI 深度思考中...</p>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            aria-label="AI 帮写内容"
            placeholder="AI 正在分析并提取..."
            style={{ lineHeight: '24px' }}
            className="custom-scrollbar block h-[240px] max-h-[calc(100vh-220px)] w-full resize-none border-0 bg-transparent p-0 pr-1 text-left text-[13px] font-normal leading-6 text-[#171A1D] outline-none"
          />
        )}
      </div>

      {busy ? (
        <button type="button" disabled style={{ marginTop: 12 }} className="h-9 w-full shrink-0 cursor-not-allowed rounded-[8px] border-0 bg-[#C4C6CA] text-[13px] font-semibold text-white">
          正在帮写请稍后...
        </button>
      ) : (
        <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
          <button type="button" onClick={onRetry} className="h-9 cursor-pointer rounded-[8px] border-0 bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#ECEFF4]">
            重新帮写
          </button>
          <button type="button" disabled={!text.trim()} onClick={onConfirm} className="h-9 cursor-pointer rounded-[8px] border-0 bg-[#171A1D] text-[13px] font-semibold text-white transition-colors hover:bg-[#2A2F36] disabled:cursor-not-allowed disabled:bg-[#C4C6CA]">
            确认
          </button>
        </div>
      )}
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      popupVisible={visible}
      onVisibleChange={(nextVisible) => {
        if (!nextVisible) {
          onVisibleChange(false)
        }
      }}
      position="rt"
      triggerProps={{
        showArrow: false,
        popupStyle: {
          padding: 0,
          backgroundColor: 'transparent',
          boxShadow: 'none',
          border: 'none',
        },
      }}
      className="ai-help-popover-content"
    >
      {trigger ?? (
        <button
          type="button"
          onClick={handleTriggerClick}
          className={`ai-help-btn inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-[#D9E8FF] bg-white px-3 text-[13px] font-medium leading-none text-[#1683FF] shadow-sm transition-all hover:bg-[#F2F7FF] hover:border-[#1683FF] ${
            triggerDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`}
          style={{
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            whiteSpace: 'nowrap',
            wordBreak: 'keep-all',
          }}
        >
          {busy ? (
            <Loader2
              className="h-3.5 w-3.5 shrink-0 animate-spin text-[#1683FF]"
              style={{ display: 'inline-block', flexShrink: 0 }}
            />
          ) : (
            <Lightbulb
              className="h-3.5 w-3.5 shrink-0 text-[#1683FF]"
              style={{ display: 'inline-block', flexShrink: 0 }}
            />
          )}
          <span style={{ display: 'inline-block', whiteSpace: 'nowrap', lineHeight: 1 }}>
            {triggerLabel}
          </span>
        </button>
      )}
    </Popover>
  )
}
