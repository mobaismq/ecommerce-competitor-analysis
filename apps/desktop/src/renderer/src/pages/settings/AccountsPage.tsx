import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Search, X } from 'lucide-react'
import { api } from '../../api/client'
import { Can } from '../../components/Can'
import { formatDateTime } from '../../utils/format'
import { apiErrorText, buildDeptTree, notifyError, unwrapList, useAdminMutation, type DeptNode, type DeptRow } from './shared'

/**
 * 账号管理（迁移自旧版 app/src/app/pages/AccountManagement.tsx）。
 *
 * ## 布局与样式：沿用旧版
 * - 左 280px 部门树面板（标题 + 新建部门按钮 + 树节点 hover「…」菜单：创建子部门/重命名/删除）
 * - 右侧：当前部门提示 → 查询卡（账号名称/手机号/状态/查询+重置）→ 创建账号 → 自定义表格 → 分页
 * - 新增/编辑 = **整页表单**（非弹窗）：面包屑 + 白卡纵向字段 + 底部居中「确认/取消」
 * - 部门下拉、角色多选、部门弹窗、删除确认、修改权限弹窗均为旧版自定义样式
 * - pageSize 12，分页为「共 N 条 + < 1 2 3 >」
 *
 * ## 与旧版的差异（仅后端对接层）
 * - 旧版自带 MySQL 账号接口；这里调用 apps/backend 的 /api/users|roles|departments（账号属服务端能力）
 * - 数据范围后端用字符串枚举（all/department/self），界面选项文案与旧版一致
 * - 额外保留「重置密码」操作与密码规则（旧版编辑页无改密入口）
 */

const PAGE_SIZE = 12
const PASSWORD_PATTERN = /^[\x21-\x7E]{6,20}$/

interface AccountRow {
  id: string
  username: string
  displayName: string | null
  phone: string | null
  departmentId: string | null
  dataScope?: string | null
  isActive: boolean
  createdAt: string
  roleIds?: string[]
}

interface RoleOption {
  id: string
  name: string
  code?: string
}

/** 部门路径（旧版 getDeptPath：返回 ["一级","二级"]） */
function getDeptPath(nodes: DeptNode[], targetId: string, path: string[] = []): string[] | null {
  for (const node of nodes) {
    const current = [...path, node.name]
    if (node.id === targetId) return current
    const found = getDeptPath(node.children, targetId, current)
    if (found) return found
  }
  return null
}

/** 含自身的子树 id 列表（旧版 collectSubDeptIds） */
function collectSubDeptIds(node: DeptNode): string[] {
  return [node.id, ...node.children.flatMap((child) => collectSubDeptIds(child))]
}

function findDeptNode(nodes: DeptNode[], id: string): DeptNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findDeptNode(node.children, id)
    if (found) return found
  }
  return null
}

const INPUT_CLASS = 'h-9 w-full rounded-lg border bg-white px-3 text-[13px] text-[#0A1B39] outline-none transition-colors focus:border-[#409eff]'

// ── 部门树节点（旧版 DeptTreeNode） ──
function DeptTreeNode({
  node,
  depth,
  expanded,
  selectedId,
  openMenuId,
  onToggleExpand,
  onSelect,
  onOpenMenu,
  onAction,
}: {
  node: DeptNode
  depth: number
  expanded: Set<string>
  selectedId: string | null
  openMenuId: string | null
  onToggleExpand: (id: string) => void
  onSelect: (id: string) => void
  onOpenMenu: (id: string | null) => void
  onAction: (action: 'createChild' | 'rename' | 'delete', node: DeptNode) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const isSelected = selectedId === node.id
  const menuOpen = openMenuId === node.id

  return (
    <div>
      <div
        className={`group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors ${
          isSelected ? 'bg-[#e8f3ff]' : 'hover:bg-[#f5f6f8]'
        }`}
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(node.id)}
              className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[#86909C] hover:text-[#0A1B39]"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className={`cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[13px] ${
              isSelected ? 'font-bold text-[#3388ff]' : 'text-[#0A1B39] hover:text-[#3388ff]'
            }`}
            title={node.name}
          >
            {node.name}
          </button>
        </div>
        <Can code="system:manage">
          <div className="relative shrink-0" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => onOpenMenu(menuOpen ? null : node.id)}
              className="cursor-pointer border-0 bg-transparent p-0.5 text-[#86909C] opacity-0 transition-opacity hover:text-[#0A1B39] group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-[#e6e9ef] bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => onAction('createChild', node)}
                  className="w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
                >
                  创建子部门
                </button>
                <button
                  type="button"
                  onClick={() => onAction('rename', node)}
                  className="w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
                >
                  重命名
                </button>
                <button
                  type="button"
                  onClick={() => onAction('delete', node)}
                  className="w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-[13px] text-[#ff4d4f] hover:bg-[#f5f6f8]"
                >
                  删除
                </button>
              </div>
            )}
          </div>
        </Can>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <DeptTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              openMenuId={openMenuId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onOpenMenu={onOpenMenu}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 部门下拉（旧版 DeptSelect：自定义树下拉） ──
function DeptSelect({ nodes, value, onChange, error }: { nodes: DeptNode[]; value: string; onChange: (value: string) => void; error?: string }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(nodes.map((node) => node.id)))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedPath = value ? getDeptPath(nodes, value) : null

  const renderTreeItems = (items: DeptNode[], depth: number): React.ReactNode =>
    items.map((node) => {
      const hasChildren = node.children.length > 0
      const isExpanded = expanded.has(node.id)
      const isSelected = value === node.id
      return (
        <div key={node.id}>
          <div
            className={`flex cursor-pointer items-center gap-1 py-2 text-[13px] ${
              isSelected ? 'bg-[#f0f7ff] text-[#409eff]' : 'text-[#0A1B39] hover:bg-[#f5f6f8]'
            }`}
            style={{ paddingLeft: depth * 16 + 12 }}
            onClick={() => {
              onChange(node.id)
              setOpen(false)
            }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(node.id)) next.delete(node.id)
                    else next.add(node.id)
                    return next
                  })
                }}
                className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[#86909C]"
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>
          {hasChildren && isExpanded && <div>{renderTreeItems(node.children, depth + 1)}</div>}
        </div>
      )
    })

  return (
    <div ref={ref} className="relative w-full">
      <div
        onClick={() => setOpen(!open)}
        className={`flex h-9 w-full cursor-pointer select-none items-center justify-between rounded-lg border bg-white px-3 text-[13px] outline-none ${
          error ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'
        }`}
      >
        <span className={`truncate ${!value ? 'text-[#c0c4cc]' : 'text-[#0A1B39]'}`} title={selectedPath?.join('/')}>
          {selectedPath?.join('/') ?? '请选择部门'}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onChange('')
              }}
              className="cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-[#c0c4cc]" />
        </div>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[240px] overflow-auto rounded-lg border border-[#e6e9ef] bg-white py-1 shadow-lg">
          {nodes.length ? renderTreeItems(nodes, 0) : <div className="px-3 py-2 text-[13px] text-[#86909C]">暂无部门</div>}
        </div>
      )}
    </div>
  )
}

// ── 角色多选（旧版 RoleMultiSelect） ──
function RoleMultiSelect({ roles, value, onChange, error }: { roles: RoleOption[]; value: string[]; onChange: (value: string[]) => void; error?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (roleId: string) => onChange(value.includes(roleId) ? value.filter((id) => id !== roleId) : [...value, roleId])
  const displayText = value.length === 0 ? '请选择角色' : roles.filter((role) => value.includes(role.id)).map((role) => role.name).join('、')

  return (
    <div ref={ref} className="relative w-full">
      <div
        onClick={() => setOpen(!open)}
        className={`flex h-9 w-full cursor-pointer select-none items-center justify-between rounded-lg border bg-white px-3 text-[13px] outline-none ${
          error ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'
        }`}
      >
        <span className={`truncate ${value.length === 0 ? 'text-[#c0c4cc]' : 'text-[#0A1B39]'}`} title={displayText}>
          {displayText}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {value.length > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onChange([])
              }}
              className="cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-[#c0c4cc]" />
        </div>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[200px] overflow-auto rounded-lg border border-[#e6e9ef] bg-white shadow-lg">
          {roles.map((role) => (
            <div
              key={role.id}
              onClick={() => toggle(role.id)}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
            >
              <div
                className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                  value.includes(role.id) ? 'border-[#409eff] bg-[#409eff]' : 'border-[#dcdfe6] bg-white'
                }`}
              >
                {value.includes(role.id) && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {role.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 部门弹窗（旧版 DeptModal） ──
function DeptModal({
  title,
  parentPath,
  initialValue,
  submitting,
  onConfirm,
  onCancel,
}: {
  title: string
  parentPath?: string
  initialValue?: string
  submitting: boolean
  onConfirm: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialValue ?? '')
  const [error, setError] = useState('')

  const handleChange = (value: string) => {
    setName(value)
    if (value.length > 15) setError('部门名称最多15个字符')
    else if (error === '部门名称最多15个字符' || error === '部门名称不可为空') setError('')
  }

  const handleConfirm = () => {
    if (!name.trim()) return setError('部门名称不可为空')
    if (name.length > 15) return setError('部门名称最多15个字符')
    onConfirm(name.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="w-[420px] rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h2 className="text-[16px] font-bold text-[#0A1B39]">{title}</h2>
          <button type="button" onClick={onCancel} className="cursor-pointer border-0 bg-transparent p-0 text-[#86909C] transition-colors hover:text-[#0A1B39]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6">
          {parentPath && (
            <div className="mb-4">
              <label className="mb-1 block text-[13px] text-[#86909C]">上级部门</label>
              <div className="flex h-9 w-full items-center rounded-lg border border-[#e6e9ef] bg-[#f5f6f8] px-3 text-[13px] text-[#0A1B39]">{parentPath}</div>
            </div>
          )}
          <div className="mb-4">
            <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
              部门名称 <span className="text-[#ff4d4f]">*</span>
            </label>
            <input
              type="text"
              placeholder="请输入"
              value={name}
              onChange={(event) => handleChange(event.target.value)}
              className={`${INPUT_CLASS} ${error ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'}`}
            />
            {error && <p className="mt-1 text-[12px] text-[#ff4d4f]">{error}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="h-9 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="h-9 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '保存中…' : '确认'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 删除确认（旧版 DeleteConfirmModal） ──
function DeleteConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="w-[400px] rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h2 className="text-[16px] font-bold text-[#0A1B39]">提示</h2>
          <button type="button" onClick={onCancel} className="cursor-pointer border-0 bg-transparent p-0 text-[#86909C] transition-colors hover:text-[#0A1B39]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6">
          <p className="mb-6 text-[14px] text-[#0A1B39]">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="h-9 cursor-pointer rounded-lg border-0 bg-[#ff4d4f] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#ff7875]"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 修改权限弹窗（旧版 ModifyPermissionModal） ──
function ModifyPermissionModal({
  roles,
  value,
  submitting,
  onChange,
  onConfirm,
  onCancel,
}: {
  roles: RoleOption[]
  value: string[]
  submitting: boolean
  onChange: (value: string[]) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="w-[420px] rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <h2 className="text-[16px] font-bold text-[#0A1B39]">修改权限</h2>
          <button type="button" onClick={onCancel} className="cursor-pointer border-0 bg-transparent p-0 text-[#86909C] transition-colors hover:text-[#0A1B39]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6">
          <div className="mb-4">
            <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
              角色权限 <span className="text-[#ff4d4f]">*</span>
            </label>
            <RoleMultiSelect roles={roles} value={value} onChange={onChange} />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="h-9 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting}
              className="h-9 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '保存中…' : '确认'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 账号表单整页视图（旧版 AccountForm） ──
interface AccountFormValues {
  username: string
  phone: string
  password: string
  departmentId: string
  roleIds: string[]
  dataScope: string
}

function AccountForm({
  isEdit,
  initial,
  departments,
  roles,
  submitting,
  onSave,
  onCancel,
  checkDuplicate,
}: {
  isEdit: boolean
  initial: AccountFormValues
  departments: DeptNode[]
  roles: RoleOption[]
  submitting: boolean
  onSave: (values: AccountFormValues) => void
  onCancel: () => void
  checkDuplicate: (field: 'username' | 'phone', value: string) => Promise<boolean>
}) {
  const [values, setValues] = useState<AccountFormValues>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const patch = (next: Partial<AccountFormValues>) => setValues((prev) => ({ ...prev, ...next }))

  const handleSave = () => {
    const next: Record<string, string> = {}
    if (!values.username.trim()) next.username = '账号名称不可为空'
    else if (values.username.length > 15) next.username = '账号名称最多15个字符'
    if (!values.phone.trim()) next.phone = '手机号不可为空'
    else if (!/^\d{11}$/.test(values.phone)) next.phone = '手机号格式错误'
    if (!isEdit) {
      if (!values.password) next.password = '密码不可为空'
      else if (!PASSWORD_PATTERN.test(values.password)) next.password = '密码格式错误'
    }
    if (!values.departmentId) next.departmentId = '部门不可为空'
    if (!values.roleIds.length) next.roleIds = '角色不可为空'
    if (!values.dataScope) next.dataScope = '数据范围不可为空'
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    onSave(values)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center gap-1 text-[13px] text-[#86909C]">
        <span>设置</span>
        <span className="text-[#c0c4cc]">/</span>
        <span>账号管理</span>
        <span className="text-[#c0c4cc]">/</span>
        <span className="font-medium text-[#0A1B39]">{isEdit ? '编辑账号' : '创建账号'}</span>
      </div>

      <div className="rounded-xl bg-white p-6">
        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
            账号名称 <span className="text-[#ff4d4f]">*</span>
          </label>
          <input
            type="text"
            placeholder="请输入"
            value={values.username}
            onChange={(event) => {
              const value = event.target.value
              patch({ username: value })
              setErrors((prev) => ({ ...prev, username: value.length > 15 ? '账号名称最多15个字符' : '' }))
            }}
            onBlur={async () => {
              if (isEdit) return
              const value = values.username.trim()
              if (!value || value.length > 15) return
              if (await checkDuplicate('username', value)) setErrors((prev) => ({ ...prev, username: '账号名称已存在' }))
            }}
            className={`${INPUT_CLASS} ${errors.username ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'}`}
          />
          {errors.username && <p className="mt-1 text-[12px] text-[#ff4d4f]">{errors.username}</p>}
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
            手机号 <span className="text-[#ff4d4f]">*</span>
          </label>
          <input
            type="text"
            placeholder="请输入"
            value={values.phone}
            readOnly={isEdit}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, '')
              patch({ phone: digits })
              setErrors((prev) => ({ ...prev, phone: digits.length > 11 ? '手机号格式错误' : '' }))
            }}
            onBlur={async () => {
              if (isEdit) return
              const value = values.phone.trim()
              if (!value || !/^\d{11}$/.test(value)) return
              if (await checkDuplicate('phone', value)) setErrors((prev) => ({ ...prev, phone: '手机号已存在' }))
            }}
            className={`${INPUT_CLASS} ${errors.phone ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'} ${
              isEdit ? 'cursor-not-allowed bg-[#f5f6f8] text-[#86909C]' : ''
            }`}
          />
          {errors.phone && <p className="mt-1 text-[12px] text-[#ff4d4f]">{errors.phone}</p>}
        </div>

        {!isEdit && (
          <div className="mb-5">
            <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
              密码 <span className="text-[#ff4d4f]">*</span>
            </label>
            <input
              type="password"
              placeholder="请输入"
              value={values.password}
              onChange={(event) => {
                const value = event.target.value
                patch({ password: value })
                setErrors((prev) => ({ ...prev, password: value && !PASSWORD_PATTERN.test(value) ? '密码格式错误' : '' }))
              }}
              className={`${INPUT_CLASS} ${errors.password ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'}`}
            />
            {errors.password && <p className="mt-1 text-[12px] text-[#ff4d4f]">{errors.password}</p>}
          </div>
        )}

        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
            部门 <span className="text-[#ff4d4f]">*</span>
          </label>
          <DeptSelect
            nodes={departments}
            value={values.departmentId}
            onChange={(value) => {
              patch({ departmentId: value })
              setErrors((prev) => ({ ...prev, departmentId: '' }))
            }}
            error={errors.departmentId}
          />
          {errors.departmentId && <p className="mt-1 text-[12px] text-[#ff4d4f]">{errors.departmentId}</p>}
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
            角色权限 <span className="text-[#ff4d4f]">*</span>
          </label>
          <RoleMultiSelect
            roles={roles}
            value={values.roleIds}
            onChange={(value) => {
              patch({ roleIds: value })
              setErrors((prev) => ({ ...prev, roleIds: '' }))
            }}
            error={errors.roleIds}
          />
          {errors.roleIds && <p className="mt-1 text-[12px] text-[#ff4d4f]">{errors.roleIds}</p>}
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
            数据范围 <span className="text-[#ff4d4f]">*</span>
          </label>
          <div className="relative">
            <select
              value={values.dataScope}
              onChange={(event) => {
                patch({ dataScope: event.target.value })
                setErrors((prev) => ({ ...prev, dataScope: '' }))
              }}
              className={`${INPUT_CLASS} appearance-none pr-7 ${errors.dataScope ? 'border-[#ff4d4f]' : 'border-[#e6e9ef]'} ${
                values.dataScope === '' ? 'text-[#c0c4cc]' : 'text-[#0A1B39]'
              }`}
            >
              <option value="">请选择</option>
              <option value="all">全部数据</option>
              <option value="department">同部门创建数据</option>
              <option value="self">仅自己创建数据</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
          </div>
          {errors.dataScope && <p className="mt-1 text-[12px] text-[#ff4d4f]">{errors.dataScope}</p>}
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
export function AccountsPage() {
  const [query, setQuery] = useState({ name: '', phone: '', status: '' })
  const [filter, setFilter] = useState({ name: '', phone: '', status: '' })
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // 视图：列表 / 创建 / 编辑（旧版整页表单，非弹窗）
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null)

  const [deptModal, setDeptModal] = useState<{ mode: 'create' | 'createChild' | 'rename'; node?: DeptNode; name: string } | null>(null)
  const [deletingDept, setDeletingDept] = useState<{ node: DeptNode; errorMsg: string } | null>(null)
  const [permissionTarget, setPermissionTarget] = useState<AccountRow | null>(null)
  const [permissionRoleIds, setPermissionRoleIds] = useState<string[]>([])
  const [deletingAccount, setDeletingAccount] = useState<AccountRow | null>(null)
  const [passwordTarget, setPasswordTarget] = useState<AccountRow | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const departmentsQuery = useQuery<DeptRow[]>({
    queryKey: ['departments'],
    queryFn: async () => unwrapList<DeptRow>((await api.get('/api/departments')).data).rows,
  })
  const rolesQuery = useQuery<RoleOption[]>({
    queryKey: ['roles'],
    queryFn: async () => unwrapList<RoleOption>((await api.get('/api/roles')).data).rows,
  })

  const accountsQuery = useQuery({
    queryKey: ['settings-users', filter, selectedDeptId, page],
    queryFn: async () => {
      const { data } = await api.get('/api/users', {
        params: {
          ...(filter.name.trim() ? { username: filter.name.trim() } : {}),
          ...(filter.phone.trim() ? { phone: filter.phone.trim() } : {}),
          ...(filter.status ? { isActive: filter.status === '启用' } : {}),
          ...(selectedDeptId ? { departmentId: selectedDeptId } : {}),
          page,
          pageSize: PAGE_SIZE,
        },
      })
      return unwrapList<AccountRow>(data)
    },
  })

  const deptTree = useMemo(() => buildDeptTree(departmentsQuery.data ?? []), [departmentsQuery.data])
  const roles = rolesQuery.data ?? []
  const roleNameById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles])
  const total = accountsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    const handler = () => setOpenMenuId(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const invalidate = [['settings-users'], ['departments'], ['users']]

  const createAccount = useAdminMutation({
    mutationFn: async (values: AccountFormValues) =>
      api.post('/api/users', {
        username: values.username.trim(),
        password: values.password,
        phone: values.phone.trim(),
        departmentId: values.departmentId,
        roleIds: values.roleIds,
        dataScope: values.dataScope,
      }),
    successText: '账号已创建',
    invalidate,
  })

  const updateAccount = useAdminMutation({
    mutationFn: async (values: AccountFormValues) =>
      api.patch(`/api/users/${editingAccount?.id}`, {
        departmentId: values.departmentId,
        roleIds: values.roleIds,
        dataScope: values.dataScope,
      }),
    successText: '账号已更新',
    invalidate,
  })

  const toggleAccount = useAdminMutation({
    mutationFn: async (row: AccountRow) => api.patch(`/api/users/${row.id}`, { isActive: !row.isActive }),
    successText: '状态已更新',
    invalidate,
  })

  const deleteAccount = useAdminMutation({
    mutationFn: async (row: AccountRow) => api.delete(`/api/users/${row.id}`),
    successText: '账号已删除',
    invalidate,
  })

  const modifyPermission = useAdminMutation({
    mutationFn: async () => api.patch(`/api/users/${permissionTarget?.id}`, { roleIds: permissionRoleIds }),
    successText: '权限已更新',
    invalidate,
  })

  const resetPassword = useAdminMutation({
    mutationFn: async () => api.post(`/api/users/${passwordTarget?.id}/reset-password`, { password: newPassword }),
    successText: '密码已重置',
    invalidate,
  })

  const saveDept = useAdminMutation({
    mutationFn: async (name: string) => {
      if (!deptModal) return Promise.resolve()
      if (deptModal.mode === 'rename' && deptModal.node) return api.patch(`/api/departments/${deptModal.node.id}`, { name })
      const parentId = deptModal.mode === 'createChild' ? deptModal.node?.id : undefined
      return api.post('/api/departments', { name, parentId })
    },
    successText: () => (deptModal?.mode === 'rename' ? '部门已重命名' : '部门已创建'),
    invalidate,
  })

  const removeDept = useAdminMutation({
    mutationFn: async (id: string) => api.delete(`/api/departments/${id}`),
    successText: '部门已删除',
    invalidate,
  })

  const checkDuplicate = async (field: 'username' | 'phone', value: string): Promise<boolean> => {
    try {
      const { data } = await api.get('/api/users/check-duplicate', {
        params: { [field]: value, excludeId: editingAccount?.id },
      })
      return Boolean((data as { duplicate?: boolean }).duplicate)
    } catch {
      return false
    }
  }

  const handleDeptAction = async (action: 'createChild' | 'rename' | 'delete', node: DeptNode) => {
    setOpenMenuId(null)
    if (action === 'createChild') return setDeptModal({ mode: 'createChild', node, name: '' })
    if (action === 'rename') return setDeptModal({ mode: 'rename', node, name: node.name })
    // 旧版：子树下若有账号则不可删除
    const subIds = collectSubDeptIds(node)
    let hasAccounts = false
    for (const id of subIds) {
      try {
        const { data } = await api.get('/api/users', { params: { departmentId: id, page: 1, pageSize: 1 } })
        if (unwrapList<AccountRow>(data).total > 0) {
          hasAccounts = true
          break
        }
      } catch {
        /* 检查失败按无账号处理，后端仍会校验 */
      }
    }
    setDeletingDept({ node, errorMsg: hasAccounts ? '该部门下有员工账号，不可删除！' : '' })
  }

  const confirmDeleteDept = async () => {
    if (!deletingDept) return
    const target = deletingDept
    setDeletingDept(null)
    if (target.errorMsg) return
    try {
      // 旧版：先删子部门再删父部门
      const ids = collectSubDeptIds(target.node).reverse()
      for (const id of ids) await removeDept.mutateAsync(id)
    } catch {
      /* 失败由 mutation 的 onError 提示 */
    }
  }

  const openCreate = () => {
    setEditingAccount(null)
    setView('create')
  }

  const openEdit = (row: AccountRow) => {
    setEditingAccount(row)
    setView('edit')
  }

  const submitForm = (values: AccountFormValues) => {
    if (view === 'create') {
      createAccount.mutate(values, { onSuccess: () => setView('list') })
    } else {
      updateAccount.mutate(values, { onSuccess: () => setView('list') })
    }
  }

  // ── 创建/编辑整页视图 ──
  if (view !== 'list') {
    const initial: AccountFormValues = editingAccount
      ? {
          username: editingAccount.username,
          phone: editingAccount.phone ?? '',
          password: '',
          departmentId: editingAccount.departmentId ?? '',
          roleIds: editingAccount.roleIds ?? [],
          dataScope: editingAccount.dataScope ?? 'all',
        }
      : { username: '', phone: '', password: '', departmentId: selectedDeptId ?? '', roleIds: [], dataScope: '' }
    return (
      <AccountForm
        key={editingAccount?.id ?? 'create'}
        isEdit={view === 'edit'}
        initial={initial}
        departments={deptTree}
        roles={roles}
        submitting={createAccount.isPending || updateAccount.isPending}
        onSave={submitForm}
        onCancel={() => setView('list')}
        checkDuplicate={checkDuplicate}
      />
    )
  }

  // ── 列表视图 ──
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center gap-1 text-[13px] text-[#86909C]">
        <span>设置</span>
        <span className="text-[#c0c4cc]">/</span>
        <span className="font-medium text-[#0A1B39]">账号管理</span>
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 120px)' }}>
        {/* 左：部门管理 */}
        <div className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-[#e6e9ef] bg-white">
          <div className="flex items-center justify-between border-b border-[#e6e9ef] px-4 py-3">
            <span className="text-[14px] font-bold text-[#0A1B39]">部门管理</span>
            <Can code="system:manage">
              <button
                type="button"
                onClick={() => setDeptModal({ mode: 'create', name: '' })}
                className="flex h-7 cursor-pointer items-center gap-1 rounded-lg border-0 bg-[#409eff] px-3 text-[12px] font-bold text-white transition-colors hover:bg-[#66b1ff]"
              >
                <Plus className="h-3.5 w-3.5" />
                新建部门
              </button>
            </Can>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {departmentsQuery.isLoading ? (
              <div className="py-6 text-center text-[13px] text-[#86909C]">加载中…</div>
            ) : deptTree.length ? (
              deptTree.map((node) => (
                <DeptTreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expandedDepts}
                  selectedId={selectedDeptId}
                  openMenuId={openMenuId}
                  onToggleExpand={(id) =>
                    setExpandedDepts((prev) => {
                      const next = new Set(prev)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }
                  onSelect={(id) => {
                    setSelectedDeptId((prev) => (prev === id ? null : id))
                    setPage(1)
                  }}
                  onOpenMenu={setOpenMenuId}
                  onAction={(action, target) => void handleDeptAction(action, target)}
                />
              ))
            ) : (
              <div className="py-6 text-center text-[13px] text-[#86909C]">暂无部门</div>
            )}
          </div>
        </div>

        {/* 右：账号列表 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {selectedDeptId && (
            <div className="mb-3 flex items-center gap-2 text-[13px]">
              <span className="text-[#86909C]">当前部门：</span>
              <span className="font-medium text-[#3388ff]">
                {getDeptPath(deptTree, selectedDeptId)?.join('/') ?? selectedDeptId}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedDeptId(null)
                  setPage(1)
                }}
                className="cursor-pointer border-0 bg-transparent p-0 text-[#409eff] hover:text-[#66b1ff]"
              >
                清除筛选
              </button>
            </div>
          )}

          {/* 查询卡（旧版单行 4 列） */}
          <div className="mb-4 rounded-xl bg-white p-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-[12px] text-[#86909C]">账号名称</label>
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
                  <input
                    type="text"
                    placeholder="请输入"
                    value={query.name}
                    onChange={(event) => setQuery((prev) => ({ ...prev, name: event.target.value }))}
                    className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                  />
                  {query.name && (
                    <button
                      type="button"
                      onClick={() => setQuery((prev) => ({ ...prev, name: '' }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-[12px] text-[#86909C]">手机号</label>
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
                  <input
                    type="text"
                    placeholder="请输入"
                    value={query.phone}
                    onChange={(event) => setQuery((prev) => ({ ...prev, phone: event.target.value }))}
                    className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                  />
                  {query.phone && (
                    <button
                      type="button"
                      onClick={() => setQuery((prev) => ({ ...prev, phone: '' }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-[12px] text-[#86909C]">状态</label>
                <div className="relative min-w-0 flex-1">
                  <select
                    value={query.status}
                    onChange={(event) => setQuery((prev) => ({ ...prev, status: event.target.value }))}
                    className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 pr-7 text-[13px] outline-none focus:border-[#409eff] ${
                      !query.status ? 'text-[#c0c4cc]' : 'text-[#0A1B39]'
                    }`}
                  >
                    <option value="">请选择</option>
                    <option value="启用">启用</option>
                    <option value="停用">停用</option>
                  </select>
                  {query.status && (
                    <button
                      type="button"
                      onClick={() => setQuery((prev) => ({ ...prev, status: '' }))}
                      className="absolute right-7 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#c0c4cc] hover:text-[#86909C]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c0c4cc]" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilter({ name: query.name.trim(), phone: query.phone.trim(), status: query.status })
                    setPage(1)
                  }}
                  className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff]"
                >
                  查询
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const empty = { name: '', phone: '', status: '' }
                    setQuery(empty)
                    setFilter(empty)
                    setSelectedDeptId(null)
                    setPage(1)
                  }}
                  className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]"
                >
                  重置
                </button>
              </div>
            </div>
          </div>

          {/* 创建账号 */}
          <div className="mb-4 flex items-center justify-between">
            <Can code="user:manage">
              <button
                type="button"
                onClick={openCreate}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff]"
              >
                <Plus className="h-4 w-4" />
                创建账号
              </button>
            </Can>
            <div />
          </div>

          {/* 账号列表（旧版自定义表格） */}
          {accountsQuery.isError && (
            <div className="mb-3 rounded-xl border border-[#ffd2d2] bg-[#fff3f3] px-4 py-3 text-[13px] text-[#d93026]">
              账号列表加载失败：{apiErrorText(accountsQuery.error)}
            </div>
          )}
          {accountsQuery.isLoading ? (
            <div className="flex-1 rounded-xl bg-white p-12 text-center text-[14px] text-[#86909C]">加载中…</div>
          ) : (accountsQuery.data?.rows.length ?? 0) > 0 ? (
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[#e6e9ef] bg-white">
              <table className="w-full min-w-[900px] text-[13px]">
                <thead>
                  <tr className="bg-[#f5f6f8]">
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#86909C]">账号名称</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#86909C]">手机号</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#86909C]">部门</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#86909C]">角色</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#86909C]">状态</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#86909C]">创建时间</th>
                    <th className="w-[300px] whitespace-nowrap px-4 py-3 text-left font-medium text-[#86909C]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(accountsQuery.data?.rows ?? []).map((account) => {
                    const deptPath = account.departmentId ? getDeptPath(deptTree, account.departmentId) : null
                    const roleNames = (account.roleIds ?? []).map((id) => roleNameById.get(id) ?? id)
                    return (
                      <tr key={account.id} className="border-t border-[#f0f2f5]">
                        <td className="whitespace-nowrap px-4 py-3 text-[#0A1B39]">{account.username}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#0A1B39]">{account.phone ?? '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#86909C]">{deptPath ? deptPath.join('/') : '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#86909C]">{roleNames.length ? roleNames.join('、') : '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#0A1B39]">{account.isActive ? '启用' : '停用'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#86909C]">{formatDateTime(account.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-4">
                            <Can code="user:manage">
                              <button
                                type="button"
                                onClick={() => {
                                  setPermissionTarget(account)
                                  setPermissionRoleIds(account.roleIds ?? [])
                                }}
                                className="cursor-pointer border-0 bg-transparent p-0 text-[#409eff] transition-colors hover:text-[#66b1ff]"
                              >
                                修改权限
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(account)}
                                className="cursor-pointer border-0 bg-transparent p-0 text-[#409eff] transition-colors hover:text-[#66b1ff]"
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleAccount.mutate(account)}
                                className="cursor-pointer border-0 bg-transparent p-0 text-[#409eff] transition-colors hover:text-[#66b1ff]"
                              >
                                {account.isActive ? '停用' : '启用'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPasswordTarget(account)
                                  setNewPassword('')
                                }}
                                className="cursor-pointer border-0 bg-transparent p-0 text-[#409eff] transition-colors hover:text-[#66b1ff]"
                              >
                                重置密码
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingAccount(account)}
                                className="cursor-pointer border-0 bg-transparent p-0 text-[#409eff] transition-colors hover:text-[#66b1ff]"
                              >
                                删除
                              </button>
                            </Can>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 rounded-xl bg-white p-12 text-center text-[14px] text-[#86909C]">暂无数据</div>
          )}

          {/* 分页（旧版样式） */}
          <div className="flex items-center justify-between rounded-b-xl border-t border-[#f0f2f5] bg-white px-4 py-3">
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
        </div>
      </div>

      {/* 部门弹窗 */}
      {deptModal && (
        <DeptModal
          title={deptModal.mode === 'rename' ? '编辑部门' : '新建部门'}
          parentPath={
            deptModal.mode === 'createChild' && deptModal.node
              ? getDeptPath(deptTree, deptModal.node.id)?.join('/') ?? ''
              : deptModal.mode === 'rename' && deptModal.node
                ? getDeptPath(deptTree, deptModal.node.id)?.slice(0, -1).join('/') ?? ''
                : undefined
          }
          initialValue={deptModal.mode === 'rename' ? deptModal.node?.name : ''}
          submitting={saveDept.isPending}
          onConfirm={(name) => saveDept.mutate(name, { onSuccess: () => setDeptModal(null) })}
          onCancel={() => setDeptModal(null)}
        />
      )}

      {/* 删除部门确认 */}
      {deletingDept && (
        <DeleteConfirmModal
          message={deletingDept.errorMsg || '确认删除该部门及子部门，删除后不可恢复？'}
          onConfirm={() => void confirmDeleteDept()}
          onCancel={() => setDeletingDept(null)}
        />
      )}

      {/* 修改权限 */}
      {permissionTarget && (
        <ModifyPermissionModal
          roles={roles}
          value={permissionRoleIds}
          submitting={modifyPermission.isPending}
          onChange={setPermissionRoleIds}
          onConfirm={() => modifyPermission.mutate(undefined as never, { onSuccess: () => setPermissionTarget(null) })}
          onCancel={() => setPermissionTarget(null)}
        />
      )}

      {/* 删除账号确认 */}
      {deletingAccount && (
        <DeleteConfirmModal
          message="确认删除该账号，删除后不可恢复？"
          onConfirm={() => {
            const target = deletingAccount
            deleteAccount.mutate(target, { onSuccess: () => setDeletingAccount(null) })
          }}
          onCancel={() => setDeletingAccount(null)}
        />
      )}

      {/* 重置密码（桌面端额外能力） */}
      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPasswordTarget(null)}>
          <div className="w-[420px] rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pb-3 pt-5">
              <h2 className="text-[16px] font-bold text-[#0A1B39]">重置密码</h2>
              <button
                type="button"
                onClick={() => setPasswordTarget(null)}
                className="cursor-pointer border-0 bg-transparent p-0 text-[#86909C] transition-colors hover:text-[#0A1B39]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-6">
              <p className="mb-4 text-[13px] text-[#86909C]">为账号「{passwordTarget.username}」设置新密码</p>
              <input
                type="password"
                placeholder="请输入新密码（6-20 位可见字符）"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={`${INPUT_CLASS} border-[#e6e9ef]`}
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="h-9 cursor-pointer rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={resetPassword.isPending}
                  onClick={() => {
                    if (!PASSWORD_PATTERN.test(newPassword)) {
                      notifyError(new Error('密码格式错误（6-20 位可见字符）'))
                      return
                    }
                    resetPassword.mutate(undefined as never, { onSuccess: () => setPasswordTarget(null) })
                  }}
                  className="h-9 cursor-pointer rounded-lg border-0 bg-[#409eff] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#66b1ff] disabled:opacity-50"
                >
                  {resetPassword.isPending ? '保存中…' : '确认'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
