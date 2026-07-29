import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Search, RotateCcw, Eye, Download, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, Calendar } from "lucide-react";
import { createPortal } from "react-dom";

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
              className="px-3 py-1.5 text-[13px] hover:bg-[#f5f6f8] cursor-pointer flex items-center gap-2"
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${value.includes(opt) ? "bg-[#409eff] border-[#409eff]" : "border-[#dcdfe6]"}`}>
                {value.includes(opt) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ImageItem {
  id: string;
  url: string;
  name: string;
  sceneTag: string;
  size: string;
}

interface ImageGroup {
  id: string;
  coverUrl: string;
  name: string;
  groupCode: string;
  type: "主图" | "详情图" | "复刻图";
  ratio: string;
  count: number;
  product: string;
  platforms: string[];
  createTime: string;
  images: ImageItem[];
}

const MOCK_PRODUCT_NAMES = [
  "激光水平仪",
  "智能手表",
  "蓝牙耳机",
  "便携榨汁机",
  "LED台灯",
  "蓝牙音箱",
  "无线鼠标",
  "机械键盘",
  "电动牙刷",
  "高速吹风机",
  "手机壳",
  "数据线",
  "直播补光灯",
  "手机支架",
  "移动电源",
  "摄像头",
  "扩展坞",
  "钢化膜",
  "车载支架",
  "笔记本支架",
  "无线充电器",
  "智能门锁",
];

const MOCK_PLATFORMS = ["淘宝", "天猫", "京东", "拼多多", "抖店"];

// Real product image generation using trae-api
const IMG = (prompt: string, size: "square" | "landscape_16_9" = "square") =>
  `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`;

const TYPES: Array<"主图" | "详情图" | "复刻图"> = ["主图", "详情图", "复刻图"];
const RATIOS = ["1:1", "3:4", "4:3", "16:9"];
const SIZES = ["1.2 MB", "1.5 MB", "1.8 MB", "980 KB", "1.1 MB", "1.3 MB", "900 KB", "800 KB", "750 KB", "1.0 MB", "850 KB", "720 KB", "680 KB", "600 KB", "580 KB"];

// English prompts for real product images
const PRODUCT_PROMPTS: Record<string, string> = {
  "激光水平仪": "laser level tool product photo white background",
  "智能手表": "smart watch wristband product photo white background",
  "蓝牙耳机": "bluetooth earbuds headphones product photo white background",
  "便携榨汁机": "portable juicer blender product photo white background",
  "LED台灯": "LED desk lamp product photo white background",
  "蓝牙音箱": "bluetooth speaker portable product photo white background",
  "无线鼠标": "wireless mouse product photo white background",
  "机械键盘": "mechanical keyboard RGB product photo white background",
  "电动牙刷": "electric toothbrush product photo white background",
  "高速吹风机": "hair dryer product photo white background",
  "手机壳": "phone case protective cover product photo white background",
  "数据线": "usb cable charging product photo white background",
  "直播补光灯": "ring light selfie product photo white background",
  "手机支架": "phone tripod stand product photo white background",
  "移动电源": "power bank portable charger product photo white background",
  "摄像头": "security camera wifi product photo white background",
  "扩展坞": "usb hub dock station product photo white background",
  "钢化膜": "tempered glass screen protector product photo white background",
  "车载支架": "car phone holder mount product photo white background",
  "笔记本支架": "laptop stand aluminum product photo white background",
  "无线充电器": "wireless charger pad product photo white background",
  "智能门锁": "smart door lock fingerprint product photo white background",
};

// Scene-specific prompt suffixes
const SCENE_SUFFIXES: Record<string, string> = {
  "主图": "front view product shot studio lighting",
  "模特图": "model using product lifestyle photo",
  "场景图": "product in use scene lifestyle setting",
  "细节图": "product close up detail texture macro shot",
  "白底图": "product isolated on pure white background clean",
};

function generateRandomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generatePlatforms(i: number): string[] {
  // Some groups have no platforms, some have multiple
  if (i % 7 === 0) return []; // 空
  if (i % 5 === 0) return [MOCK_PLATFORMS[i % MOCK_PLATFORMS.length], MOCK_PLATFORMS[(i + 1) % MOCK_PLATFORMS.length]]; // 2个
  if (i % 3 === 0) return [MOCK_PLATFORMS[i % MOCK_PLATFORMS.length], MOCK_PLATFORMS[(i + 1) % MOCK_PLATFORMS.length], MOCK_PLATFORMS[(i + 2) % MOCK_PLATFORMS.length]]; // 3个
  return [MOCK_PLATFORMS[i % MOCK_PLATFORMS.length]]; // 1个
}

function generateGroups(count: number): ImageGroup[] {
  const groups: ImageGroup[] = [];
  const sceneTags = ["主图", "模特图", "场景图", "细节图", "白底图"];
  for (let i = 0; i < count; i++) {
    const productIdx = i % MOCK_PRODUCT_NAMES.length;
    // 造一条关联商品主档为空的数据
    const productName = i === 3 ? "" : MOCK_PRODUCT_NAMES[productIdx];
    const platforms = generatePlatforms(i);
    const type = TYPES[i % TYPES.length];
    const ratio = RATIOS[i % RATIOS.length];
    const imgCount = 2 + (i % 4);
    const day = String(1 + (i % 28)).padStart(2, "0");
    const month = String(1 + (i % 7) + 5).padStart(2, "0");
    const hour = String(8 + (i % 12)).padStart(2, "0");
    const minute = String((i * 7) % 60).padStart(2, "0");
    const second = String((i * 13) % 60).padStart(2, "0");
    const basePrompt = PRODUCT_PROMPTS[productName] || `${productName} product photo white background`;
    const images: ImageItem[] = [];
    for (let j = 0; j < imgCount; j++) {
      const sceneTag = sceneTags[j % sceneTags.length];
      const suffix = SCENE_SUFFIXES[sceneTag] || "product shot";
      images.push({
        id: `i${i + 1}-${j + 1}`,
        url: IMG(`${basePrompt} ${suffix}`),
        name: `${productName}-${sceneTag}`,
        sceneTag,
        size: SIZES[(i + j) % SIZES.length],
      });
    }
    groups.push({
      id: `g${i + 1}`,
      coverUrl: IMG(`${basePrompt} front view product shot studio lighting`),
      name: `${productName}${type}`,
      groupCode: `2026${month}${day}${hour}${minute}${second}${generateRandomCode()}`,
      type,
      ratio,
      count: imgCount,
      product: productName,
      platforms,
      createTime: `2026-${month}-${day}`,
      images,
    });
  }
  return groups;
}

const MOCK_IMAGE_GROUPS: ImageGroup[] = generateGroups(80);

export function ImageGallery() {
  const navigate = useNavigate();
  const [searchName, setSearchName] = useState("");
  const [searchType, setSearchType] = useState<string[]>([]);
  const [searchProduct, setSearchProduct] = useState<string[]>([]);
  const [searchPlatform, setSearchPlatform] = useState("");
  const [searchCreateTimeStart, setSearchCreateTimeStart] = useState("");
  const [searchCreateTimeEnd, setSearchCreateTimeEnd] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string[]>([]);
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterCreateTimeStart, setFilterCreateTimeStart] = useState("");
  const [filterCreateTimeEnd, setFilterCreateTimeEnd] = useState("");
  const [showDateRange, setShowDateRange] = useState(false);
  const dateRangeBtnRef = useRef<HTMLButtonElement>(null);
  const [dateRangePopupPos, setDateRangePopupPos] = useState({ top: 0, left: 0 });

  const toggleDateRange = () => {
    if (!showDateRange && dateRangeBtnRef.current) {
      const rect = dateRangeBtnRef.current.getBoundingClientRect();
      setDateRangePopupPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setShowDateRange(!showDateRange);
  };
  const [groups, setGroups] = useState<ImageGroup[]>(MOCK_IMAGE_GROUPS);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<ImageGroup | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(-1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingImage, setDeletingImage] = useState<{ groupId: string; imageId: string } | null>(null);
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tooltipText, setTooltipText] = useState("");
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const pageSize = 80;

  const handlePlatformHover = (e: React.MouseEvent, text: string) => {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollWidth > el.clientWidth) {
      const rect = el.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 计算 tooltip 位置，确保不超出视口
      let x = rect.left + rect.width / 2;
      const tooltipHeight = 28;
      let y = rect.bottom + 6;

      // 如果下方空间不够，显示在上方
      if (y + tooltipHeight > viewportHeight) {
        y = rect.top - tooltipHeight - 6;
      }

      // 确保不超出顶部边界
      if (y < 10) {
        y = rect.bottom + 6; // 如果上方也不够，强制显示在下方
      }

      // 确保不超出左右边界
      const tooltipWidth = text.length * 8 + 16;
      if (x - tooltipWidth / 2 < 10) {
        x = tooltipWidth / 2 + 10;
      } else if (x + tooltipWidth / 2 > viewportWidth - 10) {
        x = viewportWidth - tooltipWidth / 2 - 10;
      }

      setTooltipText(text);
      setTooltipPos({ x, y });
      setShowTooltip(true);
    }
  };

  const filteredGroups = groups.filter((g) => {
    if (filterName && !g.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterType.length > 0 && !filterType.includes(g.type)) return false;
    if (filterProduct.length > 0) {
      const includeEmpty = filterProduct.includes("--");
      const selectedProducts = filterProduct.filter((p) => p !== "--");
      if (includeEmpty && selectedProducts.length === 0) {
        if (g.product) return false;
      } else if (includeEmpty && selectedProducts.length > 0) {
        if (g.product && !selectedProducts.includes(g.product)) return false;
      } else {
        if (!g.product || !selectedProducts.includes(g.product)) return false;
      }
    }
    if (filterPlatform && !g.platforms.includes(filterPlatform)) return false;
    if (filterCreateTimeStart && g.createTime < filterCreateTimeStart) return false;
    if (filterCreateTimeEnd && g.createTime > filterCreateTimeEnd) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredGroups.length / pageSize);
  const paginatedGroups = filteredGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearch = () => {
    setFilterName(searchName);
    setFilterType(searchType);
    setFilterProduct(searchProduct);
    setFilterPlatform(searchPlatform);
    setFilterCreateTimeStart(searchCreateTimeStart);
    setFilterCreateTimeEnd(searchCreateTimeEnd);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchName("");
    setSearchType([]);
    setSearchProduct([]);
    setSearchPlatform("");
    setSearchCreateTimeStart("");
    setSearchCreateTimeEnd("");
    setFilterName("");
    setFilterType([]);
    setFilterProduct([]);
    setFilterPlatform("");
    setFilterCreateTimeStart("");
    setFilterCreateTimeEnd("");
    setCurrentPage(1);
  };

  const handleView = (group: ImageGroup) => {
    setViewingGroup(group);
    setCurrentImageIndex(-1);
    setShowViewModal(true);
  };

  const [showPathTip, setShowPathTip] = useState(false);

  const downloadWithPicker = async (url: string, fileName: string) => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      if (!dirHandle) return;
      const response = await fetch(url);
      const blob = await response.blob();
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e: any) {
      if (e?.name === "AbortError") return true;
      return false;
    }
  };

  const handleDownloadImage = async (url: string, name: string) => {
    const ok = await downloadWithPicker(url, `${name}.jpg`);
    if (!ok) {
      setShowPathTip(true);
      setTimeout(() => setShowPathTip(false), 3000);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.target = "_blank";
      a.click();
    }
  };

  const handleDownloadGroup = async (group: ImageGroup) => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      if (!dirHandle) return;

      for (const img of group.images) {
        try {
          const response = await fetch(img.url);
          const blob = await response.blob();
          const fileName = `${group.product}-${img.name}.jpg`;
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch {
          // 单张失败继续下一张
        }
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setShowPathTip(true);
      setTimeout(() => setShowPathTip(false), 3000);
      group.images.forEach((img, i) => {
        setTimeout(() => {
          const a = document.createElement("a");
          a.href = img.url;
          a.download = `${group.product}-${img.name}.jpg`;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, i * 500);
      });
    }
  };

  const handleDeleteImage = (groupId: string, imageId: string) => {
    setDeletingImage({ groupId, imageId });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteImage = () => {
    if (!deletingImage) return;
    setGroups(
      groups.map((g) =>
        g.id === deletingImage.groupId
          ? { ...g, images: g.images.filter((img) => img.id !== deletingImage.imageId), count: g.count - 1 }
          : g
      )
    );
    setShowDeleteConfirm(false);
    setDeletingImage(null);
  };

  const handleDeleteGroup = (groupId: string) => {
    setDeletingGroupId(groupId);
    setShowDeleteGroupConfirm(true);
  };

  const confirmDeleteGroup = () => {
    if (!deletingGroupId) return;
    setGroups(groups.filter((g) => g.id !== deletingGroupId));
    setShowDeleteGroupConfirm(false);
    setDeletingGroupId(null);
    setShowViewModal(false);
    setViewingGroup(null);
  };

  const productNames = [...new Set(groups.map((g) => g.product).filter(Boolean))];

  return (
    <>
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        {/* 页面路径 */}
        <div className="mb-2 text-[14px] text-[#86909C]">
          资产库 / 图库
        </div>

        {/* 查询条件 */}
        <div className="mb-4 rounded-xl bg-white p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">图片名称</label>
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
                  <button onClick={() => setSearchName("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">图片类型</label>
              <MultiSelect
                options={["主图", "详情图", "复刻图"]}
                value={searchType}
                onChange={setSearchType}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">关联商品主档</label>
              <MultiSelect
                options={["--", ...productNames]}
                value={searchProduct}
                onChange={setSearchProduct}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">关联平台</label>
              <div className="relative flex-1">
                <select
                  value={searchPlatform}
                  onChange={(e) => setSearchPlatform(e.target.value)}
                  className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 pr-7 text-[13px] outline-none focus:border-[#409eff] ${!searchPlatform ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`}
                >
                  <option value="">请选择</option>
                  {MOCK_PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc] pointer-events-none" />
                {searchPlatform && (
                  <button
                    onClick={() => setSearchPlatform("")}
                    className="absolute right-7 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">创建时间</label>
              <div className="relative flex-1">
                <button
                  ref={dateRangeBtnRef}
                  onClick={toggleDateRange}
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
                {showDateRange && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDateRange(false)} />
                    <div className="fixed z-50 bg-white rounded-lg border border-[#e6e9ef] shadow-lg p-3 w-80" style={{ top: `${dateRangePopupPos.top}px`, left: `${dateRangePopupPos.left}px` }}>
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
                          onClick={() => { setSearchCreateTimeStart(""); setSearchCreateTimeEnd(""); setShowDateRange(false); }}
                          className="h-6 px-3 rounded text-[12px] text-[#606266] border border-[#dcdfe6] hover:text-[#409eff] hover:border-[#409eff]"
                        >
                          清除
                        </button>
                        <button
                          onClick={() => setShowDateRange(false)}
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

        {/* 图片列表 */}
        <div className="grid grid-cols-8 gap-3">
          {paginatedGroups.map((group) => (
            <div key={group.id} className="rounded-xl bg-white overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative aspect-square bg-[#f2f4f7] overflow-hidden border-b border-[#e9edf3] group/card">
                <img src={group.coverUrl} alt={group.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <button onClick={() => handleView(group)} className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
                    <Eye className="h-4 w-4 text-[#0A1B39]" />
                  </button>
                  <button onClick={() => handleDownloadGroup(group)} className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
                    <Download className="h-4 w-4 text-[#0A1B39]" />
                  </button>
                  <button onClick={() => handleDeleteGroup(group.id)} className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>
              <div className="px-2 py-1">
                <div className="text-[12px] font-bold text-[#0A1B39] truncate">{group.name}</div>
                <div className="flex items-center gap-1">
                  <svg className="h-2.5 w-2.5 text-[#86909C] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="text-[10px] text-[#86909C]">{group.type}</span>
                </div>
                <div className="text-[10px] text-[#86909C]">{group.ratio} · {group.count}张</div>
                <div
                  className={`text-[10px] truncate ${group.product ? "text-[#409eff] cursor-pointer hover:underline" : "text-[#86909C]"}`}
                  onClick={() => group.product && navigate(`/product/master-data?name=${encodeURIComponent(group.product)}`)}
                >
                  {group.product || "--"}
                </div>
                <div className="flex items-center justify-between overflow-hidden">
                  <span
                    className="text-[10px] text-[#86909C] truncate block flex-1 min-w-0 cursor-default"
                    onMouseEnter={(e) => handlePlatformHover(e, group.platforms.length > 0 ? group.platforms.join(" / ") : "--")}
                    onMouseLeave={() => setShowTooltip(false)}
                  >
                    {group.platforms.length > 0 ? group.platforms.join("/") : "--"}
                  </span>
                  <span className="text-[10px] text-[#86909C] whitespace-nowrap ml-2 shrink-0">{group.createTime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 分页器 */}
        {filteredGroups.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-[13px] text-[#86909C]">共 {filteredGroups.length} 条</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-lg border border-[#e6e9ef] bg-white flex items-center justify-center text-[#0A1B39] hover:bg-[#f5f6f8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 rounded-lg text-[13px] font-bold transition-colors ${
                    page === currentPage ? "bg-[#409eff] text-white" : "border border-[#e6e9ef] bg-white text-[#0A1B39] hover:bg-[#f5f6f8]"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-lg border border-[#e6e9ef] bg-white flex items-center justify-center text-[#0A1B39] hover:bg-[#f5f6f8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 查看图片弹窗 */}
      {showViewModal && viewingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowViewModal(false)}>
          <div className="bg-white rounded-2xl w-[90vw] max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* 弹窗标题 */}
            <div className="flex items-center justify-between px-6 py-2.5 border-b border-[#e9edf3]">
              <div className="text-[16px] font-bold text-[#0A1B39]">查看图片</div>
              <button onClick={() => setShowViewModal(false)} className="h-8 w-8 rounded-lg hover:bg-[#f5f6f8] flex items-center justify-center transition-colors">
                <X className="h-5 w-5 text-[#86909C]" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 pt-3 pb-6">
              {/* 下载路径提示 */}
              {showPathTip && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[12px] text-amber-800">
                  当前浏览器不支持选择下载路径，图片将下载到默认下载文件夹。建议使用 Chrome/Edge 浏览器以获得完整功能。
                </div>
              )}

              {/* 图片展示 */}
              <div className="mb-4">
                <div className="flex items-center justify-end mb-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDownloadGroup(viewingGroup)} className="h-7 w-7 rounded-lg bg-white flex items-center justify-center hover:bg-[#f5f6f8] transition-colors" title="下载全部">
                      <Download className="h-4 w-4 text-[#409eff]" />
                    </button>
                    <button onClick={() => handleDeleteGroup(viewingGroup.id)} className="h-7 w-7 rounded-lg bg-white flex items-center justify-center hover:bg-[#f5f6f8] transition-colors" title="删除全部">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {viewingGroup.images.map((img, index) => (
                    <div key={img.id} className="rounded-xl overflow-hidden border border-[#e9edf3] group/img">
                      <div className="relative aspect-square bg-[#f2f4f7] cursor-pointer" onClick={() => setCurrentImageIndex(index)}>
                        <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(index); }} className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center">
                            <Eye className="h-3.5 w-3.5 text-[#0A1B39]" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDownloadImage(img.url, img.name); }} className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center">
                            <Download className="h-3.5 w-3.5 text-[#0A1B39]" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(viewingGroup.id, img.id); }} className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className="px-2.5 pb-2.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="inline-block rounded bg-[#f2f4f7] px-2 py-0.5 text-[11px] text-[#86909C]">{img.sceneTag}</span>
                          <span className="text-[11px] text-[#86909C]">{img.size}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 图片信息 */}
              <div>
                <div className="rounded-xl border border-[#e9edf3] p-4">
                  <div className="grid grid-cols-6 gap-4 text-[13px]">
                    <div>
                      <div className="text-[#86909C] mb-1">图片类型</div>
                      <div className="text-[#0A1B39]">{viewingGroup.type}</div>
                    </div>
                    <div>
                      <div className="text-[#86909C] mb-1">图片比例</div>
                      <div className="text-[#0A1B39]">{viewingGroup.ratio}</div>
                    </div>
                    <div>
                      <div className="text-[#86909C] mb-1">数量</div>
                      <div className="text-[#0A1B39]">{viewingGroup.count}张</div>
                    </div>
                    <div>
                      <div className="text-[#86909C] mb-1">关联商品主档</div>
                      <div className="text-[#0A1B39]">{viewingGroup.product}</div>
                    </div>
                    <div>
                      <div className="text-[#86909C] mb-1">关联平台</div>
                      <div className="text-[#0A1B39]">{viewingGroup.platforms.length > 0 ? viewingGroup.platforms.join(" / ") : "--"}</div>
                    </div>
                    <div>
                      <div className="text-[#86909C] mb-1">创建时间</div>
                      <div className="text-[#0A1B39]">{viewingGroup.createTime}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 大图查看 */}
      {showViewModal && viewingGroup && currentImageIndex >= 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setCurrentImageIndex(-1)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <img src={viewingGroup.images[currentImageIndex].url} alt={viewingGroup.images[currentImageIndex].name} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-lg">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded bg-white/20 px-2 py-0.5 text-[12px] text-white">{viewingGroup.images[currentImageIndex].sceneTag}</span>
                  <span className="text-[12px] text-white/80">{viewingGroup.images[currentImageIndex].size}</span>
                </div>
              </div>
              {viewingGroup.images.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((currentImageIndex - 1 + viewingGroup.images.length) % viewingGroup.images.length); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/20 hover:bg-black/70 flex items-center justify-center transition-colors shadow-lg"
                  >
                    <ChevronLeft className="h-7 w-7 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((currentImageIndex + 1) % viewingGroup.images.length); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/20 hover:bg-black/70 flex items-center justify-center transition-colors shadow-lg"
                  >
                    <ChevronRight className="h-7 w-7 text-white" />
                  </button>
                </>
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownloadImage(viewingGroup.images[currentImageIndex].url, viewingGroup.images[currentImageIndex].name); }}
                  className="h-10 w-10 rounded-full bg-black/20 hover:bg-black/70 flex items-center justify-center transition-colors shadow-lg"
                >
                  <Download className="h-5 w-5 text-white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteImage(viewingGroup.id, viewingGroup.images[currentImageIndex].id); }}
                  className="h-10 w-10 rounded-full bg-black/20 hover:bg-black/70 flex items-center justify-center transition-colors shadow-lg"
                >
                  <Trash2 className="h-5 w-5 text-red-400" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(-1); }}
                  className="h-10 w-10 rounded-full bg-black/20 hover:bg-black/70 flex items-center justify-center transition-colors shadow-lg"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {viewingGroup.images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(i); }}
                    className={`h-2 rounded-full transition-all ${i === currentImageIndex ? "w-6 bg-white" : "w-2 bg-white/50"}`}
                  />
                ))}
              </div>
            </div>
          </div>
      )}

      {/* 删除单张图片确认 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[16px] font-bold text-[#0A1B39] mb-2">确认删除</div>
            <div className="text-[14px] text-[#86909C] mb-6">确认删除该图片？</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
                取消
              </button>
              <button onClick={confirmDeleteImage} className="h-9 rounded-lg bg-red-500 px-5 text-[13px] font-bold text-white hover:bg-red-600 transition-colors">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除整组图片确认 */}
      {showDeleteGroupConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/20" onClick={() => setShowDeleteGroupConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[16px] font-bold text-[#0A1B39] mb-2">确认删除</div>
            <div className="text-[14px] text-[#86909C] mb-6">确认删除该组图片？</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteGroupConfirm(false)} className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
                取消
              </button>
              <button onClick={confirmDeleteGroup} className="h-9 rounded-lg bg-red-500 px-5 text-[13px] font-bold text-white hover:bg-red-600 transition-colors">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* 全局 tooltip */}
    {showTooltip && createPortal(
      <div
        className="fixed px-2 py-1 text-[10px] text-white bg-[#0A1B39] rounded whitespace-nowrap z-[9999] pointer-events-none shadow-lg"
        style={{ left: tooltipPos.x, top: tooltipPos.y, transform: "translateX(-50%)" }}
      >
        {tooltipText}
      </div>,
      document.body
    )}
    </>
  );
}
