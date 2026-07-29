import { useState, useEffect, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { ChevronDown, Copy, FileText, FolderOpen, Package, PanelLeftClose, PanelLeftOpen, Target, Cpu, FileBarChart, Video, WalletCards, ShoppingBag, Database, Image, Film, Sparkles, Globe, Settings, UserCog, Users, Store } from "lucide-react";
import brandLogo from "@/imports/image-5.png";
import { SidebarContext } from "./SidebarContext";

type NavItem = {
  to?: string;
  label: string;
  icon: ReactNode;
  children?: NavItem[];
};

const nav: NavItem[] = [
  {
    label: "市场",
    icon: <Globe className="h-4 w-4 shrink-0" />,
    children: [
      {
        label: "竞品分析",
        icon: <Target className="h-4 w-4 shrink-0" />,
        children: [
          { to: "/market/competitive/ai-collect", label: "AI数据采集", icon: <Cpu className="h-4 w-4 shrink-0" /> },
          { to: "/market/competitive/report", label: "分析报告", icon: <FileBarChart className="h-4 w-4 shrink-0" /> },
        ],
      },
    ],
  },
  {
    label: "AIGC",
    icon: <Sparkles className="h-4 w-4 shrink-0" />,
    children: [
      { to: "/product-sets", label: "商品主图", icon: <WalletCards className="h-4 w-4 shrink-0" /> },
      { to: "/aplus", label: "详情图", icon: <FileText className="h-4 w-4 shrink-0" /> },
      { to: "/replicate", label: "爆款图复刻", icon: <Copy className="h-4 w-4 shrink-0" /> },
      { to: "/video-replicate", label: "爆款视频复刻", icon: <Video className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    label: "资产库",
    icon: <FolderOpen className="h-4 w-4 shrink-0" />,
    children: [
      { to: "/asset/image-gallery", label: "图库", icon: <Image className="h-4 w-4 shrink-0" /> },
      { to: "/asset/video-gallery", label: "视频库", icon: <Film className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    label: "商品",
    icon: <ShoppingBag className="h-4 w-4 shrink-0" />,
    children: [
      { to: "/product/master-data", label: "商品主档", icon: <Database className="h-4 w-4 shrink-0" /> },
      { to: "/product/management", label: "平台商品", icon: <Package className="h-4 w-4 shrink-0" /> },
    ],
  },
  {
    label: "设置",
    icon: <Settings className="h-4 w-4 shrink-0" />,
    children: [
      { to: "/settings/account", label: "账号管理", icon: <UserCog className="h-4 w-4 shrink-0" /> },
      { to: "/settings/role", label: "角色管理", icon: <Users className="h-4 w-4 shrink-0" /> },
      { to: "/settings/store", label: "店铺管理", icon: <Store className="h-4 w-4 shrink-0" /> },
    ],
  },
];

function hasActiveChild(item: NavItem, pathname: string): boolean {
  if (!item.children) return false;
  return item.children.some((child) => (child.to ? child.to === pathname : false) || hasActiveChild(child, pathname));
}

export function Layout() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem("sidebar_expanded");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("sidebar_expanded_groups");
    return saved ? new Set(JSON.parse(saved)) : new Set(["资产库", "市场", "竞品分析"]);
  });
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("sidebar_manually_collapsed");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem("sidebar_expanded", JSON.stringify(expanded));
  }, [expanded]);

  useEffect(() => {
    localStorage.setItem("sidebar_expanded_groups", JSON.stringify(Array.from(expandedGroups)));
  }, [expandedGroups]);

  useEffect(() => {
    localStorage.setItem("sidebar_manually_collapsed", JSON.stringify(Array.from(manuallyCollapsed)));
  }, [manuallyCollapsed]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      nav.forEach((item) => {
        if (item.children && hasActiveChild(item, location.pathname) && !manuallyCollapsed.has(item.label)) {
          next.add(item.label);
          item.children.forEach((child) => {
            if (child.children && hasActiveChild(child, location.pathname) && !manuallyCollapsed.has(child.label)) {
              next.add(child.label);
            }
          });
        }
      });
      return next;
    });
  }, [location.pathname, manuallyCollapsed]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
        setManuallyCollapsed((mc) => {
          const mcNext = new Set(mc);
          mcNext.add(label);
          return mcNext;
        });
      } else {
        next.add(label);
        setManuallyCollapsed((mc) => {
          const mcNext = new Set(mc);
          mcNext.delete(label);
          return mcNext;
        });
      }
      return next;
    });
  };

  function renderNavItems(items: NavItem[], depth: number = 0): ReactNode {
    return items.map((item) => {
      const hasChildren = Boolean(item.children?.length);
      const isActive = item.to ? item.to === location.pathname : false;
      const hasActiveDescendant = hasActiveChild(item, location.pathname);
      const isGroupExpanded = expandedGroups.has(item.label);

      if (depth > 0 && !expanded) return null;

      const indentStyle = depth > 0 ? { paddingLeft: `${40 + (depth - 1) * 24}px` } : {};

      if (hasChildren && expanded) {
        return (
          <div key={item.label}>
            <button
              onClick={() => toggleGroup(item.label)}
              className={`flex w-full items-center gap-3 text-[14px] ${hasActiveDescendant ? "font-bold text-[#0A1B39]" : "font-normal text-[#0A1B39] hover:bg-[#f5f6f8]"} h-10 rounded-lg px-3 transition-colors`}
              style={indentStyle}
            >
              {depth === 0 && <div className="shrink-0">{item.icon}</div>}
              <span className="flex-1 text-left leading-tight whitespace-nowrap">{item.label}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-[#86909C] transition-transform ${isGroupExpanded ? "rotate-180" : ""}`} />
            </button>
            {isGroupExpanded && <div className="mt-0.5">{renderNavItems(item.children!, depth + 1)}</div>}
          </div>
        );
      }

      const content = (
        <div
          className={`flex items-center gap-3 text-[14px] ${isActive ? "font-bold text-[#0A1B39] bg-[#e4f3ff]" : "font-normal text-[#0A1B39] hover:bg-[#f5f6f8]"} ${expanded ? "h-10 rounded-lg px-3" : "h-10 w-10 rounded-lg mx-auto justify-center"}`}
          style={indentStyle}
        >
          {depth === 0 && <div className="shrink-0">{item.icon}</div>}
          {expanded && <span className="leading-tight whitespace-nowrap">{item.label}</span>}
        </div>
      );

      return (
        <div key={item.label} className="relative group">
          {item.to ? <Link to={item.to}>{content}</Link> : <div>{content}</div>}
          {!expanded && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-[100]">
              <div className="rounded-md bg-[#0A1B39] px-2.5 py-1.5 text-[12px] font-normal text-white whitespace-nowrap shadow-lg">{item.label}</div>
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <SidebarContext.Provider value={{ expanded }}>
    <div className="min-w-[1024px] h-screen w-full overflow-hidden bg-[#f4f7fb] text-[#0A1B39] font-sans flex">
        <aside className={`${expanded ? "w-[240px]" : "w-[72px]"} relative z-30 h-full shrink-0 border-r border-[#e9edf3] bg-white flex flex-col transition-all duration-300`}>
          <div className={`flex h-[68px] shrink-0 items-center border-b border-[#e9edf3] ${expanded ? "gap-2.5 px-6" : "justify-center"}`}>
            <img src={brandLogo} alt="品牌 logo" className="h-8 w-8 rounded-lg object-contain" />
            {expanded && <span className="text-[18px] font-extrabold tracking-[-0.02em]">Design Studio</span>}
          </div>
          <nav className={`flex flex-col gap-2 px-3 pt-4 flex-1 ${expanded ? "overflow-y-auto custom-scrollbar" : "overflow-visible"}`}>
            {renderNavItems(nav)}
          </nav>
          <div className={`${expanded ? "px-5 pb-4 flex items-center justify-between" : "pb-4 flex flex-col items-center gap-3"}`}>
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-b from-[#80d4ff] to-[#d7efff] shadow-inner" />
            <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-center h-10 w-10 rounded-lg hover:bg-[#f5f6f8] transition-colors text-[#86909C]">
              {expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-hidden"><Outlet /></main>
    </div>
    </SidebarContext.Provider>
  );
}
