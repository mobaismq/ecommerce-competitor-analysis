import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Message, Modal } from '@arco-design/web-react'
import type { AxiosError } from 'axios'

/**
 * 「设置」模块共享基建（账号 / 角色 / 店铺 / 部门）。
 *
 * 迁移来源：旧版 `app/src/app/pages/{Account,Role,Store}Management.tsx` 与
 * `app/src/server/{account,role,dept,store}Management.js`。
 * 边界（doc 01）：账号、权限、店铺归属服务端 → 统一调用 apps/backend 的 /api/* 管理接口，不在桌面端落本地库。
 */

export interface PageEnvelope<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

/** 兼容后端两种信封：带分页参数时返回 { rows, total, page, pageSize }，否则返回裸数组。 */
export function unwrapList<T>(payload: unknown): { rows: T[]; total: number } {
  if (Array.isArray(payload)) return { rows: payload as T[], total: payload.length }
  const envelope = payload as PageEnvelope<T> | undefined
  if (envelope && Array.isArray(envelope.rows)) {
    return { rows: envelope.rows, total: Number(envelope.total) || envelope.rows.length }
  }
  return { rows: [], total: 0 }
}

/** 抽出后端可读错误文案（class-validator 的数组消息会拼接成一行）。 */
export function apiErrorText(error: unknown): string {
  const err = error as AxiosError<{ message?: string | string[] }>
  const message = err?.response?.data?.message
  if (Array.isArray(message) && message.length) return message.join('；')
  if (typeof message === 'string' && message) return message
  return err?.message ?? '请求失败'
}

export function notifyError(error: unknown): void {
  Message.error(apiErrorText(error))
}

/** 危险操作二次确认：失败时如实提示，不静默吞错。 */
export function confirmDanger(content: string, onOk: () => Promise<unknown>, okText = '确定'): void {
  Modal.confirm({
    title: '请确认',
    content,
    okText,
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      try {
        await onOk()
      } catch (error) {
        notifyError(error)
      }
    },
  })
}

/** 统一的写操作封装：成功提示 + 失效相关查询 + 失败提示。 */
export function useAdminMutation<TVars, TData>(options: {
  mutationFn: (vars: TVars) => Promise<TData>
  successText: string | ((vars: TVars) => string)
  invalidate: string[][]
}) {
  const queryClient = useQueryClient()
  return useMutation<TData, unknown, TVars>({
    mutationFn: options.mutationFn,
    onSuccess: (_data, vars) => {
      Message.success(typeof options.successText === 'function' ? options.successText(vars) : options.successText)
      for (const key of options.invalidate) void queryClient.invalidateQueries({ queryKey: key })
    },
    onError: notifyError,
  })
}

/** 数据范围（旧版 data_scope：0全部 1同部门 2仅自己 → 后端字符串枚举）。 */
export const DATA_SCOPE_OPTIONS = [
  { label: '全部数据', value: 'all' },
  { label: '同部门创建数据', value: 'department' },
  { label: '仅自己创建数据', value: 'self' },
]

export function dataScopeLabel(value?: string | null): string {
  return DATA_SCOPE_OPTIONS.find((option) => option.value === value)?.label ?? '全部数据'
}

export const STATUS_OPTIONS = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
]

export interface DeptRow {
  id: string
  name: string
  parentId: string | null
  enabled?: boolean
  level?: number
}

export interface DeptNode extends DeptRow {
  children: DeptNode[]
  depth: number
}

/** 扁平部门列表 → 层级树（旧版把后端平铺部门列表按 parentId 组装成树）。 */
export function buildDeptTree(rows: DeptRow[]): DeptNode[] {
  const map = new Map<string, DeptNode>()
  rows.forEach((row) => map.set(row.id, { ...row, children: [], depth: 0 }))
  const roots: DeptNode[] = []
  rows.forEach((row) => {
    const node = map.get(row.id)!
    if (row.parentId && map.has(row.parentId)) map.get(row.parentId)!.children.push(node)
    else roots.push(node)
  })
  const assignDepth = (nodes: DeptNode[], depth: number) => {
    nodes.forEach((node) => {
      node.depth = depth
      assignDepth(node.children, depth + 1)
    })
  }
  assignDepth(roots, 0)
  return roots
}

/** 部门 id → 名称（列表展示与上级列使用）。 */
export function deptNameMap(rows: DeptRow[]): Map<string, string> {
  return new Map(rows.map((row) => [row.id, row.name]))
}

/** 白色卡片分区（与项目内其它页面视觉一致）。 */
export function Section({
  title,
  extra,
  children,
  className = '',
}: {
  title?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)] ${className}`}>
      {(title || extra) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {typeof title === 'string' ? <h2 className="m-0 text-[15px] font-extrabold text-[#0A1B39]">{title}</h2> : title}
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

/** 表单字段外壳：标签 + 必填星号 + 校验错误 + 说明。 */
export function Field({
  label,
  required,
  error,
  hint,
  children,
  className = '',
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`grid content-start gap-1.5 ${className}`}>
      <span className="text-[12px] text-[#86909C]">
        {required && <span className="mr-0.5 text-[#f53f3f]">*</span>}
        {label}
      </span>
      {children}
      {error ? <span className="text-[11px] text-[#f53f3f]">{error}</span> : null}
      {!error && hint ? <span className="text-[11px] text-[#98A2B3]">{hint}</span> : null}
    </label>
  )
}

/** 命令行内的链接式操作按钮（与商品主档等页面一致）。 */
export function LinkButton({
  children,
  onClick,
  danger,
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`cursor-pointer border-0 bg-transparent p-0 text-[13px] transition-colors disabled:cursor-not-allowed disabled:text-[#c0c4cc] ${
        danger ? 'text-[#f53f3f] hover:text-[#cb2634]' : 'text-[#3388ff] hover:text-[#1a6fe8]'
      }`}
    >
      {children}
    </button>
  )
}
