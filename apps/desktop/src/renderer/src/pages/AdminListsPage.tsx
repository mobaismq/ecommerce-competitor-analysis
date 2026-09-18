import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

interface UserRow {
  id: string
  username: string
  displayName: string | null
  isActive: boolean
}

interface RoleRow {
  id: string
  code: string
  name: string
}

interface TenantRow {
  id: string
  name: string
  code?: string
  status?: string
}

interface ProviderRow {
  id: string
  name: string
  type: string
  enabled: boolean
  apiKeyRef: string
}

function refresh<T>(refetch: () => Promise<unknown>, mutate: Promise<unknown>) {
  void mutate
    .then(() => refetch())
    .catch((err: any) => {
      const data = err?.response?.data
      const msg = data?.message || err?.message || '请求失败'
      const detail = Array.isArray(msg) ? msg.join('; ') : String(msg)
      alert(`操作失败: ${detail}`)
    })
}

export function AdminUsersPage() {
  const users = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get<UserRow[]>('/api/users')).data })
  const roles = useQuery({ queryKey: ['roles'], queryFn: async () => (await api.get<RoleRow[]>('/api/roles')).data })
  const [form, setForm] = useState({ username: '', password: '', displayName: '', roleId: '' })

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.username.trim() || !form.password.trim()) {
      alert('请填写用户名和密码')
      return
    }
    refresh(
      users.refetch,
      api.post('/api/users', {
        username: form.username.trim(),
        password: form.password.trim(),
        displayName: form.displayName.trim() || undefined,
        roleIds: form.roleId ? [form.roleId] : [],
      }),
    )
    setForm({ username: '', password: '', displayName: '', roleId: '' })
  }
  const toggle = (row: UserRow) => refresh(users.refetch, api.patch(`/api/users/${row.id}`, { isActive: !row.isActive }))
  const resetPassword = async (row: UserRow) => {
    const password = window.prompt(`为 ${row.username} 设置新密码`)
    if (password) refresh(users.refetch, api.patch(`/api/users/${row.id}`, { password }))
  }
  const remove = (row: UserRow) => {
    if (window.confirm(`确定删除 ${row.username}？`)) refresh(users.refetch, api.delete(`/api/users/${row.id}`))
  }

  return (
    <div className="page-container">
      <section className="panel">
        <div className="panel-head">
          <h2>账号管理</h2>
          <button className="ghost" onClick={() => void users.refetch()}>刷新</button>
        </div>
        <form className="form-grid" onSubmit={create}>
          <label>用户名<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="请输入用户名" /></label>
          <label>初始密码<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="请输入密码" /></label>
          <label>显示名<input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="选填" /></label>
          <label>角色
            <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              <option value="">不分配</option>
              {(roles.data ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>
          <button type="submit">创建账号</button>
        </form>
        <table>
          <thead><tr><th>用户名</th><th>显示名</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {(users.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.username}</td>
                <td>{row.displayName ?? '-'}</td>
                <td>{row.isActive ? '启用' : '停用'}</td>
                <td>
                  <button className="ghost" onClick={() => toggle(row)}>{row.isActive ? '停用' : '启用'}</button>
                  <button className="ghost" onClick={() => resetPassword(row)}>重置密码</button>
                  <button className="ghost" onClick={() => remove(row)}>删除</button>
                </td>
              </tr>
            ))}
            {(users.data ?? []).length === 0 && <tr><td colSpan={4}>暂无数据</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export function AdminTenantsPage() {
  const tenants = useQuery({ queryKey: ['tenants'], queryFn: async () => (await api.get<TenantRow[]>('/api/tenants')).data })
  const [form, setForm] = useState({ name: '', adminUsername: '', adminPassword: '', adminDisplayName: '' })
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.adminUsername.trim() || !form.adminPassword.trim()) {
      alert('请完整填写租户名称及初始管理员账号密码')
      return
    }
    refresh(
      tenants.refetch,
      api.post('/api/tenants', {
        name: form.name.trim(),
        adminUsername: form.adminUsername.trim(),
        adminPassword: form.adminPassword.trim(),
        adminDisplayName: form.adminDisplayName.trim() || undefined,
      }),
    )
    setForm({ name: '', adminUsername: '', adminPassword: '', adminDisplayName: '' })
  }
  return (
    <div className="page-container">
      <section className="panel">
        <div className="panel-head">
          <h2>租户管理（仅超级管理员）</h2>
          <button className="ghost" onClick={() => void tenants.refetch()}>刷新</button>
        </div>
        <form className="form-grid" onSubmit={create}>
          <label>租户名称<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="请输入租户名称" /></label>
          <label>超级管理员用户名<input value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} required placeholder="如: tenant_admin" /></label>
          <label>初始密码<input type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required placeholder="请输入密码" /></label>
          <label>显示名<input value={form.adminDisplayName} onChange={(e) => setForm({ ...form, adminDisplayName: e.target.value })} placeholder="选填" /></label>
          <button type="submit">创建租户</button>
        </form>
        <table>
          <thead><tr><th>名称</th><th>编码</th><th>状态</th></tr></thead>
          <tbody>
            {(tenants.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.code}</td>
                <td>{row.status}</td>
              </tr>
            ))}
            {(tenants.data ?? []).length === 0 && <tr><td colSpan={3}>暂无数据</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export function AdminRolesPage() {
  const roles = useQuery({ queryKey: ['roles'], queryFn: async () => (await api.get<RoleRow[]>('/api/roles')).data })
  const [form, setForm] = useState({ code: '', name: '' })
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      alert('请填写角色编码和角色名称')
      return
    }
    refresh(roles.refetch, api.post('/api/roles', { code: form.code.trim(), name: form.name.trim() }))
    setForm({ code: '', name: '' })
  }
  return (
    <div className="page-container">
      <section className="panel">
        <div className="panel-head">
          <h2>角色管理</h2>
          <button className="ghost" onClick={() => void roles.refetch()}>刷新</button>
        </div>
        <form className="form-grid" onSubmit={create}>
          <label>角色编码<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="如: operator" /></label>
          <label>角色名称<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="如: 运营人员" /></label>
          <button type="submit">创建角色</button>
        </form>
        <table>
          <thead><tr><th>编码</th><th>名称</th></tr></thead>
          <tbody>
            {(roles.data ?? []).map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td></tr>)}
            {(roles.data ?? []).length === 0 && <tr><td colSpan={2}>暂无数据</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export function AdminStoresPage() {
  const stores = useQuery({ queryKey: ['stores'], queryFn: async () => (await api.get<Array<Record<string, string>>>(`/api/stores`)).data })
  return (
    <div className="page-container">
      <section className="panel">
        <div className="panel-head">
          <h2>店铺管理</h2>
          <button className="ghost" onClick={() => void stores.refetch()}>刷新</button>
        </div>
        <table>
          <thead><tr><th>名称</th><th>状态</th></tr></thead>
          <tbody>
            {(stores.data ?? []).map((row, index) => <tr key={index}><td>{row.name}</td><td>{row.status ?? '-'}</td></tr>)}
            {(stores.data ?? []).length === 0 && <tr><td colSpan={2}>暂无数据</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export function AdminProviderProfilesPage() {
  const profiles = useQuery({ queryKey: ['provider-profiles'], queryFn: async () => (await api.get<ProviderRow[]>('/api/provider-profiles')).data })
  const activate = (row: ProviderRow) => refresh(profiles.refetch, api.post(`/api/provider-profiles/${row.id}/activate`))
  const toggle = (row: ProviderRow) => refresh(profiles.refetch, api.patch(`/api/provider-profiles/${row.id}`, { enabled: !row.enabled }))
  const remove = (row: ProviderRow) => {
    if (window.confirm(`确定删除供应商配置 ${row.name}？`)) refresh(profiles.refetch, api.delete(`/api/provider-profiles/${row.id}`))
  }
  return (
    <div className="page-container">
      <section className="panel">
        <div className="panel-head">
          <h2>AI 供应商配置（仅超级管理员）</h2>
          <button className="ghost" onClick={() => void profiles.refetch()}>刷新</button>
        </div>
        <table>
          <thead><tr><th>名称</th><th>类型</th><th>状态</th><th>Key</th><th>操作</th></tr></thead>
          <tbody>
            {(profiles.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.type}</td>
                <td>{row.enabled ? '启用' : '停用'}</td>
                <td>{row.apiKeyRef}</td>
                <td>
                  <button className="ghost" onClick={() => activate(row)}>设为当前</button>
                  <button className="ghost" onClick={() => toggle(row)}>{row.enabled ? '停用' : '启用'}</button>
                  <button className="ghost" onClick={() => remove(row)}>删除</button>
                </td>
              </tr>
            ))}
            {(profiles.data ?? []).length === 0 && <tr><td colSpan={5}>暂无数据</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}

interface DepartmentRow {
  id: string
  name: string
  parentId: string | null
}

export function AdminDepartmentsPage() {
  const departments = useQuery({ queryKey: ['departments'], queryFn: async () => (await api.get<DepartmentRow[]>('/api/departments')).data })
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')

  // 扁平列表按 parentId 组装层级（根 parentId 为 null/空）
  const tree = buildDeptTree(departments.data ?? [])

  const create = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      window.alert('请填写部门名称')
      return
    }
    refresh(departments.refetch, api.post('/api/departments', { name: name.trim(), parentId: parentId || undefined }))
    setName('')
    setParentId('')
  }

  const rename = async (row: DepartmentRow) => {
    const val = window.prompt(`修改部门「${row.name}」名称`, row.name)
    if (val && val.trim() && val.trim() !== row.name) refresh(departments.refetch, api.patch(`/api/departments/${row.id}`, { name: val.trim() }))
  }

  return (
    <div className="page-container">
      <section className="panel">
        <div className="panel-head">
          <h2>部门管理（仅超级管理员）</h2>
          <button className="ghost" onClick={() => void departments.refetch()}>刷新</button>
        </div>
        <form onSubmit={create} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="部门名称" />
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">（顶级部门）</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button type="submit" className="ghost">新建部门</button>
        </form>
        <table>
          <thead><tr><th>部门</th><th>上级</th><th>操作</th></tr></thead>
          <tbody>
            {departments.data?.length ? (
              departments.data.map((row) => (
                <tr key={row.id} style={{ paddingLeft: treeDepth(departments.data ?? [], row.id) * 16 }}>
                  <td>
                    <span style={{ marginLeft: treeDepth(departments.data ?? [], row.id) * 16 }}>{row.name}</span>
                  </td>
                  <td>{row.parentId ? (departments.data?.find((d) => d.id === row.parentId)?.name ?? '-') : '-'}</td>
                  <td><button className="ghost" onClick={() => void rename(row)}>重命名</button></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={3}>加载中…</td></tr>
            )}
            {(departments.data ?? []).length === 0 && <tr><td colSpan={3}>暂无部门</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function buildDeptTree(rows: DepartmentRow[]): DepartmentRow[] {
  return rows.filter((r) => !r.parentId)
}

function treeDepth(rows: DepartmentRow[], id: string, seen = new Set<string>()): number {
  if (seen.has(id)) return 0
  const row = rows.find((r) => r.id === id)
  if (!row || !row.parentId) return 0
  seen.add(id)
  return 1 + treeDepth(rows, row.parentId, seen)
}
