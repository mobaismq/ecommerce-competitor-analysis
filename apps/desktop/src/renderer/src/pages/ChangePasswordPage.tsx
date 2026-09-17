import { useState } from 'react'
import { Button, Card, Form, Input, Message } from '@arco-design/web-react'
import { api } from '../api/client'

export function ChangePasswordPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const values = await form.validate()
    if (values.newPassword !== values.confirmPassword) {
      Message.error('两次输入的新密码不一致')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/auth/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      })
      Message.success('密码修改成功')
      form.resetFields()
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      Message.error(msg ?? '修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <Card title="修改密码" style={{ maxWidth: 420 }}>
        <Form form={form} layout="vertical" onSubmit={submit}>
          <Form.Item label="原密码" field="oldPassword" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item
            label="新密码"
            field="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { minLength: 6, maxLength: 20, message: '密码长度 6-20 位' },
            ]}
          >
            <Input.Password placeholder="6-20 位" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            field="confirmPassword"
            rules={[{ required: true, message: '请再次输入新密码' }]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
          <Button type="primary" long loading={loading} htmlType="submit">
            保存
          </Button>
        </Form>
      </Card>
    </div>
  )
}