import { Button, Space, Typography } from '@arco-design/web-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'

/**
 * 手机验证页。
 * 旧系统该页发送/验证均为 TODO 桩，无真实短信服务。当前按「能力位预留」处理：
 * 不伪装可发送验证码，仅做入口引导；真实短信接入后再启用表单。
 */
export function PhoneVerificationPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const target = params.get('target') === 'phone' ? 'phone' : 'password'

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader title="手机验证" />
      <div className="mx-auto max-w-[600px] rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-8 text-[24px] font-bold text-[#0A1B39]">手机验证</h1>

        <div className="border-b border-[#f0f2f5] py-4">
          <div className="flex items-center gap-3">
            <span className="w-[100px] shrink-0 text-[14px] text-[#86909C]">目标</span>
            <span className="text-[14px] font-medium text-[#0A1B39]">{target === 'phone' ? '改绑手机号' : '修改密码'}</span>
          </div>
        </div>

        <div className="border-b border-[#f0f2f5] py-4">
          <div className="flex items-start gap-3">
            <span className="w-[100px] shrink-0 text-[14px] text-[#86909C]">验证码</span>
            <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.7 }}>
              当前版本未接入短信验证码服务，无法在线发送验证短信。你可以直接前往下方入口完成修改。
            </Typography.Text>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            type="primary"
            size="large"
            long
            className="!max-w-[280px] !rounded-lg"
            onClick={() => navigate('/settings/change-password')}
          >
            去修改密码
          </Button>
          <Button long className="!max-w-[280px] !rounded-lg" onClick={() => navigate('/settings/change-phone')}>
            去修改绑定手机号
          </Button>
        </div>
      </div>
    </div>
  )
}
