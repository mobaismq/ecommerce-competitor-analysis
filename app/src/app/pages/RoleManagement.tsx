import { useState, useEffect } from "react";
import { Search, RotateCcw, Plus, X, Check, Minus } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";
import { hasButtonPermission } from "@/app/utils/permission";
import { usePlatforms, type Platform } from "@/app/hooks/usePlatforms";

// ── Types ──
interface Role {
  id: string;
  name: string;
  description: string;
  status: number; // 1启用 0停用
  menuPermissionIds: number[];
  buttonPermissionIds: number[];
  storePermissionIds: string[];
  menuPermissionAll: boolean;
  buttonPermissionAll: boolean;
  storePermissionAll: boolean;
}

interface ButtonPermissionItem {
  id: number;
  label: string;
}

interface MenuPermissionItem {
  id: number;
  level1: string;
  level2: string;
  level3: string;
  buttons: ButtonPermissionItem[];
}

// ── 后端 /api/menu/list 返回的菜单记录 ──
interface MenuRecord {
  menuId: number;
  menuName: string;
  level1Name: string;
  level2Name: string;
  level3Name: string;
  buttons: { buttonId: number; buttonName: string }[];
}

// 后端菜单记录 → 页面菜单结构
function mapMenu(record: MenuRecord): MenuPermissionItem {
  return {
    id: record.menuId,
    level1: record.level1Name,
    level2: record.level2Name,
    level3: record.level3Name || "",
    buttons: (record.buttons || []).map((b) => ({ id: b.buttonId, label: b.buttonName })),
  };
}

// ── 店铺权限数据来源（/api/store/list 返回的店铺记录）──
interface StoreItem {
  storeId: string;
  storeName: string;
  platformId: string;
  platformName: string;
  isDeleted: number;
}

// ── 后端 /api/role/list 返回的角色记录 ──
interface RoleRecord {
  roleId: string;
  roleName: string;
  roleDescription: string;
  roleStatus: number;
  menuPermissionIds: number[];
  buttonPermissionIds: number[];
  storePermissionIds: string[];
  menuPermissionAll: boolean;
  buttonPermissionAll: boolean;
  storePermissionAll: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted: number;
}

// 把接口返回字段映射为页面使用的 Role 结构
function mapRole(raw: RoleRecord | null | undefined): Role {
  if (!raw) {
    return {
      id: "", name: "", description: "", status: 1,
      menuPermissionIds: [], buttonPermissionIds: [], storePermissionIds: [],
      menuPermissionAll: false, buttonPermissionAll: false, storePermissionAll: false,
    };
  }
  return {
    id: raw.roleId ?? "",
    name: raw.roleName ?? "",
    description: raw.roleDescription ?? "",
    status: Number(raw.roleStatus) === 0 ? 0 : 1,
    menuPermissionIds: Array.isArray(raw.menuPermissionIds) ? raw.menuPermissionIds : [],
    buttonPermissionIds: Array.isArray(raw.buttonPermissionIds) ? raw.buttonPermissionIds : [],
    storePermissionIds: Array.isArray(raw.storePermissionIds) ? raw.storePermissionIds : [],
    menuPermissionAll: raw.menuPermissionAll === true,
    buttonPermissionAll: raw.buttonPermissionAll === true,
    storePermissionAll: raw.storePermissionAll === true,
  };
}

// 当前操作人：项目暂未接入登录态，先用默认值；登录态就绪后改为读取登录用户
function currentOperator(): string {
  return localStorage.getItem("current_user") || "admin";
}

// ── Role Form Component ──
function RoleForm({
  role,
  menus,
  platforms,
  stores,
  onSave,
  onCancel,
}: {
  role: Role | null;
  menus: MenuPermissionItem[];
  platforms: Platform[];
  stores: StoreItem[];
  onSave: (data: Omit<Role, "id" | "status">) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [activeTab, setActiveTab] = useState<"menu" | "store">("menu");
  const [menuPermissions, setMenuPermissions] = useState<Set<number>>(
    new Set(role?.menuPermissionIds ?? [])
  );
  const [buttonPermissions, setButtonPermissions] = useState<Set<number>>(
    new Set(role?.buttonPermissionIds ?? [])
  );
  const [storePermissions, setStorePermissions] = useState<Set<string>>(
    new Set(role?.storePermissionIds ?? [])
  );
  // 菜单/按钮「全选」与店铺「全选」
  const [menuButtonAll, setMenuButtonAll] = useState(
    role?.menuPermissionAll === true || role?.buttonPermissionAll === true,
  );
  const [storePermissionAll, setStorePermissionAll] = useState(
    role?.storePermissionAll === true,
  );
  const [nameError, setNameError] = useState("");
  const [descError, setDescError] = useState("");
  const [permError, setPermError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 全选时用当前全部菜单/按钮填充勾选视觉（保存时后端以「全选」标记存储）
  useEffect(() => {
    if (menuButtonAll) {
      setMenuPermissions(new Set(menus.map((m) => m.id)));
      setButtonPermissions(new Set(menus.flatMap((m) => m.buttons.map((b) => b.id))));
    }
  }, [menuButtonAll, menus]);

  // 全选时用当前全部店铺填充勾选视觉
  useEffect(() => {
    if (storePermissionAll) {
      setStorePermissions(new Set(stores.map((s) => s.storeId)));
    }
  }, [storePermissionAll, stores]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (val.length > 50) {
      setNameError("角色名称最多50个字符");
    } else if (nameError === "角色名称最多50个字符" || nameError === "角色名称不可为空") {
      setNameError("");
    }
  };

  const handleDescChange = (val: string) => {
    setDescription(val);
    if (val.length > 200) {
      setDescError("角色描述最多200个字符");
    } else {
      setDescError("");
    }
  };

  const toggleMenu = (key: number) => {
    setPermError("");
    setMenuPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleButton = (btnKey: number) => {
    setPermError("");
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
    setPermError("");
    setStorePermissions((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const handleMenuButtonAllToggle = () => {
    setPermError("");
    if (menuButtonAll) {
      setMenuButtonAll(false);
      setMenuPermissions(new Set());
      setButtonPermissions(new Set());
    } else {
      setMenuButtonAll(true);
    }
  };

  const handleStoreAllToggle = () => {
    setPermError("");
    if (storePermissionAll) {
      setStorePermissionAll(false);
      setStorePermissions(new Set());
    } else {
      setStorePermissionAll(true);
    }
  };

  // 浮窗提示已移除，改用「角色权限」标签后的红色字体提示
  const handleSave = async () => {
    let valid = true;

    // Validate name
    if (!name.trim()) {
      setNameError("角色名称不可为空");
      valid = false;
    } else if (name.length > 50) {
      setNameError("角色名称最多50个字符");
      valid = false;
    } else {
      setNameError("");
    }

    // Validate description
    if (description.length > 200) {
      setDescError("角色描述最多200个字符");
      valid = false;
    }

    // Validate menu/button permissions（优先提示）
    const menuButtonValid = menuButtonAll || menuPermissions.size > 0 || buttonPermissions.size > 0;
    if (!menuButtonValid) {
      setPermError("菜单/按钮权限不可为空");
      valid = false;
    } else {
      // 仅当菜单/按钮权限有效时才校验店铺权限
      const storeValid = storePermissionAll || storePermissions.size > 0;
      if (!storeValid) {
        setPermError("店铺权限不可为空");
        valid = false;
      } else {
        setPermError("");
      }
    }

    if (!valid) return;

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        menuPermissionAll: menuButtonAll,
        buttonPermissionAll: menuButtonAll,
        storePermissionAll,
        menuPermissionIds: Array.from(menuPermissions),
        buttonPermissionIds: Array.from(buttonPermissions),
        storePermissionIds: Array.from(storePermissions),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Build flat rows: each level3 item (or level2 if no level3) = one table row
  const flatRows = (() => {
    const result: {
      menuId: number;
      level1: string;
      level2: string;
      level3: string; // empty if no level3
      buttons: ButtonPermissionItem[];
      showLevel1: boolean;
      level1RowSpan: number;
      showLevel2: boolean;
      level2RowSpan: number;
    }[] = [];

    const l1Order: string[] = [];
    const l1Map: Record<string, { level2: string; items: MenuPermissionItem[] }[]> = {};

    menus.forEach((m) => {
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
            menuId: 0,
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
              menuId: item.id,
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
      <PageHeader breadcrumbs={[{ label: "设置" }, { label: "角色管理" }, { label: role ? "编辑角色" : "创建角色" }]} />

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
            {permError && <span className="text-[#ff4d4f] ml-2 font-normal">{permError}</span>}
          </label>

          {/* Tabs */}
          <div className="flex border-b border-[#e6e9ef] mb-4">
            <button
              onClick={() => { setActiveTab("menu"); }}
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${activeTab === "menu" ? "border-[#409eff] text-[#409eff]" : "border-transparent text-[#86909C] hover:text-[#0A1B39]"}`}
            >
              菜单/按钮权限
            </button>
            <button
              onClick={() => { setActiveTab("store"); }}
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${activeTab === "store" ? "border-[#409eff] text-[#409eff]" : "border-transparent text-[#86909C] hover:text-[#0A1B39]"}`}
            >
              店铺权限
            </button>
          </div>

          {/* Menu/Button Permission Table */}
          {activeTab === "menu" && (
            <div className="border border-[#e6e9ef] rounded-lg overflow-hidden">
              {/* 菜单/按钮权限全选 */}
              <div className="flex items-center gap-2 border-b border-[#f0f2f5] bg-[#fafbfc] px-3 py-2">
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${menuButtonAll ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                  onClick={handleMenuButtonAllToggle}
                >
                  {menuButtonAll && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="text-[13px] font-medium text-[#0A1B39]">全选（菜单/按钮）</span>
              </div>
              <div className={menuButtonAll ? "pointer-events-none opacity-60" : ""}>
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
                    const mKey = row.menuId;
                    const isMenuChecked = menuPermissions.has(mKey);

                    // Collect all menu keys and button keys under this level1
                    const l1MenuKeys: number[] = [];
                    const l1BtnKeys: number[] = [];
                    flatRows.forEach((r) => {
                      if (r.level1 === row.level1) {
                        l1MenuKeys.push(r.menuId);
                        r.buttons.forEach((b) => l1BtnKeys.push(b.id));
                      }
                    });
                    const l1MenuAllChecked = l1MenuKeys.length > 0 && l1MenuKeys.every((k) => menuPermissions.has(k));
                    const l1MenuSomeChecked = l1MenuKeys.some((k) => menuPermissions.has(k));
                    const l1BtnAllChecked = l1BtnKeys.length === 0 || l1BtnKeys.every((k) => buttonPermissions.has(k));
                    const l1BtnSomeChecked = l1BtnKeys.some((k) => buttonPermissions.has(k));
                    // 勾选：菜单+按钮全部勾选；半选：菜单已勾选但未勾全对应按钮
                    const l1AllChecked = l1MenuAllChecked && l1BtnAllChecked;
                    const l1SomeChecked = (l1MenuSomeChecked || l1BtnSomeChecked) && !l1AllChecked;

                    // Collect all menu keys and button keys under this level1+level2
                    const l2MenuKeys: number[] = [];
                    const l2BtnKeys: number[] = [];
                    flatRows.forEach((r) => {
                      if (r.level1 === row.level1 && r.level2 === row.level2) {
                        l2MenuKeys.push(r.menuId);
                        r.buttons.forEach((b) => l2BtnKeys.push(b.id));
                      }
                    });
                    const l2MenuAllChecked = l2MenuKeys.length > 0 && l2MenuKeys.every((k) => menuPermissions.has(k));
                    const l2MenuSomeChecked = l2MenuKeys.some((k) => menuPermissions.has(k));
                    const l2BtnAllChecked = l2BtnKeys.length === 0 || l2BtnKeys.every((k) => buttonPermissions.has(k));
                    const l2BtnSomeChecked = l2BtnKeys.some((k) => buttonPermissions.has(k));
                    // 勾选：菜单+按钮全部勾选；半选：菜单已勾选但未勾全对应按钮
                    const l2AllChecked = l2MenuAllChecked && l2BtnAllChecked;
                    const l2SomeChecked = (l2MenuSomeChecked || l2BtnSomeChecked) && !l2AllChecked;

                    return (
                      <tr key={idx} className={idx > 0 ? "border-t border-[#f0f2f5]" : ""}>
                        {row.showLevel1 && (
                          <td rowSpan={row.level1RowSpan} className="px-3 py-2 border-r border-[#f0f2f5] align-middle">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${l1AllChecked ? "bg-[#409eff] border-[#409eff]" : l1SomeChecked ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                                onClick={() => {
                                  const shouldCheck = !l1MenuAllChecked;
                                  setMenuPermissions((prev) => {
                                    const next = new Set(prev);
                                    l1MenuKeys.forEach((k) => {
                                      if (shouldCheck) next.add(k);
                                      else next.delete(k);
                                    });
                                    return next;
                                  });
                                  // 按钮权限：仅在取消菜单时跟随取消，勾选菜单时不自动选中
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
                                  const shouldCheck = !l2MenuAllChecked;
                                  setMenuPermissions((prev) => {
                                    const next = new Set(prev);
                                    l2MenuKeys.forEach((k) => {
                                      if (shouldCheck) next.add(k);
                                      else next.delete(k);
                                    });
                                    return next;
                                  });
                                  // 按钮权限：仅在取消菜单时跟随取消，勾选菜单时不自动选中
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
                                        const bKey = b.id;
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
                                const allBtnKeys = row.buttons.map((btn) => btn.id);
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
                                      const bKey = btn.id;
                                      const isChecked = buttonPermissions.has(bKey);
                                      return (
                                        <div key={btn.id} className="flex items-center gap-1">
                                          <span
                                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${isChecked ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                                            onClick={() => toggleButton(bKey)}
                                          >
                                            {isChecked && <Check className="w-3 h-3 text-white" />}
                                          </span>
                                          <span className="text-[#0A1B39] text-[12px]">{btn.label}</span>
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
            </div>
          )}

          {/* Store Permission */}
          {activeTab === "store" && (
            <div className="border border-[#e6e9ef] rounded-lg">
              {/* 店铺权限全选 */}
              <div className="flex items-center gap-2 border-b border-[#f0f2f5] bg-[#fafbfc] px-3 py-2">
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${storePermissionAll ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                  onClick={handleStoreAllToggle}
                >
                  {storePermissionAll && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="text-[13px] font-medium text-[#0A1B39]">全选（店铺）</span>
              </div>
              <div className={`p-4 ${storePermissionAll ? "pointer-events-none opacity-60" : ""}`}>
              {platforms.length === 0 && (
                <p className="text-[13px] text-[#86909C]">暂无启用中的平台数据</p>
              )}
              {platforms.map((platform) => {
                const platformStores = stores.filter((s) => s.platformId === platform.platformId);
                if (platformStores.length === 0) return null;
                return (
                  <div key={platform.platformId} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[13px] font-medium text-[#0A1B39]">{platform.platformName}</span>
                    </div>
                    <div className="ml-6 space-y-1.5">
                      {platformStores.map((store) => {
                        const isChecked = storePermissions.has(store.storeId);
                        return (
                          <div key={store.storeId} className="flex items-center gap-2">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${isChecked ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}
                              onClick={() => toggleStore(store.storeId)}
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
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={submitting}
            className="h-9 rounded-lg bg-[#409eff] px-6 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "保存中…" : "确认"}
          </button>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-6 text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [queryName, setQueryName] = useState("");
  const [filterName, setFilterName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [menus, setMenus] = useState<MenuPermissionItem[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const { platforms: allPlatforms } = usePlatforms();
  // 店铺权限平台来源：仅启用状态（未删除由后端默认过滤）
  const enabledPlatforms = allPlatforms.filter((p) => p.platformStatus === 1);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagedRoles = roles;

  // 对接 /api/menu/list：拉取菜单/按钮权限字典
  useEffect(() => {
    let cancelled = false;
    async function loadMenus() {
      try {
        const response = await fetch("/api/menu/list");
        const data = await response.json();
        if (cancelled) return;
        if (response.ok && data.ok) {
          setMenus((Array.isArray(data.menus) ? data.menus : []).map(mapMenu));
        }
      } catch {
        // 忽略，权限树会显示为空
      }
    }
    loadMenus();
    return () => { cancelled = true; };
  }, []);

  // 对接 /api/store/list：拉取店铺权限字典（仅未删除店铺）
  useEffect(() => {
    let cancelled = false;
    async function loadStores() {
      try {
        const response = await fetch("/api/store/list?page=1&pageSize=100");
        const data = await response.json();
        if (cancelled) return;
        if (response.ok && data.ok) {
          const list = (Array.isArray(data.list) ? data.list : []) as StoreItem[];
          setStores(list.filter((s) => s.isDeleted === 0));
        }
      } catch {
        // 忽略，店铺权限区会显示为空
      }
    }
    loadStores();
    return () => { cancelled = true; };
  }, []);

  // 对接 /api/role/list：后端分页 + 角色名称左模糊查询
  useEffect(() => {
    let cancelled = false;
    async function loadRoles() {
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("pageSize", String(pageSize));
        if (filterName) params.set("roleName", filterName);
        const response = await fetch(`/api/role/list?${params.toString()}`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          setLoadError(data?.error || "加载角色列表失败");
          setRoles([]);
          setTotal(0);
          return;
        }
        setRoles((Array.isArray(data.list) ? data.list : []).map(mapRole));
        setTotal(Number(data.total) || 0);
      } catch {
        if (!cancelled) {
          setLoadError("网络异常，加载角色列表失败");
          setRoles([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRoles();
    return () => {
      cancelled = true;
    };
  }, [currentPage, filterName, reloadKey]);

  const handleQuery = () => {
    setFilterName(queryName.trim());
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

  const handleSave = async (data: Omit<Role, "id" | "status">) => {
    const operator = currentOperator();
    try {
      if (view === "create") {
        const response = await fetch("/api/role/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleName: data.name,
            roleDescription: data.description,
            menuPermissionAll: data.menuPermissionAll,
            buttonPermissionAll: data.buttonPermissionAll,
            storePermissionAll: data.storePermissionAll,
            menuPermissionIds: data.menuPermissionIds,
            buttonPermissionIds: data.buttonPermissionIds,
            storePermissionIds: data.storePermissionIds,
            createdBy: operator,
          }),
        });
        const res = await response.json();
        if (!response.ok || !res.ok) throw new Error(res?.error || "创建角色失败");
      } else if (view === "edit" && editingRole) {
        const response = await fetch("/api/role/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleId: editingRole.id,
            roleName: data.name,
            roleDescription: data.description,
            menuPermissionAll: data.menuPermissionAll,
            buttonPermissionAll: data.buttonPermissionAll,
            storePermissionAll: data.storePermissionAll,
            menuPermissionIds: data.menuPermissionIds,
            buttonPermissionIds: data.buttonPermissionIds,
            storePermissionIds: data.storePermissionIds,
            updatedBy: operator,
          }),
        });
        const res = await response.json();
        if (!response.ok || !res.ok) throw new Error(res?.error || "编辑角色失败");
      }
      setView("list");
      setEditingRole(null);
      setReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleCancel = () => {
    setView("list");
    setEditingRole(null);
  };

  const handleToggleStatus = async (role: Role) => {
    const nextStatus = role.status === 1 ? 0 : 1;
    try {
      const response = await fetch("/api/role/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: role.id,
          status: nextStatus,
          updatedBy: currentOperator(),
        }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) throw new Error(res?.error || "更新角色状态失败");
      setReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleDelete = (id: string) => {
    setDeletingRoleId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const roleId = deletingRoleId;
    setShowDeleteConfirm(false);
    setDeletingRoleId(null);
    if (!roleId) return;
    try {
      const response = await fetch("/api/role/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, updatedBy: currentOperator() }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) throw new Error(res?.error || "删除角色失败");
      setReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
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
        menus={menus}
        platforms={enabledPlatforms}
        stores={stores}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  // List View
  return (
    <div className="p-6 overflow-y-auto h-full">
      <PageHeader breadcrumbs={[{ label: "设置" }, { label: "角色管理" }]} />

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
        {hasButtonPermission(2014) && (
          <button
            onClick={handleCreate}
            className="h-9 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            创建角色
          </button>
        )}
        <div />
      </div>

      {/* Role List Table */}
      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-[#86909C] text-[14px]">
          加载中…
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-xl p-12 text-center text-[#ff4d4f] text-[14px]">
          {loadError}
        </div>
      ) : pagedRoles.length > 0 ? (
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
                  <td className="px-4 py-3 text-[13px] text-[#86909C]">{role.status === 1 ? "启用" : "停用"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4">
                      {hasButtonPermission(2015) && (
                        <button
                          onClick={() => handleEdit(role)}
                          className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                        >
                          编辑
                        </button>
                      )}
                      {hasButtonPermission(2016) && (
                        <button
                          onClick={() => handleToggleStatus(role)}
                          className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                        >
                          {role.status === 1 ? "停用" : "启用"}
                        </button>
                      )}
                      {hasButtonPermission(2017) && (
                        <button
                          onClick={() => handleDelete(role.id)}
                          className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                        >
                          删除
                        </button>
                      )}
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
