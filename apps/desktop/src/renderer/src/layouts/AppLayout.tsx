import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

function buildNavGroups(isSuper: boolean) {
  const settings = [
    { to: '/settings/account-info', label: '个人中心' },
    ...(isSuper
      ? [
          { to: '/settings/tenants', label: '租户管理' },
          { to: '/settings/providers', label: 'AI 供应商' },
          { to: '/settings/accounts', label: '账号管理' },
          { to: '/settings/roles', label: '角色管理' },
        ]
      : []),
    { to: '/settings/stores', label: '店铺管理' },
  ]
  return [
    {
      label: '分析',
      items: [
        { to: '/analysis/collect', label: 'AI 数据采集' },
        { to: '/analysis/reports', label: '竞品报告' },
        { to: '/analysis/agent', label: '数据 Agent' },
        { to: '/analysis/market-reports', label: '市场报告' },
        { to: '/analytics', label: '数据看板' },
        { to: '/data/downloads', label: '数据下载' },
      ],
    },
    {
      label: '内容',
      items: [
        { to: '/content/product-sets', label: '图片生成' },
        { to: '/content/aplus', label: '详情图' },
        { to: '/content/video-replicate', label: '视频复刻' },
        { to: '/content/one-click-replicate', label: '一键复刻' },
      ],
    },
    {
      label: '商品与资产',
      items: [
        { to: '/products/master-data', label: '商品主档' },
        { to: '/products/management', label: '平台商品' },
        { to: '/assets', label: '资产库' },
        { to: '/assets/images', label: '图片库' },
        { to: '/assets/videos', label: '视频库' },
      ],
    },
    { label: '系统设置', items: settings },
  ]
}

export function AppLayout() {
  const navigate = useNavigate()
  const user = useAuth((state) => state.user)
  const logout = useAuth((state) => state.logout)
  const isSuper = user?.username === 'super_admin' || user?.tenantId === 'system'
  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).desktop)
  const navGroups = buildNavGroups(Boolean(isSuper))
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
          <Outlet />
        </div>
      </main>
    </div>
  )
}
