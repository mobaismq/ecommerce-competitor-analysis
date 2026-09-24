import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, RefreshCw, Search, X } from 'lucide-react'
import { Checkbox, DatePicker, Modal, Table } from '@arco-design/web-react'
import dayjs from 'dayjs'
import { api } from '../api/client'
import { PageHeader } from '../components/PageHeader'

interface UserRow {
  id: string
  username: string
  displayName: string | null
  isActive: boolean
  roleIds?: string[]
}

interface RoleRow {
  id: string
  code: string
  name: string
  permissionIds?: string[]
  storeIds?: string[]
  permissionAll?: boolean
}

interface PermNode {
  id: string
  code: string
  name: string
  type: string
}
interface PermGroup {
  code: string
  name: string
  type: string
  children: PermNode[]
}
interface StoreOption {
  id: string
  name: string
}

interface DepartmentRow {
  id: string
  name: string
  parentId: string | null
}

function refresh(refetch: () => Promise<unknown>, mutate: Promise<unknown>) {
  void mutate
    .then(() => refetch())
    .catch((err: any) => {
      const data = err?.response?.data
      const msg = data?.message || err?.message || '请求失败'
      const detail = Array.isArray(msg) ? msg.join('; ') : String(msg)
      alert(`操作失败: ${detail}`)
    })
}

/** 扁平部门数组 → 层级树（对照旧版 DeptTreeNode 缩进深度） */
interface DeptNode extends DepartmentRow {
  children: DeptNode[]
  depth: number
}

function buildDeptTree(rows: DepartmentRow[]): DeptNode[] {
  const map = new Map<string, DeptNode>()
  rows.forEach((r) => map.set(r.id, { ...r, children: [], depth: 0 }))
  const roots: DeptNode[] = []
  rows.forEach((r) => {
    const node = map.get(r.id)!
    if (r.parentId && map.has(r.parentId)) {
      map.get(r.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  const assignDepth = (nodes: DeptNode[], depth: number) => {
    nodes.forEach((n) => {
      n.depth = depth
      assignDepth(n.children, depth + 1)
    })
  }
  assignDepth(roots, 0)
  return roots
}

export function AdminUsersPage() {
  const users = useQuery({ queryKey: ['users'], queryFn: async () => (await api.get<UserRow[]>('/api/users')).data })
  const roles = useQuery({ queryKey: ['roles'], queryFn: async () => (await api.get<RoleRow[]>('/api/roles')).data })
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get<DepartmentRow[]>('/api/departments')).data,
  })

  // 账号列表 roleIds → 角色名映射（对照旧版 mapAccountRow 返回 roleIds 数组的展示）
  const roleNameMap = new Map((roles.data ?? []).map((role) => [role.id, role.name]))

  const [form, setForm] = useState({ username: '', password: '', displayName: '', roleId: '' })
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

  const deptTree = useMemo(() => buildDeptTree(departments.data ?? []), [departments.data])

  const deptNameById = useMemo(() => {
    const map = new Map<string, string>()
    ;(departments.data ?? []).forEach((d) => map.set(d.id, d.name))
    return map
  }, [departments.data])

  // 用户挂到部门（按用户名前缀启发不可取——桌面端 /api/users 无部门字段，部门树仅作组织视图过滤展示占位）
  const filteredUsers = useMemo(() => {
    const list = users.data ?? []
    const kw = appliedSearch.trim().toLowerCase()
    if (!kw) return list
    return list.filter(
      (u) => u.username.toLowerCase().includes(kw) || (u.displayName || '').toLowerCase().includes(kw),
    )
  }, [users.data, appliedSearch])

  const toggleDept = (id: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    if (password) refresh(users.refetch, api.post(`/api/users/${row.id}/reset-password`, { password }))
  }
  const remove = (row: UserRow) => {
    if (window.confirm(`确定删除 ${row.username}？`)) refresh(users.refetch, api.delete(`/api/users/${row.id}`))
  }

  const renderDeptNodes = (nodes: DeptNode[]) =>
    nodes.map((node) => (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => {
            toggleDept(node.id)
            setDeptFilter((cur) => (cur === node.id ? null : node.id))
          }}
          className={`flex w-full cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent py-1.5 pr-2 text-left text-[13px] transition-colors hover:bg-[#f5f6f8] ${
            deptFilter === node.id ? 'bg-[#e8f3ff] font-bold text-[#3388ff]' : 'text-[#0A1B39]'
          }`}
          style={{ paddingLeft: 8 + node.depth * 20 }}
        >
          {node.children.length > 0 ? (
            <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${expandedDepts.has(node.id) ? 'rotate-90' : ''}`} />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {expandedDepts.has(node.id) && node.children.length > 0 && renderDeptNodes(node.children)}
      </div>
    ))

  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      render: (v: string) => <span className="text-[13px] font-semibold text-[#0A1B39]">{v}</span>,
    },
    {
      title: '显示名',
      dataIndex: 'displayName',
      render: (v: string | null) => <span className="text-[13px] text-[#344054]">{v ?? '-'}</span>,
    },
    {
      title: '角色',
      dataIndex: 'roleIds',
      render: (roleIds: string[] | undefined) => {
        const ids = roleIds ?? []
        return <span className="text-[13px] text-[#344054]">{ids.length ? ids.map((id) => roleNameMap.get(id) ?? id).join('、') : '-'}</span>
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      render: (isActive: boolean) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${
            isActive ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#f2f4f7] text-[#86909C]'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-[#2e7d32]' : 'bg-[#d0d5dd]'}`} />
          {isActive ? '启用' : '停用'}
        </span>
      ),
    },
    {
      title: '操作',
      dataIndex: 'op',
      render: (_: unknown, row: UserRow) => (
        <div className="flex items-center gap-3 text-[13px]">
          <button type="button" onClick={() => toggle(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[#3388ff] hover:text-[#1a6fe8]">
            {row.isActive ? '停用' : '启用'}
          </button>
          <button type="button" onClick={() => void resetPassword(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[#3388ff] hover:text-[#1a6fe8]">
            重置密码
          </button>
          <button type="button" onClick={() => remove(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[#c62828] hover:text-[#a02020]">
            删除
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      {/* 手写面包屑（对照旧版 AccountManagement） */}
      <div className="mb-4 text-[13px] text-[#86909C]">
        设置 / <span className="font-medium text-[#0A1B39]">账号管理</span>
      </div>

      {/* 左右分栏（对照旧版 flex gap-4 h-[calc(100vh-120px)]） */}
      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 160px)' }}>
        {/* 左：部门树 */}
        <aside className="flex h-fit w-[280px] shrink-0 flex-col rounded-xl border border-[#e5eaf2] bg-white">
          <div className="flex items-center justify-between border-b border-[#eef1f5] px-4 py-3">
            <h2 className="m-0 text-[14px] font-bold text-[#0A1B39]">部门管理</h2>
            <button
              type="button"
              onClick={() => void departments.refetch()}
              className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-bold text-[#3388ff] hover:text-[#1a6fe8]"
            >
              刷新
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2 custom-scrollbar">
            {departments.isLoading ? (
              <div className="grid h-24 place-items-center text-[13px] text-[#86909C]">加载中…</div>
            ) : deptTree.length > 0 ? (
              renderDeptNodes(deptTree)
            ) : (
              <div className="rounded-lg bg-[#f8fafc] px-3 py-6 text-center text-[12px] text-[#86909C]">
                暂无部门数据
                <br />
                （可在超级管理员「部门管理」中维护）
              </div>
            )}
          </div>
          {deptFilter && (
            <div className="border-t border-[#eef1f5] px-3 py-2 text-[12px] text-[#3388ff]">
              已选部门：{deptNameById.get(deptFilter)}
              <button
                type="button"
                onClick={() => setDeptFilter(null)}
                className="ml-2 inline-flex cursor-pointer items-center border-0 bg-transparent p-0 text-[#86909C] hover:text-[#c62828]"
              >
                <X className="h-3 w-3" /> 清除筛选
              </button>
            </div>
          )}
        </aside>

        {/* 右：账号列表区 */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* 创建账号卡（对照旧版白卡表单） */}
          <section className="rounded-xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <h2 className="m-0 mb-4 text-[15px] font-extrabold text-[#0A1B39]">创建账号</h2>
            <form className="grid grid-cols-5 items-end gap-3" onSubmit={create}>
              <label className="grid gap-1.5 text-[12px] text-[#86909C]">
                用户名
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  placeholder="请输入用户名"
                  className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                />
              </label>
              <label className="grid gap-1.5 text-[12px] text-[#86909C]">
                初始密码
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  placeholder="请输入密码"
                  className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                />
              </label>
              <label className="grid gap-1.5 text-[12px] text-[#86909C]">
                显示名
                <input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="选填"
                  className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                />
              </label>
              <label className="grid gap-1.5 text-[12px] text-[#86909C]">
                角色
                <select
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                  className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                >
                  <option value="">不分配</option>
                  {(roles.data ?? []).map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="h-9 cursor-pointer rounded-lg border-0 bg-[#3388ff] text-[13px] font-bold text-white hover:bg-[#1a6fe8]"
              >
                创建账号
              </button>
            </form>
          </section>

          {/* 账号表格卡 */}
          <section className="min-w-0 flex-1 overflow-hidden rounded-xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-5 py-4">
              <h2 className="m-0 text-[15px] font-extrabold text-[#0A1B39]">账号列表（{filteredUsers.length}）</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setAppliedSearch(search)}
                    placeholder="搜索用户名 / 显示名"
                    className={`h-8 w-[240px] rounded-lg border border-[#e6e9ef] bg-white pl-8 text-[13px] outline-none focus:border-[#409eff] ${search ? 'pr-7' : 'pr-3'}`}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        setAppliedSearch('')
                      }}
                      aria-label="清空"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setAppliedSearch(search)}
                  className="h-8 shrink-0 cursor-pointer rounded-lg border-0 bg-[#409eff] px-4 text-[13px] font-bold text-white hover:bg-[#66b1ff]"
                >
                  查询
                </button>
                <button
                  type="button"
                  onClick={() => void users.refetch()}
                  className="flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-[#e6e9ef] bg-white px-3 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  刷新
                </button>
              </div>
            </div>

            <Table
              columns={userColumns}
              data={filteredUsers}
              rowKey="id"
              loading={users.isLoading}
              border={false}
              noDataElement={<span className="text-[13px] text-[#86909C]">暂无数据</span>}
              pagination={false}
            />
          </section>
        </div>
      </div>
    </div>
  )
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
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="mb-4 text-[13px] text-[#86909C]">
        设置 / <span className="font-medium text-[#0A1B39]">租户管理</span>
      </div>
      <section className="mb-4 rounded-xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <h2 className="m-0 mb-4 text-[15px] font-extrabold text-[#0A1B39]">创建租户（仅超级管理员）</h2>
        <form className="grid grid-cols-5 items-end gap-3" onSubmit={create}>
          <label className="grid gap-1.5 text-[12px] text-[#86909C]">
            租户名称
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="请输入租户名称" className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white" />
          </label>
          <label className="grid gap-1.5 text-[12px] text-[#86909C]">
            超管用户名
            <input value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} required placeholder="如: tenant_admin" className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white" />
          </label>
          <label className="grid gap-1.5 text-[12px] text-[#86909C]">
            初始密码
            <input type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required placeholder="请输入密码" className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white" />
          </label>
          <label className="grid gap-1.5 text-[12px] text-[#86909C]">
            显示名
            <input value={form.adminDisplayName} onChange={(e) => setForm({ ...form, adminDisplayName: e.target.value })} placeholder="选填" className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white" />
          </label>
          <button type="submit" className="h-9 cursor-pointer rounded-lg border-0 bg-[#3388ff] text-[13px] font-bold text-white hover:bg-[#1a6fe8]">
            创建租户
          </button>
        </form>
      </section>
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <Table
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '编码', dataIndex: 'code' },
            { title: '状态', dataIndex: 'status' },
          ]}
          data={tenants.data ?? []}
          rowKey="id"
          loading={tenants.isLoading}
          border={false}
          noDataElement={<span className="text-[13px] text-[#86909C]">暂无数据</span>}
          pagination={false}
        />
      </section>
    </div>
  )
}

export function AdminRolesPage() {
  const roles = useQuery({ queryKey: ['roles'], queryFn: async () => (await api.get<RoleRow[]>('/api/roles')).data })
  const permTree = useQuery({
    queryKey: ['permissionTree'],
    queryFn: async () => (await api.get<{ groups: PermGroup[]; stores: StoreOption[] }>('/api/permissions/tree')).data,
  })
  const groups = permTree.data?.groups ?? []
  const stores = permTree.data?.stores ?? []

  const [form, setForm] = useState({ code: '', name: '' })
  const [permIds, setPermIds] = useState<string[]>([])
  const [storeIds, setStoreIds] = useState<string[]>([])

  // 编辑态：目标角色 + 回填的权限/店铺
  const [editRole, setEditRole] = useState<RoleRow | null>(null)
  const [editPermIds, setEditPermIds] = useState<string[]>([])
  const [editStoreIds, setEditStoreIds] = useState<string[]>([])

  const togglePerm = (id: string) =>
    setPermIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleStore = (id: string) =>
    setStoreIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleGroup = (childIds: string[], checked: boolean) =>
    setPermIds((prev) => (checked ? Array.from(new Set([...prev, ...childIds])) : prev.filter((x) => !childIds.includes(x))))

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      alert('请填写角色编码和角色名称')
      return
    }
    refresh(roles.refetch, api.post('/api/roles', { code: form.code.trim(), name: form.name.trim(), permissionIds: permIds, storeIds }))
    setForm({ code: '', name: '' })
    setPermIds([])
    setStoreIds([])
  }

  const toggle = (row: RoleRow) =>
    refresh(roles.refetch, api.patch(`/api/roles/${row.id}`, { status: (row as RoleRow & { status?: string }).status === 'disabled' ? 'active' : 'disabled' }))
  const remove = (row: RoleRow) => {
    if (window.confirm(`确定删除角色 ${row.name}？`)) refresh(roles.refetch, api.delete(`/api/roles/${row.id}`))
  }

  const openEdit = (row: RoleRow) => {
    setEditRole(row)
    setEditPermIds(row.permissionAll ? [] : (row.permissionIds ?? []))
    setEditStoreIds(row.storeIds ?? [])
  }
  const saveEdit = () => {
    if (!editRole) return
    refresh(roles.refetch, api.patch(`/api/roles/${editRole.id}`, { permissionIds: editPermIds, storeIds: editStoreIds }))
    setEditRole(null)
  }

  // 权限/店铺选择面板（create 与 edit 共用）
  const renderConfig = (
    curPermIds: string[],
    curStoreIds: string[],
    onTogglePerm: (id: string) => void,
    onToggleStore: (id: string) => void,
    onToggleGroup: (childIds: string[], checked: boolean) => void,
  ) => (
    <div className="mt-4 rounded-lg border border-[#eef1f5] bg-[#f9fafb] p-3">
      <div className="mb-2 text-[13px] font-bold text-[#0A1B39]">菜单 / 按钮权限</div>
      {groups.length === 0 ? (
        <p className="text-[12px] text-[#86909C]">暂无权限项</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {groups.map((g) => {
            const childIds = g.children.map((c) => c.id)
            const allChecked = childIds.length > 0 && childIds.every((id) => curPermIds.includes(id))
            const someChecked = childIds.some((id) => curPermIds.includes(id))
            return (
              <div key={g.code} className="rounded-md border border-[#e6e9ef] bg-white p-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-[#0A1B39]">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={someChecked && !allChecked}
                    onChange={(v) => onToggleGroup(childIds, v === true)}
                  />
                  {g.name}
                  <span className="ml-auto text-[10px] text-[#98A2B3]">{g.code}</span>
                </label>
                <div className="mt-1.5 grid gap-0.5">
                  {g.children.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-1.5 pl-4 text-[12px] text-[#4E5969]">
                      <Checkbox checked={curPermIds.includes(c.id)} onChange={() => onTogglePerm(c.id)} />
                      {c.name}
                      <span className="ml-auto text-[10px] text-[#c0c4cc]">{c.type === 'button' ? '按钮' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mb-2 mt-4 text-[13px] font-bold text-[#0A1B39]">店铺权限</div>
      {stores.length === 0 ? (
        <p className="text-[12px] text-[#86909C]">暂无店铺（不配置即视为不限制店铺数据范围）</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {stores.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[#4E5969]">
              <Checkbox checked={curStoreIds.includes(s.id)} onChange={() => onToggleStore(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-[#98A2B3]">说明：未配置任何菜单/按钮/店铺时，该角色按"全部放行"处理（先不加权限的宽松默认）；配置后按所选范围收窄。</p>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader breadcrumbs={[{ label: '设置' }, { label: '角色管理' }]} />
      <section className="mb-4 rounded-xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <h2 className="m-0 mb-4 text-[15px] font-extrabold text-[#0A1B39]">创建角色</h2>
        <form className="grid grid-cols-3 items-end gap-3" onSubmit={create}>
          <label className="grid gap-1.5 text-[12px] text-[#86909C]">
            角色编码
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="如: operator" className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white" />
          </label>
          <label className="grid gap-1.5 text-[12px] text-[#86909C]">
            角色名称
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="如: 运营人员" className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white" />
          </label>
          <button type="submit" className="h-9 cursor-pointer rounded-lg border-0 bg-[#3388ff] text-[13px] font-bold text-white hover:bg-[#1a6fe8]">
            创建角色
          </button>
          <div className="col-span-3">{renderConfig(permIds, storeIds, togglePerm, toggleStore, toggleGroup)}</div>
        </form>
      </section>
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <Table
          columns={[
            { title: '编码', dataIndex: 'code', render: (v: string) => <span className="font-mono">{v}</span> },
            { title: '名称', dataIndex: 'name' },
            {
              title: '权限',
              dataIndex: 'permissionIds',
              render: (_: unknown, row: RoleRow) => (
                <span className="text-[12px] text-[#98A2B3]">
                  {row.permissionAll
                    ? `全选（${(row.permissionIds ?? []).filter((id) => id !== '*').length} 项 + 未来新增）`
                    : `${(row.permissionIds ?? []).length} 项权限 / ${(row.storeIds ?? []).length} 店铺`}
                </span>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (_: unknown, row: RoleRow) => ((row as RoleRow & { status?: string }).status === 'disabled' ? '停用' : '启用'),
            },
            {
              title: '操作',
              dataIndex: 'op',
              render: (_: unknown, row: RoleRow) => (
                <div className="flex gap-3">
                  <button type="button" onClick={() => openEdit(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#3388ff] hover:underline">
                    权限
                  </button>
                  <button type="button" onClick={() => toggle(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#3388ff] hover:underline">
                    启停
                  </button>
                  <button type="button" onClick={() => remove(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#f53f3f] hover:underline">
                    删除
                  </button>
                </div>
              ),
            },
          ]}
          data={roles.data ?? []}
          rowKey="id"
          loading={roles.isLoading}
          border={false}
          noDataElement={<span className="text-[13px] text-[#86909C]">暂无数据</span>}
          pagination={false}
        />
      </section>

      {/* 编辑权限弹窗 */}
      <Modal
        title={`编辑权限 · ${editRole?.name ?? ''}`}
        visible={editRole !== null}
        onCancel={() => setEditRole(null)}
        onOk={saveEdit}
        okText="保存权限"
        cancelText="取消"
        style={{ width: 880 }}
      >
        <div className="max-h-[65vh] overflow-auto">
          {editRole &&
            renderConfig(
              editPermIds,
              editStoreIds,
              (id) => setEditPermIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
              (id) => setEditStoreIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
              (childIds, checked) =>
                setEditPermIds((prev) => (checked ? Array.from(new Set([...prev, ...childIds])) : prev.filter((x) => !childIds.includes(x)))),
            )}
        </div>
      </Modal>
    </div>
  )
}

interface StoreRow {
  id: string
  name: string
  status?: string | null
  externalId?: string | null
  platform?: { name?: string; logo?: string | null } | null
  storeLogo?: string | null
  authStatus?: 'valid' | 'expired' | 'none' | null
}

export function AdminStoresPage() {
  const stores = useQuery({ queryKey: ['stores'], queryFn: async () => (await api.get<StoreRow[]>(`/api/stores`)).data })
  const [form, setForm] = useState({ name: '', externalId: '', authorizedAt: '' })
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) {
      alert('请填写店铺名称')
      return
    }
    refresh(stores.refetch, api.post('/api/stores', { name: form.name.trim(), externalId: form.externalId.trim() || undefined, authorizedAt: form.authorizedAt.trim() || undefined }))
    setForm({ name: '', externalId: '', authorizedAt: '' })
  }
  const toggle = (row: StoreRow) => refresh(stores.refetch, api.patch(`/api/stores/${row.id}`, { status: row.status === 'disabled' ? 'active' : 'disabled' }))
  const remove = (row: StoreRow) => {
    if (window.confirm(`确定删除店铺 ${row.name}？`)) refresh(stores.refetch, api.delete(`/api/stores/${row.id}`))
  }

  const storeColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (name: string, row: StoreRow) => (
        <div className="flex items-center gap-2">
          {(row.storeLogo ?? row.platform?.logo) ? (
            <img src={row.storeLogo ?? row.platform?.logo ?? ''} alt={name} className="h-5 w-5 rounded object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          ) : null}
          {name}
        </div>
      ),
    },
    { title: '平台', dataIndex: 'platform', render: (_: unknown, row: StoreRow) => row.platform?.name ?? '-' },
    { title: '平台店铺 ID', dataIndex: 'externalId', render: (v: string | null) => <span className="font-mono">{v ?? '-'}</span> },
    { title: '状态', dataIndex: 'status', render: (status: string | null | undefined) => (status === 'disabled' ? '停用' : status ?? '-') },
    {
      title: '授权状态',
      dataIndex: 'authStatus',
      render: (authStatus: StoreRow['authStatus']) =>
        authStatus === 'valid' ? (
          <span className="inline-block rounded-full bg-[#e8f5ee] px-2 py-0.5 text-[12px] font-semibold text-[#389e0d]">有效</span>
        ) : authStatus === 'expired' ? (
          <span className="inline-block rounded-full bg-[#fff1f0] px-2 py-0.5 text-[12px] font-semibold text-[#f5222d]">已过期</span>
        ) : (
          <span className="text-[12px] text-[#98a2b3]">未设置</span>
        ),
    },
    {
      title: '操作',
      dataIndex: 'op',
      render: (_: unknown, row: StoreRow) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => toggle(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#3388ff] hover:underline">
            启停
          </button>
          <button type="button" onClick={() => remove(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[#f53f3f] hover:underline">
            删除
          </button>
        </div>
      ),
    },
  ]
  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader breadcrumbs={[{ label: '设置' }, { label: '店铺管理' }]} />
      <section className="mb-4 rounded-xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <h2 className="m-0 mb-4 text-[15px] font-extrabold text-[#0A1B39]">新增店铺</h2>
        <form className="grid grid-cols-3 items-end gap-3" onSubmit={create}>
          <label className="grid gap-1.5 text-[12px] text-[#86909C]">
            店铺名称
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="请输入店铺名称" className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white" />
          </label>
          <label className="grid gap-1.5 text-[12px] text-[#86909C]">
            平台店铺 ID
            <input value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} placeholder="选填" className="h-9 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white" />
          </label>
          <label className="grid gap-1.5 text-[12px] text-[#86909C]">
            授权时间
            <DatePicker
              value={form.authorizedAt ? dayjs(form.authorizedAt) : undefined}
              onChange={(dateString) => setForm({ ...form, authorizedAt: dateString || '' })}
              style={{ width: '100%' }}
            />
          </label>
          <button type="submit" className="h-9 cursor-pointer rounded-lg border-0 bg-[#3388ff] text-[13px] font-bold text-white hover:bg-[#1a6fe8]">
            新增店铺
          </button>
        </form>
      </section>
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="flex items-center justify-between border-b border-[#eef1f5] px-5 py-4">
          <h2 className="m-0 text-[15px] font-extrabold text-[#0A1B39]">店铺列表（{(stores.data ?? []).length}）</h2>
          <button
            type="button"
            onClick={() => void stores.refetch()}
            className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[#e6e9ef] bg-white px-3 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>
        <Table
          columns={storeColumns}
          data={stores.data ?? []}
          rowKey="id"
          loading={stores.isLoading}
          border={false}
          noDataElement={<span className="text-[13px] text-[#86909C]">暂无数据</span>}
          pagination={false}
        />
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
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="mb-4 text-[13px] text-[#86909C]">
        设置 / <span className="font-medium text-[#0A1B39]">AI 供应商配置</span>
      </div>
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <Table
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '类型', dataIndex: 'type' },
            { title: '状态', dataIndex: 'enabled', render: (enabled: boolean) => (enabled ? '启用' : '停用') },
            { title: 'Key', dataIndex: 'apiKeyRef', render: (v: string) => <span className="font-mono text-[12px]">{v}</span> },
            {
              title: '操作',
              dataIndex: 'op',
              render: (_: unknown, row: ProviderRow) => (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => activate(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[#3388ff]">设为当前</button>
                  <button type="button" onClick={() => toggle(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[#3388ff]">{row.enabled ? '停用' : '启用'}</button>
                  <button type="button" onClick={() => remove(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[#c62828]">删除</button>
                </div>
              ),
            },
          ]}
          data={profiles.data ?? []}
          rowKey="id"
          loading={profiles.isLoading}
          border={false}
          noDataElement={<span className="text-[13px] text-[#86909C]">暂无数据</span>}
          pagination={false}
        />
      </section>
    </div>
  )
}

interface DepartmentRow2 {
  id: string
  name: string
  parentId: string | null
  enabled?: boolean
}

export function AdminDepartmentsPage() {
  const departments = useQuery({ queryKey: ['departments'], queryFn: async () => (await api.get<DepartmentRow2[]>('/api/departments')).data })
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')

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

  const rename = async (row: DepartmentRow2) => {
    const val = window.prompt(`修改部门「${row.name}」名称`, row.name)
    if (val && val.trim() && val.trim() !== row.name) refresh(departments.refetch, api.patch(`/api/departments/${row.id}`, { name: val.trim() }))
  }

  // 启用/停用（对照旧版 dept_status：1启用 0停用）
  const toggleEnabled = (row: DepartmentRow2) =>
    refresh(departments.refetch, api.patch(`/api/departments/${row.id}`, { enabled: !row.enabled }))

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="mb-4 text-[13px] text-[#86909C]">
        设置 / <span className="font-medium text-[#0A1B39]">部门管理</span>
      </div>
      <section className="mb-4 rounded-xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <form onSubmit={create} className="flex items-end gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="部门名称" className="h-9 flex-1 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2.5 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white" />
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-9 flex-1 rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-2 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white">
            <option value="">（顶级部门）</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="submit" className="h-9 shrink-0 cursor-pointer rounded-lg border-0 bg-[#3388ff] px-4 text-[13px] font-bold text-white hover:bg-[#1a6fe8]">
            新建部门
          </button>
        </form>
      </section>
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <Table
          columns={[
            {
              title: '部门',
              dataIndex: 'name',
              render: (name: string, row: DepartmentRow2) => (
                <span style={{ paddingLeft: treeDepth2(departments.data ?? [], row.id) * 16 }}>{name}</span>
              ),
            },
            {
              title: '上级',
              dataIndex: 'parentId',
              render: (parentId: string | null) => (parentId ? (departments.data?.find((d) => d.id === parentId)?.name ?? '-') : '-'),
            },
            {
              title: '状态',
              dataIndex: 'enabled',
              render: (_: unknown, row: DepartmentRow2) => (
                <button type="button" onClick={() => toggleEnabled(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[#3388ff]">
                  {row.enabled === false ? '停用' : '启用'}
                </button>
              ),
            },
            {
              title: '操作',
              dataIndex: 'op',
              render: (_: unknown, row: DepartmentRow2) => (
                <button type="button" onClick={() => void rename(row)} className="cursor-pointer border-0 bg-transparent p-0 text-[#3388ff]">
                  重命名
                </button>
              ),
            },
          ]}
          data={departments.data ?? []}
          rowKey="id"
          loading={departments.isLoading}
          border={false}
          noDataElement={<span className="text-[13px] text-[#86909C]">暂无部门</span>}
          pagination={false}
        />
      </section>
    </div>
  )
}

function treeDepth2(rows: DepartmentRow2[], id: string, seen = new Set<string>()): number {
  if (seen.has(id)) return 0
  const row = rows.find((r) => r.id === id)
  if (!row || !row.parentId) return 0
  seen.add(id)
  return 1 + treeDepth2(rows, row.parentId, seen)
}
