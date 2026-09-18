import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Layout, Menu, Popover } from '@arco-design/web-react'
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
} from 'lucide-react'
import brandLogo from '../assets/brand-logo.png'
import { useAuth } from '../store/auth'

const { Sider, Content } = Layout
const MenuItem = Menu.Item
const SubMenu = Menu.SubMenu

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const user = useAuth((state) => state.user)
  const logout = useAuth((state) => state.logout)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  // 计算当前选中的菜单 key，并兼容旧路由
  const currentPath = location.pathname
  const getSelectedKey = (path: string) => {
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

  const selectedKey = getSelectedKey(currentPath)

  // 默认展开当前激活菜单所属的 SubMenu
  const getDefaultOpenKeys = (key: string) => {
    if (key.startsWith('/market/competitive')) return ['market', 'market-competitive']
    if (['/product-sets', '/aplus', '/replicate', '/video-replicate'].includes(key)) return ['aigc']
    if (key.startsWith('/asset')) return ['assets']
    if (key.startsWith('/product')) return ['products']
    if (key.startsWith('/settings')) return ['settings']
    return ['market', 'market-competitive']
  }

  const [openKeys, setOpenKeys] = useState<string[]>(() => getDefaultOpenKeys(selectedKey))

  const handleMenuClick = (key: string) => {
    navigate(key)
  }

  const accountMenuContent = (
    <div className="w-[180px] py-1 text-[13px] text-[#0A1B39]">
      <div className="px-3 py-2 border-b border-[#f0f2f5] mb-1">
        <p className="font-bold truncate">{user?.displayName || user?.username || '当前用户'}</p>
        <p className="text-[11px] text-[#86909C] truncate">{user?.tenantId || '电商企业版'}</p>
      </div>
      <button
        onClick={() => navigate('/settings/account-info')}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#f4f7fb] rounded-md transition-colors"
      >
        <User className="h-4 w-4 text-[#86909C]" />
        <span>账号信息</span>
      </button>
      <div className="my-1 border-t border-[#f0f2f5]" />
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#fff0f0] text-[#c62828] rounded-md transition-colors"
      >
        <LogOut className="h-4 w-4" />
        <span>退出当前账号</span>
      </button>
    </div>
  )

  return (
    <Layout className="app-shell flex h-screen w-screen overflow-hidden bg-[#f4f7fb] text-[#0A1B39]">
      <Sider
        collapsed={collapsed}
        onCollapse={setCollapsed}
        collapsible={false}
        width={240}
        collapsedWidth={68}
        className="sidebar-clean border-r border-[#e9edf3] bg-white flex flex-col z-30 select-none"
      >
        {/* 顶部 Logo 区域 */}
        <div
          className={`flex h-[64px] shrink-0 items-center border-b border-[#e9edf3] ${
            collapsed ? 'justify-center' : 'gap-2.5 px-5'
          }`}
        >
          <img src={brandLogo} alt="繁星" className="h-7 w-7 rounded-lg object-contain" />
          {!collapsed && <span className="text-[18px] font-extrabold tracking-[-0.02em] text-[#0A1B39]">繁星</span>}
        </div>

        {/* 树形菜单 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-2">
          <Menu
            selectedKeys={[selectedKey]}
            openKeys={openKeys}
            onClickSubMenu={(key) => {
              setOpenKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
            }}
            onClickMenuItem={handleMenuClick}
            style={{ border: 'none', background: 'transparent' }}
          >
            {/* 市场 */}
            <SubMenu
              key="market"
              title={
                <span className="flex items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0 text-[#86909C]" />
                  <span>市场</span>
                </span>
              }
            >
              <SubMenu
                key="market-competitive"
                title={
                  <span className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 shrink-0 text-[#86909C]" />
                    <span>竞品分析</span>
                  </span>
                }
              >
                <MenuItem key="/market/competitive/ai-collect">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 shrink-0" />
                    <span>AI数据采集</span>
                  </div>
                </MenuItem>
                <MenuItem key="/market/competitive/report">
                  <div className="flex items-center gap-2">
                    <FileBarChart className="h-3.5 w-3.5 shrink-0" />
                    <span>分析报告</span>
                  </div>
                </MenuItem>
                <MenuItem key="/market/competitive/agent">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 shrink-0" />
                    <span>智能问答</span>
                  </div>
                </MenuItem>
              </SubMenu>
            </SubMenu>

            {/* AIGC */}
            <SubMenu
              key="aigc"
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-[#86909C]" />
                  <span>AIGC</span>
                </span>
              }
            >
              <MenuItem key="/product-sets">
                <div className="flex items-center gap-2">
                  <WalletCards className="h-3.5 w-3.5 shrink-0" />
                  <span>商品主图</span>
                </div>
              </MenuItem>
              <MenuItem key="/aplus">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>详情图</span>
                </div>
              </MenuItem>
              <MenuItem key="/replicate">
                <div className="flex items-center gap-2">
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                  <span>爆款图复刻</span>
                </div>
              </MenuItem>
              <MenuItem key="/video-replicate">
                <div className="flex items-center gap-2">
                  <Video className="h-3.5 w-3.5 shrink-0" />
                  <span>爆款视频复刻</span>
                </div>
              </MenuItem>
            </SubMenu>

            {/* 资产库 */}
            <SubMenu
              key="assets"
              title={
                <span className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 shrink-0 text-[#86909C]" />
                  <span>资产库</span>
                </span>
              }
            >
              <MenuItem key="/asset/image-gallery">
                <div className="flex items-center gap-2">
                  <Image className="h-3.5 w-3.5 shrink-0" />
                  <span>图库</span>
                </div>
              </MenuItem>
              <MenuItem key="/asset/video-gallery">
                <div className="flex items-center gap-2">
                  <Film className="h-3.5 w-3.5 shrink-0" />
                  <span>视频库</span>
                </div>
              </MenuItem>
            </SubMenu>

            {/* 商品 */}
            <SubMenu
              key="products"
              title={
                <span className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 shrink-0 text-[#86909C]" />
                  <span>商品</span>
                </span>
              }
            >
              <MenuItem key="/product/master-data">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 shrink-0" />
                  <span>商品主档</span>
                </div>
              </MenuItem>
              <MenuItem key="/product/management">
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 shrink-0" />
                  <span>平台商品</span>
                </div>
              </MenuItem>
            </SubMenu>

            {/* 设置 */}
            <SubMenu
              key="settings"
              title={
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 shrink-0 text-[#86909C]" />
                  <span>设置</span>
                </span>
              }
            >
              <MenuItem key="/settings/account">
                <div className="flex items-center gap-2">
                  <UserCog className="h-3.5 w-3.5 shrink-0" />
                  <span>账号管理</span>
                </div>
              </MenuItem>
              <MenuItem key="/settings/role">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>角色管理</span>
                </div>
              </MenuItem>
              <MenuItem key="/settings/store">
                <div className="flex items-center gap-2">
                  <Store className="h-3.5 w-3.5 shrink-0" />
                  <span>店铺管理</span>
                </div>
              </MenuItem>
              <MenuItem key="/settings/ai-config">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>AI 配置</span>
                </div>
              </MenuItem>
            </SubMenu>
          </Menu>
        </div>

        {/* 侧边栏底栏：头像与折叠切换 */}
        <div
          className={`border-t border-[#e9edf3] ${
            collapsed
              ? 'flex flex-col items-center gap-3 py-3'
              : 'flex items-center justify-between px-4 py-3'
          }`}
        >
          <Popover content={accountMenuContent} trigger="click" position="tr">
            <div
              className="h-8 w-8 rounded-full bg-gradient-to-b from-[#80d4ff] to-[#d7efff] shadow-inner cursor-pointer flex items-center justify-center text-white text-[12px] font-bold ring-2 ring-white hover:ring-[#80d4ff] transition-all shrink-0"
              title="账号与个人设置"
            >
              {user?.username?.slice(0, 1).toUpperCase() || 'U'}
            </div>
          </Popover>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-[#f0f2f5] text-[#86909C] hover:text-[#0A1B39] transition-colors"
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
            aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </Sider>

      {/* 主视区内容 */}
      <Content className="content-main flex-1 min-w-0 overflow-hidden flex flex-col bg-[#f4f7fb]">
        <Outlet />
      </Content>
    </Layout>
  )
}
