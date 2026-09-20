import { useState } from 'react'
import { Button, Form, Input, Message } from '@arco-design/web-react'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'

export function ChangePhonePage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  // 业务逻辑保持桌面端现状：/api/auth/change-phone
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
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader title="修改手机号" />
      <div className="mx-auto max-w-[600px] rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-8 text-[24px] font-bold text-[#0A1B39]">修改手机号</h1>

        <Form form={form} layout="vertical" onSubmit={submit}>
          <div className="border-b border-[#f0f2f5] py-4">
            <div className="flex items-center gap-3">
              <span className="w-[100px] shrink-0 text-[14px] text-[#86909C]">新手机号</span>
              <Form.Item
                field="newPhone"
                rules={[{ required: true, message: '请输入新手机号' }, { match: /^1\d{10}$/, message: '手机号格式不正确' }]}
                className="mb-0 flex-1"
              >
                <Input placeholder="请输入新手机号" maxLength={11} />
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
