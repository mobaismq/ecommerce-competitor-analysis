import { Button, Card, Space, Typography } from '@arco-design/web-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

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
    <div className="page">
      <Card title="手机验证" style={{ maxWidth: 460 }}>
        <Typography.Paragraph>
          当前版本未接入短信验证码服务，无法在线发送验证短信。你可以直接前往：
        </Typography.Paragraph>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="primary" long onClick={() => navigate('/settings/change-password')}>
            去修改密码
          </Button>
          <Button long onClick={() => navigate('/settings/change-phone')}>
            去修改绑定手机号
          </Button>
          <Typography.Text type="secondary">目标：{target === 'phone' ? '改绑手机号' : '修改密码'}</Typography.Text>
        </Space>
      </Card>
    </div>
  )
}
