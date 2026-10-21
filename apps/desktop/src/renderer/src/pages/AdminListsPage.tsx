import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Table, Tag } from '@arco-design/web-react'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Field, LinkButton, Section, apiErrorText, confirmDanger, unwrapList, useAdminMutation } from './settings/shared'

/**
 * 桌面端自有的「设置」页（旧版没有对应页面，不属迁移范围）：
 * - 租户管理（超级管理员）：多租户开通，旧版是单库单租户模型，这里保留桌面端能力
 * - AI 供应商配置：服务端下发的供应商档案
 *
 * 账号 / 角色 / 店铺 / 部门四个旧版设置页已迁到 pages/settings/（AccountsPage 等）。
 */

interface TenantRow {
  id: string
  name: string
  code?: string | null
  status?: string | null
  createdAt?: string
}

interface ProviderRow {
  id: string
  name: string
  type: string
  enabled: boolean
  apiKeyRef: string
}

export function AdminTenantsPage() {
  const tenantsQuery = useQuery<TenantRow[]>({
    queryKey: ['tenants'],
    queryFn: async () => unwrapList<TenantRow>((await api.get('/api/tenants')).data).rows,
  })

  const [form, setForm] = useState({ name: '', adminUsername: '', adminPassword: '', adminDisplayName: '' })

  const createTenant = useAdminMutation({
    mutationFn: async () =>
      api.post('/api/tenants', {
        name: form.name.trim(),
        adminUsername: form.adminUsername.trim(),
        adminPassword: form.adminPassword,
        adminDisplayName: form.adminDisplayName.trim() || undefined,
      }),
    successText: '租户已创建',
    invalidate: [['tenants']],
  })

  const submit = () => {
    if (!form.name.trim() || !form.adminUsername.trim() || !form.adminPassword.trim()) {
      return
    }
    createTenant.mutate(undefined as never, { onSuccess: () => setForm({ name: '', adminUsername: '', adminPassword: '', adminDisplayName: '' }) })
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader breadcrumbs={[{ label: '设置' }, { label: '租户管理' }]} />

      <Section title="创建租户（仅超级管理员）" className="mb-4">
        <div className="grid grid-cols-4 items-end gap-3">
          <Field label="租户名称" required>
            <Input value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="请输入租户名称" allowClear />
          </Field>
          <Field label="超管用户名" required>
            <Input value={form.adminUsername} onChange={(v) => setForm((p) => ({ ...p, adminUsername: v }))} placeholder="如 tenant_admin" allowClear />
          </Field>
          <Field label="初始密码" required>
            <Input.Password value={form.adminPassword} onChange={(v) => setForm((p) => ({ ...p, adminPassword: v }))} placeholder="请输入密码" />
          </Field>
          <Field label="显示名">
            <Input value={form.adminDisplayName} onChange={(v) => setForm((p) => ({ ...p, adminDisplayName: v }))} placeholder="选填" allowClear />
          </Field>
        </div>
        <div className="mt-3">
          <Button type="primary" loading={createTenant.isPending} onClick={submit} disabled={!form.name.trim() || !form.adminUsername.trim() || !form.adminPassword.trim()}>
            创建租户
          </Button>
        </div>
      </Section>

      <Section title={`租户列表（${tenantsQuery.data?.length ?? 0}）`}>
        {tenantsQuery.isError && (
          <div className="mb-3 rounded-lg border border-[#ffd2d2] bg-[#fff3f3] px-4 py-3 text-[13px] text-[#d93026]">
            租户加载失败：{apiErrorText(tenantsQuery.error)}
          </div>
        )}
        <Table
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '编码', dataIndex: 'code', render: (v?: string | null) => <span className="font-mono text-[12px]">{v || '-'}</span> },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status?: string | null) => (
                <Tag color={status === 'disabled' ? 'gray' : 'green'} size="small">
                  {status === 'disabled' ? '停用' : '启用'}
                </Tag>
              ),
            },
          ]}
          data={tenantsQuery.data ?? []}
          rowKey="id"
          loading={tenantsQuery.isLoading}
          border={false}
          pagination={false}
          noDataElement={<span className="text-[13px] text-[#86909C]">暂无租户数据</span>}
        />
      </Section>
    </div>
  )
}

export function AdminProviderProfilesPage() {
  const profilesQuery = useQuery<ProviderRow[]>({
    queryKey: ['provider-profiles'],
    queryFn: async () => unwrapList<ProviderRow>((await api.get('/api/provider-profiles')).data).rows,
  })

  const invalidate = [['provider-profiles']]
  const activate = useAdminMutation({
    mutationFn: async (row: ProviderRow) => api.post(`/api/provider-profiles/${row.id}/activate`),
    successText: '已设为当前供应商',
    invalidate,
  })
  const toggle = useAdminMutation({
    mutationFn: async (row: ProviderRow) => api.patch(`/api/provider-profiles/${row.id}`, { enabled: !row.enabled }),
    successText: '状态已更新',
    invalidate,
  })
  const remove = useAdminMutation({
    mutationFn: async (row: ProviderRow) => api.delete(`/api/provider-profiles/${row.id}`),
    successText: '供应商配置已删除',
    invalidate,
  })

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader breadcrumbs={[{ label: '设置' }, { label: 'AI 供应商配置' }]} />
      <Section title={`供应商档案（${profilesQuery.data?.length ?? 0}）`}>
        {profilesQuery.isError && (
          <div className="mb-3 rounded-lg border border-[#ffd2d2] bg-[#fff3f3] px-4 py-3 text-[13px] text-[#d93026]">
            供应商加载失败：{apiErrorText(profilesQuery.error)}
          </div>
        )}
        <Table
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '类型', dataIndex: 'type' },
            {
              title: '状态',
              dataIndex: 'enabled',
              render: (enabled: boolean) => (
                <Tag color={enabled ? 'green' : 'gray'} size="small">
                  {enabled ? '启用' : '停用'}
                </Tag>
              ),
            },
            { title: 'Key', dataIndex: 'apiKeyRef', render: (v: string) => <span className="font-mono text-[12px]">{v}</span> },
            {
              title: '操作',
              dataIndex: 'op',
              render: (_: unknown, row: ProviderRow) => (
                <div className="flex items-center gap-3">
                  <LinkButton onClick={() => activate.mutate(row)}>设为当前</LinkButton>
                  <LinkButton onClick={() => toggle.mutate(row)}>{row.enabled ? '停用' : '启用'}</LinkButton>
                  <LinkButton danger onClick={() => confirmDanger(`确定删除供应商配置「${row.name}」？`, () => remove.mutateAsync(row))}>
                    删除
                  </LinkButton>
                </div>
              ),
            },
          ]}
          data={profilesQuery.data ?? []}
          rowKey="id"
          loading={profilesQuery.isLoading}
          border={false}
          pagination={false}
          noDataElement={<span className="text-[13px] text-[#86909C]">暂无供应商配置</span>}
        />
      </Section>
    </div>
  )
}
