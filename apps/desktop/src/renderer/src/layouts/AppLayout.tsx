import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Alert } from '@arco-design/web-react'
import { useAuth } from '../store/auth'
import { api } from '../api/client'

interface NavItem {
  to: string
  label: string
  /** 权限码：为空表示始终可见；权限驱动导航据此过滤（超级管理员或有任意权限码才收窄） */
  perm?: string
  children?: { to: string; label: string; perm?: string }[]
}

function buildNavGroups(isSuper: boolean, permissions: string[]) {
  const can = (perm?: string) => (perm ? isSuper || permissions.includes(perm) : true)
  const showGroup = (items: { perm?: string }[]) => isSuper || items.some((i) => can(i.perm))

  const settings = [
    { to: '/settings/account-info', label: '个人中心' },
    { to: '/settings/ai-config', label: 'AI 配置' },
    ...(isSuper
      ? [
          { to: '/settings/tenants', label: '租户管理' },
          { to: '/settings/providers', label: 'AI 供应商' },
          { to: '/settings/accounts', label: '账号管理' },
          { to: '/settings/roles', label: '角色管理' },
          { to: '/settings/departments', label: '部门管理' },
        ]
      : []),
    { to: '/settings/stores', label: '店铺管理' },
  ]
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: '分析',
      items: [
        { to: '/analysis/collect', label: 'AI 数据采集', perm: 'analysis:collect' },
        { to: '/analysis/reports', label: '竞品报告', perm: 'analysis:report' },
        { to: '/analysis/agent', label: '数据 Agent', perm: 'analysis:agent' },
        { to: '/analysis/market-reports', label: '市场报告', perm: 'analysis:market-report' },
        { to: '/analytics', label: '数据看板', perm: 'analysis:analytics' },
        { to: '/data/downloads', label: '数据下载', perm: 'analysis:download' },
      ],
    },
    {
      label: '内容',
      items: [
        { to: '/content/product-sets', label: '图片生成', perm: 'content:image-gen' },
        { to: '/content/aplus', label: '详情图', perm: 'content:aplus' },
        { to: '/content/replicate', label: '图文复刻', perm: 'content:replicate' },
        { to: '/content/video-replicate', label: '视频复刻', perm: 'content:video-replicate' },
        { to: '/content/one-click-replicate', label: '一键复刻', perm: 'content:oneclick' },
      ],
    },
    {
      label: '商品与资产',
      items: [
        { to: '/products/master-data', label: '商品主档', perm: 'product:master' },
        { to: '/products/management', label: '平台商品', perm: 'product:management' },
        { to: '/assets', label: '资产库', perm: 'asset:library' },
        { to: '/assets/images', label: '图片库', perm: 'asset:image' },
        { to: '/assets/videos', label: '视频库', perm: 'asset:video' },
      ],
    },
    { label: '系统设置', items: settings },
  ]
  // 非超级管理员且用户已有某些权限时，按权限码收窄导航；无权限码则全部显示（兼容存量数据）
  if (!isSuper && permissions.length > 0) {
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) }))
      .filter((g) => g.items.length > 0 || showGroup(g.items))
  }
  return groups
}

export function AppLayout() {
  const navigate = useNavigate()
  const user = useAuth((state) => state.user)
  const logout = useAuth((state) => state.logout)
  const permissions = useAuth((state) => state.permissions)
  const isSuperStore = useAuth((state) => state.isSuper)
  const loadMe = useAuth((state) => state.loadMe)
  const isSuper = isSuperStore || user?.username === 'super_admin' || user?.tenantId === 'system'
  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).desktop)
  const navGroups = buildNavGroups(Boolean(isSuper), permissions)

  // 挂载时拉取 my 权限集，用于权限驱动导航（登录流程已触发，这里覆盖直接进入的会话）
  useEffect(() => {
    void loadMe()
  }, [loadMe])

  // 未配个人 AI Key 且系统无默认供应商时，提醒先配置
  const [needAiConfig, setNeedAiConfig] = useState(false)
  useEffect(() => {
    let alive = true
    void api
      .get<{ selfEnabled: boolean; hasDefaultProvider: boolean }>('/api/ai/self-config')
      .then(({ data }) => {
        if (alive) setNeedAiConfig(!data.selfEnabled && !data.hasDefaultProvider)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>电商竞品分析</span>
        </div>
        <nav className="nav">
          {navGroups.map((group) => (
            <section key={group.label}>
              <div className="nav-group">{group.label}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                  {item.label}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#4e5969', fontWeight: 500 }}>
              {user?.displayName ?? user?.username}
            </span>
            <button className="ghost" onClick={() => { logout(); navigate('/login', { replace: true }) }}>
              退出
            </button>
          </div>
        </header>
        <div className="content-body">
          {needAiConfig && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              action={<NavLink to="/settings/ai-config">去配置 Key</NavLink>}
              content="你尚未配置个人 AI 供应商，且系统暂无默认供应商可用。请先配置 Key 以免 AI 功能不可用。"
            />
          )}
          <Outlet />
        </div>
      </main>
    </div>
  )
}
