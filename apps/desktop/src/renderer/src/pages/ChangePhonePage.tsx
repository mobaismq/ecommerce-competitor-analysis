import { useState } from 'react'
import { Button, Card, Form, Input, Message } from '@arco-design/web-react'
import { api } from '../api/client'

export function ChangePhonePage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const values = await form.validate()
    setLoading(true)
    try {
      await api.post('/api/auth/change-phone', { newPhone: values.newPhone })
      Message.success('手机号修改成功')
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
      <Card title="修改绑定手机号" style={{ maxWidth: 420 }}>
        <Form form={form} layout="vertical" onSubmit={submit}>
          <Form.Item
            label="新手机号"
            field="newPhone"
            rules={[{ required: true, message: '请输入新手机号' }, { pattern: /^1\d{10}$/, message: '手机号格式不正确' }]}
          >
            <Input placeholder="请输入 11 位手机号" />
          </Form.Item>
          <Button type="primary" long loading={loading} htmlType="submit">
            保存
          </Button>
        </Form>
      </Card>
    </div>
  )
}
