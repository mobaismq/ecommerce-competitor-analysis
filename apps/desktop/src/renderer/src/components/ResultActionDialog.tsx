import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ResultActionDialogProps {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  widthClassName?: string
}

export function ResultActionDialog({ visible, title, onClose, children, footer, widthClassName = 'max-w-[420px]' }: ResultActionDialogProps) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/[0.04] p-6" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${widthClassName} rounded-[8px] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,.18)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 className="m-0 text-[16px] font-semibold text-[#171A1D]">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-7 w-7 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-[#9AA4B2] transition-colors hover:bg-[#F5F6F8] hover:text-[#4E5969]" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
        <footer className="mt-4">{footer}</footer>
      </section>
    </div>
  )
}
