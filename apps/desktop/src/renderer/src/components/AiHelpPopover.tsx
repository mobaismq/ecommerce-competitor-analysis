import type { ReactNode } from 'react'
import { Button, Input, Popover } from '@arco-design/web-react'
import { Lightbulb, Loader2, Sparkles, X } from 'lucide-react'

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
    <div className="flex items-center gap-1.5" aria-label="AI 深度思考中">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#86909C]"
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
    <div className="w-[390px] overflow-hidden rounded-[12px] border border-[#E5E8EF] bg-white p-4 text-[13px] text-[#0A1B39] shadow-[0_12px_36px_rgba(15,23,41,.18)]">
      <div className="mb-3 flex items-center justify-between border-b border-[#f0f2f5] pb-3">
        <div className="flex items-center gap-1.5 text-[15px] font-bold text-[#171A1D]">
          <Sparkles className="h-4 w-4 text-[#1683FF]" />
          <span>AI 帮写</span>
        </div>
        <button
          type="button"
          onClick={() => onVisibleChange(false)}
          className="grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[#86909C] hover:bg-[#F2F3F5] hover:text-[#171A1D]"
          aria-label="关闭 AI 帮写"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {waitingForContent ? (
        <div className="mb-3 flex min-h-[148px] flex-col items-center justify-center gap-3 rounded-[8px] bg-[#F8FAFC]">
          <ThinkingDots />
          <p className="m-0 text-[12px] text-[#86909C]">AI 深度思考中...</p>
        </div>
      ) : (
        <div className="mb-3">
          <label className="mb-1 block text-[11px] text-[#86909C]">提炼出的结构化要求（可编辑）：</label>
          <Input.TextArea
            value={text}
            onChange={onTextChange}
            rows={5}
            placeholder="AI 正在分析并提取..."
            className="text-[12px]"
          />
        </div>
      )}

      {busy ? (
        <Button size="small" disabled className="h-9 w-full rounded-[8px]">
          正在帮写请稍后...
        </Button>
      ) : (
        <div className="flex justify-end gap-2">
          <Button size="small" onClick={onRetry} className="h-9 rounded-[8px] px-4">
            重新帮写
          </Button>
          <Button size="small" type="primary" disabled={!text.trim()} onClick={onConfirm} className="h-9 rounded-[8px] px-5">
            确认
          </Button>
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
      position="right"
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
