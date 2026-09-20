import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { PageHeader } from '../components/PageHeader'

export function AccountInfoPage() {
  const user = useAuth((state) => state.user)
  const navigate = useNavigate()

  const rows = [
    { label: '账号名称', value: user?.username ?? '-', action: null },
    {
      label: '绑定手机号',
      // 桌面端数据契约无手机号字段：宁可显示占位也不伪造（旧版为 mock「136******46」）
      value: (user as { phone?: string } | null)?.phone ?? '-',
      action: { text: '修改手机号', target: '/settings/change-phone' },
    },
    {
      label: '登录密码',
      value: '••••••••',
      action: { text: '修改密码', target: '/settings/change-password' },
    },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader title="账号信息" />
      <div className="mx-auto max-w-[600px] rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-8 text-[24px] font-bold text-[#0A1B39]">账号信息</h1>

        <div className="space-y-0">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between border-b border-[#f0f2f5] py-4">
              <div className="flex items-center gap-3">
                <span className="w-[100px] text-[14px] text-[#86909C]">{row.label}</span>
                <span className="text-[14px] font-medium text-[#0A1B39]">{row.value}</span>
              </div>
              {row.action && (
                <button
                  type="button"
                  onClick={() => navigate(row.action!.target)}
                  className="w-[100px] cursor-pointer rounded border border-[#3388ff] bg-transparent py-1.5 text-[13px] text-[#3388ff] transition-colors hover:bg-[#f0f7ff]"
                >
                  {row.action.text}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="cursor-pointer rounded-lg border-0 bg-[#3388ff] px-8 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#1a6fe8]"
          >
            返回
          </button>
        </div>
      </div>
    </div>
  )
}
