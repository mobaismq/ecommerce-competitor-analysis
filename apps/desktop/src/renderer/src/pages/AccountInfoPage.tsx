import { Button, Card, Descriptions, Space } from '@arco-design/web-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

export function AccountInfoPage() {
  const user = useAuth((state) => state.user)
  const navigate = useNavigate()

  return (
    <div className="page">
      <Card title="账号信息" style={{ maxWidth: 480 }}>
        <Descriptions
          column={1}
          data={[
            { label: '账号', value: user?.username ?? '-' },
            { label: '昵称', value: user?.displayName ?? '-' },
            { label: '所属租户', value: user?.tenantId ?? '-' },
          ]}
          style={{ marginBottom: 20 }}
        />
        <Space direction="vertical">
          <Button type="primary" long onClick={() => navigate('/settings/change-password')}>
            修改密码
          </Button>
          <Button long onClick={() => navigate('/settings/change-phone')}>
            修改绑定手机号
          </Button>
        </Space>
      </Card>
    </div>
  )
}
