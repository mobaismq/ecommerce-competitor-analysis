import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Modal, Select, Table, Tag } from '@arco-design/web-react'
import { Plus, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'
import { Can } from '../../components/Can'
import { PageHeader } from '../../components/PageHeader'
import { Field, LinkButton, Section, apiErrorText, buildDeptTree, confirmDanger, unwrapList, useAdminMutation } from './shared'
import type { DeptNode, DeptRow } from './shared'

/**
 * 部门管理（迁移自旧版 server/deptManagement.js 与账号页内联部门树逻辑）。
 *
 * 旧版功能对齐点：新建部门 / 新建子部门 / 重命名 / 删除部门；部门层级由服务端按父级+1 计算。
 * 额外提供启停（后端 Department.enabled 已有能力，旧版 standalone 页也有该口径）。
 */

interface DeptModalState {
  mode: 'create' | 'rename'
  id?: string
  parentId?: string
  name: string
}

/** 树 → 按展示顺序拍平的表格行（带缩进深度）。 */
function flatten(nodes: DeptNode[], acc: DeptNode[] = []): DeptNode[] {
  for (const node of nodes) {
    acc.push(node)
    if (node.children.length) flatten(node.children, acc)
  }
  return acc
}

export function DepartmentsPage() {
  const [keyword, setKeyword] = useState('')
  const departmentsQuery = useQuery<DeptRow[]>({
    queryKey: ['departments'],
    queryFn: async () => unwrapList<DeptRow>((await api.get('/api/departments')).data).rows,
  })

  const rows = useMemo(() => flatten(buildDeptTree(departmentsQuery.data ?? [])), [departmentsQuery.data])
  const nameById = useMemo(() => new Map(rows.map((row) => [row.id, row.name])), [rows])
  const visibleRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return rows
    return rows.filter((row) => row.name.toLowerCase().includes(kw))
  }, [rows, keyword])

  const [modal, setModal] = useState<DeptModalState | null>(null)
  const invalidate = [['departments'], ['settings-users']]

  const saveDept = useAdminMutation({
    mutationFn: async (): Promise<unknown> => {
      if (!modal) return Promise.resolve()
      const name = modal.name.trim()
      if (modal.mode === 'rename' && modal.id) return api.patch(`/api/departments/${modal.id}`, { name })
      return api.post('/api/departments', { name, parentId: modal.parentId || undefined })
    },
    successText: () => (modal?.mode === 'rename' ? '部门已重命名' : '部门已创建'),
    invalidate,
  })

  const toggleEnabled = useAdminMutation({
    mutationFn: async (row: DeptRow) => api.patch(`/api/departments/${row.id}`, { enabled: row.enabled === false }),
    successText: '状态已更新',
    invalidate,
  })

  const removeDept = useAdminMutation({
    mutationFn: async (id: string) => api.delete(`/api/departments/${id}`),
    successText: '部门已删除',
    invalidate,
  })

  const columns = [
    {
      title: '部门',
      dataIndex: 'name',
      render: (name: string, row: DeptNode) => (
        <span style={{ paddingLeft: row.depth * 18 }} className="font-semibold text-[#0A1B39]">
          {row.depth > 0 ? <span className="mr-1 text-[#c9cdd4]">└</span> : null}
          {name}
        </span>
      ),
    },
    {
      title: '上级部门',
      dataIndex: 'parentId',
      width: 180,
      render: (parentId: string | null) => (parentId ? (nameById.get(parentId) ?? parentId) : '-'),
    },
    {
      title: '层级',
      dataIndex: 'level',
      width: 90,
      render: (_: unknown, row: DeptNode) => <span className="text-[13px]">{row.level ?? row.depth + 1}</span>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (enabled: boolean | undefined) => (
        <Tag color={enabled === false ? 'gray' : 'green'} size="small">
          {enabled === false ? '停用' : '启用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'op',
      width: 260,
      render: (_: unknown, row: DeptNode) => (
        <div className="flex items-center gap-3">
          <Can code="system:manage">
            <LinkButton onClick={() => setModal({ mode: 'create', parentId: row.id, name: '' })}>新建子部门</LinkButton>
            <LinkButton onClick={() => setModal({ mode: 'rename', id: row.id, name: row.name })}>重命名</LinkButton>
            <LinkButton onClick={() => toggleEnabled.mutate(row)}>{row.enabled === false ? '启用' : '停用'}</LinkButton>
            <LinkButton
              danger
              onClick={() =>
                confirmDanger(`确定删除部门「${row.name}」？存在子部门时需先删除子部门。`, async () => {
                  await removeDept.mutateAsync(row.id)
                })
              }
            >
              删除
            </LinkButton>
          </Can>
        </div>
      ),
    },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader breadcrumbs={[{ label: '设置' }, { label: '部门管理' }]} />

      <Section className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="部门名称" className="w-[280px]">
            <Input value={keyword} onChange={setKeyword} placeholder="按名称搜索" allowClear />
          </Field>
          <Can code="system:manage">
            <Button type="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setModal({ mode: 'create', name: '' })}>
              新建部门
            </Button>
          </Can>
          <Button icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void departmentsQuery.refetch()}>
            刷新
          </Button>
          <span className="text-[12px] text-[#86909C]">共 {visibleRows.length} 个部门</span>
        </div>
      </Section>

      <Section>
        {departmentsQuery.isError && (
          <div className="mb-3 rounded-lg border border-[#ffd2d2] bg-[#fff3f3] px-4 py-3 text-[13px] text-[#d93026]">
            部门加载失败：{apiErrorText(departmentsQuery.error)}
          </div>
        )}
        <Table
          columns={columns}
          data={visibleRows}
          rowKey="id"
          loading={departmentsQuery.isLoading}
          border={false}
          scroll={{ x: 900 }}
          pagination={false}
          noDataElement={<span className="text-[13px] text-[#86909C]">暂无部门数据</span>}
        />
      </Section>

      <Modal
        visible={Boolean(modal)}
        title={modal?.mode === 'rename' ? '重命名部门' : modal?.parentId ? '新建子部门' : '新建部门'}
        style={{ width: 460 }}
        unmountOnExit
        onCancel={() => setModal(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setModal(null)}>取消</Button>
            <Button type="primary" loading={saveDept.isPending} onClick={() => saveDept.mutate(undefined as never, { onSuccess: () => setModal(null) })}>
              保存
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          {modal?.mode === 'create' && (
            <Field label="上级部门" hint="不选则为一级部门">
              <Select
                value={modal.parentId || undefined}
                onChange={(v) => setModal((prev) => (prev ? { ...prev, parentId: v ?? '' } : prev))}
                placeholder="（顶级部门）"
                allowClear
                options={rows.map((row) => ({
                  label: `${'　'.repeat(row.depth)}${row.name}`,
                  value: row.id,
                }))}
              />
            </Field>
          )}
          <Field label="部门名称" required hint="最多 15 个字符">
            <Input
              value={modal?.name ?? ''}
              onChange={(v) => setModal((prev) => (prev ? { ...prev, name: v.slice(0, 15) } : prev))}
              placeholder="请输入部门名称"
              allowClear
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
