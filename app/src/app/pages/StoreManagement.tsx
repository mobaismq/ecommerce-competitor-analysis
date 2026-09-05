import { useState, useRef, useEffect } from "react";
import { Search, RotateCcw, Plus, X, ChevronDown, Calendar, ExternalLink, Check } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { hasButtonPermission, getUserPermissions } from "@/app/utils/permission";
import { usePlatforms, type Platform } from "@/app/hooks/usePlatforms";

// ── Types ──
interface Store {
  id: string;
  platform: string; // 所属平台名称
  platformId: string;
  platformLogo: string; // 所属平台logo（角标用）
  storeName: string;
  platformStoreId: string;
  storeLogo: string;
  authStatus: number; // 0已到期 1正常
  storeStatus: number; // 1启用 0停用
  authExpireTime: string;
  authTime: string;
}

// ── 后端 /api/store/list 返回的店铺记录 ──
interface StoreRecord {
  storeId: string;
  storeName: string;
  platformId: string;
  platformName: string;
  platformLogo: string;
  platformStoreId: string;
  storeLogo: string;
  authStatus: number;
  storeStatus: number;
  authTime: string;
  authExpireTime: string;
  authBy: string;
  createdAt: string;
  createdBy: string;
  isDeleted: number;
}

// 后端店铺记录 → 页面 Store 结构
function mapStore(record: StoreRecord): Store {
  return {
    id: record.storeId,
    platform: record.platformName,
    platformId: record.platformId,
    platformLogo: record.platformLogo,
    storeName: record.storeName,
    platformStoreId: record.platformStoreId,
    storeLogo: record.storeLogo,
    authStatus: record.authStatus,
    storeStatus: record.storeStatus,
    authExpireTime: record.authExpireTime,
    authTime: record.authTime,
  };
}

// ── MultiSelect Component ──
function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "请选择",
}: {
  options: string[];
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const displayText = value.length === 0 ? placeholder : value.join("、");

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div
        onClick={() => setOpen(!open)}
        className="h-8 w-full flex items-center justify-between rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] cursor-pointer outline-none focus:border-[#409eff] select-none"
      >
        <span className={`truncate ${value.length === 0 ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`} title={displayText}>{displayText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value.length > 0 && (
            <button onClick={clearAll} className="text-[#c0c4cc] hover:text-[#86909C]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-[#c0c4cc]" />
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e6e9ef] rounded-lg shadow-lg z-50 max-h-[200px] overflow-auto">
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => toggle(opt)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-[#f5f6f8] cursor-pointer text-[13px] text-[#0A1B39]"
            >
              <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${value.includes(opt) ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6] bg-white"}`}>
                {value.includes(opt) && <Check className="h-3 w-3 text-white" />}
              </div>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single Select Component ──
function SingleSelect({
  options,
  value,
  onChange,
  placeholder = "请选择",
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayText = value || placeholder;

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div
        onClick={() => setOpen(!open)}
        className="h-8 w-full flex items-center justify-between rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] cursor-pointer outline-none focus:border-[#409eff] select-none"
      >
        <span className={`truncate ${!value ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`} title={displayText}>{displayText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="text-[#c0c4cc] hover:text-[#86909C]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-[#c0c4cc]" />
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e6e9ef] rounded-lg shadow-lg z-50 max-h-[200px] overflow-auto">
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`flex items-center gap-2 px-3 py-2 hover:bg-[#f5f6f8] cursor-pointer text-[13px] ${value === opt ? "text-[#409eff] bg-[#f0f7ff]" : "text-[#0A1B39]"}`}
            >
              {value === opt && <Check className="h-3.5 w-3.5" />}
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Date Range Picker ─
function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  placeholder = "请选择日期范围",
}: {
  startDate: string;
  endDate: string;
  onStartChange: (val: string) => void;
  onEndChange: (val: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasValue = startDate || endDate;
  const displayText = startDate && endDate ? `${startDate} 至 ${endDate}` : placeholder;

  const handleClear = () => {
    onStartChange("");
    onEndChange("");
  };

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-left text-[13px] outline-none focus:border-[#409eff] flex items-center justify-between min-w-0"
      >
        <span className={`truncate ${hasValue ? "text-[#0A1B39]" : "text-[#c0c4cc]"}`} title={displayText}>{displayText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {hasValue && (
            <button onClick={(e) => { e.stopPropagation(); handleClear(); }} className="text-[#c0c4cc] hover:text-[#86909C]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <Calendar className="h-3.5 w-3.5 text-[#c0c4cc]" />
        </div>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-[#e6e9ef] rounded-lg shadow-lg z-50 p-4 w-80">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-[12px] text-[#86909C] mb-1">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartChange(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2 text-[13px] outline-none focus:border-[#409eff]"
              />
            </div>
            <span className="text-[12px] text-[#86909C] mt-4">至</span>
            <div className="flex-1">
              <label className="block text-[12px] text-[#86909C] mb-1">结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndChange(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2 text-[13px] outline-none focus:border-[#409eff]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={handleClear} className="h-7 px-3 rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
              清除
            </button>
            <button onClick={() => setOpen(false)} className="h-7 px-3 rounded-lg bg-[#409eff] text-[13px] text-white hover:bg-[#66b1ff] transition-colors">
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Store Modal ─
function AddStoreModal({ platforms, onClose, onCreated }: { platforms: Platform[]; onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePlatformSelect = (p: Platform) => {
    setSelectedPlatform(p);
    setStep(2);
  };

  const handleAuthComplete = async () => {
    if (!selectedPlatform) return;
    setSubmitting(true);
    try {
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      const now = new Date();
      const expire = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      // 授权操作人 = 授权人 = 新增操作人（当前登录账号）
      const operator = localStorage.getItem("current_user_id") || localStorage.getItem("current_user") || "admin";
      // 模拟平台授权返回的店铺信息（后续对接真实授权后由平台回调提供）
      const mockStoreName = `${selectedPlatform.platformName}店铺`;
      const mockPlatformStoreId = `${selectedPlatform.platformCode}${Date.now().toString().slice(-6)}`;
      const response = await fetch("/api/store/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: mockStoreName,
          platformId: selectedPlatform.platformId,
          platformStoreId: mockPlatformStoreId,
          storeLogo: selectedPlatform.platformLogo,
          authStatus: 1,
          storeStatus: 1,
          authTime: fmt(now),
          authExpireTime: fmt(expire),
          authBy: operator,
          createdBy: operator,
        }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) throw new Error(res?.error || "新增店铺失败");
      setStep(3);
      onCreated();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "新增店铺失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToPlatformList = () => {
    setSelectedPlatform(null);
    setStep(1);
  };

  const handleGoAuth = () => {
    window.open("#", "_blank");
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[480px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-[16px] font-bold text-[#0A1B39]">新增店铺</h2>
          <button onClick={onClose} className="text-[#86909C] hover:text-[#0A1B39] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-4">
          <div className="flex items-center justify-center">
            {[1, 2, 3].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold ${step >= s ? "bg-[#409eff] text-white" : "bg-[#f2f4f7] text-[#86909C]"}`}>
                    {step > s ? <Check className="h-3.5 w-3.5" /> : s}
                  </div>
                  <span className={`text-[12px] mt-1 ${step >= s ? "text-[#409eff] font-bold" : "text-[#86909C]"}`}>
                    {s === 1 ? "选择平台" : s === 2 ? "店铺授权" : "授权完成"}
                  </span>
                </div>
                {i < 2 && <div className={`w-12 h-[2px] mx-2 ${step > s ? "bg-[#409eff]" : "bg-[#e6e9ef]"}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6">
          {step === 1 && (
            <div>
              <p className="text-[13px] text-[#86909C] mb-4">请选择要授权的电商平台</p>
              <div className="grid grid-cols-3 gap-3">
                {platforms.length > 0 ? (
                  platforms.map((p) => (
                    <button
                      key={p.platformId}
                      onClick={() => handlePlatformSelect(p)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[#e6e9ef] hover:border-[#409eff] hover:bg-[#f0f7ff] transition-colors cursor-pointer"
                    >
                      <div className="h-10 w-10 rounded-xl bg-[#f5f6f8] flex items-center justify-center overflow-hidden">
                        {p.platformLogo ? (
                          <img src={p.platformLogo} alt={p.platformName} className="h-full w-full object-cover rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <span className="text-[11px] font-bold text-[#86909C]">{p.platformName.slice(0, 1)}</span>
                        )}
                      </div>
                      <span className="text-[13px] text-[#0A1B39] font-medium">{p.platformName}</span>
                    </button>
                  ))
                ) : (
                  <div className="col-span-3 py-10 text-center text-[#86909C] text-[13px]">平台加载中…</div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center py-8">
              <div className="h-16 w-16 rounded-full bg-[#f0f7ff] flex items-center justify-center mb-4">
                <ExternalLink className="h-8 w-8 text-[#409eff]" />
              </div>
              <p className="text-[14px] text-[#0A1B39] font-medium mb-1">正在授权 {selectedPlatform?.platformName} 店铺</p>
              <p className="text-[12px] text-[#86909C] mb-6">请在新打开的窗口中完成授权操作</p>
              <div className="flex gap-3">
                <button onClick={handleBackToPlatformList} className="h-9 px-5 rounded-lg border border-[#e6e9ef] bg-white text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
                  返回平台列表
                </button>
                <button onClick={handleGoAuth} className="h-9 px-5 rounded-lg bg-[#409eff] text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors flex items-center gap-1">
                  <ExternalLink className="h-3.5 w-3.5" />
                  去授权
                </button>
              </div>
              <button
                onClick={handleAuthComplete}
                disabled={submitting}
                className="mt-4 text-[12px] text-[#409eff] hover:underline disabled:opacity-50"
              >
                {submitting ? "授权中…" : "（模拟授权完成）"}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center py-8">
              <div className="h-16 w-16 rounded-full bg-[#e6f7e6] flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-[#52c41a]" />
              </div>
              <p className="text-[14px] text-[#0A1B39] font-medium mb-1">授权完成</p>
              <p className="text-[12px] text-[#86909C] mb-6">{selectedPlatform?.platformName} 店铺已成功授权</p>
              <button onClick={onClose} className="h-9 px-8 rounded-lg bg-[#409eff] text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors">
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Store Card ──
function StoreCard({ store, onToggleStatus, onDelete, onAuth }: { store: Store; onToggleStatus: (id: string) => void; onDelete: (id: string) => void; onAuth: (store: Store) => void }) {
  // 授权已到期：店铺状态强制为停用，状态按钮不可点击
  const isExpired = store.authStatus === 0;
  return (
    <div className="bg-white rounded-xl border border-[#e6e9ef] p-4 hover:shadow-md transition-shadow relative">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-[#f5f6f8] flex items-center justify-center overflow-hidden shrink-0">
          {store.storeLogo ? (
            <img src={store.storeLogo} alt={store.storeName} className="h-full w-full object-cover rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <span className="text-[11px] font-bold text-[#86909C]">{store.storeName.slice(0, 1)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-[#0A1B39] truncate">{store.storeName}</div>
        </div>
      </div>

      {/* 平台logo+名称角标（右上角） */}
      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white border border-[#e6e9ef] shadow-sm pl-1 pr-2 py-0.5">
        <div className="relative h-4 w-4 shrink-0 overflow-hidden rounded-sm flex items-center justify-center">
          <span className="text-[10px] font-bold text-[#86909C]">{store.platform.slice(0, 1)}</span>
          {store.platformLogo && (
            <img
              src={store.platformLogo}
              alt={store.platform}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
        <span className="text-[11px] text-[#86909C] leading-none">{store.platform}</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12px] text-[#86909C]">授权状态</span>
        <span className={`text-[12px] font-medium px-2 py-0.5 rounded ${store.authStatus === 1 ? "text-[#52c41a]" : "text-[#ff4d4f]"}`}>
          {store.authStatus === 1 ? "正常" : "已到期"}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12px] text-[#86909C]">店铺状态</span>
        <button
          onClick={() => onToggleStatus(store.id)}
          disabled={isExpired}
          className={`relative h-5 w-9 rounded-full transition-colors ${isExpired ? "bg-[#dcdfe6] cursor-not-allowed opacity-60" : store.storeStatus === 1 ? "bg-[#409eff]" : "bg-[#dcdfe6]"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isExpired || store.storeStatus !== 1 ? "left-0.5" : "left-[18px]"}`} />
        </button>
        <span className="text-[12px] text-[#0A1B39]">{isExpired ? "停用" : store.storeStatus === 1 ? "启用" : "停用"}</span>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#86909C]">授权时间</span>
          <span className="text-[12px] text-[#0A1B39]">{store.authTime}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#86909C]">授权到期</span>
          <span className="text-[12px] text-[#0A1B39]">{store.authExpireTime}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasButtonPermission(2019) && (
          <button onClick={() => onAuth(store)} className="flex-1 h-8 rounded-lg bg-[#409eff] text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors flex items-center justify-center gap-1">
            <ExternalLink className="h-3.5 w-3.5" />
            授权
          </button>
        )}
        {hasButtonPermission(2020) && (
          <button
            onClick={() => onDelete(store.id)}
            className="h-8 px-4 rounded-lg border border-[#e6e9ef] bg-white text-[13px] font-bold text-[#86909C] hover:bg-[#f5f6f8] transition-colors"
          >
            删除
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──
export function StoreManagement() {
  const { platforms } = usePlatforms();
  const [stores, setStores] = useState<Store[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);

  const [queryName, setQueryName] = useState("");
  const [queryPlatform, setQueryPlatform] = useState("");
  const [queryStartDate, setQueryStartDate] = useState("");
  const [queryEndDate, setQueryEndDate] = useState("");

  const [filterName, setFilterName] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagedStores = stores;

  // 对接 /api/store/list：后端分页 + 后端查询
  useEffect(() => {
    let cancelled = false;
    async function loadStores() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("pageSize", String(pageSize));
        if (filterName) params.set("storeName", filterName);
        if (filterPlatform) {
          const p = platforms.find((x) => x.platformName === filterPlatform);
          if (p) params.set("platformId", p.platformId);
        }
        // 账号店铺权限：无店铺权限限制时查询全部店铺；有权限则仅查询有权限的店铺
        const storePerms = getUserPermissions().storePermissionIds;
        if (storePerms.length > 0) {
          params.set("storeIds", storePerms.join(","));
        }
        if (filterStartDate) params.set("authTimeStart", filterStartDate);
        if (filterEndDate) params.set("authTimeEnd", filterEndDate);
        const response = await fetch(`/api/store/list?${params.toString()}`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          setStores([]);
          setTotal(0);
          return;
        }
        setStores((Array.isArray(data.list) ? data.list : []).map(mapStore));
        setTotal(Number(data.total) || 0);
      } catch {
        if (!cancelled) {
          setStores([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadStores();
    return () => { cancelled = true; };
  }, [currentPage, filterName, filterPlatform, filterStartDate, filterEndDate, platforms, reloadKey]);

  const handleQuery = () => {
    setFilterName(queryName.trim());
    setFilterPlatform(queryPlatform);
    setFilterStartDate(queryStartDate);
    setFilterEndDate(queryEndDate);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setQueryName("");
    setQueryPlatform("");
    setQueryStartDate("");
    setQueryEndDate("");
    setFilterName("");
    setFilterPlatform("");
    setFilterStartDate("");
    setFilterEndDate("");
    setCurrentPage(1);
  };

  const handleToggleStatus = async (id: string) => {
    const store = stores.find((s) => s.id === id);
    if (!store) return;
    // 授权已到期：店铺状态强制停用，不允许切换
    if (store.authStatus === 0) {
      window.alert("授权已到期，店铺已停用，请先重新授权");
      return;
    }
    const nextStatus = store.storeStatus === 1 ? 0 : 1;
    // 乐观更新：先本地变更，后端失败再回滚（不刷新列表）
    setStores((prev) => prev.map((s) => (s.id === id ? { ...s, storeStatus: nextStatus } : s)));
    try {
      const response = await fetch("/api/store/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: id, status: nextStatus }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) throw new Error(res?.error || "更新店铺状态失败");
    } catch (error) {
      // 失败回滚
      setStores((prev) => prev.map((s) => (s.id === id ? { ...s, storeStatus: store.storeStatus } : s)));
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  // 重新授权：更新授权时间/到期时间/授权人，授权状态置为正常
  const handleAuth = async (store: Store) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const now = new Date();
    const expire = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    try {
      const response = await fetch("/api/store/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          authStatus: 1,
          authTime: fmt(now),
          authExpireTime: fmt(expire),
          authBy: localStorage.getItem("current_user_id") || "",
        }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) throw new Error(res?.error || "授权失败");
      setReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleDelete = (id: string) => {
    setDeletingStoreId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const storeId = deletingStoreId;
    setShowDeleteConfirm(false);
    setDeletingStoreId(null);
    if (!storeId) return;
    try {
      const response = await fetch("/api/store/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) throw new Error(res?.error || "删除店铺失败");
      setReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingStoreId(null);
  };

  const clearName = () => setQueryName("");

  return (
    <div className="p-6 overflow-y-auto h-full">
      <PageHeader breadcrumbs={[{ label: "设置" }, { label: "店铺管理" }]} />

      <div className="mb-4 rounded-xl bg-white p-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">店铺名称</label>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
              <input
                type="text"
                placeholder="请输入"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
              />
              {queryName && (
                <button onClick={clearName} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">店铺平台</label>
            <SingleSelect
              options={platforms.map((p) => p.platformName)}
              value={queryPlatform}
              onChange={setQueryPlatform}
              placeholder="请选择"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">授权时间</label>
            <DateRangePicker
              startDate={queryStartDate}
              endDate={queryEndDate}
              onStartChange={setQueryStartDate}
              onEndChange={setQueryEndDate}
              placeholder="请选择日期范围"
            />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleQuery} className="h-8 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors shrink-0">
              查询
            </button>
            <button onClick={handleReset} className="h-8 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors shrink-0">
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        {hasButtonPermission(2018) && (
          <button
            onClick={() => setShowAddModal(true)}
            className="h-9 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            新增店铺
          </button>
        )}
        <div />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-[#86909C] text-[14px]">
          加载中…
        </div>
      ) : pagedStores.length > 0 ? (
        <div className="grid grid-cols-4 gap-4">
          {pagedStores.map((store) => (
            <StoreCard key={store.id} store={store} onToggleStatus={handleToggleStatus} onDelete={handleDelete} onAuth={handleAuth} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-12 text-center text-[#86909C] text-[14px]">
          暂无数据
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f2f5]">
        <div className="text-[13px] text-[#86909C]">共 {total} 条</div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-7 w-7 rounded-md border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &lt;
          </button>
          {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`h-7 w-7 rounded-md text-[13px] transition-colors ${currentPage === p ? "bg-[#409eff] text-white" : "border border-[#e6e9ef] bg-white text-[#0A1B39] hover:bg-[#f5f6f8]"}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(Math.max(1, totalPages), p + 1))}
            disabled={currentPage === Math.max(1, totalPages)}
            className="h-7 w-7 rounded-md border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>
      </div>

      {showAddModal && <AddStoreModal platforms={platforms} onClose={() => setShowAddModal(false)} onCreated={() => setReloadKey((k) => k + 1)} />}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={cancelDelete}>
          <div className="bg-white rounded-xl w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-[16px] font-bold text-[#0A1B39]">确认删除</h2>
              <button onClick={cancelDelete} className="text-[#86909C] hover:text-[#0A1B39] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-6">
              <p className="text-[14px] text-[#0A1B39] mb-6">是否删除该店铺并取消授权？</p>
              <div className="flex justify-end gap-3">
                <button onClick={cancelDelete} className="h-9 px-5 rounded-lg border border-[#e6e9ef] bg-white text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
                  取消
                </button>
                <button onClick={confirmDelete} className="h-9 px-5 rounded-lg bg-[#ff4d4f] text-[13px] font-bold text-white hover:bg-[#ff7875] transition-colors">
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
