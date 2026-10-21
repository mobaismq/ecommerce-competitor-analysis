import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, RotateCcw, Plus, Upload, Edit, Trash2, ChevronDown, ChevronRight, X, Calendar } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../store/auth";
import { hasPermission } from "../utils/permission";
import { Message } from "@arco-design/web-react";
import dayjs from "dayjs";


// 旧版按钮权限是数字 id（2001 新增 / 2002 导入 / 2003 编辑 / 2004 启停 / 2005 删除），
// 桌面端统一用权限码：这里做一次映射；未配置任何权限时沿用旧版宽松兜底（可见）
const BUTTON_PERMISSION_MAP: Record<number, string> = {
  2001: "product:create",
  2002: "product:import",
  2003: "product:update",
  2004: "product:toggle-status",
  2005: "product:delete",
};
function hasButtonPermission(id: number): boolean {
  const { isSuper, menuCodes, buttonCodes } = useAuth.getState();
  if (isSuper) return true;
  if (!(menuCodes ?? []).length && !(buttonCodes ?? []).length) return true;
  return hasPermission(BUTTON_PERMISSION_MAP[id] ?? String(id));
}

function ImageUpload({
  size = "md",
  value,
  onChange,
}: {
  size?: "sm" | "md";
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dim = size === "sm" ? "h-16 w-16" : "h-20 w-20";
  const iconSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 旧版只生成 blob 预览（刷新即丢）；商品主档要落库，改为 dataURL，并限制大小
    if (file.size > 2 * 1024 * 1024) {
      Message.error("图片不能超过 2MB");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {value ? (
        <div
          className={`${dim} rounded-lg overflow-hidden cursor-pointer border border-[#e6e9ef] hover:border-[#409eff]`}
          onClick={handleClick}
        >
          <img src={value} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className={`${dim} flex items-center justify-center rounded-lg border border-dashed border-[#e6e9ef] bg-[#f9fafb] cursor-pointer hover:border-[#409eff]`}
          onClick={handleClick}
        >
          <Upload className={`${iconSize} text-[#86909C]`} />
        </div>
      )}
    </div>
  );
}

interface SKU {
  id: string;
  skuCode: string;
  specName: string;
  specImage: string | null;
  costPrice: number;
  standardPrice: number;
}

interface Product {
  id: string;
  productCode: string;
  productName: string;
  brand: string;
  productImage: string | null;
  skus: SKU[];
  status: "启用" | "停用";
  updateTime: string;
  createTime: string;
}

export function ProductMasterData() {
  const [searchParams] = useSearchParams();
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchBrand, setSearchBrand] = useState("");
  const [searchUpdateTimeStart, setSearchUpdateTimeStart] = useState("");
  const [searchUpdateTimeEnd, setSearchUpdateTimeEnd] = useState("");
  const [searchCreateTimeStart, setSearchCreateTimeStart] = useState("");
  const [searchCreateTimeEnd, setSearchCreateTimeEnd] = useState("");
  const [filterCode, setFilterCode] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterUpdateTimeStart, setFilterUpdateTimeStart] = useState("");
  const [filterUpdateTimeEnd, setFilterUpdateTimeEnd] = useState("");
  const [filterCreateTimeStart, setFilterCreateTimeStart] = useState("");
  const [filterCreateTimeEnd, setFilterCreateTimeEnd] = useState("");
  const [showUpdateTimeRange, setShowUpdateTimeRange] = useState(false);
  const [showCreateTimeRange, setShowCreateTimeRange] = useState(false);
  const updateTimeBtnRef = useRef<HTMLButtonElement>(null);
  const createTimeBtnRef = useRef<HTMLButtonElement>(null);
  const [updateTimePopupPos, setUpdateTimePopupPos] = useState({ top: 0, left: 0 });
  const [createTimePopupPos, setCreateTimePopupPos] = useState({ top: 0, left: 0 });

  const toggleUpdateTimeRange = () => {
    if (!showUpdateTimeRange && updateTimeBtnRef.current) {
      const rect = updateTimeBtnRef.current.getBoundingClientRect();
      setUpdateTimePopupPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowUpdateTimeRange(!showUpdateTimeRange);
  };

  const toggleCreateTimeRange = () => {
    if (!showCreateTimeRange && createTimeBtnRef.current) {
      const rect = createTimeBtnRef.current.getBoundingClientRect();
      setCreateTimePopupPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowCreateTimeRange(!showCreateTimeRange);
  };
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({ productCode: "", productName: "", brand: "" });
  const [editForm, setEditForm] = useState({ productCode: "", productName: "", brand: "" });
  const [addProductImage, setAddProductImage] = useState<string | null>(null);
  const [addSkus, setAddSkus] = useState<SKU[]>([{ id: "new-1", skuCode: "", specName: "", specImage: null, costPrice: 0, standardPrice: 0 }]);
  const [editProductImage, setEditProductImage] = useState<string | null>(null);
  const [editSkus, setEditSkus] = useState<SKU[]>([]);

  // ── 桌面端服务层（旧版该页为纯本地演示：无接口，新增/编辑/删除均不落库） ──
  const invoke = async <T,>(capability: string, payload?: unknown): Promise<T> => {
    if (!window.desktop?.capabilities) throw new Error("当前环境未接入本地能力，无法操作商品主档");
    return (await window.desktop.capabilities.invoke(capability, payload)) as T;
  };

  const formatTime = (value: unknown): string => {
    if (!value) return "";
    const date = dayjs(value as string | number | Date);
    return date.isValid() ? date.format("YYYY-MM-DD HH:mm:ss") : String(value);
  };

  interface ProductRowDto {
    id: string;
    productCode?: string;
    productName?: string;
    brand?: string | null;
    productImage?: string | null;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    skus?: Array<{ id?: string; skuCode?: string; specName?: string; specImage?: string | null; costPrice?: number; standardPrice?: number }>;
  }

  const mapProductRow = (row: ProductRowDto): Product => ({
    id: row.id,
    productCode: row.productCode ?? "",
    productName: row.productName ?? "",
    brand: row.brand ?? "",
    productImage: row.productImage ?? null,
    status: row.status === "disabled" ? "停用" : "启用",
    updateTime: formatTime(row.updatedAt),
    createTime: formatTime(row.createdAt),
    skus: (row.skus ?? []).map((sku, index) => ({
      id: sku.id ?? `${row.id}-sku-${index}`,
      skuCode: sku.skuCode ?? "",
      specName: sku.specName ?? "",
      specImage: sku.specImage ?? null,
      costPrice: Number(sku.costPrice) || 0,
      standardPrice: Number(sku.standardPrice) || 0,
    })),
  });

  const reload = async () => {
    setLoading(true);
    try {
      const data = await invoke<ProductRowDto[] | { rows?: ProductRowDto[] }>("product.list", {
        tenantId: "local",
        page: 1,
        pageSize: 500,
      });
      const rows = Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
      setProducts(rows.map(mapProductRow));
    } catch (error) {
      Message.error((error as Error)?.message ?? "商品主档加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skusToInput = (skus: SKU[]) =>
    skus
      .filter((sku) => sku.skuCode.trim() || sku.specName.trim())
      .map((sku) => ({
        skuCode: sku.skuCode.trim() || sku.specName.trim(),
        specName: sku.specName.trim() || undefined,
        specImage: sku.specImage ?? undefined,
        costPrice: Number(sku.costPrice) || 0,
        standardPrice: Number(sku.standardPrice) || 0,
      }));

  const resetAddForm = () => {
    setAddForm({ productCode: "", productName: "", brand: "" });
    setAddProductImage(null);
    setAddSkus([{ id: "new-1", skuCode: "", specName: "", specImage: null, costPrice: 0, standardPrice: 0 }]);
  };

  const handleAddConfirm = async () => {
    if (!addForm.productCode.trim()) return void Message.error("请填写商品编码");
    if (!addForm.productName.trim()) return void Message.error("请填写商品名称");
    setSubmitting(true);
    try {
      await invoke("product.create", {
        tenantId: "local",
        productCode: addForm.productCode.trim(),
        productName: addForm.productName.trim(),
        brand: addForm.brand.trim() || undefined,
        productImage: addProductImage ?? undefined,
        status: "active",
        skus: skusToInput(addSkus),
      });
      Message.success("商品已创建");
      setShowAddModal(false);
      resetAddForm();
      await reload();
    } catch (error) {
      Message.error((error as Error)?.message ?? "商品创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditConfirm = async () => {
    if (!editingProduct) return;
    if (!editForm.productCode.trim()) return void Message.error("请填写商品编码");
    if (!editForm.productName.trim()) return void Message.error("请填写商品名称");
    setSubmitting(true);
    try {
      await invoke("product.update", {
        tenantId: "local",
        id: editingProduct.id,
        productCode: editForm.productCode.trim(),
        productName: editForm.productName.trim(),
        brand: editForm.brand.trim() || undefined,
        productImage: editProductImage ?? undefined,
        status: editingProduct.status === "启用" ? "active" : "disabled",
        skus: skusToInput(editSkus),
      });
      Message.success("商品已更新");
      setShowEditModal(false);
      setEditingProduct(null);
      await reload();
    } catch (error) {
      Message.error((error as Error)?.message ?? "商品更新失败");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const nameParam = searchParams.get("name");
    if (nameParam) {
      setSearchName(nameParam);
      setFilterName(nameParam);
    }
  }, [searchParams]);

  const filteredProducts = products.filter((p) => {
    if (filterCode && !p.productCode.toLowerCase().includes(filterCode.toLowerCase())) return false;
    if (filterName && !p.productName.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterBrand && !p.brand.toLowerCase().includes(filterBrand.toLowerCase())) return false;
    if (filterUpdateTimeStart && p.updateTime < filterUpdateTimeStart) return false;
    if (filterUpdateTimeEnd && p.updateTime > filterUpdateTimeEnd + " 23:59:59") return false;
    if (filterCreateTimeStart && p.createTime < filterCreateTimeStart) return false;
    if (filterCreateTimeEnd && p.createTime > filterCreateTimeEnd + " 23:59:59") return false;
    return true;
  });

  const handleSearch = () => {
    setFilterCode(searchCode);
    setFilterName(searchName);
    setFilterBrand(searchBrand);
    setFilterUpdateTimeStart(searchUpdateTimeStart);
    setFilterUpdateTimeEnd(searchUpdateTimeEnd);
    setFilterCreateTimeStart(searchCreateTimeStart);
    setFilterCreateTimeEnd(searchCreateTimeEnd);
  };

  const handleReset = () => {
    setSearchCode("");
    setSearchName("");
    setSearchBrand("");
    setSearchUpdateTimeStart("");
    setSearchUpdateTimeEnd("");
    setSearchCreateTimeStart("");
    setSearchCreateTimeEnd("");
    setFilterCode("");
    setFilterName("");
    setFilterBrand("");
    setFilterUpdateTimeStart("");
    setFilterUpdateTimeEnd("");
    setFilterCreateTimeStart("");
    setFilterCreateTimeEnd("");
  };

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setEditProductImage(product.productImage);
    setEditSkus([...product.skus]);
    setEditForm({ productCode: product.productCode, productName: product.productName, brand: product.brand });
    setShowEditModal(true);
  };

  const handleDelete = (product: Product) => {
    setDeletingProduct(product);
    setShowDeleteModal(true);
  };

  const addSku = () => {
    setAddSkus([...addSkus, { id: `new-${Date.now()}`, skuCode: "", specName: "", specImage: null, costPrice: 0, standardPrice: 0 }]);
  };

  const updateAddSku = (index: number, field: keyof SKU, value: string | number | null) => {
    setAddSkus(addSkus.map((sku, i) => i === index ? { ...sku, [field]: value } : sku));
  };

  const removeAddSku = (index: number) => {
    setAddSkus(addSkus.filter((_, i) => i !== index));
  };

  const addEditSku = () => {
    setEditSkus([...editSkus, { id: `edit-${Date.now()}`, skuCode: "", specName: "", specImage: null, costPrice: 0, standardPrice: 0 }]);
  };

  const updateEditSku = (index: number, field: keyof SKU, value: string | number | null) => {
    setEditSkus(editSkus.map((sku, i) => i === index ? { ...sku, [field]: value } : sku));
  };

  const removeEditSku = (index: number) => {
    setEditSkus(editSkus.filter((_, i) => i !== index));
  };

  const confirmDelete = async () => {
    const target = deletingProduct;
    setShowDeleteModal(false);
    setDeletingProduct(null);
    if (!target) return;
    try {
      await invoke("product.delete", { tenantId: "local", id: target.id });
      Message.success("商品已删除");
      await reload();
    } catch (error) {
      Message.error((error as Error)?.message ?? "删除失败");
    }
  };

  const toggleStatus = async (product: Product) => {
    const nextStatus = product.status === "启用" ? "disabled" : "active";
    try {
      await invoke("product.update", { tenantId: "local", id: product.id, status: nextStatus });
      Message.success(nextStatus === "active" ? "商品已启用" : "商品已停用");
      await reload();
    } catch (error) {
      Message.error((error as Error)?.message ?? "状态更新失败");
    }
  };

  return (
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        <PageHeader breadcrumbs={[{ label: "商品" }, { label: "商品主档" }]} className="mb-2" />

        {/* 查询条件 */}
        <div className="mb-4 rounded-xl bg-white p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">商品编码</label>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
                <input
                  type="text"
                  placeholder="请输入"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                />
                {searchCode && (
                  <button
                    onClick={() => setSearchCode("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">商品名称</label>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
                <input
                  type="text"
                  placeholder="请输入"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                />
                {searchName && (
                  <button
                    onClick={() => setSearchName("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">品牌</label>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
                <input
                  type="text"
                  placeholder="请输入"
                  value={searchBrand}
                  onChange={(e) => setSearchBrand(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
                />
                {searchBrand && (
                  <button
                    onClick={() => setSearchBrand("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {/* 更新时间 */}
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">更新时间</label>
              <div className="relative flex-1">
                <button
                  ref={updateTimeBtnRef}
                  onClick={toggleUpdateTimeRange}
                  className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-left text-[13px] outline-none focus:border-[#409eff] flex items-center justify-between min-w-0"
                >
                  <span className={`truncate ${searchUpdateTimeStart || searchUpdateTimeEnd ? "text-[#0A1B39]" : "text-[#c0c4cc]"}`} title={searchUpdateTimeStart && searchUpdateTimeEnd ? `${searchUpdateTimeStart} 至 ${searchUpdateTimeEnd}` : ""}>
                    {searchUpdateTimeStart && searchUpdateTimeEnd
                      ? `${searchUpdateTimeStart} 至 ${searchUpdateTimeEnd}`
                      : searchUpdateTimeStart
                        ? `${searchUpdateTimeStart} 至`
                        : searchUpdateTimeEnd
                          ? `至 ${searchUpdateTimeEnd}`
                          : "请选择日期范围"}
                  </span>
                  <Calendar className="h-3.5 w-3.5 text-[#c0c4cc] shrink-0 ml-1" />
                </button>
                {(searchUpdateTimeStart || searchUpdateTimeEnd) && (
                  <button
                    onClick={() => { setSearchUpdateTimeStart(""); setSearchUpdateTimeEnd(""); }}
                    className="absolute right-7 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {showUpdateTimeRange && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUpdateTimeRange(false)} />
                    <div className="fixed z-50 bg-white rounded-lg border border-[#e6e9ef] shadow-lg p-3 w-80" style={{ top: `${updateTimePopupPos.top}px`, left: `${updateTimePopupPos.left}px` }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-[11px] text-[#86909C] mb-1">开始日期</label>
                          <input
                            type="date"
                            value={searchUpdateTimeStart}
                            onChange={(e) => setSearchUpdateTimeStart(e.target.value)}
                            className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                          />
                        </div>
                        <span className="text-[12px] text-[#86909C] mt-4">至</span>
                        <div className="flex-1">
                          <label className="block text-[11px] text-[#86909C] mb-1">结束日期</label>
                          <input
                            type="date"
                            value={searchUpdateTimeEnd}
                            onChange={(e) => setSearchUpdateTimeEnd(e.target.value)}
                            className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end gap-1.5">
                        <button
                          onClick={() => { setSearchUpdateTimeStart(""); setSearchUpdateTimeEnd(""); setShowUpdateTimeRange(false); }}
                          className="h-6 px-3 rounded text-[12px] text-[#606266] border border-[#dcdfe6] hover:text-[#409eff] hover:border-[#409eff]"
                        >
                          清除
                        </button>
                        <button
                          onClick={() => setShowUpdateTimeRange(false)}
                          className="h-6 px-3 rounded text-[12px] text-white bg-[#409eff] hover:bg-[#66b1ff]"
                        >
                          确定
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* 第二行：创建时间 + 按钮 */}
          <div className="mt-3 grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">创建时间</label>
              <div className="relative flex-1">
              <button
                ref={createTimeBtnRef}
                onClick={toggleCreateTimeRange}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-left text-[13px] outline-none focus:border-[#409eff] flex items-center justify-between min-w-0"
              >
                <span className={`truncate ${searchCreateTimeStart || searchCreateTimeEnd ? "text-[#0A1B39]" : "text-[#c0c4cc]"}`} title={searchCreateTimeStart && searchCreateTimeEnd ? `${searchCreateTimeStart} 至 ${searchCreateTimeEnd}` : ""}>
                  {searchCreateTimeStart && searchCreateTimeEnd
                    ? `${searchCreateTimeStart} 至 ${searchCreateTimeEnd}`
                    : searchCreateTimeStart
                      ? `${searchCreateTimeStart} 至`
                      : searchCreateTimeEnd
                        ? `至 ${searchCreateTimeEnd}`
                        : "请选择日期范围"}
                </span>
                <Calendar className="h-3.5 w-3.5 text-[#c0c4cc] shrink-0 ml-1" />
              </button>
              {(searchCreateTimeStart || searchCreateTimeEnd) && (
                <button
                  onClick={() => { setSearchCreateTimeStart(""); setSearchCreateTimeEnd(""); }}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {showCreateTimeRange && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCreateTimeRange(false)} />
                  <div className="fixed z-50 bg-white rounded-lg border border-[#e6e9ef] shadow-lg p-3 w-80" style={{ top: `${createTimePopupPos.top}px`, left: `${createTimePopupPos.left}px` }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] text-[#86909C] mb-1">开始日期</label>
                        <input
                          type="date"
                          value={searchCreateTimeStart}
                          onChange={(e) => setSearchCreateTimeStart(e.target.value)}
                          className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <span className="text-[12px] text-[#86909C] mt-4">至</span>
                      <div className="flex-1">
                        <label className="block text-[11px] text-[#86909C] mb-1">结束日期</label>
                        <input
                          type="date"
                          value={searchCreateTimeEnd}
                          onChange={(e) => setSearchCreateTimeEnd(e.target.value)}
                          className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        onClick={() => { setSearchCreateTimeStart(""); setSearchCreateTimeEnd(""); setShowCreateTimeRange(false); }}
                        className="h-6 px-3 rounded text-[12px] text-[#606266] border border-[#dcdfe6] hover:text-[#409eff] hover:border-[#409eff]"
                      >
                        清除
                      </button>
                      <button
                        onClick={() => setShowCreateTimeRange(false)}
                        className="h-6 px-3 rounded text-[12px] text-white bg-[#409eff] hover:bg-[#66b1ff]"
                      >
                        确定
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSearch} className="h-8 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors">
                查询
              </button>
              <button onClick={handleReset} className="h-8 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
                重置
              </button>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mb-4 flex gap-3">
          {hasButtonPermission(2001) && (
            <button
              onClick={() => { resetAddForm(); setShowAddModal(true); }}
              className="h-9 rounded-lg bg-[#409eff] px-5 text-[14px] font-bold text-white hover:bg-[#66b1ff]"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                新增商品
              </div>
            </button>
          )}
          {hasButtonPermission(2002) && (
            <button
              className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[14px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] relative"
              onClick={() => {
                // 旧版只弹出文件名（假装导入）；桌面端尚未接入 Excel 解析能力 → 如实提示
                Message.warning("Excel 批量导入尚未接入本地解析能力，请先用「新增商品」逐条录入");
              }}
            >
              <div className="flex items-center gap-1.5">
                <Upload className="h-4 w-4" />
                导入商品
              </div>
            </button>
          )}
        </div>

        {/* 表单信息 */}
        <div className="rounded-xl bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#e9edf3] text-left">
                <th className="py-3 pl-4 pr-2 text-[13px] font-medium text-[#86909C]"></th>
                <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">商品图片</th>
                <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">商品编码</th>
                <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">商品名称</th>
                <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">品牌</th>
                <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">成本价</th>
                <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">标准售价</th>
                <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">状态</th>
                <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">更新时间</th>
                <th className="py-3 pr-2 text-[13px] font-medium text-[#86909C]">创建时间</th>
                <th className="py-3 pr-4 text-[13px] font-medium text-[#86909C]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const isExpanded = expandedRows.has(product.id);
                const hasSkus = product.skus.length > 0;
                const minPrice = hasSkus ? Math.min(...product.skus.map((s) => s.costPrice)) : 0;
                const maxPrice = hasSkus ? Math.max(...product.skus.map((s) => s.costPrice)) : 0;
                const minStandardPrice = hasSkus ? Math.min(...product.skus.map((s) => s.standardPrice)) : 0;
                const maxStandardPrice = hasSkus ? Math.max(...product.skus.map((s) => s.standardPrice)) : 0;

                return (
                  <React.Fragment key={product.id}>
                    <tr className="border-b border-[#f0f2f5] hover:bg-[#fafafa]">
                      <td className="py-3 pl-4 pr-2">
                        <button
                          onClick={() => toggleExpand(product.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[#e9edf3]"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-[#86909C]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[#86909C]" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="h-10 w-10 rounded-lg bg-[#f2f4f7] flex items-center justify-center">
                          <svg className="h-5 w-5 text-[#c0c4cc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                          </svg>
                        </div>
                      </td>
                      <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productCode}</td>
                      <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productName}</td>
                      <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.brand}</td>
                      <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">
                        {!hasSkus ? "--" : minPrice === maxPrice ? `¥${minPrice}` : `¥${minPrice}-¥${maxPrice}`}
                      </td>
                      <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">
                        {!hasSkus
                          ? "--"
                          : minStandardPrice === maxStandardPrice
                          ? `¥${minStandardPrice}`
                          : `¥${minStandardPrice}-¥${maxStandardPrice}`}
                      </td>
                      <td className="py-3 pr-2 whitespace-nowrap">
                        <span className="inline-block rounded-full px-3 py-0.5 text-[12px] text-black">
                          {product.status}
                        </span>
                      </td>
                      <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.updateTime}</td>
                      <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.createTime}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {hasButtonPermission(2003) && (
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-[14px] text-[#409eff] hover:text-[#66b1ff]"
                            >
                              编辑
                            </button>
                          )}
                          {hasButtonPermission(2004) && (
                            <button
                              onClick={() => toggleStatus(product)}
                              className="text-[14px] text-[#409eff] hover:text-[#66b1ff]"
                            >
                              {product.status === "启用" ? "停用" : "启用"}
                            </button>
                          )}
                          {hasButtonPermission(2005) && (
                            <button
                              onClick={() => handleDelete(product)}
                              className="text-[14px] text-[#409eff] hover:text-[#66b1ff]"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <>
                        <tr className="border-b border-[#f0f2f5] bg-[#fafbfc]">
                          <td className="py-2 pl-4 pr-2"></td>
                          <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">sku图片</td>
                          <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">sku编码</td>
                          <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">规格</td>
                          <td className="py-2 pr-2"></td>
                          <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">成本价</td>
                          <td className="py-2 pr-2 text-[12px] font-medium text-[#86909C]">标准售价</td>
                          <td className="py-2 pr-2"></td>
                          <td className="py-2 pr-2"></td>
                          <td className="py-2 pr-2"></td>
                          <td className="py-2 pr-4"></td>
                        </tr>
                        {product.skus.map((sku) => (
                          <tr key={sku.id} className="border-b border-[#f0f2f5] bg-[#fafbfc]">
                            <td className="py-3 pl-4 pr-2"></td>
                            <td className="py-3 pr-2">
                              <div className="h-8 w-8 rounded bg-[#e9edf3]"></div>
                            </td>
                            <td className="py-3 pr-2 text-[13px] text-[#86909C]">{sku.skuCode}</td>
                            <td className="py-3 pr-2 text-[13px] text-[#86909C]">{sku.specName}</td>
                            <td className="py-3 pr-2"></td>
                            <td className="py-3 pr-2 text-[13px] text-[#86909C]">¥{sku.costPrice}</td>
                            <td className="py-3 pr-2 text-[13px] text-[#86909C]">¥{sku.standardPrice}</td>
                            <td className="py-3 pr-2"></td>
                            <td className="py-3 pr-2"></td>
                            <td className="py-3 pr-2"></td>
                            <td className="py-3 pr-4"></td>
                          </tr>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* 分页器 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f2f5]">
            <div className="text-[13px] text-[#86909C]">共 {filteredProducts.length} 条</div>
            <div className="flex items-center gap-1">
              <button className="h-8 w-8 rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8] flex items-center justify-center">
                &lt;
              </button>
              <button className="h-8 w-8 rounded-full bg-[#409eff] text-[13px] text-white flex items-center justify-center">1</button>
              <button className="h-8 w-8 rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8] flex items-center justify-center">2</button>
              <button className="h-8 w-8 rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8] flex items-center justify-center">
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 新增商品弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[600px] max-h-[80vh] overflow-auto rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0A1B39]">新增商品</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[#86909C] hover:text-[#0A1B39]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-[15px] font-bold text-[#0A1B39]">商品信息</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">商品编码</label>
                  <input
                    type="text"
                    value={addForm.productCode}
                    onChange={(e) => setAddForm({ ...addForm, productCode: e.target.value })}
                    placeholder="商品编码请保持与ERP一致"
                    className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">商品名称</label>
                  <input
                    type="text"
                    value={addForm.productName}
                    onChange={(e) => setAddForm({ ...addForm, productName: e.target.value })}
                    placeholder="请输入"
                    className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">品牌</label>
                  <input
                    type="text"
                    value={addForm.brand}
                    onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })}
                    placeholder="请输入"
                    className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">商品图片</label>
                  <ImageUpload size="md" value={addProductImage} onChange={setAddProductImage} />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-[15px] font-bold text-[#0A1B39]">规格信息</h3>
              <div className="space-y-4">
                {addSkus.map((sku, index) => (
                  <div key={sku.id} className="rounded-lg border border-[#e6e9ef] p-4 relative">
                    {addSkus.length > 1 && (
                      <button
                        onClick={() => removeAddSku(index)}
                        className="absolute top-2 right-2 text-[#c0c4cc] hover:text-[#f56c6c]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">SKU编码</label>
                        <input
                          type="text"
                          value={sku.skuCode}
                          onChange={(e) => updateAddSku(index, "skuCode", e.target.value)}
                          placeholder="sku编码请保持与ERP一致"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">规格名称</label>
                        <input
                          type="text"
                          value={sku.specName}
                          onChange={(e) => updateAddSku(index, "specName", e.target.value)}
                          placeholder="请输入"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">成本价（元）</label>
                        <input
                          type="number"
                          value={sku.costPrice || ""}
                          onChange={(e) => updateAddSku(index, "costPrice", Number(e.target.value))}
                          placeholder="请输入"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">标准售价（元）</label>
                        <input
                          type="number"
                          value={sku.standardPrice || ""}
                          onChange={(e) => updateAddSku(index, "standardPrice", Number(e.target.value))}
                          placeholder="请输入"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">规格图片</label>
                        <ImageUpload size="sm" value={sku.specImage} onChange={(url) => updateAddSku(index, "specImage", url)} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addSku} className="flex items-center gap-1 text-[14px] text-[#409eff] hover:text-[#66b1ff]">
                  <Plus className="h-4 w-4" />
                  添加规格
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[14px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8]"
              >
                取消
              </button>
              <button
                onClick={() => void handleAddConfirm()}
                disabled={submitting}
                className="h-9 rounded-lg bg-[#409eff] px-5 text-[14px] font-bold text-white hover:bg-[#66b1ff] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "保存中…" : "确定"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑商品弹窗 */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[600px] max-h-[80vh] overflow-auto rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#0A1B39]">商品编辑</h2>
              <button onClick={() => setShowEditModal(false)} className="text-[#86909C] hover:text-[#0A1B39]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-[15px] font-bold text-[#0A1B39]">商品信息</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">商品编码</label>
                  <input
                    type="text"
                    value={editForm.productCode}
                    onChange={(e) => setEditForm({ ...editForm, productCode: e.target.value })}
                    placeholder="商品编码请保持与ERP一致"
                    className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">商品名称</label>
                  <input
                    type="text"
                    value={editForm.productName}
                    onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
                    placeholder="请输入"
                    className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">品牌</label>
                  <input
                    type="text"
                    value={editForm.brand}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    placeholder="请输入"
                    className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] text-[#86909C]">商品图片</label>
                  <ImageUpload size="md" value={editProductImage} onChange={setEditProductImage} />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-[15px] font-bold text-[#0A1B39]">规格信息</h3>
              <div className="space-y-4">
                {editSkus.map((sku, index) => (
                  <div key={sku.id} className="rounded-lg border border-[#e6e9ef] p-4 relative">
                    {editSkus.length > 1 && (
                      <button
                        onClick={() => removeEditSku(index)}
                        className="absolute top-2 right-2 text-[#c0c4cc] hover:text-[#f56c6c]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">SKU编码</label>
                        <input
                          type="text"
                          value={sku.skuCode}
                          onChange={(e) => updateEditSku(index, "skuCode", e.target.value)}
                          placeholder="sku编码请保持与ERP一致"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">规格名称</label>
                        <input
                          type="text"
                          value={sku.specName}
                          onChange={(e) => updateEditSku(index, "specName", e.target.value)}
                          placeholder="请输入"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">成本价（元）</label>
                        <input
                          type="number"
                          value={sku.costPrice || ""}
                          onChange={(e) => updateEditSku(index, "costPrice", Number(e.target.value))}
                          placeholder="请输入"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">标准售价（元）</label>
                        <input
                          type="number"
                          value={sku.standardPrice || ""}
                          onChange={(e) => updateEditSku(index, "standardPrice", Number(e.target.value))}
                          placeholder="请输入"
                          className="h-9 w-full rounded-lg border border-[#e6e9ef] bg-white px-3 text-[14px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[13px] text-[#86909C]">规格图片</label>
                        <ImageUpload size="sm" value={sku.specImage} onChange={(url) => updateEditSku(index, "specImage", url)} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addEditSku} className="flex items-center gap-1 text-[14px] text-[#409eff] hover:text-[#66b1ff]">
                  <Plus className="h-4 w-4" />
                  添加规格
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[14px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8]"
              >
                取消
              </button>
              <button
                onClick={() => void handleEditConfirm()}
                disabled={submitting}
                className="h-9 rounded-lg bg-[#409eff] px-5 text-[14px] font-bold text-white hover:bg-[#66b1ff] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteModal && deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[400px] rounded-xl bg-white p-6">
            <h2 className="mb-3 text-[18px] font-bold text-[#0A1B39]">提示</h2>
            <p className="mb-6 text-[14px] text-[#0A1B39]">
              确认删除该商品，删除后不可恢复？
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[14px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8]"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="h-9 rounded-lg bg-[#f56c6c] px-5 text-[14px] font-bold text-white hover:bg-[#f78989]"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 桌面端接线别名 ──
export const ProductMasterDataPage = ProductMasterData
