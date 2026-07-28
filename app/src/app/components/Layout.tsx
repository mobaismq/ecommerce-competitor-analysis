import { useState, useEffect, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { ChevronDown, Copy, FileText, FolderOpen, Package, Store, Video, WalletCards, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import brandLogo from "@/imports/image-5.png";
import { SidebarContext } from "./SidebarContext";

type NavItem = {
  to?: string;
  label: string;
  icon?: ReactNode;
  children?: NavItem[];
};

const nav: NavItem[] = [
  { to: "/", label: "资产库", icon: <FolderOpen className="h-4 w-4 shrink-0" /> },
  {
    label: "市场",
    icon: <Store className="h-4 w-4 shrink-0" />,
    children: [
      {
        label: "竞品分析",
        children: [
          { to: "/market/competitive/ai-collect", label: "AI数据采集" },
          { to: "/market/competitive/report", label: "分析报告" },
        ],
      },
    ],
  },
  { to: "/product-sets", label: "商品套图", icon: <WalletCards className="h-4 w-4 shrink-0" /> },
  { to: "/aplus", label: "A+详情", icon: <FileText className="h-4 w-4 shrink-0" /> },
  { to: "/replicate", label: "爆款图复刻", icon: <Copy className="h-4 w-4 shrink-0" /> },
  { to: "/video-replicate", label: "爆款视频复刻", icon: <Video className="h-4 w-4 shrink-0" /> },
  { to: "/listing", label: "图片上架", icon: <Package className="h-4 w-4 shrink-0" /> },
];

function hasActiveChild(item: NavItem, pathname: string): boolean {
  if (!item.children) return false;
  return item.children.some((child) => (child.to ? child.to === pathname : false) || hasActiveChild(child, pathname));
}

export function Layout() {
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["市场", "竞品分析"]));

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      nav.forEach((item) => {
        if (item.children && hasActiveChild(item, location.pathname)) {
          next.add(item.label);
          item.children.forEach((child) => {
            if (child.children && hasActiveChild(child, location.pathname)) {
              next.add(child.label);
            }
          });
        }
      });
      return next;
    });
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
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

      const indentStyle = depth > 0 ? { paddingLeft: `${depth * 22 + 18}px` } : {};
      const shouldShowIcon = depth === 0 && item.icon;

      if (hasChildren && expanded) {
        return (
          <div key={item.label}>
            <button
              onClick={() => toggleGroup(item.label)}
              className={`flex w-full items-center gap-3 text-[14px] ${hasActiveDescendant ? "font-bold text-[#0A1B39]" : "font-normal text-[#0A1B39] hover:bg-[#f5f6f8]"} h-10 rounded-lg px-3 transition-colors`}
              style={indentStyle}
            >
              {shouldShowIcon && <div className="shrink-0">{item.icon}</div>}
              <span className="flex-1 text-left leading-tight whitespace-nowrap">{item.label}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-[#86909C] transition-transform ${isGroupExpanded ? "rotate-180" : ""}`} />
            </button>
	            {isGroupExpanded && <div className="mt-2 space-y-2">{renderNavItems(item.children!, depth + 1)}</div>}
          </div>
        );
      }

      const content = (
        <div
          className={`flex items-center gap-3 text-[14px] ${isActive ? "font-bold text-[#0A1B39] bg-[#e4f3ff]" : "font-normal text-[#0A1B39] hover:bg-[#f5f6f8]"} ${expanded ? "h-10 rounded-lg px-3" : "h-10 w-10 rounded-lg mx-auto justify-center"}`}
          style={indentStyle}
        >
          {shouldShowIcon && <div className="shrink-0">{item.icon}</div>}
          {expanded && <span className="leading-tight whitespace-nowrap">{item.label}</span>}
        </div>
      );

      return (
        <div key={item.label} className="relative group">
          {item.to ? <Link to={item.to}>{content}</Link> : <div>{content}</div>}
          {!expanded && (
            <div className="absolute left-full ml-2 top-1/2 z-[100] hidden -translate-y-1/2 group-hover:block">
              <div className="rounded-md bg-[#0A1B39] px-2.5 py-1.5 text-[12px] font-normal text-white whitespace-nowrap shadow-lg">{item.label}</div>
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <SidebarContext.Provider value={{ expanded }}>
      <div className="min-h-screen w-full bg-[#f4f7fb] text-[#0A1B39] font-sans flex">
        {/* Sidebar */}
        <aside className={`${expanded ? "w-[240px]" : "w-[72px]"} sticky top-0 z-30 h-screen shrink-0 border-r border-[#e9edf3] bg-white flex flex-col transition-all duration-300`}>
          {/* Logo */}
          <div className={`flex items-center ${expanded ? "gap-2.5 px-4" : "justify-center"} h-[68px] border-b border-[#e9edf3]`}>
            <img src={brandLogo} alt="品牌 logo" className="h-8 w-8 rounded-lg object-contain" />
            {expanded && <span className="text-[18px] font-extrabold tracking-[-0.02em]">Design Studio</span>}
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-2 px-3 pt-4 flex-1 overflow-visible custom-scrollbar">
            {renderNavItems(nav)}
          </nav>

          {/* User avatar and collapse toggle */}
          <div className={`${expanded ? "flex items-center justify-between px-4" : "flex flex-col items-center gap-3 px-3"} pb-4 pt-3`}>
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-b from-[#80d4ff] to-[#d7efff] shadow-inner"></div>
            <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-center h-10 w-10 rounded-lg text-[#86909C] outline-none transition-colors hover:bg-[#f5f6f8] focus:outline-none focus-visible:outline-none">
              {expanded ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </SidebarContext.Provider>
  );
}
