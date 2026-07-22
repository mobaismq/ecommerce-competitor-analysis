import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, ChevronRight, Copy, Download, Eye, Folder, Image as ImageIcon, Plus, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import image1 from "@/imports/image-1.png";
import image9 from "@/imports/image-9.png";
import image10 from "@/imports/image-10.png";
import image11 from "@/imports/image-11.png";
import image12 from "@/imports/image-12.png";
import image13 from "@/imports/image-13.png";
import image26 from "@/imports/image-26.png";
import image27 from "@/imports/image-27.png";

export interface AssetImage {
  id: string;
  name: string;
  url: string;
  category: string;
  platform: string;
  createdAt: string;
  size: string;
  productId: string;
  selected?: boolean;
}

interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  platform: string;
  imageCount: number;
  status: "待生成" | "生成中" | "已完成";
  createdAt: string;
}

const PLATFORMS = ["全部", "亚马逊", "TikTok", "速卖通", "Temu", "Shein", "Shopee", "Lazada", "eBay"];

const MOCK_PRODUCTS: ProductInfo[] = [
  { id: "p1", name: "无线蓝牙耳机 Pro", sku: "SKU-BT-001", platform: "亚马逊", imageCount: 4, status: "已完成", createdAt: "2026-06-18" },
  { id: "p2", name: "智能手表 Series 5", sku: "SKU-SW-002", platform: "TikTok", imageCount: 3, status: "生成中", createdAt: "2026-06-19" },
  { id: "p3", name: "便携充电宝 20000mAh", sku: "SKU-PB-003", platform: "速卖通", imageCount: 3, status: "待生成", createdAt: "2026-06-20" },
  { id: "p4", name: "碎花连衣裙 夏季款", sku: "SKU-DR-004", platform: "Shein", imageCount: 2, status: "已完成", createdAt: "2026-06-20" },
];

const MOCK_ASSETS: AssetImage[] = [
  { id: "1", name: "无线耳机主图", url: image9, category: "商品主图", platform: "亚马逊", createdAt: "2026-06-18", size: "1.2 MB", productId: "p1" },
  { id: "2", name: "耳机场景展示", url: image10, category: "场景图", platform: "亚马逊", createdAt: "2026-06-18", size: "1.5 MB", productId: "p1" },
  { id: "3", name: "模特佩戴展示", url: image11, category: "模特图", platform: "亚马逊", createdAt: "2026-06-19", size: "1.8 MB", productId: "p1" },
  { id: "4", name: "产品细节特写", url: image12, category: "细节图", platform: "亚马逊", createdAt: "2026-06-19", size: "980 KB", productId: "p1" },
  { id: "5", name: "手表卖点说明图", url: image13, category: "卖点图", platform: "TikTok", createdAt: "2026-06-20", size: "1.1 MB", productId: "p2" },
  { id: "6", name: "连衣裙参考图", url: image26, category: "参考图", platform: "Shein", createdAt: "2026-06-20", size: "2.1 MB", productId: "p4" },
  { id: "7", name: "连衣裙复刻图", url: image27, category: "复刻图", platform: "Shein", createdAt: "2026-06-20", size: "2.3 MB", productId: "p4" },
  { id: "8", name: "女装产品图", url: image1, category: "商品主图", platform: "Shein", createdAt: "2026-06-20", size: "1.4 MB", productId: "p4" },
];

const CATEGORIES = ["全部", "商品主图", "场景图", "模特图", "细节图", "卖点图", "参考图", "复刻图"];

interface AssetLibraryProps {
  selectionMode?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

export function AssetLibrary({ selectionMode = false, selectedIds = [], onSelectionChange }: AssetLibraryProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [previewImage, setPreviewImage] = useState<AssetImage | null>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [showViewImagesModal, setShowViewImagesModal] = useState(false);
  const [viewImagesProductId, setViewImagesProductId] = useState("");
  const [viewImagesPlatform, setViewImagesPlatform] = useState("全部");
  const [products] = useState(MOCK_PRODUCTS);

  const filteredAssets = MOCK_ASSETS.filter((asset) => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "全部" || asset.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleSelection = (id: string) => {
    if (!onSelectionChange) return;
    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter((sid) => sid !== id)
      : [...selectedIds, id];
    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds.length === filteredAssets.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredAssets.map((a) => a.id));
    }
  };

  const getStatusBadge = (status: ProductInfo["status"]) => {
    const config = {
      "待生成": { color: "bg-[#f1f3f7] text-[#86909C]" },
      "生成中": { color: "bg-[#fff3e0] text-[#f57c00]" },
      "已完成": { color: "bg-[#e8f5e9] text-[#2e7d32]" },
    };
    return <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${config[status].color}`}>{status}</span>;
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-[#0A1B39]">
              {selectionMode ? "选择图片" : "资产库"}
            </h1>
            <p className="mt-2 text-[14px] font-medium text-[#86909C]">
              {selectionMode ? "从资产库中选择图片进行上架" : "管理商品信息与生成的图片"}
            </p>
          </div>
          {selectionMode && selectedIds.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-bold text-[#86909C]">已选择 {selectedIds.length} 张</span>
              <button
                onClick={selectAll}
                className="h-9 rounded-xl bg-[#f2f4f7] px-4 text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#eceff4]"
              >
                {selectedIds.length === filteredAssets.length ? "取消全选" : "全选"}
              </button>
            </div>
          )}
          {!selectionMode && (
            <button
              onClick={() => navigate("/one-click-replicate")}
              className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#3388ff] to-[#66a3ff] px-5 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:shadow-[0_12px_32px_rgba(47,130,255,.35)]"
            >
              <Copy className="h-4 w-4" />
              一键复刻
            </button>
          )}
        </div>

        {/* ===== 商品信息区域 ===== */}
        <div className="mb-8 rounded-2xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="flex items-center justify-between border-b border-[#eef1f5] px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-extrabold text-[#0A1B39]">商品信息</h2>
              <span className="rounded-full bg-[#f2f4f7] px-2.5 py-0.5 text-[12px] font-bold text-[#86909C]">{products.length} 个商品</span>
            </div>
            <button
              onClick={() => setShowAddProductModal(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#3388ff] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1a6fe8]"
            >
              <Plus className="h-4 w-4" />
              添加商品
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                  <th className="px-6 py-3.5 text-left text-[13px] font-bold text-[#86909C]">商品名称</th>
                  <th className="px-6 py-3.5 text-left text-[13px] font-bold text-[#86909C]">SKU编码</th>
                  <th className="px-6 py-3.5 text-left text-[13px] font-bold text-[#86909C]">已生成图片</th>
                  <th className="px-6 py-3.5 text-left text-[13px] font-bold text-[#86909C]">状态</th>
                  <th className="px-6 py-3.5 text-left text-[13px] font-bold text-[#86909C]">创建时间</th>
                  <th className="px-6 py-3.5 text-left text-[13px] font-bold text-[#86909C]">操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-[#eef1f5] transition-colors hover:bg-[#f9fafb]">
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-bold text-[#0A1B39]">{product.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-lg bg-[#f2f4f7] px-3 py-1.5 font-mono text-[13px] font-bold text-[#0A1B39]">{product.sku}</span>
                      </td>
                      <td className="px-6 py-4 text-[14px] font-medium text-[#86909C]">{product.imageCount} 张</td>
                      <td className="px-6 py-4">{getStatusBadge(product.status)}</td>
                      <td className="px-6 py-4 text-[14px] font-medium text-[#86909C]">{product.createdAt}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setViewImagesProductId(product.id); setShowViewImagesModal(true); }}
                            className="flex items-center gap-1 text-[13px] font-bold text-[#2e7d32] hover:text-[#1b5e20]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            查看图片
                          </button>
                          <span className="text-[#d0d5dd]">|</span>
                          <button
                            onClick={() => { setSelectedProductId(product.id); setShowGenerateModal(true); }}
                            className="flex items-center gap-1 text-[13px] font-bold text-[#3388ff] hover:text-[#1a6fe8]"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            生成图片
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== 生成图片区域 ===== */}
        <div className="rounded-2xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eef1f5] px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-extrabold text-[#0A1B39]">生成的图片</h2>
              <span className="rounded-full bg-[#f2f4f7] px-2.5 py-0.5 text-[12px] font-bold text-[#86909C]">{MOCK_ASSETS.length} 张</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909C]" />
                <input
                  type="text"
                  placeholder="搜索图片名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-[220px] rounded-lg border border-[#e1e6ee] bg-[#f9fafb] pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[#3388ff] focus:bg-white"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      activeCategory === category
                        ? "bg-[#3388ff] text-white"
                        : "bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Image Grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {filteredAssets.map((asset) => {
                const isSelected = selectedIds.includes(asset.id);
                const product = MOCK_ASSETS.find((a) => a.productId === asset.productId);
                const productName = MOCK_PRODUCTS.find((p) => p.id === asset.productId)?.name || "";
                return (
                  <div
                    key={asset.id}
                    className={`group relative overflow-hidden rounded-2xl bg-[#f9fafb] shadow-[0_4px_16px_rgba(29,38,52,.04)] transition-all hover:shadow-[0_8px_24px_rgba(29,38,52,.1)] ${
                      isSelected ? "ring-2 ring-[#3388ff]" : ""
                    }`}
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#f2f4f7]">
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {selectionMode && (
                        <button
                          onClick={() => toggleSelection(asset.id)}
                          className={`absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full transition-all ${
                            isSelected
                              ? "bg-[#3388ff] text-white"
                              : "bg-white/80 text-[#86909C] hover:bg-white"
                          }`}
                        >
                          {isSelected ? <Check className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2 border-current" />}
                        </button>
                      )}
                      {!selectionMode && (
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setPreviewImage(asset)}
                            className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#0A1B39] transition-colors hover:bg-white"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#0A1B39] transition-colors hover:bg-white">
                            <Download className="h-5 w-5" />
                          </button>
                          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#e53935] transition-colors hover:bg-white">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="mb-1 truncate text-[14px] font-bold text-[#0A1B39]">{asset.name}</h3>
                      <p className="mb-1 truncate text-[11px] text-[#3388ff]">{productName}</p>
                      <div className="flex items-center justify-between text-[12px] text-[#86909C]">
                        <span className="flex items-center gap-1">
                          <Folder className="h-3.5 w-3.5" />
                          {asset.category}
                        </span>
                        <span>{asset.size}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#86909C]">{asset.createdAt}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredAssets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <ImageIcon className="mb-4 h-16 w-16 text-[#d0d5dd]" />
                <p className="text-[16px] font-bold text-[#86909C]">暂无图片</p>
                <p className="mt-2 text-[14px] text-[#86909C]">选择商品信息后生成图片将显示在这里</p>
              </div>
            )}
          </div>
        </div>

        {/* Preview Modal */}
        {previewImage && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={() => setPreviewImage(null)}>
            <div className="relative max-h-[80vh] max-w-[80vw] overflow-hidden rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
              <img src={previewImage.url} alt={previewImage.name} className="max-h-[70vh] max-w-full object-contain" />
              <div className="mt-4">
                <h3 className="text-[16px] font-bold text-[#0A1B39]">{previewImage.name}</h3>
                <p className="mt-1 text-[13px] text-[#86909C]">
                  {MOCK_PRODUCTS.find((p) => p.id === previewImage.productId)?.name} · {previewImage.category} · {previewImage.size} · {previewImage.createdAt}
                </p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Add Product Modal */}
        {showAddProductModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setShowAddProductModal(false)}>
            <div className="w-[min(520px,90vw)] rounded-2xl bg-white p-6 sm:p-8 shadow-[0_24px_64px_rgba(29,38,52,.2)]" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-6 text-[20px] font-extrabold text-[#0A1B39]">添加商品</h2>
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">商品名称</label>
                  <input
                    type="text"
                    placeholder="请输入商品名称"
                    className="h-11 w-full rounded-xl border border-[#e1e6ee] bg-[#f9fafb] px-4 text-[14px] outline-none transition-colors focus:border-[#3388ff] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">SKU编码</label>
                  <input
                    type="text"
                    placeholder="请输入SKU编码，如 SKU-XX-001"
                    className="h-11 w-full rounded-xl border border-[#e1e6ee] bg-[#f9fafb] px-4 font-mono text-[14px] outline-none transition-colors focus:border-[#3388ff] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">商品图片（可选）</label>
                  <div className="flex h-[100px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#8cc4ff] bg-[#f9fafb]">
                    <Upload className="mb-2 h-7 w-7 text-[#3388ff]" />
                    <p className="text-[13px] font-bold text-[#86909C]">上传商品原图</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="h-11 flex-1 rounded-xl bg-[#f2f4f7] text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#eceff4]"
                >
                  取消
                </button>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="h-11 flex-1 rounded-xl bg-[#3388ff] text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8]"
                >
                  确认添加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generate Image Modal */}
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setShowGenerateModal(false)}>
            <div className="w-[min(520px,90vw)] rounded-2xl bg-white p-6 sm:p-8 shadow-[0_24px_64px_rgba(29,38,52,.2)]" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-2 text-[20px] font-extrabold text-[#0A1B39]">生成图片</h2>
              <p className="mb-6 text-[13px] text-[#86909C]">
                为 <span className="font-bold text-[#3388ff]">{MOCK_PRODUCTS.find((p) => p.id === selectedProductId)?.name}</span> 生成图片
              </p>
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">图片类型</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {["商品主图", "场景图", "模特图", "细节图", "卖点图", "海报图", "白底图", "对比图"].map((type) => (
                      <button
                        key={type}
                        className="rounded-xl border border-[#e1e6ee] bg-[#f9fafb] px-3 py-2.5 text-[12px] font-bold text-[#0A1B39] transition-all hover:border-[#3388ff] hover:bg-[#f0f7ff]"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">生成数量</label>
                  <div className="flex gap-2">
                    {[1, 2, 4, 6, 8].map((n) => (
                      <button
                        key={n}
                        className="h-10 flex-1 rounded-xl border border-[#e1e6ee] bg-[#f9fafb] text-[14px] font-bold text-[#0A1B39] transition-all hover:border-[#3388ff] hover:bg-[#f0f7ff]"
                      >
                        {n} 张
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">风格描述（选填）</label>
                  <textarea
                    placeholder="例如：简约风格、白色背景、突出产品细节..."
                    className="h-[74px] w-full resize-none rounded-xl border border-[#e1e6ee] bg-[#f9fafb] p-3 text-[13px] outline-none transition-colors focus:border-[#3388ff] focus:bg-white"
                  />
                </div>
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="h-11 flex-1 rounded-xl bg-[#f2f4f7] text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#eceff4]"
                >
                  取消
                </button>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="h-11 flex-1 rounded-xl bg-[#3388ff] text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8]"
                >
                  开始生成
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Images Modal */}
        {showViewImagesModal && (() => {
          const filteredViewAssets = MOCK_ASSETS.filter((a) => {
            const matchesProduct = a.productId === viewImagesProductId;
            const matchesPlatform = viewImagesPlatform === "全部" || a.platform === viewImagesPlatform;
            return matchesProduct && matchesPlatform;
          });
          const currentProduct = MOCK_PRODUCTS.find((p) => p.id === viewImagesProductId);
          return (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={() => setShowViewImagesModal(false)}>
              <div className="h-[80vh] w-[min(900px,90vw)] rounded-2xl bg-white shadow-[0_24px_64px_rgba(29,38,52,.2)]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-[#eef1f5] px-6 py-4">
                  <div>
                    <h2 className="text-[18px] font-extrabold text-[#0A1B39]">关联图片</h2>
                    <p className="mt-1 text-[13px] text-[#86909C]">
                      <span className="font-bold text-[#0A1B39]">{currentProduct?.name}</span>
                      <span className="ml-2 font-mono text-[#3388ff]">{currentProduct?.sku}</span>
                      <span className="ml-3 text-[#86909C]">共 {filteredViewAssets.length} 张图片</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setShowViewImagesModal(false)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] transition-colors hover:bg-[#eceff4]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Platform Filter */}
                <div className="border-b border-[#eef1f5] px-6 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold text-[#86909C]">平台筛选：</span>
                    <select
                      value={viewImagesPlatform}
                      onChange={(e) => setViewImagesPlatform(e.target.value)}
                      className="h-9 rounded-lg border border-[#e1e6ee] bg-[#f9fafb] px-3 text-[13px] font-medium text-[#0A1B39] outline-none transition-colors focus:border-[#3388ff] focus:bg-white"
                    >
                      {PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>{platform}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-y-auto p-6 custom-scrollbar" style={{ maxHeight: "calc(80vh - 160px)" }}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredViewAssets.map((asset) => (
                      <div key={asset.id} className="group relative overflow-hidden rounded-xl border border-[#eef1f5] bg-[#f9fafb] transition-all hover:shadow-[0_4px_16px_rgba(29,38,52,.08)]">
                        <div className="relative aspect-square overflow-hidden bg-[#f2f4f7]">
                          <img src={asset.url} alt={asset.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => { setShowViewImagesModal(false); setPreviewImage(asset); }}
                              className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#0A1B39] transition-colors hover:bg-white"
                            >
                              <Eye className="h-5 w-5" />
                            </button>
                            <button className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#0A1B39] transition-colors hover:bg-white">
                              <Download className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                        <div className="p-3">
                          <h4 className="truncate text-[13px] font-bold text-[#0A1B39]">{asset.name}</h4>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-[#86909C]">
                            <span className="rounded bg-[#f2f4f7] px-1.5 py-0.5">{asset.category}</span>
                            <span>{asset.size}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-[#86909C]">
                            <span className="rounded bg-[#e4f3ff] px-1.5 py-0.5 text-[#3388ff]">{asset.platform}</span>
                            <span>{asset.createdAt}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {filteredViewAssets.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <ImageIcon className="mb-3 h-12 w-12 text-[#d0d5dd]" />
                      <p className="text-[14px] font-bold text-[#86909C]">暂无关联图片</p>
                      <p className="mt-1 text-[13px] text-[#86909C]">点击"生成图片"为该商品生成图片</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
