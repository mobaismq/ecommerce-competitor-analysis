import { useState, useRef, useEffect } from "react";
import { Search, Plus, X, ChevronDown, ChevronRight, MoreHorizontal, Check } from "lucide-react";
import { hasButtonPermission } from "@/app/utils/permission";

// ── Types ──
interface Department {
  id: string;
  name: string;
  parentId: string | null;
  children: Department[];
}

// ── 后端 /api/dept/list 返回的部门记录 ──
interface DeptRecord {
  deptId: string;
  deptName: string;
  deptLevel: number;
  parentId: string;
  deptStatus: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted: number;
}

// 把后端平铺部门列表组装成树（parentId='0' 为根）
function buildDeptTree(rows: DeptRecord[]): Department[] {
  const map = new Map<string, Department>();
  rows.forEach((r) => {
    map.set(r.deptId, {
      id: r.deptId,
      name: r.deptName,
      parentId: r.parentId === "0" ? null : r.parentId,
      children: [],
    });
  });
  const roots: Department[] = [];
  rows.forEach((r) => {
    const node = map.get(r.deptId);
    if (!node) return;
    if (r.parentId === "0" || !map.has(r.parentId)) {
      roots.push(node);
    } else {
      map.get(r.parentId)!.children.push(node);
    }
  });
  return roots;
}

// 当前操作人：项目暂未接入登录态，先用默认值；登录态就绪后改为读取登录用户
function currentOperator(): string {
  return localStorage.getItem("current_user") || "admin";
}

interface Account {
  id: string;
  name: string;
  phone: string;
  departmentId: string;
  departmentName: string;
  roleIds: string[];
  roleNames: string[];
  dataScope: number; // 0全部数据 1同部门创建数据 2仅自己创建数据
  status: "启用" | "停用";
  createTime: string;
}

// ── 后端 /api/account/list 返回的账号记录 ──
interface AccountRecord {
  accountId: string;
  accountName: string;
  phone: string;
  accountStatus: number;
  departmentId: string;
  roleIds: string[];
  dataScope: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted: number;
}

// 后端账号记录 → 页面 Account 结构（部门路径 + 角色名在此映射）
function mapAccount(record: AccountRecord, departments: Department[], roleMap: Map<string, string>): Account {
  const deptPath = getDeptPath(departments, record.departmentId);
  const roleIds = Array.isArray(record.roleIds) ? record.roleIds : [];
  return {
    id: record.accountId,
    name: record.accountName,
    phone: record.phone,
    departmentId: record.departmentId,
    departmentName: deptPath ? deptPath.join("/") : record.departmentId,
    roleIds,
    roleNames: roleIds.map((rid) => roleMap.get(rid) ?? rid),
    dataScope: record.dataScope,
    status: record.accountStatus === 0 ? "停用" : "启用",
    createTime: record.createdAt,
  };
}

interface Role {
  id: string;
  name: string;
}

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

// ── Helper: 在部门树中按 id 找到部门，并返回该部门及全部子部门 id ──
function collectDeptAndSubIds(depts: Department[], targetId: string): string[] {
  for (const d of depts) {
    if (d.id === targetId) return collectSubDeptIds(d);
    const found = collectDeptAndSubIds(d.children, targetId);
    if (found.length) return found;
  }
  return [];
}

// ── Department Tree Node Component ──
function DeptTreeNode({
  dept,
  depth,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
  onAction,
  maxDepth,
}: {
  dept: Department;
  depth: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
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
        className={`flex items-center justify-between group rounded-lg px-2 py-1.5 transition-colors ${selectedId === dept.id ? "bg-[#e8f3ff]" : "hover:bg-[#f5f6f8]"}`}
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
          <button
            onClick={() => onSelect(dept.id)}
            className={`text-[13px] truncate text-left ${selectedId === dept.id ? "text-[#3388ff] font-bold" : "text-[#0A1B39] hover:text-[#3388ff]"}`}
          >
            {dept.name}
          </button>
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
                {hasButtonPermission(2022) && (
                  <button
                    onClick={() => { onAction("createChild", dept); setShowMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
                  >
                    创建子部门
                  </button>
                )}
                {hasButtonPermission(2023) && (
                  <button
                    onClick={() => { onAction("rename", dept); setShowMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]"
                  >
                    重命名
                  </button>
                )}
                {hasButtonPermission(2024) && (
                  <button
                    onClick={() => { onAction("delete", dept); setShowMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-[13px] text-[#ff4d4f] hover:bg-[#f5f6f8]"
                  >
                    删除
                  </button>
                )}
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
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
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
  onConfirm: (name: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialValue ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (val: string) => {
    setName(val);
    if (val.length > 15) {
      setError("部门名称最多15个字符");
    } else if (error === "部门名称最多15个字符" || error === "部门名称不可为空") {
      setError("");
    }
  };

  const handleConfirm = async () => {
    if (!name.trim()) {
      setError("部门名称不可为空");
      return;
    }
    if (name.length > 15) {
      setError("部门名称最多15个字符");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(name.trim());
    } finally {
      setSubmitting(false);
    }
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
            <button onClick={onCancel} disabled={submitting} className="h-9 px-5 rounded-lg border border-[#e6e9ef] bg-white text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              取消
            </button>
            <button onClick={handleConfirm} disabled={submitting} className="h-9 px-5 rounded-lg bg-[#409eff] text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "保存中…" : "确认"}
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
  onSave: (data: Omit<Account, "id" | "createTime" | "status"> & { password?: string }) => Promise<void> | void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState(account?.departmentId ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(account?.roleIds ?? []);
  const [dataScope, setDataScope] = useState<number | "">(account?.dataScope ?? "");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [deptError, setDeptError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [dataScopeError, setDataScopeError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (val.length > 15) {
      setNameError("账号名称最多15个字符");
    } else if (nameError === "账号名称最多15个字符" || nameError === "账号名称不可为空") {
      setNameError("");
    }
  };

  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    setPhone(digits);
    if (digits.length > 11) {
      setPhoneError("手机号格式错误");
    } else if (phoneError === "手机号格式错误" || phoneError === "手机号不可为空") {
      setPhoneError("");
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (val.length > 0 && !/^[\x21-\x7E]{6,20}$/.test(val)) {
      setPasswordError("密码格式错误");
    } else if (passwordError === "密码格式错误" || passwordError === "密码不可为空") {
      setPasswordError("");
    }
  };

  const handleDeptChange = (val: string) => {
    setDepartmentId(val);
    if (deptError === "部门不可为空") setDeptError("");
  };

  const handleRoleChange = (val: string[]) => {
    setRoleIds(val);
    if (roleError === "角色不可为空") setRoleError("");
  };

  const handleSave = async () => {
    let valid = true;

    if (!name.trim()) {
      setNameError("账号名称不可为空");
      valid = false;
    } else if (name.length > 15) {
      setNameError("账号名称最多15个字符");
      valid = false;
    } else {
      setNameError("");
    }

    if (!phone.trim()) {
      setPhoneError("手机号不可为空");
      valid = false;
    } else if (!/^\d{11}$/.test(phone)) {
      setPhoneError("手机号格式错误");
      valid = false;
    } else {
      setPhoneError("");
    }

    if (!isEdit) {
      if (!password) {
        setPasswordError("密码不可为空");
        valid = false;
      } else if (!/^[\x21-\x7E]{6,20}$/.test(password)) {
        setPasswordError("密码格式错误");
        valid = false;
      } else {
        setPasswordError("");
      }
    }

    if (!departmentId) {
      setDeptError("部门不可为空");
      valid = false;
    } else {
      setDeptError("");
    }

    if (roleIds.length === 0) {
      setRoleError("角色不可为空");
      valid = false;
    } else {
      setRoleError("");
    }

    if (dataScope === "") {
      setDataScopeError("数据范围不可为空");
      valid = false;
    } else {
      setDataScopeError("");
    }

    if (!valid) return;

    const deptPath = getDeptPath(departments, departmentId);
    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        departmentId,
        departmentName: deptPath?.join("/") ?? "",
        roleIds,
        roleNames: roleIds.map((rid) => roles.find((r) => r.id === rid)?.name ?? ""),
        dataScope,
        password: isEdit ? undefined : password,
      });
    } finally {
      setSubmitting(false);
    }
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
              onChange={(e) => { setDataScope(e.target.value === "" ? "" : Number(e.target.value)); if (dataScopeError === "数据范围不可为空") setDataScopeError(""); }}
              className={`h-9 w-full rounded-lg border ${dataScopeError ? "border-[#ff4d4f]" : "border-[#e6e9ef]"} bg-white px-3 pr-7 text-[13px] outline-none focus:border-[#409eff] appearance-none ${dataScope === "" ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`}
            >
              <option value="">请选择</option>
              <option value={0}>全部数据</option>
              <option value={1}>同部门创建数据</option>
              <option value={2}>仅自己创建数据</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc] pointer-events-none" />
          </div>
          {dataScopeError && <p className="text-[12px] text-[#ff4d4f] mt-1">{dataScopeError}</p>}
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

// ── Modify Permission Modal ──
function ModifyPermissionModal({
  account,
  roles,
  onConfirm,
  onCancel,
}: {
  account: Account;
  roles: Role[];
  onConfirm: (roleIds: string[]) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [roleIds, setRoleIds] = useState<string[]>(account.roleIds);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(roleIds);
    } finally {
      setSubmitting(false);
    }
  };

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
            <button onClick={onCancel} disabled={submitting} className="h-9 px-5 rounded-lg border border-[#e6e9ef] bg-white text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              取消
            </button>
            <button onClick={handleConfirm} disabled={submitting} className="h-9 px-5 rounded-lg bg-[#409eff] text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "保存中…" : "确认"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Account Management Page ──
export function AccountManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // 对接 /api/dept/list：只拉取未删除部门并组装成树
  useEffect(() => {
    let cancelled = false;
    async function loadDepts() {
      try {
        const response = await fetch("/api/dept/list?page=1&pageSize=100");
        const data = await response.json();
        if (cancelled) return;
        if (response.ok && data.ok) {
          setDepartments(buildDeptTree(Array.isArray(data.list) ? data.list : []));
        } else {
          setDepartments([]);
        }
      } catch {
        if (!cancelled) setDepartments([]);
      }
    }
    loadDepts();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTotal, setAccountTotal] = useState(0);
  const [accountLoading, setAccountLoading] = useState(false);
  const [roleMap, setRoleMap] = useState<Map<string, string>>(new Map());
  const [roles, setRoles] = useState<Role[]>([]);
  const [accountReloadKey, setAccountReloadKey] = useState(0);
  const [expandedDeptIds, setExpandedDeptIds] = useState<Set<string>>(new Set());

  // Query state
  const [queryName, setQueryName] = useState("");
  const [queryPhone, setQueryPhone] = useState("");
  const [queryStatus, setQueryStatus] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // 对接 /api/role/list：拉取角色用于账号的 roleNames 映射和角色下拉
  useEffect(() => {
    let cancelled = false;
    async function loadRoles() {
      try {
        const response = await fetch("/api/role/list?page=1&pageSize=100");
        const data = await response.json();
        if (cancelled) return;
        if (response.ok && data.ok) {
          const list = Array.isArray(data.list) ? data.list : [];
          const map = new Map<string, string>();
          const roleList: Role[] = [];
          list.forEach((r: { roleId: string; roleName: string }) => {
            map.set(r.roleId, r.roleName);
            roleList.push({ id: r.roleId, name: r.roleName });
          });
          setRoleMap(map);
          setRoles(roleList);
        }
      } catch {
        // 忽略，roleNames 会退化为显示 roleId
      }
    }
    loadRoles();
    return () => { cancelled = true; };
  }, []);

  // 对接 /api/account/list：只拉取未删除账号，后端分页 + 后端查询
  useEffect(() => {
    let cancelled = false;
    async function loadAccounts() {
      setAccountLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("pageSize", String(pageSize));
        if (filterName) params.set("accountName", filterName);
        if (filterPhone) params.set("phone", filterPhone);
        if (filterStatus) params.set("status", filterStatus === "启用" ? "1" : "0");
        if (selectedDeptId) {
          const deptIds = collectDeptAndSubIds(departments, selectedDeptId);
          if (deptIds.length) params.set("departmentIds", deptIds.join(","));
        }
        const response = await fetch(`/api/account/list?${params.toString()}`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          setAccounts([]);
          setAccountTotal(0);
          return;
        }
        setAccounts((Array.isArray(data.list) ? data.list : []).map((r) => mapAccount(r, departments, roleMap)));
        setAccountTotal(Number(data.total) || 0);
      } catch {
        if (!cancelled) {
          setAccounts([]);
          setAccountTotal(0);
        }
      } finally {
        if (!cancelled) setAccountLoading(false);
      }
    }
    loadAccounts();
    return () => { cancelled = true; };
  }, [currentPage, filterName, filterPhone, filterStatus, departments, roleMap, accountReloadKey, selectedDeptId]);

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

  const totalPages = Math.max(1, Math.ceil(accountTotal / pageSize));
  const pagedAccounts = accounts;

  // ── Department handlers ──
  const toggleDeptExpand = (id: string) => {
    setExpandedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 点击部门名：选中/取消选中，按部门过滤账号列表
  const handleDeptSelect = (id: string) => {
    setSelectedDeptId((prev) => (prev === id ? null : id));
    setCurrentPage(1);
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

  const handleDeptConfirm = async (name: string) => {
    const operator = currentOperator();
    try {
      if (deptModalMode === "create") {
        const response = await fetch("/api/dept/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deptName: name, parentId: "0", createdBy: operator }),
        });
        const res = await response.json();
        if (!response.ok || !res.ok) throw new Error(res?.error || "新建部门失败");
      } else if (deptModalMode === "createChild" && editingDept) {
        const response = await fetch("/api/dept/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deptName: name, parentId: editingDept.id, createdBy: operator }),
        });
        const res = await response.json();
        if (!response.ok || !res.ok) throw new Error(res?.error || "创建子部门失败");
        setExpandedDeptIds((prev) => new Set([...prev, editingDept.id]));
      } else if (deptModalMode === "rename" && editingDept) {
        const response = await fetch("/api/dept/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deptId: editingDept.id, deptName: name, updatedBy: operator }),
        });
        const res = await response.json();
        if (!response.ok || !res.ok) throw new Error(res?.error || "编辑部门失败");
      }
      setShowDeptModal(false);
      setEditingDept(null);
      setReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleDeptDelete = async () => {
    if (!deletingDept) return;
    const subIds = collectSubDeptIds(deletingDept);
    setShowDeleteConfirm(false);
    setDeletingDept(null);
    try {
      // 先删子部门再删父部门
      for (const deptId of [...subIds].reverse()) {
        const response = await fetch("/api/dept/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deptId, updatedBy: currentOperator() }),
        });
        const res = await response.json();
        if (!response.ok || !res.ok) throw new Error(res?.error || "删除部门失败");
      }
      setReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  // ── Query handlers ──
  const handleQuery = () => {
    setFilterName(queryName.trim());
    setFilterPhone(queryPhone.trim());
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

  const handleSaveAccount = async (data: Omit<Account, "id" | "createTime" | "status"> & { password?: string }) => {
    const operator = currentOperator();
    try {
      if (view === "create") {
        const response = await fetch("/api/account/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountName: data.name,
            phone: data.phone,
            password: data.password,
            departmentId: data.departmentId,
            roleIds: data.roleIds,
            dataScope: data.dataScope,
            createdBy: operator,
          }),
        });
        const res = await response.json();
        if (!response.ok || !res.ok) throw new Error(res?.error || "创建账号失败");
      } else if (view === "edit" && editingAccount) {
        const response = await fetch("/api/account/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: editingAccount.id,
            accountName: data.name,
            departmentId: data.departmentId,
            roleIds: data.roleIds,
            dataScope: data.dataScope,
            updatedBy: operator,
          }),
        });
        const res = await response.json();
        if (!response.ok || !res.ok) throw new Error(res?.error || "编辑账号失败");
      }
      setView("list");
      setEditingAccount(null);
      setAccountReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleCancelForm = () => {
    setView("list");
    setEditingAccount(null);
  };

  const handleToggleStatus = async (account: Account) => {
    const nextStatus = account.status === "启用" ? 0 : 1;
    try {
      const response = await fetch("/api/account/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, status: nextStatus, updatedBy: currentOperator() }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) throw new Error(res?.error || "更新账号状态失败");
      setAccountReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleDeleteAccount = (id: string) => {
    setDeletingAccountId(id);
    setShowDeleteAccount(true);
  };

  const confirmDeleteAccount = async () => {
    const accountId = deletingAccountId;
    setShowDeleteAccount(false);
    setDeletingAccountId(null);
    if (!accountId) return;
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, updatedBy: currentOperator() }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) throw new Error(res?.error || "删除账号失败");
      setAccountReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleModifyPerm = (account: Account) => {
    setModifyingAccount(account);
    setShowModifyPerm(true);
  };

  const confirmModifyPerm = async (roleIds: string[]) => {
    const accountId = modifyingAccount?.id;
    setShowModifyPerm(false);
    setModifyingAccount(null);
    if (!accountId) return;
    try {
      const response = await fetch("/api/account/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, roleIds, updatedBy: currentOperator() }),
      });
      const res = await response.json();
      if (!response.ok || !res.ok) throw new Error(res?.error || "修改权限失败");
      setAccountReloadKey((k) => k + 1);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  // ── Create/Edit View ──
  if (view === "create" || view === "edit") {
    return (
      <AccountForm
        account={editingAccount}
        departments={departments}
        roles={roles}
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
            {hasButtonPermission(2021) && (
              <button
                onClick={() => { setDeptModalMode("create"); setEditingDept(null); setShowDeptModal(true); }}
                className="h-7 rounded-lg bg-[#409eff] px-3 text-[12px] font-bold text-white hover:bg-[#66b1ff] transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                新建部门
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {departments.map((dept) => (
              <DeptTreeNode
                key={dept.id}
                dept={dept}
                depth={0}
                expandedIds={expandedDeptIds}
                selectedId={selectedDeptId}
                onToggle={toggleDeptExpand}
                onSelect={handleDeptSelect}
                onAction={handleDeptAction}
                maxDepth={9}
              />
            ))}
          </div>
        </div>

        {/* Right: Account List */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedDeptId && (
            <div className="mb-3 flex items-center gap-2 text-[13px]">
              <span className="text-[#86909C]">当前部门：</span>
              <span className="font-medium text-[#3388ff]">
                {getDeptPath(departments, selectedDeptId)?.join("/") ?? selectedDeptId}
              </span>
              <button
                onClick={() => { setSelectedDeptId(null); setCurrentPage(1); }}
                className="text-[#409eff] hover:text-[#66b1ff]"
              >
                清除筛选
              </button>
            </div>
          )}
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
            {hasButtonPermission(2010) && (
              <button
                onClick={handleCreate}
                className="h-9 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                创建账号
              </button>
            )}
            <div />
          </div>

          {/* Account List Table */}
          {accountLoading ? (
            <div className="bg-white rounded-xl p-12 text-center text-[#86909C] text-[14px] flex-1">
              加载中…
            </div>
          ) : pagedAccounts.length > 0 ? (
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
                          {hasButtonPermission(2011) && (
                            <button
                              onClick={() => handleModifyPerm(account)}
                              className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                            >
                              修改权限
                            </button>
                          )}
                          {hasButtonPermission(2011) && (
                            <button
                              onClick={() => handleEdit(account)}
                              className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                            >
                              编辑
                            </button>
                          )}
                          {hasButtonPermission(2012) && (
                            <button
                              onClick={() => handleToggleStatus(account)}
                              className="text-[#409eff] hover:text-[#66b1ff] transition-colors"
                            >
                              {account.status === "启用" ? "停用" : "启用"}
                            </button>
                          )}
                          {hasButtonPermission(2013) && (
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
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
            <div className="bg-white rounded-xl p-12 text-center text-[#86909C] text-[14px] flex-1">
              暂无数据
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f2f5] bg-white rounded-b-xl">
            <div className="text-[13px] text-[#86909C]">共 {accountTotal} 条</div>
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
          roles={roles}
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
