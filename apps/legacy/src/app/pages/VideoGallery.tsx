import { useState } from "react";
import { Search, X } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";

interface VideoItem {
  id: string;
  url: string;
  name: string;
  duration: string;
  size: string;
}

interface VideoGroup {
  id: string;
  coverUrl: string;
  name: string;
  type: "主图视频" | "详情视频" | "复刻视频";
  count: number;
  product: string;
  platform: string;
  createTime: string;
  videos: VideoItem[];
}

const MOCK_PRODUCT_NAMES = [
  "激光水平仪", "智能手表", "蓝牙耳机", "便携榨汁机",
  "LED台灯", "蓝牙音箱", "无线鼠标", "机械键盘",
  "电动牙刷", "高速吹风机", "手机壳", "数据线",
  "直播补光灯", "手机支架",
];

const MOCK_VIDEO_GROUPS: VideoGroup[] = [
  {
    id: "v1",
    coverUrl: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=orange+wireless+headphones+product+video+thumbnail+white+background&image_size=landscape_16_9",
    name: "无线耳机主图视频",
    type: "主图视频",
    count: 2,
    product: "蓝牙耳机",
    platform: "淘宝",
    createTime: "2026-06-18",
    videos: [
      { id: "v1-1", url: "", name: "360度展示", duration: "0:30", size: "12 MB" },
      { id: "v1-2", url: "", name: "功能演示", duration: "1:00", size: "25 MB" },
    ],
  },
  {
    id: "v2",
    coverUrl: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=smart+watch+product+video+thumbnail+white+background&image_size=landscape_16_9",
    name: "智能手表详情视频",
    type: "详情视频",
    count: 1,
    product: "智能手表",
    platform: "天猫",
    createTime: "2026-06-20",
    videos: [
      { id: "v2-1", url: "", name: "产品详情", duration: "2:00", size: "45 MB" },
    ],
  },
  {
    id: "v3",
    coverUrl: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=laser+level+tool+product+video+thumbnail+white+background&image_size=landscape_16_9",
    name: "激光水平仪复刻视频",
    type: "复刻视频",
    count: 3,
    product: "激光水平仪",
    platform: "京东",
    createTime: "2026-07-01",
    videos: [
      { id: "v3-1", url: "", name: "使用教程", duration: "3:00", size: "60 MB" },
      { id: "v3-2", url: "", name: "场景演示", duration: "1:30", size: "35 MB" },
      { id: "v3-3", url: "", name: "对比评测", duration: "5:00", size: "120 MB" },
    ],
  },
];

export function VideoGallery() {
  const [searchName, setSearchName] = useState("");
  const [searchType, setSearchType] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [searchCreateTimeStart, setSearchCreateTimeStart] = useState("");
  const [searchCreateTimeEnd, setSearchCreateTimeEnd] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterCreateTimeStart, setFilterCreateTimeStart] = useState("");
  const [filterCreateTimeEnd, setFilterCreateTimeEnd] = useState("");
  const [groups, setGroups] = useState<VideoGroup[]>(MOCK_VIDEO_GROUPS);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [productSearchText, setProductSearchText] = useState("");

  const filteredGroups = groups.filter((g) => {
    if (filterName && !g.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterType && g.type !== filterType) return false;
    if (filterProduct && !g.product.includes(filterProduct)) return false;
    if (filterCreateTimeStart && g.createTime < filterCreateTimeStart) return false;
    if (filterCreateTimeEnd && g.createTime > filterCreateTimeEnd) return false;
    return true;
  });

  const handleSearch = () => {
    setFilterName(searchName);
    setFilterType(searchType);
    setFilterProduct(searchProduct);
    setFilterCreateTimeStart(searchCreateTimeStart);
    setFilterCreateTimeEnd(searchCreateTimeEnd);
  };

  const handleReset = () => {
    setSearchName(""); setSearchType(""); setSearchProduct("");
    setSearchCreateTimeStart(""); setSearchCreateTimeEnd("");
    setFilterName(""); setFilterType(""); setFilterProduct("");
    setFilterCreateTimeStart(""); setFilterCreateTimeEnd("");
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (deletingId) setGroups(groups.filter((g) => g.id !== deletingId));
    setShowDeleteConfirm(false);
    setDeletingId(null);
  };

  const filteredProducts = MOCK_PRODUCT_NAMES.filter((n) =>
    n.toLowerCase().includes(productSearchText.toLowerCase())
  );

  return (
    <div className="h-full overflow-auto bg-[#f4f7fb]">
      <div className="p-6">
        <PageHeader breadcrumbs={[{ label: "资产库" }, { label: "视频库" }]} className="mb-2" />

        <div className="mb-4 rounded-xl bg-white p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">视频名称</label>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
                <input type="text" placeholder="请输入" value={searchName} onChange={(e) => setSearchName(e.target.value)} className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]" />
                {searchName && <button onClick={() => setSearchName("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"><X className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">视频类型</label>
              <div className="relative flex-1">
                <select value={searchType} onChange={(e) => setSearchType(e.target.value)} className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-[13px] text-[#0A1B39] outline-none focus:border-[#409eff] appearance-none">
                  <option value="">请选择</option>
                  <option value="主图视频">主图视频</option>
                  <option value="详情视频">详情视频</option>
                  <option value="复刻视频">复刻视频</option>
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">关联主商品</label>
              <div className="relative flex-1">
                <input type="text" placeholder="请选择" value={searchProduct} onChange={(e) => { setSearchProduct(e.target.value); setProductSearchText(e.target.value); setShowProductDropdown(true); }} onFocus={() => setShowProductDropdown(true)} className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2.5 pr-7 text-[13px] outline-none focus:border-[#409eff]" />
                {searchProduct && <button onClick={() => { setSearchProduct(""); setProductSearchText(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"><X className="h-3.5 w-3.5" /></button>}
                {showProductDropdown && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#e6e9ef] bg-white shadow-lg max-h-48 overflow-auto">
                    {filteredProducts.length === 0 ? <div className="px-3 py-2 text-[13px] text-[#86909C]">无匹配结果</div> : filteredProducts.map((name) => (
                      <div key={name} className="px-3 py-2 text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8] cursor-pointer" onClick={() => { setSearchProduct(name); setProductSearchText(name); setShowProductDropdown(false); }}>{name}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-[12px] text-[#86909C]">创建时间</label>
              <div className="flex items-center gap-1.5 flex-1">
                <div className="relative flex-1">
                  <input type="date" value={searchCreateTimeStart} onChange={(e) => setSearchCreateTimeStart(e.target.value)} className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2 pr-7 text-[13px] outline-none focus:border-[#409eff]" />
                  {searchCreateTimeStart && <button onClick={() => setSearchCreateTimeStart("")} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"><X className="h-3.5 w-3.5" /></button>}
                </div>
                <span className="text-[12px] text-[#86909C]">至</span>
                <div className="relative flex-1">
                  <input type="date" value={searchCreateTimeEnd} onChange={(e) => setSearchCreateTimeEnd(e.target.value)} className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2 pr-7 text-[13px] outline-none focus:border-[#409eff]" />
                  {searchCreateTimeEnd && <button onClick={() => setSearchCreateTimeEnd("")} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"><X className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSearch} className="h-8 rounded-lg bg-[#409eff] px-4 text-[13px] font-bold text-white hover:bg-[#66b1ff]">查询</button>
            <button onClick={handleReset} className="h-8 rounded-lg border border-[#e6e9ef] bg-white px-4 text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8]">重置</button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {filteredGroups.map((group) => (
            <div key={group.id} className="rounded-xl bg-white overflow-hidden border border-[#e9edf3] hover:shadow-md transition-shadow">
              <div className="relative aspect-video bg-[#f2f4f7] overflow-hidden">
                <img src={group.coverUrl} alt={group.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-black/40 flex items-center justify-center">
                    <svg className="h-6 w-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <div className="text-[14px] font-bold text-[#0A1B39] mb-1">{group.name}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#86909C]">{group.type}</span>
                  <span className="text-[12px] text-[#86909C]">{group.count} 个视频</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[12px] text-[#86909C]">{group.product}</span>
                  <span className="text-[12px] text-[#86909C]">{group.createTime}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button className="text-[13px] text-[#409eff] hover:text-[#66b1ff]">查看</button>
                  <button className="text-[13px] text-[#409eff] hover:text-[#66b1ff]">下载</button>
                  <button onClick={() => handleDelete(group.id)} className="text-[13px] text-[#409eff] hover:text-[#66b1ff]">删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredGroups.length === 0 && (
          <div className="flex items-center justify-center py-20 text-[14px] text-[#86909C]">暂无数据</div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-[13px] text-[#86909C]">共 {filteredGroups.length} 条</div>
          <div className="flex items-center gap-1">
            <button className="h-8 w-8 rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8] flex items-center justify-center">&lt;</button>
            <button className="h-8 w-8 rounded-full bg-[#409eff] text-[13px] text-white flex items-center justify-center">1</button>
            <button className="h-8 w-8 rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8] flex items-center justify-center">2</button>
            <button className="h-8 w-8 rounded-lg border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8] flex items-center justify-center">&gt;</button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[400px] rounded-xl bg-white p-6">
            <h2 className="mb-3 text-[18px] font-bold text-[#0A1B39]">提示</h2>
            <p className="mb-6 text-[14px] text-[#0A1B39]">确认删除该视频组？</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="h-9 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[14px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8]">取消</button>
              <button onClick={confirmDelete} className="h-9 rounded-lg bg-[#f56c6c] px-5 text-[14px] font-bold text-white hover:bg-[#f78989]">确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
