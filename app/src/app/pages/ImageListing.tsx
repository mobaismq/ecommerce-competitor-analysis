import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Check, ChevronDown, ChevronRight, Package, ShoppingBag } from "lucide-react";
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

export function ImageListing() {
  const navigate = useNavigate();
  const [listings] = useState(MOCK_LISTINGS);
  const [showListingDropdown, setShowListingDropdown] = useState(false);
  const listingBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (listingBtnRef.current && !listingBtnRef.current.contains(e.target as Node)) {
        setShowListingDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getStatusBadge = (status: ListingStatus) => {
    const config = {
      draft: { label: "草稿", color: "bg-[#f1f3f7] text-[#86909C]" },
      pending: { label: "审核中", color: "bg-[#fff3e0] text-[#f57c00]" },
      published: { label: "已上架", color: "bg-[#e8f5e9] text-[#2e7d32]" },
    };
    const { label, color } = config[status];
    return <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${color}`}>{label}</span>;
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
          <div ref={listingBtnRef} className="relative">
            <button
              className="flex h-11 cursor-default items-center gap-2 rounded-xl bg-[#3388ff] px-5 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8] hover:shadow-[0_12px_32px_rgba(47,130,255,.35)]"
              onMouseEnter={() => setShowListingDropdown(true)}
            >
              商品上架
              <ChevronDown className="h-4 w-4" />
            </button>
            {showListingDropdown && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-[#e1e6ee] bg-white py-1 shadow-[0_8px_24px_rgba(29,38,52,.12)]">
                <button
                  onClick={() => { setShowListingDropdown(false); navigate("/listing/manual"); }}
                  className="flex w-full items-center px-4 py-2.5 text-left text-[14px] text-[#0A1B39] transition-colors hover:bg-[#f0f7ff]"
                >
                  手动上架
                </button>
                <button
                  onClick={() => { setShowListingDropdown(false); navigate("/listing/select"); }}
                  className="flex w-full items-center px-4 py-2.5 text-left text-[14px] text-[#0A1B39] transition-colors hover:bg-[#f0f7ff]"
                >
                  从商品列表选取
                </button>
              </div>
            )}
          </div>
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
      </div>
    </div>
  );
}
