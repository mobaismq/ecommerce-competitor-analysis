import { ResultActionDialog } from './ResultActionDialog'

export const IMAGE_RESIZE_OPTIONS: Array<{ label: string; value: string; dimension?: string }> = [
  { label: '普通A+', value: '970:600', dimension: '970:600' },
  { label: '高级A+（Web端）', value: '1464:600', dimension: '1464:600' },
  { label: '高级A+（移动端）', value: '600:450', dimension: '600:450' },
  { label: '1:1', value: '1:1' },
  { label: '3:4', value: '3:4' },
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
]

interface ImageResizeDialogProps {
  visible: boolean
  batch: boolean
  ratio: string
  onRatioChange: (ratio: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function ImageResizeDialog({ visible, batch, ratio, onRatioChange, onClose, onConfirm }: ImageResizeDialogProps) {
  return (
    <ResultActionDialog
      visible={visible}
      title={batch ? '批量改尺寸' : '智能改尺寸'}
      onClose={onClose}
      widthClassName="max-w-[500px]"
      footer={<div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={onClose} className="h-11 cursor-pointer rounded-[8px] border-0 bg-[#F2F3F5] text-[14px] font-semibold text-[#171A1D] transition-colors hover:bg-[#E5E6EB]">取消</button>
        <button type="button" onClick={onConfirm} className="h-11 cursor-pointer rounded-[8px] border-0 bg-[#171A1D] text-[14px] font-semibold text-white transition-colors hover:bg-[#2A2F36]">确定 · 15</button>
      </div>}
    >
      <div className="space-y-1">
        {IMAGE_RESIZE_OPTIONS.map((option, index) => (
          <div key={option.value} className={index === 3 ? 'mt-3 border-t border-[#EEF0F3] pt-3' : ''}>
            <button type="button" onClick={() => onRatioChange(option.value)} aria-pressed={ratio === option.value} className={`flex h-11 w-full cursor-pointer items-center gap-3 rounded-[8px] border-0 px-3 text-left transition-colors ${ratio === option.value ? 'bg-[#F2F3F5]' : 'bg-white hover:bg-[#F7F8FA]'}`}>
              <span className={`grid h-4 w-4 place-items-center rounded-full border ${ratio === option.value ? 'border-[#171A1D]' : 'border-[#C9CDD4]'}`}>
                {ratio === option.value && <span className="h-2 w-2 rounded-full bg-[#171A1D]" />}
              </span>
              <span className="flex-1 text-[14px] font-semibold text-[#4E5969]">{option.label}</span>
              {option.dimension && <span className="text-[13px] font-medium text-[#86909C]">{option.dimension}</span>}
            </button>
          </div>
        ))}
      </div>
    </ResultActionDialog>
  )
}
