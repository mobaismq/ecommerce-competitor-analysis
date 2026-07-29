import { useState, useRef, useEffect } from "react";
import { Search, Plus, X, ChevronDown, ChevronRight, MoreHorizontal, Check } from "lucide-react";

// ── Types ──
interface Department {
  id: string;
  name: string;
  parentId: string | null;
  children: Department[];
}

interface Account {
  id: string;
  name: string;
  phone: string;
  departmentId: string;
  departmentName: string;
  roleIds: string[];
  roleNames: string[];
  dataScope: string;
  status: "启用" | "停用";
  createTime: string;
}

interface Role {
  id: string;
  name: string;
}

// ── Mock roles (from RoleManagement) ──
const MOCK_ROLES: Role[] = [
  { id: "1", name: "超级管理员" },
  { id: "2", name: "运营专员" },
  { id: "3", name: "数据分析师" },
];

// ── Mock departments ──
const MOCK_DEPARTMENTS: Department[] = [
  {
    id: "d1",
    name: "总部",
    parentId: null,
    children: [
      {
        id: "d1-1",
        name: "技术部",
        parentId: "d1",
        children: [
          { id: "d1-1-1", name: "前端组", parentId: "d1-1", children: [] },
          { id: "d1-1-2", name: "后端组", parentId: "d1-1", children: [] },
        ],
      },
      {
        id: "d1-2",
        name: "运营部",
        parentId: "d1",
        children: [
          { id: "d1-2-1", name: "商品运营组", parentId: "d1-2", children: [] },
        ],
      },
    ],
  },
];

// ── Mock accounts ──
const MOCK_ACCOUNTS: Account[] = [
  {
    id: "a1",
    name: "张三",
    phone: "13800138001",
    departmentId: "d1-1-1",
    departmentName: "总部/技术部/前端组",
    roleIds: ["1"],
    roleNames: ["超级管理员"],
    dataScope: "全部数据",
    status: "启用",
    createTime: "2026-01-15 09:30:00",
  },
  {
    id: "a2",
    name: "李四",
    phone: "13800138002",
    departmentId: "d1-2-1",
    departmentName: "总部/运营部/商品运营组",
    roleIds: ["2"],
    roleNames: ["运营专员"],
    dataScope: "同部门创建数据",
    status: "启用",
    createTime: "2026-02-20 14:00:00",
  },
  {
    id: "a3",
    name: "王五",
    phone: "13800138003",
    departmentId: "d1-1-2",
    departmentName: "总部/技术部/后端组",
    roleIds: ["2", "3"],
    roleNames: ["运营专员", "数据分析师"],
    dataScope: "仅自己创建数据",
    status: "停用",
    createTime: "2026-03-10 11:20:00",
  },
];

// ── Helper: get department path ──
function getDeptPath(depts: Department[], targetId: string, path: string[] = []): string[] | null {
  for (const d of depts) {
    const currentPath = [...path, d.name];
    if (d.id === targetId) return currentPath;
    const found = getDeptPath(d.children, targetId, currentPath);
    if (found) return found;
  }
  return null;
}

// ── Helper: check if dept has accounts ──
function deptHasAccounts(deptId: string, accounts: Account[]): boolean {
  return accounts.some((a) => a.departmentId === deptId);
}

// ── Helper: collect all sub-department ids ──
function collectSubDeptIds(dept: Department): string[] {
  const ids: string[] = [dept.id];
  for (const child of dept.children) {
    ids.push(...collectSubDeptIds(child));
  }
  return ids;
}

// ── Department Tree Node Component ──
function DeptTreeNode({
  dept,
  depth,
  expandedIds,
  onToggle,
  onAction,
  maxDepth,
}: {
  dept: Department;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onAction: (action: string, dept: Department) => void;
  maxDepth: number;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isExpanded = expandedIds.has(dept.id);
  const hasChildren = dept.children.length > 0;
  const showActions = depth < maxDepth;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div>
      <div
        className="flex items-center justify-between group hover:bg-[#f5f6f8] rounded-lg px-2 py-1.5 transition-colors"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {hasChildren ? (
            <button onClick={() => onToggle(dept.id)} className="shrink-0 text-[#86909C] hover:text-[#0A1B39]">
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="text-[13px] text-[#0A1B39] truncate">{dept.name}</span>
        </div>
        {showActions && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="opacity-0 group-hover:opacity-100 text-[#86909C] hover:text-[#0A1B39] transition-opacity p-0.5"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-[#e6e9ef] rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
                <button
                  onClick={() => { onAction("createChild", dept); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
                >
                  创建子部门
                </button>
                <button
                  onClick={() => { onAction("rename", dept); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
                >
                  重命名
                </button>
                <button
                  onClick={() => { onAction("delete", dept); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-[13px] text-[#ff4d4f] hover:bg-[#f5f6f8]"
                >
                  删除
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {dept.children.map((child) => (
            <DeptTreeNode
              key={child.id}
              dept={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onAction={onAction}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Department Modal Component ──
function DeptModal({
  title,
  parentPath,
  initialValue,
  onConfirm,
  onCancel,
}: {
  title: string;
  parentPath?: string;
  initialValue?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialValue ?? "");
  const [error, setError] = useState("");

  const handleChange = (val: string) => {
    setName(val);
    if (val.length > 10) {
      setError("最多10个字符");
    } else if (error === "最多10个字符" || error === "请输入部门名称") {
      setError("");
    }
  };

  const handleConfirm = () => {
    if (!name.trim()) {
      setError("请输入部门名称");
      return;
    }
    if (name.length > 10) {
      setError("最多10个字符");
      return;
    }
    onConfirm(name.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl w-[420px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-[16px] font-bold text-[#0A1B39]">{title}</h2>
          <button onClick={onCancel} className="text-[#86909C] hover:text-[#0A1B39] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6">
          {parentPath && (
            <div className="mb-4">
              <label className="block text-[13px] text-[#86909C] mb-1">上级部门</label>
              <div className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-[#f5f6f8] px-3 text-[13px] text-[#0A1B39] flex items-center">
                {parentPath}
              </div>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
              部门名称 <span className="text-[#ff4d4f]">*</span>
            </label>
            <input
              type="text"
              placeholder="请输入"
              value={name}
              onChange={(e) => handleChange(e.target.value)}
              className={`h-9 w-full rounded-lg border ${error ? "border-[#ff4d4f]" : "border-[#e6e9ef]"} bg-white px-3 text-[13px] outline-none focus:border-[#409eff]`}
            />
            {error && <p className="text-[12px] text-[#ff4d4f] mt-1">{error}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="h-9 px-5 rounded-lg border border-[#e6e9ef] bg-white text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
              取消
            </button>
            <button onClick={handleConfirm} className="h-9 px-5 rounded-lg bg-[#409eff] text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors">
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──
function DeleteConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-[16px] font-bold text-[#0A1B39]">提示</h2>
          <button onClick={onCancel} className="text-[#86909C] hover:text-[#0A1B39] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6">
          <p className="text-[14px] text-[#0A1B39] mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="h-9 px-5 rounded-lg border border-[#e6e9ef] bg-white text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
              取消
            </button>
            <button onClick={onConfirm} className="h-9 px-5 rounded-lg bg-[#ff4d4f] text-[13px] font-bold text-white hover:bg-[#ff7875] transition-colors">
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Department Select Component (tree dropdown) ──
function DeptSelect({
  departments,
  value,
  onChange,
  placeholder = "请选择部门",
  error,
}: {
  departments: Department[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(departments.map((d) => d.id)));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const displayText = value || placeholder;
  const selectedPath = value ? getDeptPath(departments, value) : null;

  const renderTreeItems = (depts: Department[], depth: number): React.ReactNode => {
    return depts.map((d) => {
      const hasChildren = d.children.length > 0;
      const isExpanded = expandedIds.has(d.id);
      const isSelected = value === d.id;
      return (
        <div key={d.id}>
          <div
            className={`flex items-center gap-1 px-3 py-2 cursor-pointer text-[13px] ${isSelected ? "text-[#409eff] bg-[#f0f7ff]" : "text-[#0A1B39] hover:bg-[#f5f6f8]"}`}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            onClick={() => { onChange(d.id); setOpen(false); }}
          >
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(d.id); }}
                className="shrink-0 text-[#86909C]"
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="truncate">{d.name}</span>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderTreeItems(d.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div ref={ref} className="relative w-full">
      <div
        onClick={() => setOpen(!open)}
        className={`h-9 w-full flex items-center justify-between rounded-lg border ${error ? "border-[#ff4d4f]" : "border-[#e6e9ef]"} bg-white px-3 text-[13px] cursor-pointer outline-none focus:border-[#409eff] select-none`}
      >
        <span className={`truncate ${!value ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`} title={selectedPath?.join("/") ?? displayText}>
          {selectedPath?.join("/") ?? displayText}
        </span>
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e6e9ef] rounded-lg shadow-lg z-50 max-h-[240px] overflow-auto py-1">
          {renderTreeItems(departments, 0)}
        </div>
      )}
    </div>
  );
}

// ── Role Multi-Select Component ──
function RoleMultiSelect({
  roles,
  value,
  onChange,
  placeholder = "请选择角色",
  error,
}: {
  roles: Role[];
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
  error?: string;
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

  const toggle = (roleId: string) => {
    onChange(value.includes(roleId) ? value.filter((v) => v !== roleId) : [...value, roleId]);
  };

  const displayText = value.length === 0 ? placeholder : roles.filter((r) => value.includes(r.id)).map((r) => r.name).join("、");

  return (
    <div ref={ref} className="relative w-full">
      <div
        onClick={() => setOpen(!open)}
        className={`h-9 w-full flex items-center justify-between rounded-lg border ${error ? "border-[#ff4d4f]" : "border-[#e6e9ef]"} bg-white px-3 text-[13px] cursor-pointer outline-none focus:border-[#409eff] select-none`}
      >
        <span className={`truncate ${value.length === 0 ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`} title={displayText}>
          {displayText}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); onChange([]); }} className="text-[#c0c4cc] hover:text-[#86909C]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-[#c0c4cc]" />
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e6e9ef] rounded-lg shadow-lg z-50 max-h-[200px] overflow-auto">
          {roles.map((role) => (
            <div
              key={role.id}
              onClick={() => toggle(role.id)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-[#f5f6f8] cursor-pointer text-[13px] text-[#0A1B39]"
            >
              <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${value.includes(role.id) ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6] bg-white"}`}>
                {value.includes(role.id) && <Check className="h-3 w-3 text-white" />}
              </div>
              {role.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Account Form Component (Create/Edit) ──
function AccountForm({
  account,
  departments,
  roles,
  onSave,
  onCancel,
  isEdit,
}: {
  account: Account | null;
  departments: Department[];
  roles: Role[];
  onSave: (data: Omit<Account, "id" | "createTime" | "status">) => void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState(account?.departmentId ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(account?.roleIds ?? []);
  const [dataScope, setDataScope] = useState(account?.dataScope ?? "");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [deptError, setDeptError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [dataScopeError, setDataScopeError] = useState("");

  const handleNameChange = (val: string) => {
    setName(val);
    if (val.length > 20) {
      setNameError("最多20个字符");
    } else if (nameError === "最多20个字符" || nameError === "请输入账号名称") {
      setNameError("");
    }
  };

  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    setPhone(digits);
    if (digits.length > 11) {
      setPhoneError("最多11个字符");
    } else if (phoneError === "最多11个字符" || phoneError === "请输入手机号") {
      setPhoneError("");
    }
  };

  const handlePasswordChange = (val: string) => {
    const cleaned = val.replace(/[^a-zA-Z0-9]/g, "");
    setPassword(cleaned);
    if (cleaned.length > 0 && (cleaned.length < 6 || cleaned.length > 20)) {
      setPasswordError("请输入6-20个字符");
    } else if (passwordError === "请输入6-20个字符" || passwordError === "请输入密码") {
      setPasswordError("");
    }
  };

  const handleDeptChange = (val: string) => {
    setDepartmentId(val);
    if (deptError === "请选择部门") setDeptError("");
  };

  const handleRoleChange = (val: string[]) => {
    setRoleIds(val);
    if (roleError === "请选择角色") setRoleError("");
  };

  const handleSave = () => {
    let valid = true;

    if (!name.trim()) {
      setNameError("请输入账号名称");
      valid = false;
    } else if (name.length > 20) {
      setNameError("最多20个字符");
      valid = false;
    } else {
      setNameError("");
    }

    if (!phone.trim()) {
      setPhoneError("请输入手机号");
      valid = false;
    } else if (phone.length > 11) {
      setPhoneError("最多11个字符");
      valid = false;
    } else {
      setPhoneError("");
    }

    if (!isEdit) {
      if (!password.trim()) {
        setPasswordError("请输入密码");
        valid = false;
      } else if (password.length < 6 || password.length > 20) {
        setPasswordError("请输入6-20个字符");
        valid = false;
      } else {
        setPasswordError("");
      }
    }

    if (!departmentId) {
      setDeptError("请选择部门");
      valid = false;
    } else {
      setDeptError("");
    }

    if (roleIds.length === 0) {
      setRoleError("请选择角色");
      valid = false;
    } else {
      setRoleError("");
    }

    if (!dataScope) {
      setDataScopeError("请选择数据范围");
      valid = false;
    } else {
      setDataScopeError("");
    }

    if (!valid) return;

    const deptPath = getDeptPath(departments, departmentId);
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      departmentId,
      departmentName: deptPath?.join("/") ?? "",
      roleIds,
      roleNames: roleIds.map((rid) => roles.find((r) => r.id === rid)?.name ?? ""),
      dataScope,
    });
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-1 text-[13px] text-[#86909C] mb-4">
        <span>设置</span>
        <span className="text-[#c0c4cc]">/</span>
        <span>账号管理</span>
        <span className="text-[#c0c4cc]">/</span>
        <span className="text-[#0A1B39] font-medium">{isEdit ? "编辑账号" : "创建账号"}</span>
      </div>

      <div className="bg-white rounded-xl p-6">
        {/* Account Name */}
        <div className="mb-5">
          <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
            账号名称 <span className="text-[#ff4d4f]">*</span>
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

        {/* Phone */}
        <div className="mb-5">
          <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
            手机号 <span className="text-[#ff4d4f]">*</span>
          </label>
          <input
            type="text"
            placeholder="请输入"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            readOnly={isEdit}
            className={`h-9 w-full rounded-lg border ${phoneError ? "border-[#ff4d4f]" : "border-[#e6e9ef]"} bg-white px-3 text-[13px] outline-none focus:border-[#409eff] ${isEdit ? "bg-[#f5f6f8] text-[#86909C] cursor-not-allowed" : ""}`}
          />
          {phoneError && <p className="text-[12px] text-[#ff4d4f] mt-1">{phoneError}</p>}
        </div>

        {/* Password (only for create) */}
        {!isEdit && (
          <div className="mb-5">
            <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
              密码 <span className="text-[#ff4d4f]">*</span>
            </label>
            <input
              type="password"
              placeholder="请输入"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              className={`h-9 w-full rounded-lg border ${passwordError ? "border-[#ff4d4f]" : "border-[#e6e9ef]"} bg-white px-3 text-[13px] outline-none focus:border-[#409eff]`}
            />
            {passwordError && <p className="text-[12px] text-[#ff4d4f] mt-1">{passwordError}</p>}
          </div>
        )}

        {/* Department */}
        <div className="mb-5">
          <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
            部门 <span className="text-[#ff4d4f]">*</span>
          </label>
          <DeptSelect
            departments={departments}
            value={departmentId}
            onChange={handleDeptChange}
            error={deptError}
          />
          {deptError && <p className="text-[12px] text-[#ff4d4f] mt-1">{deptError}</p>}
        </div>

        {/* Role Permissions */}
        <div className="mb-5">
          <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
            角色权限 <span className="text-[#ff4d4f]">*</span>
          </label>
          <RoleMultiSelect
            roles={roles}
            value={roleIds}
            onChange={handleRoleChange}
            error={roleError}
          />
          {roleError && <p className="text-[12px] text-[#ff4d4f] mt-1">{roleError}</p>}
        </div>

        {/* Data Scope */}
        <div className="mb-5">
          <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
            数据范围 <span className="text-[#ff4d4f]">*</span>
          </label>
          <div className="relative">
            <select
              value={dataScope}
              onChange={(e) => { setDataScope(e.target.value); if (dataScopeError === "请选择数据范围") setDataScopeError(""); }}
              className={`h-9 w-full rounded-lg border ${dataScopeError ? "border-[#ff4d4f]" : "border-[#e6e9ef]"} bg-white px-3 pr-7 text-[13px] outline-none focus:border-[#409eff] appearance-none ${!dataScope ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`}
            >
              <option value="">请选择</option>
              <option value="仅自己创建数据">仅自己创建数据</option>
              <option value="同部门创建数据">同部门创建数据</option>
              <option value="全部数据">全部数据</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc] pointer-events-none" />
          </div>
          {dataScopeError && <p className="text-[12px] text-[#ff4d4f] mt-1">{dataScopeError}</p>}
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

// ── Modify Permission Modal ──
function ModifyPermissionModal({
  account,
  roles,
  onConfirm,
  onCancel,
}: {
  account: Account;
  roles: Role[];
  onConfirm: (roleIds: string[]) => void;
  onCancel: () => void;
}) {
  const [roleIds, setRoleIds] = useState<string[]>(account.roleIds);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-xl w-[420px] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-[16px] font-bold text-[#0A1B39]">修改权限</h2>
          <button onClick={onCancel} className="text-[#86909C] hover:text-[#0A1B39] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-6">
          <div className="mb-4">
            <label className="block text-[13px] font-bold text-[#0A1B39] mb-2">
              角色权限 <span className="text-[#ff4d4f]">*</span>
            </label>
            <RoleMultiSelect
              roles={roles}
              value={roleIds}
              onChange={setRoleIds}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} className="h-9 px-5 rounded-lg border border-[#e6e9ef] bg-white text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
              取消
            </button>
            <button onClick={() => onConfirm(roleIds)} className="h-9 px-5 rounded-lg bg-[#409eff] text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors">
              确认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Account Management Page ──
export function AccountManagement() {
  const [departments, setDepartments] = useState<Department[]>(() => {
    const saved = localStorage.getItem("account_departments");
    return saved ? JSON.parse(saved) : MOCK_DEPARTMENTS;
  });

  useEffect(() => {
    localStorage.setItem("account_departments", JSON.stringify(departments));
  }, [departments]);
  const [accounts, setAccounts] = useState<Account[]>(MOCK_ACCOUNTS);
  const [expandedDeptIds, setExpandedDeptIds] = useState<Set<string>>(new Set(["d1", "d1-1", "d1-2"]));

  // Query state
  const [queryName, setQueryName] = useState("");
  const [queryPhone, setQueryPhone] = useState("");
  const [queryStatus, setQueryStatus] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modal states
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptModalMode, setDeptModalMode] = useState<"create" | "createChild" | "rename">("create");
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState("");

  // Account modal states
  const [showModifyPerm, setShowModifyPerm] = useState(false);
  const [modifyingAccount, setModifyingAccount] = useState<Account | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  // View state
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Filtered accounts
  const filteredAccounts = accounts.filter((a) => {
    if (filterName && !a.name.includes(filterName)) return false;
    if (filterPhone && !a.phone.includes(filterPhone)) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredAccounts.length / pageSize);
  const pagedAccounts = filteredAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Department handlers ──
  const toggleDeptExpand = (id: string) => {
    setExpandedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeptAction = (action: string, dept: Department) => {
    if (action === "createChild") {
      setDeptModalMode("createChild");
      setEditingDept(dept);
      setShowDeptModal(true);
    } else if (action === "rename") {
      setDeptModalMode("rename");
      setEditingDept(dept);
      setShowDeptModal(true);
    } else if (action === "delete") {
      const subIds = collectSubDeptIds(dept);
      const hasAccts = subIds.some((id) => deptHasAccounts(id, accounts));
      if (hasAccts) {
        setDeleteErrorMsg("该部门下有员工账号，不可删除！");
      } else {
        setDeleteErrorMsg("");
      }
      setDeletingDept(dept);
      setShowDeleteConfirm(true);
    }
  };

  const handleDeptConfirm = (name: string) => {
    if (deptModalMode === "create") {
      const newDept: Department = {
        id: `d${Date.now()}`,
        name,
        parentId: null,
        children: [],
      };
      setDepartments((prev) => [...prev, newDept]);
    } else if (deptModalMode === "createChild" && editingDept) {
      const newChild: Department = {
        id: `d${Date.now()}`,
        name,
        parentId: editingDept.id,
        children: [],
      };
      const addChild = (depts: Department[]): Department[] =>
        depts.map((d) => {
          if (d.id === editingDept.id) {
            return { ...d, children: [...d.children, newChild] };
          }
          return { ...d, children: addChild(d.children) };
        });
      setDepartments((prev) => addChild(prev));
      setExpandedDeptIds((prev) => new Set([...prev, editingDept.id]));
    } else if (deptModalMode === "rename" && editingDept) {
      const renameDept = (depts: Department[]): Department[] =>
        depts.map((d) => {
          if (d.id === editingDept.id) return { ...d, name };
          return { ...d, children: renameDept(d.children) };
        });
      setDepartments((prev) => renameDept(prev));
      // Update account department names
      const path = getDeptPath(departments, editingDept.id);
      if (path) {
        setAccounts((prev) =>
          prev.map((a) => {
            if (a.departmentId === editingDept.id) {
              const newPath = getDeptPath(
                departments.map((d) => {
                  const rename = (ds: Department[]): Department[] =>
                    ds.map((dd) => {
                      if (dd.id === editingDept.id) return { ...dd, name };
                      return { ...dd, children: rename(dd.children) };
                    });
                  return { ...d, children: rename(d.children) };
                }),
                editingDept.id
              );
              return { ...a, departmentName: newPath?.join("/") ?? a.departmentName };
            }
            return a;
          })
        );
      }
    }
    setShowDeptModal(false);
    setEditingDept(null);
  };

  const handleDeptDelete = () => {
    if (!deletingDept) return;
    const subIds = collectSubDeptIds(deletingDept);
    const removeDept = (depts: Department[]): Department[] =>
      depts.filter((d) => !subIds.includes(d.id)).map((d) => ({ ...d, children: removeDept(d.children) }));
    setDepartments((prev) => removeDept(prev));
    setShowDeleteConfirm(false);
    setDeletingDept(null);
  };

  // ── Query handlers ──
  const handleQuery = () => {
    setFilterName(queryName);
    setFilterPhone(queryPhone);
    setFilterStatus(queryStatus);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setQueryName("");
    setQueryPhone("");
    setQueryStatus("");
    setFilterName("");
    setFilterPhone("");
    setFilterStatus("");
    setCurrentPage(1);
  };

  // ── Account handlers ──
  const handleCreate = () => {
    setEditingAccount(null);
    setView("create");
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setView("edit");
  };

  const handleSaveAccount = (data: Omit<Account, "id" | "createTime" | "status">) => {
    if (view === "create") {
      const newAccount: Account = {
        ...data,
        id: `a${Date.now()}`,
        status: "启用",
        createTime: new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/\//g, "-"),
      };
      setAccounts((prev) => [...prev, newAccount]);
    } else if (view === "edit" && editingAccount) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingAccount.id ? { ...a, ...data } : a
        )
      );
    }
    setView("list");
    setEditingAccount(null);
  };

  const handleCancelForm = () => {
    setView("list");
    setEditingAccount(null);
  };

  const handleToggleStatus = (id: string) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === "启用" ? "停用" : "启用" } : a
      )
    );
  };

  const handleDeleteAccount = (id: string) => {
    setDeletingAccountId(id);
    setShowDeleteAccount(true);
  };

  const confirmDeleteAccount = () => {
    if (deletingAccountId) {
      setAccounts((prev) => prev.filter((a) => a.id !== deletingAccountId));
    }
    setShowDeleteAccount(false);
    setDeletingAccountId(null);
  };

  const handleModifyPerm = (account: Account) => {
    setModifyingAccount(account);
    setShowModifyPerm(true);
  };

  const confirmModifyPerm = (roleIds: string[]) => {
    if (modifyingAccount) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === modifyingAccount.id
            ? {
                ...a,
                roleIds,
                roleNames: roleIds.map((rid) => MOCK_ROLES.find((r) => r.id === rid)?.name ?? ""),
              }
            : a
        )
      );
    }
    setShowModifyPerm(false);
    setModifyingAccount(null);
  };

  // ── Create/Edit View ──
  if (view === "create" || view === "edit") {
    return (
      <AccountForm
        account={editingAccount}
        departments={departments}
        roles={MOCK_ROLES}
        onSave={handleSaveAccount}
        onCancel={handleCancelForm}
        isEdit={view === "edit"}
      />
    );
  }

  // ── List View ─
  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-1 text-[13px] text-[#86909C] mb-4">
        <span>设置</span>
        <span className="text-[#c0c4cc]">/</span>
        <span className="text-[#0A1B39] font-medium">账号管理</span>
      </div>

      <div className="flex gap-4 h-[calc(100vh-120px)]">
        {/* Left: Department Management */}
        <div className="w-[280px] shrink-0 bg-white rounded-xl border border-[#e6e9ef] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e6e9ef] flex items-center justify-between">
            <span className="text-[14px] font-bold text-[#0A1B39]">部门管理</span>
            <button
              onClick={() => { setDeptModalMode("create"); setEditingDept(null); setShowDeptModal(true); }}
              className="h-7 rounded-lg bg-[#409eff] px-3 text-[12px] font-bold text-white hover:bg-[#66b1ff] transition-colors flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              新建部门
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {departments.map((dept) => (
              <DeptTreeNode
                key={dept.id}
                dept={dept}
                depth={0}
                expandedIds={expandedDeptIds}
                onToggle={toggleDeptExpand}
                onAction={handleDeptAction}
                maxDepth={9}
              />
            ))}
          </div>
        </div>

        {/* Right: Account List */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search */}
          <div className="mb-4 rounded-xl bg-white p-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-[12px] text-[#86909C]">账号名称</label>
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
                    <button onClick={() => setQueryName("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-[12px] text-[#86909C]">手机号</label>
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
                  <input
                    type="text"
                    placeholder="请输入"
                    value={queryPhone}
                    onChange={(e) => setQueryPhone(e.target.value)}
                    className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                  />
                  {queryPhone && (
                    <button onClick={() => setQueryPhone("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-[12px] text-[#86909C]">状态</label>
                <div className="relative flex-1">
                  <select
                    value={queryStatus}
                    onChange={(e) => setQueryStatus(e.target.value)}
                    className={`h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2.5 pr-7 text-[13px] outline-none focus:border-[#409eff] appearance-none ${!queryStatus ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`}
                  >
                    <option value="">请选择</option>
                    <option value="启用">启用</option>
                    <option value="停用">停用</option>
                  </select>
                  {queryStatus && (
                    <button onClick={() => setQueryStatus("")} className="absolute right-7 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc] pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center gap-2">
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
          </div>

          {/* Create Button */}
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={handleCreate}
              className="h-9 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              创建账号
            </button>
            <div />
          </div>

          {/* Account List Table */}
          {pagedAccounts.length > 0 ? (
            <div className="bg-white rounded-xl border border-[#e6e9ef] overflow-hidden flex-1">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#f5f6f8]">
                    <th className="px-4 py-3 text-left font-medium text-[#86909C]">账号名称</th>
                    <th className="px-4 py-3 text-left font-medium text-[#86909C]">手机号</th>
                    <th className="px-4 py-3 text-left font-medium text-[#86909C]">部门</th>
                    <th className="px-4 py-3 text-left font-medium text-[#86909C]">角色</th>
                    <th className="px-4 py-3 text-left font-medium text-[#86909C] whitespace-nowrap">状态</th>
                    <th className="px-4 py-3 text-left font-medium text-[#86909C]">创建时间</th>
                    <th className="px-4 py-3 text-left font-medium text-[#86909C] w-[260px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAccounts.map((account) => (
                    <tr key={account.id} className="border-t border-[#f0f2f5]">
                      <td className="px-4 py-3 text-[#0A1B39]">{account.name}</td>
                      <td className="px-4 py-3 text-[#0A1B39]">{account.phone}</td>
                      <td className="px-4 py-3 text-[#86909C]">{account.departmentName}</td>
                      <td className="px-4 py-3 text-[#86909C]">{account.roleNames.join("、")}</td>
                      <td className="px-4 py-3 text-[#0A1B39] whitespace-nowrap">{account.status}</td>
                      <td className="px-4 py-3 text-[#86909C]">{account.createTime}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleModifyPerm(account)}
                            className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                          >
                            修改权限
                          </button>
                          <button
                            onClick={() => handleEdit(account)}
                            className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleToggleStatus(account.id)}
                            className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                          >
                            {account.status === "启用" ? "停用" : "启用"}
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(account.id)}
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
            <div className="bg-white rounded-xl p-12 text-center text-[#86909C] text-[14px] flex-1">
              暂无数据
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f2f5] bg-white rounded-b-xl">
            <div className="text-[13px] text-[#86909C]">共 {filteredAccounts.length} 条</div>
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
        </div>
      </div>

      {/* Department Modal */}
      {showDeptModal && (
        <DeptModal
          title={deptModalMode === "rename" ? "编辑部门" : "新建部门"}
          parentPath={
            deptModalMode === "createChild" && editingDept
              ? getDeptPath(departments, editingDept.id)?.join("/") ?? ""
              : deptModalMode === "rename" && editingDept
              ? getDeptPath(departments, editingDept.id)?.slice(0, -1).join("/") ?? ""
              : undefined
          }
          initialValue={deptModalMode === "rename" ? editingDept?.name : ""}
          onConfirm={handleDeptConfirm}
          onCancel={() => { setShowDeptModal(false); setEditingDept(null); }}
        />
      )}

      {/* Delete Department Confirm */}
      {showDeleteConfirm && deletingDept && (
        <DeleteConfirmModal
          message={deleteErrorMsg || "确认删除该部门及子部门，删除后不可恢复？"}
          onConfirm={deleteErrorMsg ? () => { setShowDeleteConfirm(false); setDeletingDept(null); } : handleDeptDelete}
          onCancel={() => { setShowDeleteConfirm(false); setDeletingDept(null); }}
        />
      )}

      {/* Modify Permission Modal */}
      {showModifyPerm && modifyingAccount && (
        <ModifyPermissionModal
          account={modifyingAccount}
          roles={MOCK_ROLES}
          onConfirm={confirmModifyPerm}
          onCancel={() => { setShowModifyPerm(false); setModifyingAccount(null); }}
        />
      )}

      {/* Delete Account Confirm */}
      {showDeleteAccount && (
        <DeleteConfirmModal
          message="确认删除该账号，删除后不可恢复？"
          onConfirm={confirmDeleteAccount}
          onCancel={() => { setShowDeleteAccount(false); setDeletingAccountId(null); }}
        />
      )}
    </div>
  );
}
