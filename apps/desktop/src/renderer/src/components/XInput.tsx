import { useState, type FocusEvent } from 'react'
import { X } from 'lucide-react'

interface XInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  type?: 'text' | 'password' | 'numeric'
  inputMode?: 'text' | 'decimal' | 'numeric'
  className?: string
}

/** 旧版风格输入框 + 尾部「x」清空（全项目输入框统一用此组件，唯一实现）。 */
export function XInput({
  value,
  onChange,
  placeholder,
  disabled,
  type = 'text',
  inputMode = 'text',
  className = '',
}: XInputProps) {
  const [focused, setFocused] = useState(false)

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setFocused(false)
    // 允许外部在 onBlur 里做清理（当前无场景，占位保持简单）
    void e
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`h-11 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 text-[14px] font-semibold text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${value ? 'pr-8' : ''}`}
      />
      {value && !disabled && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange('')}
          tabIndex={-1}
          aria-label="清空"
          title="清空"
          className={`absolute top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full border-0 bg-transparent p-0 text-[#c0c4cc] transition-colors hover:bg-[#f2f4f7] hover:text-[#86909C] ${focused ? 'right-2.5' : 'right-2.5'}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/** 紧凑变体：查询卡 h-8 控件（带搜索图标与尾部 x），用于筛选行。 */
export function XSearchInput({
  value,
  onChange,
  placeholder,
  onEnter,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onEnter?: () => void
  className?: string
}) {
  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <SearchIcon />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder || '请输入'}
        className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清空"
          title="清空"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
