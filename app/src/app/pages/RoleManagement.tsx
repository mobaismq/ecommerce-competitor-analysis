import { useState } from "react";
import { Search, RotateCcw, Plus, X, Check, Minus } from "lucide-react";
import platformTaobao from "@/imports/platform-taobao.png";
import platformTmall from "@/imports/platform-tmall.png";
import platformJd from "@/imports/platform-jd.png";
import platformPdd from "@/imports/platform-pdd.png";
import platformDoudian from "@/imports/platform-doudian.png";

// ── Types ──
interface Role {
  id: string;
  name: string;
  description: string;
  status: "启用" | "停用";
  menuPermissions: string[];
  buttonPermissions: string[];
  storePermissions: string[];
}

interface MenuPermissionItem {
  level1: string;
  level2: string;
  level3: string;
  buttons: string[];
}

// ── Platform data ──
const PLATFORMS = ["淘宝", "天猫", "京东", "拼多多", "抖店"];

const PLATFORM_LOGOS: Record<string, string> = {
  "淘宝": platformTaobao,
  "天猫": platformTmall,
  "京东": platformJd,
  "拼多多": platformPdd,
  "抖店": platformDoudian,
};

// ── Menu permission structure ──
const MENU_PERMISSIONS: MenuPermissionItem[] = [
  { level1: "市场", level2: "竞品分析", level3: "AI数据采集", buttons: [] },
  { level1: "市场", level2: "竞品分析", level3: "分析报告", buttons: [] },
  { level1: "AIGC", level2: "商品主图", level3: "", buttons: [] },
  { level1: "AIGC", level2: "详情图", level3: "", buttons: [] },
  { level1: "AIGC", level2: "爆款图复刻", level3: "", buttons: [] },
  { level1: "AIGC", level2: "爆款视频复刻", level3: "", buttons: [] },
  { level1: "资产库", level2: "图库", level3: "", buttons: [] },
  { level1: "资产库", level2: "视频库", level3: "", buttons: [] },
  { level1: "商品", level2: "商品主档", level3: "", buttons: ["新增商品", "导入商品", "编辑", "停用/启用", "删除"] },
  { level1: "商品", level2: "平台商品", level3: "", buttons: ["发布商品", "编辑", "发布", "上架/下架"] },
  { level1: "设置", level2: "账号管理", level3: "", buttons: ["新增账号", "编辑", "停用/启用", "删除"] },
  { level1: "设置", level2: "角色管理", level3: "", buttons: ["创建角色", "编辑", "停用/启用", "删除"] },
  { level1: "设置", level2: "店铺管理", level3: "", buttons: ["新增店铺", "授权", "删除"] },
];

// ── Mock stores ──
const MOCK_STORES = [
  { id: "s1", platform: "淘宝", storeName: "优品旗舰店" },
  { id: "s2", platform: "天猫", storeName: "品质生活专营店" },
  { id: "s3", platform: "京东", storeName: "京东自营店" },
  { id: "s4", platform: "拼多多", storeName: "好物精选店" },
  { id: "s5", platform: "抖店", storeName: "抖店精选店" },
  { id: "s6", platform: "淘宝", storeName: "淘宝优选店" },
  { id: "s7", platform: "天猫", storeName: "天猫品质店" },
  { id: "s8", platform: "京东", storeName: "京东旗舰店" },
];

// ── Mock roles ──
const MOCK_ROLES: Role[] = [
  {
    id: "1",
    name: "超级管理员",
    description: "拥有所有权限",
    status: "启用",
    menuPermissions: MENU_PERMISSIONS.map((m) => `${m.level1}-${m.level2}-${m.level3}`),
    buttonPermissions: MENU_PERMISSIONS.flatMap((m) => m.buttons.map((b) => `${m.level1}-${m.level2}-${b}`)),
    storePermissions: MOCK_STORES.map((s) => s.id),
  },
  {
    id: "2",
    name: "运营专员",
    description: "负责商品运营和店铺管理",
    status: "启用",
    menuPermissions: ["商品-商品主档-", "商品-平台商品-", "设置-店铺管理-"],
    buttonPermissions: ["商品-商品主档-编辑", "商品-商品主档-停用/启用", "商品-平台商品-发布商品", "商品-平台商品-上架/下架"],
    storePermissions: ["s1", "s2"],
  },
  {
    id: "3",
    name: "数据分析师",
    description: "负责市场数据分析",
    status: "停用",
    menuPermissions: ["市场-竞品分析-AI数据采集", "市场-竞品分析-分析报告"],
    buttonPermissions: [],
    storePermissions: [],
  },
];

// ── Helper functions ─
function getMenuKey(m: MenuPermissionItem) {
  return `${m.level1}-${m.level2}-${m.level3}`;
}

function getButtonKey(m: MenuPermissionItem, btn: string) {
  return `${m.level1}-${m.level2}-${btn}`;
}

// ── Role Form Component ──
function RoleForm({
  role,
  onSave,
  onCancel,
}: {
  role: Role | null;
  onSave: (data: Omit<Role, "id" | "status">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [activeTab, setActiveTab] = useState<"menu" | "store">("menu");
  const [menuPermissions, setMenuPermissions] = useState<Set<string>>(
    new Set(role?.menuPermissions ?? [])
  );
  const [buttonPermissions, setButtonPermissions] = useState<Set<string>>(
    new Set(role?.buttonPermissions ?? [])
  );
  const [storePermissions, setStorePermissions] = useState<Set<string>>(
    new Set(role?.storePermissions ?? [])
  );
  const [nameError, setNameError] = useState("");
  const [descError, setDescError] = useState("");
  const [permError, setPermError] = useState("");

  const handleNameChange = (val: string) => {
    setName(val);
    if (val.length > 20) {
      setNameError("最多20个字符");
    } else if (nameError === "最多20个字符" || nameError === "请输入角色名称") {
      setNameError("");
    }
  };

  const handleDescChange = (val: string) => {
    setDescription(val);
    if (val.length > 50) {
      setDescError("最多50个字符");
    } else {
      setDescError("");
    }
  };

  const toggleMenu = (key: string) => {
    setMenuPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleButton = (btnKey: string) => {
    setButtonPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(btnKey)) {
        next.delete(btnKey);
      } else {
        next.add(btnKey);
      }
      return next;
    });
  };

  const toggleStore = (storeId: string) => {
    setStorePermissions((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const handleSave = () => {
    let valid = true;

    // Validate name
    if (!name.trim()) {
      setNameError("请输入角色名称");
      valid = false;
    } else if (name.length > 20) {
      setNameError("最多20个字符");
      valid = false;
    } else {
      setNameError("");
    }

    // Validate description
    if (description.length > 50) {
      setDescError("最多50个字符");
      valid = false;
    }

    // Validate permissions
    if (menuPermissions.size === 0 && storePermissions.size === 0) {
      setPermError("请选择角色权限");
      valid = false;
    } else {
      setPermError("");
    }

    if (!valid) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      menuPermissions: Array.from(menuPermissions),
      buttonPermissions: Array.from(buttonPermissions),
      storePermissions: Array.from(storePermissions),
    });
  };

  // Build flat rows: each level3 item (or level2 if no level3) = one table row
  const flatRows = (() => {
    const result: {
      level1: string;
      level2: string;
      level3: string; // empty if no level3
      buttons: string[];
      showLevel1: boolean;
      level1RowSpan: number;
      showLevel2: boolean;
      level2RowSpan: number;
    }[] = [];

    const l1Order: string[] = [];
    const l1Map: Record<string, { level2: string; items: MenuPermissionItem[] }[]> = {};

    MENU_PERMISSIONS.forEach((m) => {
      if (!l1Map[m.level1]) {
        l1Map[m.level1] = [];
        l1Order.push(m.level1);
      }
      const l2Key = `${m.level1}-${m.level2}`;
      let l2Entry = l1Map[m.level1].find((e) => `${m.level1}-${e.level2}` === l2Key);
      if (!l2Entry) {
        l2Entry = { level2: m.level2, items: [] };
        l1Map[m.level1].push(l2Entry);
      }
      l2Entry.items.push(m);
    });

    l1Order.forEach((l1) => {
      const l2Groups = l1Map[l1];
      // Calculate total rows for this level1
      let l1TotalRows = 0;
      l2Groups.forEach((l2g) => {
        l1TotalRows += Math.max(l2g.items.length, 1);
      });

      let firstL1 = true;
      l2Groups.forEach((l2g) => {
        const l2RowCount = Math.max(l2g.items.length, 1);
        let firstL2 = true;

        if (l2g.items.length === 0) {
          // No level3 items, show level2 as a single row
          result.push({
            level1: l1,
            level2: l2g.level2,
            level3: "",
            buttons: [],
            showLevel1: firstL1,
            level1RowSpan: l1TotalRows,
            showLevel2: firstL2,
            level2RowSpan: l2RowCount,
          });
          firstL1 = false;
          firstL2 = false;
        } else {
          l2g.items.forEach((item) => {
            result.push({
              level1: l1,
              level2: l2g.level2,
              level3: item.level3,
              buttons: item.buttons,
              showLevel1: firstL1,
              level1RowSpan: l1TotalRows,
              showLevel2: firstL2,
              level2RowSpan: l2RowCount,
            });
            firstL1 = false;
            firstL2 = false;
          });
        }
      });
    });

    return result;
  })();

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-1 text-[13px] text-[#86909C] mb-4">
        <span>设置</span>
        <span className="text-[#c0c4cc]">/</span>
        <span>角色管理</span>
        <span className="text-[#c0c4cc]">/</span>
        <span className="text-[#0A1B39] font-medium">{role ? "编辑角色" : "创建角色"}</span>
      </div>

      <div className="bg-white rounded-xl p-6">
        {/* Role Name */}
        <div className="mb-5">
          <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
            角色名称 <span className="text-[#ff4d4f]">*</span>
          </label>
          <input
            type="text"
            placeholder="请输入"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={`h-9 w-full rounded-lg border ${nameError ? "border-[#ff4d4f]" : "border-[#e6e9ef]"} bg-white px-3 text-[13px] outline-none focus:border-[#409eff]`}
          />
          {nameError && <p className="text-[12px] text-[#ff4d4f] mt-1">{nameError}</p>}
        </div>

        {/* Role Description */}
        <div className="mb-5">
          <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">角色描述</label>
          <input
            type="text"
            placeholder="请输入"
            value={description}
            onChange={(e) => handleDescChange(e.target.value)}
            className={`h-9 w-full rounded-lg border ${descError ? "border-[#ff4d4f]" : "border-[#e6e9ef]"} bg-white px-3 text-[13px] outline-none focus:border-[#409eff]`}
          />
          {descError && <p className="text-[12px] text-[#ff4d4f] mt-1">{descError}</p>}
        </div>

        {/* Role Permissions */}
        <div className="mb-5">
          <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
            角色权限 <span className="text-[#ff4d4f]">*</span>
          </label>

          {/* Tabs */}
          <div className="flex border-b border-[#e6e9ef] mb-4">
            <button
              onClick={() => { setActiveTab("menu"); setPermError(""); }}
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${activeTab === "menu" ? "border-[#409eff] text-[#409eff]" : "border-transparent text-[#86909C] hover:text-[#0A1B39]"}`}
            >
              菜单/按钮权限
            </button>
            <button
              onClick={() => { setActiveTab("store"); setPermError(""); }}
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${activeTab === "store" ? "border-[#409eff] text-[#409eff]" : "border-transparent text-[#86909C] hover:text-[#0A1B39]"}`}
            >
              店铺权限
            </button>
          </div>

          {permError && <p className="text-[12px] text-[#ff4d4f] mb-3">{permError}</p>}

          {/* Menu/Button Permission Table */}
          {activeTab === "menu" && (
            <div className="border border-[#e6e9ef] rounded-lg overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#f5f6f8]">
                    <th className="px-3 py-2 text-left font-medium text-[#86909C] w-[120px]">一级菜单</th>
                    <th className="px-3 py-2 text-left font-medium text-[#86909C] w-[150px]">二级菜单</th>
                    <th className="px-3 py-2 text-left font-medium text-[#86909C]">三级菜单</th>
                    <th className="px-3 py-2 text-left font-medium text-[#86909C]">操作按钮</th>
                  </tr>
                </thead>
                <tbody>
                  {flatRows.map((row, idx) => {
                    const mKey = getMenuKey({ level1: row.level1, level2: row.level2, level3: row.level3, buttons: row.buttons });
                    const isMenuChecked = menuPermissions.has(mKey);

                    // Collect all menu keys and button keys under this level1
                    const l1MenuKeys: string[] = [];
                    const l1BtnKeys: string[] = [];
                    flatRows.forEach((r) => {
                      if (r.level1 === row.level1) {
                        const rk = getMenuKey({ level1: r.level1, level2: r.level2, level3: r.level3, buttons: r.buttons });
                        l1MenuKeys.push(rk);
                        r.buttons.forEach((b) => l1BtnKeys.push(getButtonKey({ level1: r.level1, level2: r.level2, level3: r.level3, buttons: r.buttons }, b)));
                      }
                    });
                    // Parent checkbox state: fully checked when all buttons are checked (if has buttons), or all menu keys checked (if no buttons)
                    const l1AllChecked = l1BtnKeys.length > 0
                      ? l1BtnKeys.every((k) => buttonPermissions.has(k))
                      : l1MenuKeys.length > 0 && l1MenuKeys.every((k) => menuPermissions.has(k));
                    const l1SomeChecked = 
                      l1MenuKeys.some((k) => menuPermissions.has(k)) ||
                      l1BtnKeys.some((k) => buttonPermissions.has(k));

                    // Collect all menu keys and button keys under this level1+level2
                    const l2MenuKeys: string[] = [];
                    const l2BtnKeys: string[] = [];
                    flatRows.forEach((r) => {
                      if (r.level1 === row.level1 && r.level2 === row.level2) {
                        const rk = getMenuKey({ level1: r.level1, level2: r.level2, level3: r.level3, buttons: r.buttons });
                        l2MenuKeys.push(rk);
                        r.buttons.forEach((b) => l2BtnKeys.push(getButtonKey({ level1: r.level1, level2: r.level2, level3: r.level3, buttons: r.buttons }, b)));
                      }
                    });
                    // Parent checkbox state: fully checked when all buttons are checked (if has buttons), or all menu keys checked (if no buttons)
                    const l2AllChecked = l2BtnKeys.length > 0
                      ? l2BtnKeys.every((k) => buttonPermissions.has(k))
                      : l2MenuKeys.length > 0 && l2MenuKeys.every((k) => menuPermissions.has(k));
                    const l2SomeChecked =
                      l2MenuKeys.some((k) => menuPermissions.has(k)) ||
                      l2BtnKeys.some((k) => buttonPermissions.has(k));

                    return (
                      <tr key={idx} className={idx > 0 ? "border-t border-[#f0f2f5]" : ""}>
                        {row.showLevel1 && (
                          <td rowSpan={row.level1RowSpan} className="px-3 py-2 border-r border-[#f0f2f5] align-middle">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${l1AllChecked ? "bg-[#409eff] border-[#409eff]" : l1SomeChecked ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                                onClick={() => {
                                  const shouldCheck = !l1AllChecked;
                                  setMenuPermissions((prev) => {
                                    const next = new Set(prev);
                                    l1MenuKeys.forEach((k) => {
                                      if (shouldCheck) next.add(k);
                                      else next.delete(k);
                                    });
                                    return next;
                                  });
                                  if (!shouldCheck) {
                                    setButtonPermissions((prev) => {
                                      const next = new Set(prev);
                                      l1BtnKeys.forEach((k) => next.delete(k));
                                      return next;
                                    });
                                  }
                                }}
                              >
                                {l1AllChecked && <Check className="w-3 h-3 text-white" />}
                                {l1SomeChecked && !l1AllChecked && <Minus className="w-3 h-3 text-white" />}
                              </span>
                              <span className="text-[#0A1B39]">{row.level1}</span>
                            </div>
                          </td>
                        )}
                        {row.showLevel2 && (
                          <td rowSpan={row.level2RowSpan} className="px-3 py-2 border-r border-[#f0f2f5]">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${l2AllChecked ? "bg-[#409eff] border-[#409eff]" : l2SomeChecked ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                                onClick={() => {
                                  const shouldCheck = !l2AllChecked;
                                  setMenuPermissions((prev) => {
                                    const next = new Set(prev);
                                    l2MenuKeys.forEach((k) => {
                                      if (shouldCheck) next.add(k);
                                      else next.delete(k);
                                    });
                                    return next;
                                  });
                                  if (!shouldCheck) {
                                    setButtonPermissions((prev) => {
                                      const next = new Set(prev);
                                      l2BtnKeys.forEach((k) => next.delete(k));
                                      return next;
                                    });
                                  }
                                }}
                              >
                                {l2AllChecked && <Check className="w-3 h-3 text-white" />}
                                {l2SomeChecked && !l2AllChecked && <Minus className="w-3 h-3 text-white" />}
                              </span>
                              <span className="text-[#0A1B39]">{row.level2}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-3 py-2 border-r border-[#f0f2f5]">
                          {row.level3 ? (
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${isMenuChecked ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                                onClick={() => {
                                  toggleMenu(mKey);
                                  if (isMenuChecked) {
                                    setButtonPermissions((prev) => {
                                      const next = new Set(prev);
                                      row.buttons.forEach((b) => {
                                        const bKey = getButtonKey({ level1: row.level1, level2: row.level2, level3: row.level3, buttons: row.buttons }, b);
                                        next.delete(bKey);
                                      });
                                      return next;
                                    });
                                  }
                                }}
                              >
                                {isMenuChecked && <Check className="w-3 h-3 text-white" />}
                              </span>
                              <span className="text-[#0A1B39]">{row.level3}</span>
                            </div>
                          ) : (
                            <span className="text-[#c0c4cc]">/</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.buttons.length > 0 ? (
                            <div className="flex flex-wrap gap-3">
                              {(() => {
                                const allBtnKeys = row.buttons.map((btn) =>
                                  getButtonKey({ level1: row.level1, level2: row.level2, level3: row.level3, buttons: row.buttons }, btn)
                                );
                                const allChecked = allBtnKeys.length > 0 && allBtnKeys.every((k) => buttonPermissions.has(k));
                                const someChecked = allBtnKeys.some((k) => buttonPermissions.has(k));
                                return (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${allChecked ? "bg-[#409eff] border-[#409eff]" : someChecked ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                                        onClick={() => {
                                          const shouldCheck = !allChecked;
                                          setButtonPermissions((prev) => {
                                            const next = new Set(prev);
                                            allBtnKeys.forEach((k) => {
                                              if (shouldCheck) next.add(k);
                                              else next.delete(k);
                                            });
                                            return next;
                                          });
                                        }}
                                      >
                                        {allChecked && <Check className="w-3 h-3 text-white" />}
                                        {someChecked && !allChecked && <Minus className="w-3 h-3 text-white" />}
                                      </span>
                                      <span className="text-[#0A1B39] text-[12px] font-medium">全选</span>
                                    </div>
                                    {row.buttons.map((btn) => {
                                      const bKey = getButtonKey({ level1: row.level1, level2: row.level2, level3: row.level3, buttons: row.buttons }, btn);
                                      const isChecked = buttonPermissions.has(bKey);
                                      return (
                                        <div key={btn} className="flex items-center gap-1">
                                          <span
                                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${isChecked ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                                            onClick={() => toggleButton(bKey)}
                                          >
                                            {isChecked && <Check className="w-3 h-3 text-white" />}
                                          </span>
                                          <span className="text-[#0A1B39] text-[12px]">{btn}</span>
                                        </div>
                                      );
                                    })}
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="text-[#c0c4cc]">/</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Store Permission */}
          {activeTab === "store" && (
            <div className="border border-[#e6e9ef] rounded-lg p-4">
              {PLATFORMS.map((platform) => {
                const platformStores = MOCK_STORES.filter((s) => s.platform === platform);
                if (platformStores.length === 0) return null;
                return (
                  <div key={platform} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-6 w-6 rounded-lg bg-[#f5f6f8] flex items-center justify-center overflow-hidden shrink-0">
                        <img src={PLATFORM_LOGOS[platform]} alt={platform} className="h-full w-full object-cover rounded-lg" />
                      </div>
                      <span className="text-[13px] font-medium text-[#0A1B39]">{platform}</span>
                    </div>
                    <div className="ml-8 space-y-1.5">
                      {platformStores.map((store) => {
                        const isChecked = storePermissions.has(store.id);
                        return (
                          <div key={store.id} className="flex items-center gap-2">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${isChecked ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                              onClick={() => toggleStore(store.id)}
                            >
                              {isChecked && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <span className="text-[13px] text-[#0A1B39]">{store.storeName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="h-9 rounded-lg bg-[#409eff] px-6 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors"
          >
            确认
          </button>
          <button
            onClick={onCancel}
            className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-6 text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ─ Main Page ──
export function RoleManagement() {
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [roles, setRoles] = useState<Role[]>(MOCK_ROLES);
  const [queryName, setQueryName] = useState("");
  const [filterName, setFilterName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const filteredRoles = roles.filter((r) => {
    if (filterName && !r.name.includes(filterName)) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredRoles.length / pageSize);
  const pagedRoles = filteredRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleQuery = () => {
    setFilterName(queryName);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setQueryName("");
    setFilterName("");
    setCurrentPage(1);
  };

  const handleCreate = () => {
    setEditingRole(null);
    setView("create");
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setView("edit");
  };

  const handleSave = (data: Omit<Role, "id" | "status">) => {
    if (view === "create") {
      const newRole: Role = {
        ...data,
        id: `r${Date.now()}`,
        status: "启用",
      };
      setRoles((prev) => [...prev, newRole]);
    } else if (view === "edit" && editingRole) {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === editingRole.id ? { ...r, ...data } : r
        )
      );
    }
    setView("list");
    setEditingRole(null);
  };

  const handleCancel = () => {
    setView("list");
    setEditingRole(null);
  };

  const handleToggleStatus = (id: string) => {
    setRoles((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: r.status === "启用" ? "停用" : "启用" } : r
      )
    );
  };

  const handleDelete = (id: string) => {
    setDeletingRoleId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (deletingRoleId) {
      setRoles((prev) => prev.filter((r) => r.id !== deletingRoleId));
    }
    setShowDeleteConfirm(false);
    setDeletingRoleId(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingRoleId(null);
  };

  // Create/Edit View
  if (view === "create" || view === "edit") {
    return (
      <RoleForm
        role={editingRole}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  // List View
  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-1 text-[13px] text-[#86909C] mb-4">
        <span>设置</span>
        <span className="text-[#c0c4cc]">/</span>
        <span className="text-[#0A1B39] font-medium">角色管理</span>
      </div>

      {/* Search */}
      <div className="mb-4 rounded-xl bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">角色名称</label>
            <div className="relative w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
              <input
                type="text"
                placeholder="请输入"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
              />
              {queryName && (
                <button
                  onClick={() => setQueryName("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={handleQuery}
            className="h-8 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors"
          >
            查询
          </button>
          <button
            onClick={handleReset}
            className="h-8 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors"
          >
            重置
          </button>
        </div>
      </div>

      {/* Create Button */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={handleCreate}
          className="h-9 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          创建角色
        </button>
        <div />
      </div>

      {/* Role List Table */}
      {pagedRoles.length > 0 ? (
        <div className="bg-white rounded-xl border border-[#e6e9ef] overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#f5f6f8]">
                <th className="px-4 py-3 text-left font-medium text-[#86909C]">角色名称</th>
                <th className="px-4 py-3 text-left font-medium text-[#86909C]">角色描述</th>
                <th className="px-4 py-3 text-left font-medium text-[#86909C]">状态</th>
                <th className="px-4 py-3 text-left font-medium text-[#86909C] w-[200px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedRoles.map((role) => (
                <tr key={role.id} className="border-t border-[#f0f2f5]">
                  <td className="px-4 py-3 text-[#0A1B39]">{role.name}</td>
                  <td className="px-4 py-3 text-[#86909C]">{role.description || "--"}</td>
                  <td className="px-4 py-3 text-[13px] text-[#86909C]">{role.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleEdit(role)}
                        className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleToggleStatus(role.id)}
                        className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                      >
                        {role.status === "启用" ? "停用" : "启用"}
                      </button>
                      <button
                        onClick={() => handleDelete(role.id)}
                        className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-12 text-center text-[#86909C] text-[14px]">
          暂无数据
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f2f5]">
        <div className="text-[13px] text-[#86909C]">共 {filteredRoles.length} 条</div>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={cancelDelete}>
          <div className="bg-white rounded-xl w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-[16px] font-bold text-[#0A1B39]">提示</h2>
              <button onClick={cancelDelete} className="text-[#86909C] hover:text-[#0A1B39] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-6">
              <p className="text-[14px] text-[#0A1B39] mb-6">确认删除该角色，删除后不可恢复？</p>
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
