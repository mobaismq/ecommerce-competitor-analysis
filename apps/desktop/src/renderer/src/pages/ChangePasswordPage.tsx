import { useState } from 'react'
import { Button, Form, Input, Message } from '@arco-design/web-react'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'

export function ChangePasswordPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  // 业务逻辑保持桌面端现状：/api/auth/change-password（含原密码校验）
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
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader title="修改密码" />
      <div className="mx-auto max-w-[600px] rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-8 text-[24px] font-bold text-[#0A1B39]">修改密码</h1>

        <Form form={form} layout="vertical" onSubmit={submit}>
          <div className="border-b border-[#f0f2f5] py-4">
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-[14px] text-[#86909C]">原密码</span>
              <Form.Item field="oldPassword" rules={[{ required: true, message: '请输入原密码' }]} className="mb-0 flex-1">
                <Input.Password placeholder="请输入原密码" />
              </Form.Item>
            </div>
          </div>

          <div className="border-b border-[#f0f2f5] py-4">
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-[14px] text-[#86909C]">新密码</span>
              <Form.Item
                field="newPassword"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { minLength: 6, maxLength: 20, message: '密码长度 6-20 位' },
                ]}
                className="mb-0 flex-1"
              >
                <Input.Password placeholder="请输入新密码（6-20字母、数字、特殊字符）" />
              </Form.Item>
            </div>
          </div>

          <div className="border-b border-[#f0f2f5] py-4">
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-[14px] text-[#86909C]">确认密码</span>
              <Form.Item field="confirmPassword" rules={[{ required: true, message: '请再次输入新密码' }]} className="mb-0 flex-1">
                <Input.Password placeholder="请再次输入新密码" />
              </Form.Item>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <Button type="primary" size="large" loading={loading} htmlType="submit" className="!rounded-lg px-12">
              确认修改
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}
