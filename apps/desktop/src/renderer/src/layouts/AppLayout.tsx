import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Popover } from '@arco-design/web-react'
import { ReportJobBanner } from '../components/ReportJobBanner'
import {
  Bot,
  Copy,
  Cpu,
  Database,
  FileBarChart,
  FileText,
  Film,
  FolderOpen,
  Globe,
  Image,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
  User,
  UserCog,
  Users,
  Video,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import brandLogo from '../assets/brand-logo.png'
import { useAuth } from '../store/auth'

type NavItem = {
  to?: string
  label: string
  icon: LucideIcon
  /** 权限码（对齐 af80861 语义）：为空始终可见；superOnly 仅超级管理员可见 */
  perm?: string
  superOnly?: boolean
  children?: NavItem[]
}

const nav: NavItem[] = [
  {
    label: '市场',
    icon: Globe,
    children: [
      {
        label: '竞品分析',
        icon: Target,
        children: [
          { to: '/market/competitive/ai-collect', label: 'AI数据采集', perm: 'analysis:collect', icon: Cpu },
          { to: '/market/competitive/report', label: '分析报告', perm: 'analysis:report', icon: FileBarChart },
          { to: '/market/competitive/agent', label: '智能问答', perm: 'analysis:agent', icon: Bot },
        ],
      },
    ],
  },
  {
    label: 'AIGC',
    icon: Sparkles,
    children: [
      { to: '/product-sets', label: '商品主图', perm: 'content:image-gen', icon: WalletCards },
      { to: '/aplus', label: '详情图', perm: 'content:aplus', icon: FileText },
      { to: '/replicate', label: '爆款图复刻', perm: 'content:replicate', icon: Copy },
      { to: '/video-replicate', label: '爆款视频复刻', perm: 'content:video-replicate', icon: Video },
    ],
  },
  {
    label: '资产库',
    icon: FolderOpen,
    children: [
      { to: '/asset/image-gallery', label: '图库', perm: 'asset:image', icon: Image },
      { to: '/asset/video-gallery', label: '视频库', perm: 'asset:video', icon: Film },
    ],
  },
  {
    label: '商品',
    icon: ShoppingBag,
    children: [
      { to: '/product/master-data', label: '商品主档', perm: 'product:master', icon: Database },
      { to: '/product/management', label: '平台商品', perm: 'product:management', icon: Package },
    ],
  },
  {
    label: '设置',
    icon: Settings,
    children: [
      { to: '/settings/account', label: '账号管理', superOnly: true, icon: UserCog },
      { to: '/settings/role', label: '角色管理', superOnly: true, icon: Users },
      { to: '/settings/store', label: '店铺管理', icon: Store },
      { to: '/settings/ai-config', label: 'AI 配置', icon: Sparkles },
    ],
  },
]

// 权限驱动导航：业务菜单一律显示（当前权限按宽松放行，未配置即全显），仅 superOnly（账号/角色管理）限定超管
function filterNavByPermission(items: NavItem[], isSuper: boolean): NavItem[] {
  const result: NavItem[] = []
  for (const item of items) {
    if (item.children) {
      const children = filterNavByPermission(item.children, isSuper)
      if (children.length > 0) result.push({ ...item, children })
    } else if (!item.superOnly || isSuper) {
      result.push(item)
    }
  }
  return result
}

function hasActiveChild(item: NavItem, activeKey: string): boolean {
  if (!item.children) return false
  return item.children.some((child) => (child.to ? child.to === activeKey : false) || hasActiveChild(child, activeKey))
}

// 计算当前选中的菜单 key，并兼容存量旧路由
function getSelectedKey(path: string) {
  if (path.startsWith('/market/competitive/ai-collect') || path === '/analysis/collect') return '/market/competitive/ai-collect'
  if (path.startsWith('/market/competitive/report') || path === '/analysis/reports') return '/market/competitive/report'
  if (path.startsWith('/market/competitive/agent') || path === '/analysis/agent') return '/market/competitive/agent'
  if (path.startsWith('/product-sets') || path.startsWith('/content/product-sets')) return '/product-sets'
  if (path.startsWith('/aplus') || path.startsWith('/content/aplus')) return '/aplus'
  if (path.startsWith('/replicate') || path.startsWith('/content/replicate')) return '/replicate'
  if (path.startsWith('/video-replicate') || path.startsWith('/content/video-replicate')) return '/video-replicate'
  if (path.startsWith('/asset/image-gallery') || path === '/assets/images') return '/asset/image-gallery'
  if (path.startsWith('/asset/video-gallery') || path === '/assets/videos') return '/asset/video-gallery'
  if (path.startsWith('/product/master-data') || path === '/products/master-data') return '/product/master-data'
  if (path.startsWith('/product/management') || path === '/products/management') return '/product/management'
  if (path.startsWith('/settings/account')) return '/settings/account'
  if (path.startsWith('/settings/role')) return '/settings/role'
  if (path.startsWith('/settings/store')) return '/settings/store'
  if (path.startsWith('/settings/ai-config')) return '/settings/ai-config'
  return path
}

function NavTitle({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <span className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </span>
  )
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuth((state) => state.user)
  const logout = useAuth((state) => state.logout)
  const isSuper = useAuth((state) => state.isSuper)

  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar_expanded')
    return saved !== null ? JSON.parse(saved) : true
  })
  // openKeys 即旧版的组展开集合（key = 组名，兼容 sidebar_expanded_groups 存储语义）
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('sidebar_expanded_groups')
    return saved ? JSON.parse(saved) : ['资产库', '市场', '竞品分析']
  })
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('sidebar_manually_collapsed')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })

  // 已登录进入受保护界面时补拉一次 me()（权限/默认 AI 供应商等），覆盖“应用重启、token 已持久化、未重新登录”的场景。
  useEffect(() => {
    void useAuth.getState().loadMe()
  }, [])

  const filteredNav = useMemo(
    () => filterNavByPermission(nav, isSuper),
    [isSuper],
  )
  const activeKey = getSelectedKey(location.pathname)

  useEffect(() => {
    localStorage.setItem('sidebar_expanded', JSON.stringify(expanded))
  }, [expanded])

  useEffect(() => {
    localStorage.setItem('sidebar_expanded_groups', JSON.stringify(openKeys))
  }, [openKeys])

  useEffect(() => {
    localStorage.setItem('sidebar_manually_collapsed', JSON.stringify(Array.from(manuallyCollapsed)))
  }, [manuallyCollapsed])

  // 路由联动：自动展开激活叶子所在的组，但用户手动收起的组不强行展开
  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      filteredNav.forEach((item) => {
        if (item.children && hasActiveChild(item, activeKey) && !manuallyCollapsed.has(item.label)) {
          next.add(item.label)
          item.children.forEach((child) => {
            if (child.children && hasActiveChild(child, activeKey) && !manuallyCollapsed.has(child.label)) {
              next.add(child.label)
            }
          })
        }
      })
      if (next.size === prev.length) return prev
      return Array.from(next)
    })
  }, [activeKey, manuallyCollapsed, filteredNav])

  const handleClickSubMenu = (key: string) => {
    const isOpen = openKeys.includes(key)
    if (isOpen) {
      setManuallyCollapsed((mc) => new Set(mc).add(key))
    } else {
      setManuallyCollapsed((mc) => {
        const next = new Set(mc)
        next.delete(key)
        return next
      })
    }
    setOpenKeys((prev) => (isOpen ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const accountMenuContent = (
    <div className="w-[180px] overflow-hidden rounded-lg bg-white py-1 text-[14px] shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
      <div className="border-b border-[#f0f2f5] px-4 pb-2 pt-2.5">
        <p className="m-0 truncate text-[13px] font-bold text-[#0A1B39]">{user?.displayName || user?.username || '当前用户'}</p>
        <p className="m-0 mt-0.5 truncate text-[11px] text-[#86909C]">{user?.tenantId || '电商企业版'}</p>
      </div>
      <button
        onClick={() => navigate('/settings/account-info')}
        className="flex w-full items-center justify-center gap-3 border-0 bg-transparent px-4 py-3 text-[14px] text-[#0A1B39] transition-colors hover:bg-[#f8f9fb]"
      >
        <User className="h-5 w-5 text-[#86909C]" />
        <span>账号信息</span>
      </button>
      <div className="border-t border-[#f0f2f5]" />
      <button
        onClick={handleLogout}
        className="w-full border-0 bg-transparent px-4 py-3 text-center text-[14px] text-[#c62828] transition-colors hover:bg-[#fff0f0]"
      >
        退出当前账号
      </button>
    </div>
  )

  return (
    <div className="min-w-[1024px] h-screen w-full overflow-hidden bg-[#f4f7fb] text-[#0A1B39] font-sans flex">
      <aside
        className={`app-sidebar ${expanded ? 'w-[240px]' : 'w-[72px]'} relative z-30 h-full shrink-0 border-r border-[#e9edf3] bg-white flex flex-col transition-all duration-300`}
      >
        <div className={`flex h-[68px] shrink-0 items-center overflow-hidden whitespace-nowrap border-b border-[#e9edf3] ${expanded ? 'gap-2.5 px-6' : 'justify-center'}`}>
          <img src={brandLogo} alt="繁星" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
          {expanded && <span className="shrink-0 text-[18px] font-extrabold tracking-[-0.02em]">繁星</span>}
        </div>

        <Menu
          className="sidebar-tree flex-1 min-h-0"
          collapse={!expanded}
          selectedKeys={[activeKey]}
          openKeys={openKeys}
          onClickSubMenu={handleClickSubMenu}
          onClickMenuItem={(key) => navigate(key)}
          levelIndent={20}
          style={{ width: expanded ? '100%' : 72, borderRight: 'none', background: 'transparent' }}
        >
          {filteredNav.map((group) => (
            <Menu.SubMenu key={group.label} title={<NavTitle item={group} />}>
              {group.children!.map((child) =>
                child.children ? (
                  <Menu.SubMenu key={child.label} title={<NavTitle item={child} />}>
                    {child.children.map((leaf) => (
                      <Menu.Item key={leaf.to!}>
                        <NavTitle item={leaf} />
                      </Menu.Item>
                    ))}
                  </Menu.SubMenu>
                ) : (
                  <Menu.Item key={child.to!}>
                    <NavTitle item={child} />
                  </Menu.Item>
                ),
              )}
            </Menu.SubMenu>
          ))}
        </Menu>

        <div className={`${expanded ? 'px-5 pb-4 flex items-center justify-between' : 'pb-4 flex flex-col items-center gap-3'}`}>
          <Popover trigger="hover" position="tl" content={accountMenuContent}>
            <div className="h-8 w-8 rounded-full bg-gradient-to-b from-[#80d4ff] to-[#d7efff] shadow-inner cursor-pointer" />
          </Popover>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-10 w-10 items-center justify-center border-0 bg-transparent rounded-lg text-[#86909C] transition-colors hover:bg-[#f5f6f8]"
            title={expanded ? '收起侧边栏' : '展开侧边栏'}
          >
            {expanded ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </button>
        </div>
      </aside>
      <main className="content-main min-w-0 flex-1 flex-col overflow-hidden">
        <ReportJobBanner />
        <div className="min-h-0 flex-1 overflow-hidden"><Outlet /></div>
      </main>
    </div>
  )
}
