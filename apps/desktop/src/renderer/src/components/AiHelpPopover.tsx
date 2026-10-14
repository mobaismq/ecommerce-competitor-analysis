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
}: AiHelpPopoverProps) {
  const waitingForContent = busy && !text.trim()

  const content = (
    <div className="w-[380px] overflow-hidden rounded-[12px] bg-white p-4 text-[13px] text-[#0A1B39] shadow-[0_12px_36px_rgba(15,23,41,.18)]">
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
      onVisibleChange={onVisibleChange}
      position="right"
    >
      {trigger ?? (
        <button
          type="button"
          onClick={onStart}
          disabled={triggerDisabled || busy}
          className="flex h-9 min-w-[108px] shrink-0 flex-nowrap cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#D9E8FF] bg-white px-3 text-[14px] font-medium leading-none text-[#1683FF] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all' }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
          {triggerLabel}
        </button>
      )}
    </Popover>
  )
}
