import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Minus, Plus, Search, X } from 'lucide-react'
import { api } from '../../api/client'
import { Can } from '../../components/Can'
import { PageHeader } from '../../components/PageHeader'
import { apiErrorText, unwrapList, useAdminMutation } from './shared'

/**
 * 角色管理（迁移自旧版 app/src/app/pages/RoleManagement.tsx）。
 *
 * ## 布局与样式：沿用旧版
 * - 列表：面包屑 → 查询卡（角色名称 + 查询/重置，单行）→ 创建角色 → 自定义表格（角色名称/角色描述/状态/操作）
 *   → 「共 N 条」+ `< 1 2 3 >` 分页 → 旧版删除确认弹窗
 * - 新增/编辑 = **整页表单**：角色名称 / 角色描述 / 角色权限（Tab：菜单·按钮权限 | 店铺权限）
 *   - 菜单/按钮：带边框面板 + 「全选（菜单/按钮）」栏 + 分组表格（三态勾选，菜单取消时联动取消其按钮）
 *   - 店铺：带边框面板 + 「全选（店铺）」栏 + 店铺勾选列表
 *   - 底部居中「确认 / 取消」
 *
 * ## 与旧版的必要差异
 * - 旧版角色无编码字段，新后端 Role.code 必填且唯一 → 表单增加「角色编码」（仅创建时可填）
 * - 旧版权限表是「一级/二级/三级菜单 + 操作按钮」四列（来自 sys_menu 三级字典）；
 *   新后端权限字典按 code 首段分组、无菜单层级字段 → 表格改为「一级菜单（分组）/权限项/类型/勾选」，
 *   分组 rowSpan、全选栏、三态勾选、按钮联动规则保持一致
 * - 旧版店铺按平台分组展示；新接口只返回店铺 id/name → 平铺勾选（样式一致）
 */

const PAGE_SIZE = 12

interface RoleRow {
  id: string
  code: string
  name: string
  description?: string | null
  status?: string | null
  permissionIds?: string[]
  permissionAll?: boolean
  storeIds?: string[]
}

interface PermNode {
  id: string
  code: string
  name: string
  type: string
  parentCode?: string | null
}

interface PermGroup {
  code: string
  name: string
  children: PermNode[]
}

interface StoreOption {
  id: string
  name: string
}

const INPUT_CLASS = 'h-9 w-full rounded-lg border bg-white px-3 text-[13px] text-[#0A1B39] outline-none transition-colors focus:border-[#409eff]'

/** 三态勾选框（旧版用 span + Check/Minus 图标实现） */
function TriCheckbox({
  checked,
  indeterminate,
  onClick,
  disabled,
}: {
  checked: boolean
  indeterminate?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <span
      onClick={disabled ? undefined : onClick}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
        checked || indeterminate ? 'border-[#409eff] bg-[#409eff]' : 'border-[#dcdfe6] bg-white'
      } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {checked ? <Check className="h-3 w-3 text-white" /> : indeterminate ? <Minus className="h-3 w-3 text-white" /> : null}
    </span>
  )
}

// ── 角色表单整页视图（旧版 RoleForm） ──
function RoleForm({
  isEdit,
  initial,
  groups,
  stores,
  submitting,
  onSave,
  onCancel,
}: {
  isEdit: boolean
  initial: { code: string; name: string; description: string; permissionIds: string[]; storeIds: string[] }
  groups: PermGroup[]
  stores: StoreOption[]
  submitting: boolean
  onSave: (values: { code: string; name: string; description: string; permissionIds: string[]; storeIds: string[] }) => void
  onCancel: () => void
}) {
  const [code, setCode] = useState(initial.code)
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [permIds, setPermIds] = useState<string[]>(initial.permissionIds)
  const [storeIds, setStoreIds] = useState<string[]>(initial.storeIds)
  const [activeTab, setActiveTab] = useState<'menu' | 'store'>('menu')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const allPermIds = useMemo(() => groups.flatMap((group) => group.children.map((child) => child.id)), [groups])
  const allStoreIds = useMemo(() => stores.map((store) => store.id), [stores])

  // 旧版「全选」是独立标记；这里用「全选时勾满当前全部项」等价表达
  const menuAll = allPermIds.length > 0 && allPermIds.every((id) => permIds.includes(id))
  const storeAll = allStoreIds.length > 0 && allStoreIds.every((id) => storeIds.includes(id))

  const togglePerm = (child: PermNode, checked: boolean) => {
    setPermIds((prev) => {
      if (checked) return Array.from(new Set([...prev, child.id]))
      // 取消菜单时联动取消其按钮（按 parentCode）
      const childButtonIds = groups
        .flatMap((group) => group.children)
        .filter((item) => item.parentCode === child.code)
        .map((item) => item.id)
      return prev.filter((id) => id !== child.id && !childButtonIds.includes(id))
    })
  }

  const toggleGroup = (group: PermGroup, checked: boolean) => {
    const ids = group.children.map((child) => child.id)
    setPermIds((prev) => (checked ? Array.from(new Set([...prev, ...ids])) : prev.filter((id) => !ids.includes(id))))
  }

  const handleSave = () => {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = '角色名称不可为空'
    else if (name.length > 50) next.name = '角色名称最多50个字符'
    if (!isEdit) {
      if (!code.trim()) next.code = '角色编码不可为空'
      else if (!/^[a-zA-Z0-9:_-]+$/.test(code.trim())) next.code = '只允许字母、数字、下划线、冒号、短横线'
    }
    if (description.length > 200) next.description = '角色描述最多200个字符'
    if (!permIds.length) next.permission = '菜单/按钮权限不可为空'
    else if (stores.length > 0 && !storeIds.length) next.permission = '店铺权限不可为空'
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    onSave({ code: code.trim(), name: name.trim(), description: description.trim(), permissionIds: permIds, storeIds })
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader breadcrumbs={[{ label: '设置' }, { label: '角色管理' }, { label: isEdit ? '编辑角色' : '创建角色' }]} />

      <div className="rounded-xl bg-white p-6">
        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
            角色名称 <span className="text-[#ff4d4f]">*</span>
          </label>
          <input
            type="text"
            placeholder="请输入"
            value={name}
            onChange={(event) => {
              const value = event.target.value
              setName(value)
              setErrors((prev) => ({ ...prev, name: value.length > 50 ? '角色名称最多50个字符' : '' }))
            }}
            className={`${INPUT_CLASS} ${errors.name ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'}`}
          />
          {errors.name && <p className="mt-1 text-[12px] text-[#ff4d4f]">{errors.name}</p>}
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
            角色编码 {!isEdit && <span className="text-[#ff4d4f]">*</span>}
          </label>
          <input
            type="text"
            placeholder="如 operator（后端必填，创建后不可改）"
            value={code}
            readOnly={isEdit}
            onChange={(event) => {
              setCode(event.target.value)
              setErrors((prev) => ({ ...prev, code: '' }))
            }}
            className={`${INPUT_CLASS} ${errors.code ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'} ${
              isEdit ? 'cursor-not-allowed bg-[#f5f6f8] text-[#86909C]' : ''
            }`}
          />
          {errors.code && <p className="mt-1 text-[12px] text-[#ff4d4f]">{errors.code}</p>}
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">角色描述</label>
          <input
            type="text"
            placeholder="请输入"
            value={description}
            onChange={(event) => {
              const value = event.target.value
              setDescription(value)
              setErrors((prev) => ({ ...prev, description: value.length > 200 ? '角色描述最多200个字符' : '' }))
            }}
            className={`${INPUT_CLASS} ${errors.description ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'}`}
          />
          {errors.description && <p className="mt-1 text-[12px] text-[#ff4d4f]">{errors.description}</p>}
        </div>

        {/* 角色权限 */}
        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
            角色权限 <span className="text-[#ff4d4f]">*</span>
            {errors.permission && <span className="ml-2 font-normal text-[#ff4d4f]">{errors.permission}</span>}
          </label>

          <div className="mb-4 flex border-b border-[#e6e9ef]">
            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`cursor-pointer border-0 border-b-2 bg-transparent px-4 py-2 text-[13px] font-medium transition-colors ${
                activeTab === 'menu' ? 'border-[#409eff] text-[#409eff]' : 'border-transparent text-[#86909C] hover:text-[#0A1B39]'
              }`}
            >
              菜单/按钮权限
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('store')}
              className={`cursor-pointer border-0 border-b-2 bg-transparent px-4 py-2 text-[13px] font-medium transition-colors ${
                activeTab === 'store' ? 'border-[#409eff] text-[#409eff]' : 'border-transparent text-[#86909C] hover:text-[#0A1B39]'
              }`}
            >
              店铺权限
            </button>
          </div>

          {activeTab === 'menu' && (
            <div className="overflow-hidden rounded-lg border border-[#e6e9ef]">
              <div className="flex items-center gap-2 border-b border-[#f0f2f5] bg-[#fafbfc] px-3 py-2">
                <TriCheckbox
                  checked={menuAll}
                  onClick={() => setPermIds(menuAll ? [] : [...allPermIds])}
                  disabled={allPermIds.length === 0}
                />
                <span className="text-[13px] font-medium text-[#0A1B39]">全选（菜单/按钮）</span>
              </div>
              <div className={menuAll ? 'pointer-events-none opacity-60' : ''}>
                {groups.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[13px] text-[#86909C]">暂无权限字典</div>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-[#f5f6f8]">
                        <th className="w-[150px] px-3 py-2 text-left font-medium text-[#86909C]">一级菜单</th>
                        <th className="px-3 py-2 text-left font-medium text-[#86909C]">权限项</th>
                        <th className="w-[100px] px-3 py-2 text-left font-medium text-[#86909C]">类型</th>
                        <th className="w-[80px] px-3 py-2 text-left font-medium text-[#86909C]">勾选</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => {
                        const childIds = group.children.map((child) => child.id)
                        const allChecked = childIds.length > 0 && childIds.every((id) => permIds.includes(id))
                        const someChecked = childIds.some((id) => permIds.includes(id)) && !allChecked
                        return group.children.map((child, index) => (
                          <tr key={child.id} className={index > 0 ? 'border-t border-[#f0f2f5]' : 'border-t border-[#f0f2f5]'}>
                            {index === 0 && (
                              <td rowSpan={group.children.length} className="border-r border-[#f0f2f5] px-3 py-2 align-middle">
                                <div className="flex items-center gap-2">
                                  <TriCheckbox
                                    checked={allChecked}
                                    indeterminate={someChecked}
                                    onClick={() => toggleGroup(group, !allChecked)}
                                  />
                                  <span className="text-[#0A1B39]">{group.name}</span>
                                </div>
                              </td>
                            )}
                            <td className="border-r border-[#f0f2f5] px-3 py-2">
                              <span className="text-[#0A1B39]">{child.name}</span>
                              <span className="ml-2 text-[11px] text-[#c0c4cc]">{child.code}</span>
                            </td>
                            <td className="border-r border-[#f0f2f5] px-3 py-2">
                              <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${child.type === 'button' ? 'bg-[#f0f7ff] text-[#3388ff]' : 'bg-[#f2f4f7] text-[#86909C]'}`}>
                                {child.type === 'button' ? '按钮' : '菜单'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <TriCheckbox
                                checked={permIds.includes(child.id)}
                                onClick={() => togglePerm(child, !permIds.includes(child.id))}
                              />
                            </td>
                          </tr>
                        ))
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <p className="px-3 py-2 text-[11px] text-[#98A2B3]">
                规则：勾选菜单不会自动选中其按钮；取消菜单会一并取消其下按钮（按 parentCode 关联）。
              </p>
            </div>
          )}

          {activeTab === 'store' && (
            <div className="rounded-lg border border-[#e6e9ef]">
              <div className="flex items-center gap-2 border-b border-[#f0f2f5] bg-[#fafbfc] px-3 py-2">
                <TriCheckbox
                  checked={storeAll}
                  onClick={() => setStoreIds(storeAll ? [] : [...allStoreIds])}
                  disabled={allStoreIds.length === 0}
                />
                <span className="text-[13px] font-medium text-[#0A1B39]">全选（店铺）</span>
              </div>
              <div className={`p-4 ${storeAll ? 'pointer-events-none opacity-60' : ''}`}>
                {stores.length === 0 ? (
                  <p className="text-[13px] text-[#86909C]">暂无店铺数据（不配置即视为不限制店铺数据范围）</p>
                ) : (
                  <div className="space-y-1.5">
                    {stores.map((store) => {
                      const checked = storeIds.includes(store.id)
                      return (
                        <div key={store.id} className="flex items-center gap-2">
                          <TriCheckbox
                            checked={checked}
                            onClick={() => setStoreIds((prev) => (checked ? prev.filter((id) => id !== store.id) : [...prev, store.id]))}
                          />
                          <span className="text-[13px] text-[#0A1B39]">{store.name}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="h-9 cursor-pointer rounded-lg border-0 bg-[#409eff] px-6 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '保存中…' : '确认'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-9 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-6 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 主页面 ──
export function RolesPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)
  const [deletingRole, setDeletingRole] = useState<RoleRow | null>(null)

  const rolesQuery = useQuery({
    queryKey: ['settings-roles', filter, page],
    queryFn: async () => {
      const { data } = await api.get('/api/roles', {
        params: { ...(filter.trim() ? { keyword: filter.trim() } : {}), page, pageSize: PAGE_SIZE },
      })
      return unwrapList<RoleRow>(data)
    },
  })

  const treeQuery = useQuery({
    queryKey: ['permissionTree'],
    queryFn: async () => (await api.get<{ groups: PermGroup[]; stores: StoreOption[] }>('/api/permissions/tree')).data,
  })
  const groups = treeQuery.data?.groups ?? []
  const stores = treeQuery.data?.stores ?? []

  const total = rolesQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const invalidate = [['settings-roles'], ['roles']]

  const createRole = useAdminMutation({
    mutationFn: async (values: { code: string; name: string; description: string; permissionIds: string[]; storeIds: string[] }) =>
      api.post('/api/roles', {
        code: values.code,
        name: values.name,
        description: values.description || undefined,
        permissionIds: values.permissionIds,
        storeIds: values.storeIds,
      }),
    successText: '角色已创建',
    invalidate,
  })

  const updateRole = useAdminMutation({
    mutationFn: async (values: { code: string; name: string; description: string; permissionIds: string[]; storeIds: string[] }) =>
      api.patch(`/api/roles/${editingRole?.id}`, {
        name: values.name,
        description: values.description || undefined,
        permissionIds: values.permissionIds,
        storeIds: values.storeIds,
      }),
    successText: '角色已更新',
    invalidate,
  })

  const toggleRole = useAdminMutation({
    mutationFn: async (row: RoleRow) => api.patch(`/api/roles/${row.id}`, { status: row.status === 'disabled' ? 'active' : 'disabled' }),
    successText: '状态已更新',
    invalidate,
  })

  const deleteRole = useAdminMutation({
    mutationFn: async (row: RoleRow) => api.delete(`/api/roles/${row.id}`),
    successText: '角色已删除',
    invalidate,
  })

  useEffect(() => {
    // 删除确认弹窗按 Esc 关闭（与旧版弹窗点击遮罩关闭一致的轻量补充）
    if (!deletingRole) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDeletingRole(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [deletingRole])

  // ── 创建/编辑整页视图 ──
  if (view !== 'list') {
    const initial = editingRole
      ? {
          code: editingRole.code,
          name: editingRole.name,
          description: editingRole.description ?? '',
          permissionIds: editingRole.permissionAll ? groups.flatMap((group) => group.children.map((child) => child.id)) : editingRole.permissionIds ?? [],
          storeIds: editingRole.storeIds ?? [],
        }
      : { code: '', name: '', description: '', permissionIds: [], storeIds: [] }
    return (
      <RoleForm
        key={editingRole?.id ?? 'create'}
        isEdit={view === 'edit'}
        initial={initial}
        groups={groups}
        stores={stores}
        submitting={createRole.isPending || updateRole.isPending}
        onSave={(values) => {
          if (view === 'create') createRole.mutate(values, { onSuccess: () => setView('list') })
          else updateRole.mutate(values, { onSuccess: () => setView('list') })
        }}
        onCancel={() => setView('list')}
      />
    )
  }

  // ── 列表视图 ──
  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader breadcrumbs={[{ label: '设置' }, { label: '角色管理' }]} />

      {/* 查询卡（旧版单行） */}
      <div className="mb-4 rounded-xl bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">角色名称</label>
            <div className="relative w-[240px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
              <input
                type="text"
                placeholder="请输入"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilter(query.trim())
              setPage(1)
            }}
            className="h-8 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff]"
          >
            查询
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setFilter('')
              setPage(1)
            }}
            className="h-8 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]"
          >
            重置
          </button>
        </div>
      </div>

      {/* 创建角色 */}
      <div className="mb-4 flex items-center justify-between">
        <Can code="role:manage">
          <button
            type="button"
            onClick={() => {
              setEditingRole(null)
              setView('create')
            }}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff]"
          >
            <Plus className="h-4 w-4" />
            创建角色
          </button>
        </Can>
        <div />
      </div>

      {/* 列表 */}
      {rolesQuery.isError && (
        <div className="mb-3 rounded-xl border border-[#ffd2d2] bg-[#fff3f3] px-4 py-3 text-[13px] text-[#d93026]">
          角色列表加载失败：{apiErrorText(rolesQuery.error)}
        </div>
      )}
      {rolesQuery.isLoading ? (
        <div className="rounded-xl bg-white p-12 text-center text-[14px] text-[#86909C]">加载中…</div>
      ) : (rolesQuery.data?.rows.length ?? 0) > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#e6e9ef] bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#f5f6f8]">
                <th className="px-4 py-3 text-left font-medium text-[#86909C]">角色名称</th>
                <th className="px-4 py-3 text-left font-medium text-[#86909C]">角色描述</th>
                <th className="px-4 py-3 text-left font-medium text-[#86909C]">状态</th>
                <th className="w-[200px] px-4 py-3 text-left font-medium text-[#86909C]">操作</th>
              </tr>
            </thead>
            <tbody>
              {(rolesQuery.data?.rows ?? []).map((role) => (
                <tr key={role.id} className="border-t border-[#f0f2f5]">
                  <td className="px-4 py-3 text-[#0A1B39]">{role.name}</td>
                  <td className="px-4 py-3 text-[#86909C]">{role.description || '--'}</td>
                  <td className="px-4 py-3 text-[13px] text-[#86909C]">{role.status === 'disabled' ? '停用' : '启用'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4">
                      <Can code="role:manage">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRole(role)
                            setView('edit')
                          }}
                          className="cursor-pointer border-0 bg-transparent p-0 text-[#409eff] transition-colors hover:text-[#66b1ff]"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleRole.mutate(role)}
                          className="cursor-pointer border-0 bg-transparent p-0 text-[#409eff] transition-colors hover:text-[#66b1ff]"
                        >
                          {role.status === 'disabled' ? '启用' : '停用'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRole(role)}
                          className="cursor-pointer border-0 bg-transparent p-0 text-[#409eff] transition-colors hover:text-[#66b1ff]"
                        >
                          删除
                        </button>
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-12 text-center text-[14px] text-[#86909C]">暂无数据</div>
      )}

      {/* 分页（旧版样式） */}
      <div className="flex items-center justify-between border-t border-[#f0f2f5] px-4 py-3">
        <div className="text-[13px] text-[#86909C]">共 {total} 条</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="h-7 w-7 rounded-md border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] transition-colors hover:bg-[#f5f6f8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            &lt;
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`h-7 w-7 rounded-md text-[13px] transition-colors ${
                page === pageNumber ? 'bg-[#409eff] text-white' : 'border border-[#e6e9ef] bg-white text-[#0A1B39] hover:bg-[#f5f6f8]'
              }`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
            className="h-7 w-7 rounded-md border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] transition-colors hover:bg-[#f5f6f8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            &gt;
          </button>
        </div>
      </div>

      {/* 删除确认（旧版样式） */}
      {deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeletingRole(null)}>
          <div className="w-[400px] rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pb-3 pt-5">
              <h2 className="text-[16px] font-bold text-[#0A1B39]">提示</h2>
              <button
                type="button"
                onClick={() => setDeletingRole(null)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[#86909C] transition-colors hover:text-[#0A1B39]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-6">
              <p className="mb-6 text-[14px] text-[#0A1B39]">确认删除该角色，删除后不可恢复？</p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingRole(null)}
                  className="h-9 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={deleteRole.isPending}
                  onClick={() => {
                    const target = deletingRole
                    deleteRole.mutate(target, { onSuccess: () => setDeletingRole(null) })
                  }}
                  className="h-9 cursor-pointer rounded-lg border-0 bg-[#ff4d4f] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#ff7875] disabled:opacity-60"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
