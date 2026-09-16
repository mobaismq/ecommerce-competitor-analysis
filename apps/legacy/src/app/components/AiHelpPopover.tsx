import { X } from "lucide-react";

export type AiHelpPopoverStatus = "idle" | "thinking" | "writing" | "ready" | "error";

type AiHelpPopoverProps = {
  open: boolean;
  position: { top: number; left: number } | null;
  fallbackPosition: { top: number; left: number };
  status: AiHelpPopoverStatus;
  text: string;
  visibleText: string;
  error: string;
  retrying: boolean;
  onClose: () => void;
  onRetry: () => void;
  onConfirm: () => void;
};

export function AiHelpPopover({
  open,
  position,
  fallbackPosition,
  status,
  text,
  visibleText,
  error,
  retrying,
  onClose,
  onRetry,
  onConfirm,
}: AiHelpPopoverProps) {
  if (!open) return null;

  const finishedWriting = Boolean(text.trim()) && status === "ready" && visibleText === text;
  const failed = status === "error";
  const panelPosition = position || fallbackPosition;
  const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
  const panelTop = Math.min(Math.max(16, panelPosition.top), Math.max(16, viewportHeight - 380));

  return (
    <div className="fixed z-40 w-[300px]" style={{ top: panelTop, left: panelPosition.left }}>
      <div className="flex max-h-[calc(100vh-32px)] flex-col rounded-[8px] bg-white p-4 shadow-[0_16px_48px_rgba(15,23,42,0.16)] ring-1 ring-[#E6EAF0]">
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#171A1D]">AI 帮写</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-full text-[#8B949E] transition-colors hover:bg-[#F2F3F5] hover:text-[#171A1D]"
            aria-label="关闭 AI 帮写"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 rounded-[8px] border border-[#DDE3EC] bg-white p-3 text-left text-[13px] font-normal leading-6 text-[#171A1D]">
          {!visibleText && !error ? (
            <div className="flex h-[240px] max-h-[calc(100vh-220px)] flex-col items-center justify-center text-[#8E9299]">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#AEB4BC]" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#AEB4BC] [animation-delay:120ms]" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#AEB4BC] [animation-delay:240ms]" />
              </div>
              <div className="text-[13px] font-medium">AI 深度思考中...</div>
            </div>
          ) : (
            <>
              <div className="h-[240px] max-h-[calc(100vh-220px)] overflow-y-auto whitespace-pre-wrap pr-1 custom-scrollbar">
                {visibleText}
                {(status === "writing" || (status === "ready" && visibleText !== text)) && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-[#171A1D]" />
                )}
              </div>
              {error && (
                <div className="rounded-[8px] bg-[#FFF5F5] px-2 py-1.5 text-[12px] font-medium leading-5 text-[#C03535]">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {finishedWriting ? (
          <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="h-9 rounded-[8px] bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#ECEFF4] disabled:cursor-not-allowed disabled:text-[#8B949E]"
            >
              重新帮写
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="h-9 rounded-[8px] bg-[#171A1D] text-[13px] font-semibold text-white transition-colors hover:bg-[#2A2F36]"
            >
              确认
            </button>
          </div>
        ) : failed ? (
          <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-[8px] bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#ECEFF4]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="h-9 rounded-[8px] bg-[#171A1D] text-[13px] font-semibold text-white transition-colors hover:bg-[#2A2F36] disabled:cursor-not-allowed disabled:bg-[#C4C6CA]"
            >
              重新帮写
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled
            className="mt-3 h-9 w-full shrink-0 rounded-[8px] bg-[#C4C6CA] text-[13px] font-semibold text-white"
          >
            正在帮写请稍后...
          </button>
        )}
      </div>
    </div>
  );
}
