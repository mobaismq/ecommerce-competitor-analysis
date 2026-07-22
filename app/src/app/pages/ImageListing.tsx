import { useState } from "react";
import { Check, ChevronDown, ChevronRight, ChevronUp, FolderOpen, Image as ImageIcon, Package, ShoppingBag, Upload, X } from "lucide-react";
import image1 from "@/imports/image-1.png";
import image9 from "@/imports/image-9.png";
import image10 from "@/imports/image-10.png";
import image11 from "@/imports/image-11.png";
import image12 from "@/imports/image-12.png";
import image13 from "@/imports/image-13.png";
import image26 from "@/imports/image-26.png";
import image27 from "@/imports/image-27.png";

type ListingStatus = "draft" | "pending" | "published";

interface ProductListing {
  id: string;
  name: string;
  platform: string;
  imageCount: number;
  status: ListingStatus;
  createdAt: string;
  images: AssetImage[];
}

interface AssetImage {
  id: string;
  name: string;
  url: string;
  category: string;
  platform: string;
  productId: string;
}

const ASSET_IMAGES: AssetImage[] = [
  { id: "1", name: "无线耳机主图", url: image9, category: "商品主图", platform: "亚马逊", productId: "p1" },
  { id: "2", name: "耳机场景展示", url: image10, category: "场景图", platform: "亚马逊", productId: "p1" },
  { id: "3", name: "模特佩戴展示", url: image11, category: "模特图", platform: "亚马逊", productId: "p1" },
  { id: "4", name: "产品细节特写", url: image12, category: "细节图", platform: "亚马逊", productId: "p1" },
  { id: "5", name: "手表卖点说明图", url: image13, category: "卖点图", platform: "TikTok", productId: "p2" },
  { id: "6", name: "充电宝场景图", url: image26, category: "场景图", platform: "速卖通", productId: "p3" },
  { id: "7", name: "充电宝细节图", url: image27, category: "细节图", platform: "速卖通", productId: "p3" },
  { id: "8", name: "女装产品图", url: image1, category: "商品主图", platform: "Shein", productId: "p4" },
];

const MOCK_LISTINGS: ProductListing[] = [
  { id: "1", name: "无线蓝牙耳机 Pro", platform: "亚马逊", imageCount: 8, status: "published", createdAt: "2026-06-18", images: ASSET_IMAGES.slice(0, 4) },
  { id: "2", name: "智能手表 Series 5", platform: "TikTok", imageCount: 6, status: "pending", createdAt: "2026-06-19", images: ASSET_IMAGES.slice(2, 5) },
  { id: "3", name: "便携充电宝 20000mAh", platform: "速卖通", imageCount: 5, status: "draft", createdAt: "2026-06-20", images: ASSET_IMAGES.slice(4, 7) },
];

interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  platform: string;
  imageCount: number;
  status: "待生成" | "生成中" | "已完成";
  createdAt: string;
}

const MOCK_PRODUCTS: ProductInfo[] = [
  { id: "p1", name: "无线蓝牙耳机 Pro", sku: "SKU-BT-001", platform: "亚马逊", imageCount: 4, status: "已完成", createdAt: "2026-06-18" },
  { id: "p2", name: "智能手表 Series 5", sku: "SKU-SW-002", platform: "TikTok", imageCount: 3, status: "生成中", createdAt: "2026-06-19" },
  { id: "p3", name: "便携充电宝 20000mAh", sku: "SKU-PB-003", platform: "速卖通", imageCount: 3, status: "待生成", createdAt: "2026-06-20" },
  { id: "p4", name: "碎花连衣裙 夏季款", sku: "SKU-DR-004", platform: "Shein", imageCount: 2, status: "已完成", createdAt: "2026-06-20" },
];

const PLATFORMS = ["亚马逊", "TikTok", "速卖通", "Temu", "Shein", "Shopee", "Lazada", "eBay"];
const CATEGORIES = ["全部", "商品主图", "场景图", "模特图", "细节图", "卖点图", "参考图", "复刻图"];

export function ImageListing() {
  const [listings, setListings] = useState(MOCK_LISTINGS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductInfo | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);

  const getStatusBadge = (status: ListingStatus) => {
    const config = {
      draft: { label: "草稿", color: "bg-[#f1f3f7] text-[#86909C]" },
      pending: { label: "审核中", color: "bg-[#fff3e0] text-[#f57c00]" },
      published: { label: "已上架", color: "bg-[#e8f5e9] text-[#2e7d32]" },
    };
    const { label, color } = config[status];
    return <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${color}`}>{label}</span>;
  };

  const toggleAssetSelection = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const filteredAssets = ASSET_IMAGES.filter(
    (asset) => activeCategory === "全部" || asset.category === activeCategory
  );

  const selectedAssets = ASSET_IMAGES.filter((a) => selectedAssetIds.includes(a.id));

  const handleConfirmAssets = () => {
    setShowAssetSelector(false);
  };

  const removeSelectedAsset = (id: string) => {
    setSelectedAssetIds((prev) => prev.filter((sid) => sid !== id));
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const selectProduct = (product: ProductInfo) => {
    setSelectedProduct(product);
    setShowProductDropdown(false);
    // 清除已选平台中没有该商品图片的平台
    const availablePlatforms = ASSET_IMAGES
      .filter((img) => img.productId === product.id)
      .map((img) => img.platform);
    setSelectedPlatforms((prev) => prev.filter((p) => availablePlatforms.includes(p)));
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setSelectedAssetIds([]);
    setSelectedProduct(null);
    setSelectedPlatforms([]);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-[#0A1B39]">图片上架</h1>
            <p className="mt-2 text-[14px] font-medium text-[#86909C]">从资产库选择图片，一键上架到各电商平台</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#3388ff] px-5 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8] hover:shadow-[0_12px_32px_rgba(47,130,255,.35)]"
          >
            <Upload className="h-5 w-5" />
            新建上架任务
          </button>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 sm:mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#e4f3ff]">
                <Package className="h-6 w-6 text-[#3388ff]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#86909C]">总上架数</p>
                <p className="text-[24px] font-extrabold text-[#0A1B39]">{listings.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#e8f5e9]">
                <Check className="h-6 w-6 text-[#2e7d32]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#86909C]">已上架</p>
                <p className="text-[24px] font-extrabold text-[#0A1B39]">{listings.filter((l) => l.status === "published").length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#fff3e0]">
                <ShoppingBag className="h-6 w-6 text-[#f57c00]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#86909C]">审核中</p>
                <p className="text-[24px] font-extrabold text-[#0A1B39]">{listings.filter((l) => l.status === "pending").length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Listings Table */}
        <div className="rounded-2xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="border-b border-[#eef1f5] px-6 py-4">
            <h2 className="text-[16px] font-extrabold text-[#0A1B39]">上架记录</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                  <th className="px-6 py-4 text-left text-[13px] font-bold text-[#86909C]">商品名称</th>
                  <th className="px-6 py-4 text-left text-[13px] font-bold text-[#86909C]">平台</th>
                  <th className="px-6 py-4 text-left text-[13px] font-bold text-[#86909C]">图片预览</th>
                  <th className="px-6 py-4 text-left text-[13px] font-bold text-[#86909C]">图片数量</th>
                  <th className="px-6 py-4 text-left text-[13px] font-bold text-[#86909C]">状态</th>
                  <th className="px-6 py-4 text-left text-[13px] font-bold text-[#86909C]">创建时间</th>
                  <th className="px-6 py-4 text-left text-[13px] font-bold text-[#86909C]">操作</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr key={listing.id} className="border-b border-[#eef1f5] transition-colors hover:bg-[#f9fafb]">
                    <td className="px-6 py-4">
                      <span className="text-[14px] font-bold text-[#0A1B39]">{listing.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg bg-[#f2f4f7] px-3 py-1.5 text-[13px] font-bold text-[#0A1B39]">{listing.platform}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex -space-x-2">
                        {listing.images.slice(0, 4).map((img) => (
                          <img
                            key={img.id}
                            src={img.url}
                            alt={img.name}
                            className="h-10 w-10 rounded-lg border-2 border-white object-cover"
                          />
                        ))}
                        {listing.images.length > 4 && (
                          <div className="grid h-10 w-10 place-items-center rounded-lg border-2 border-white bg-[#f2f4f7] text-[11px] font-bold text-[#86909C]">
                            +{listing.images.length - 4}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[14px] font-medium text-[#86909C]">{listing.imageCount} 张</td>
                    <td className="px-6 py-4">{getStatusBadge(listing.status)}</td>
                    <td className="px-6 py-4 text-[14px] font-medium text-[#86909C]">{listing.createdAt}</td>
                    <td className="px-6 py-4">
                      <button className="flex items-center gap-1 text-[13px] font-bold text-[#3388ff] hover:text-[#1a6fe8]">
                        查看详情
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={resetCreateModal}>
            <div className="w-[600px] rounded-2xl bg-white p-8 shadow-[0_24px_64px_rgba(29,38,52,.2)]" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-6 text-[20px] font-extrabold text-[#0A1B39]">新建上架任务</h2>
              <div className="space-y-5">
                {/* Product Selector */}
                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">选择商品</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowProductDropdown(!showProductDropdown)}
                      className="flex h-11 w-full items-center justify-between rounded-xl border border-[#e1e6ee] bg-[#f9fafb] px-4 text-[14px] outline-none transition-colors hover:bg-white focus:border-[#3388ff]"
                    >
                      {selectedProduct ? (
                        <span className="text-[#0A1B39]">
                          <span className="font-bold">{selectedProduct.name}</span>
                          <span className="ml-2 font-mono text-[#3388ff]">{selectedProduct.sku}</span>
                        </span>
                      ) : (
                        <span className="text-[#86909C]">请选择商品</span>
                      )}
                      {showProductDropdown ? <ChevronUp className="h-4 w-4 text-[#86909C]" /> : <ChevronDown className="h-4 w-4 text-[#86909C]" />}
                    </button>
                    {showProductDropdown && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[200px] overflow-y-auto rounded-xl border border-[#e1e6ee] bg-white py-1 shadow-lg">
                        {MOCK_PRODUCTS.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => selectProduct(product)}
                            className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#f0f7ff] ${
                              selectedProduct?.id === product.id ? "bg-[#f0f7ff]" : ""
                            }`}
                          >
                            <div>
                              <p className="text-[14px] font-bold text-[#0A1B39]">{product.name}</p>
                              <p className="text-[12px] text-[#86909C]">
                                <span className="font-mono text-[#3388ff]">{product.sku}</span>
                                <span className="ml-2">{product.platform}</span>
                                <span className="ml-2">· {product.imageCount} 张图片</span>
                              </p>
                            </div>
                            {selectedProduct?.id === product.id && <Check className="h-4 w-4 text-[#3388ff]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Multi-select Platform */}
                <div>
                  <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">目标平台（可多选）</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
                      className="flex h-11 w-full items-center justify-between rounded-xl border border-[#e1e6ee] bg-[#f9fafb] px-4 text-[14px] outline-none transition-colors hover:bg-white focus:border-[#3388ff]"
                    >
                      {selectedPlatforms.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPlatforms.map((p) => (
                            <span key={p} className="rounded-md bg-[#e4f3ff] px-2 py-0.5 text-[12px] font-bold text-[#3388ff]">{p}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#86909C]">请选择平台</span>
                      )}
                      {showPlatformDropdown ? <ChevronUp className="h-4 w-4 text-[#86909C]" /> : <ChevronDown className="h-4 w-4 text-[#86909C]" />}
                    </button>
                    {showPlatformDropdown && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border border-[#e1e6ee] bg-white py-2 shadow-lg">
                        {PLATFORMS.map((platform) => {
                          const isSelected = selectedPlatforms.includes(platform);
                          const hasImages = !selectedProduct || ASSET_IMAGES.some(
                            (img) => img.productId === selectedProduct.id && img.platform === platform
                          );
                          return (
                            <button
                              key={platform}
                              onClick={() => hasImages && togglePlatform(platform)}
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                hasImages ? "hover:bg-[#f0f7ff]" : "cursor-not-allowed opacity-50"
                              }`}
                            >
                              <div className={`grid h-5 w-5 place-items-center rounded border-2 transition-colors ${
                                isSelected ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
                              }`}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <span className={`text-[14px] font-medium ${isSelected ? "font-bold text-[#0A1B39]" : "text-[#0A1B39]"}`}>{platform}</span>
                              {!hasImages && (
                                <span className="ml-auto text-[11px] text-[#86909C]">暂无图片</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-displayed Images */}
                {selectedProduct && selectedPlatforms.length > 0 && (
                  <div>
                    <label className="mb-2 block text-[13px] font-bold text-[#0A1B39]">
                      关联图片
                      <span className="ml-2 text-[12px] font-medium text-[#86909C]">
                        已选平台的图片自动展示
                      </span>
                    </label>
                    <div className="rounded-xl border border-[#e1e6ee] bg-[#f9fafb] p-4">
                      {(() => {
                        const matchedImages = ASSET_IMAGES.filter(
                          (img) => img.productId === selectedProduct.id && selectedPlatforms.includes(img.platform)
                        );
                        if (matchedImages.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-8">
                              <ImageIcon className="mb-2 h-10 w-10 text-[#d0d5dd]" />
                              <p className="text-[13px] font-bold text-[#86909C]">暂无匹配图片</p>
                              <p className="mt-1 text-[12px] text-[#86909C]">所选平台暂无该商品的生成图片</p>
                            </div>
                          );
                        }
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {matchedImages.map((asset) => (
                              <div key={asset.id} className="group relative overflow-hidden rounded-lg border border-[#e1e6ee] bg-white">
                                <div className="aspect-square overflow-hidden bg-[#f2f4f7]">
                                  <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                                </div>
                                <div className="p-2">
                                  <p className="truncate text-[11px] font-bold text-[#0A1B39]">{asset.name}</p>
                                  <div className="mt-0.5 flex items-center justify-between">
                                    <span className="rounded bg-[#f2f4f7] px-1 py-0.5 text-[9px] text-[#86909C]">{asset.category}</span>
                                    <span className="rounded bg-[#e4f3ff] px-1 py-0.5 text-[9px] text-[#3388ff]">{asset.platform}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={resetCreateModal}
                  className="h-11 flex-1 rounded-xl bg-[#f2f4f7] text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#eceff4]"
                >
                  取消
                </button>
                <button
                  onClick={resetCreateModal}
                  className="h-11 flex-1 rounded-xl bg-[#3388ff] text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8]"
                >
                  创建任务
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Asset Selector Modal */}
        {showAssetSelector && (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50" onClick={() => setShowAssetSelector(false)}>
            <div className="h-[80vh] w-[min(900px,90vw)] rounded-2xl bg-white shadow-[0_24px_64px_rgba(29,38,52,.2)]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-[#eef1f5] px-6 py-4">
                <div>
                  <h2 className="text-[18px] font-extrabold text-[#0A1B39]">从资产库选择</h2>
                  <p className="mt-1 text-[13px] text-[#86909C]">点击选择图片，已选 {selectedAssetIds.length} 张</p>
                </div>
                <button
                  onClick={() => setShowAssetSelector(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] transition-colors hover:bg-[#eceff4]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Category Filter */}
              <div className="flex gap-2 border-b border-[#eef1f5] px-6 py-3">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      activeCategory === category
                        ? "bg-[#3388ff] text-white"
                        : "bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Asset Grid */}
              <div className="overflow-y-auto p-6 custom-scrollbar" style={{ maxHeight: "calc(80vh - 180px)" }}>
                <div className="grid grid-cols-5 gap-4">
                  {filteredAssets.map((asset) => {
                    const isSelected = selectedAssetIds.includes(asset.id);
                    return (
                      <button
                        key={asset.id}
                        onClick={() => toggleAssetSelection(asset.id)}
                        className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                          isSelected ? "border-[#3388ff] ring-2 ring-[#3388ff]/20" : "border-transparent hover:border-[#c0d8ff]"
                        }`}
                      >
                        <div className="aspect-square overflow-hidden bg-[#f2f4f7]">
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                        {isSelected && (
                          <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#3388ff] text-white">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                        <div className="p-2">
                          <p className="truncate text-[12px] font-bold text-[#0A1B39]">{asset.name}</p>
                          <p className="text-[10px] text-[#86909C]">{asset.category}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {filteredAssets.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <ImageIcon className="mb-3 h-12 w-12 text-[#d0d5dd]" />
                    <p className="text-[14px] font-bold text-[#86909C]">暂无图片</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[#eef1f5] px-6 py-4">
                <span className="text-[13px] font-bold text-[#86909C]">已选择 {selectedAssetIds.length} 张图片</span>
                <button
                  onClick={handleConfirmAssets}
                  className="h-10 rounded-xl bg-[#3388ff] px-6 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8]"
                >
                  确认选择
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
