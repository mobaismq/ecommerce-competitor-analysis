import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, ChevronDown, ChevronRight, CircleHelp, Copy, Eye, Folder, Image as ImageIcon, Sparkles, Upload, Wand2, X } from "lucide-react";
import { useSidebar } from "@/app/components/SidebarContext";
import image1 from "@/imports/image-1.png";
import image9 from "@/imports/image-9.png";
import image10 from "@/imports/image-10.png";
import image11 from "@/imports/image-11.png";
import image12 from "@/imports/image-12.png";
import image13 from "@/imports/image-13.png";
import image26 from "@/imports/image-26.png";
import image27 from "@/imports/image-27.png";

/* ── 数据 ── */
interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  platform: string;
  imageCount: number;
  status: "待生成" | "生成中" | "已完成";
  createdAt: string;
}

interface AssetImage {
  id: string;
  name: string;
  url: string;
  category: string;
  platform: string;
  createdAt: string;
  size: string;
  productId: string;
}

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

const CLONE_OPTIONS = {
  category: ["电商商品图", "社媒广告图", "详情页模块", "主图", "场景图", "卖点图", "海报图"],
  language: ["英文", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "荷兰文", "波兰文", "泰文", "越南文", "印尼文"],
  ratio: ["1:1", "3:4", "4:3", "9:16", "16:9"],
};

/* ──小组件 ── */
function Title({ children, help = false, muted = false }: { children: ReactNode; help?: boolean; muted?: boolean }) {
  return <h2 className={`mb-3 flex items-center gap-1 text-[14px] font-semibold ${muted ? "text-[#86909C]" : "text-[#0A1B39]"}`}>{children}{help && <CircleHelp className="h-4 w-4 text-[#86909C]" />}</h2>;
}

function SelectBox({ value, options, open, onToggle, onSelect }: { value: string; options: string[]; open: boolean; onToggle: () => void; onSelect: (v: string) => void }) {
  return (
    <div className="relative">
      <button type="button" onClick={onToggle} className={`h-[42px] w-full rounded-[9px] bg-[#f2f4f7] px-3.5 flex items-center justify-between text-[14px] font-normal text-[#0A1B39] transition-colors ${open ? "ring-1 ring-[#3388ff] bg-white" : "hover:bg-[#eceff4]"}`}>
        <span>{value}</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[46px] z-30 max-h-60 overflow-y-auto rounded-xl border border-[#e5eaf2] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,41,.12)]">
          {options.map((opt) => (
            <button key={opt} type="button" onClick={() => onSelect(opt)} className={`flex h-9 w-full items-center rounded-lg px-3 text-left text-[14px] font-normal transition-colors ${opt === value ? "bg-[#eef5ff] text-[#3388ff]" : "text-[#485066] hover:bg-[#f5f6f8]"}`}>{opt}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 复刻结果卡片 ── */
function ReplicateResultCard({ title, image, badge }: { title: string; image: string; badge: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white shadow-[0_4px_16px_rgba(29,38,52,.06)] transition-all hover:shadow-[0_8px_28px_rgba(29,38,52,.12)]" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="relative aspect-[3/4] overflow-hidden bg-[#f2f4f7]">
        <img src={image} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-3.5 py-1.5 text-[12px] font-normal text-[#485066] shadow-sm">{badge}</div>
        <div className={`absolute inset-0 flex items-center justify-center gap-3 bg-black/40 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#0A1B39] transition-colors hover:bg-white"><Eye className="h-5 w-5" /></button>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-[#0A1B39] transition-colors hover:bg-white"><Copy className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="p-4">
        <h3 className="mb-1 truncate text-[14px] font-bold text-[#0A1B39]">{title}</h3>
        <p className="text-[12px] text-[#86909C]">{badge} · 刚刚生成</p>
      </div>
    </div>
  );
}

/* ── 主页面 ── */
export function OneClickReplicate() {
  const navigate = useNavigate();
  const { expanded } = useSidebar();

  /* 商品选择 */
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  /* 参考内容 */
  const [method, setMethod] = useState("上传参考图");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  /* 复刻程度 */
  const [level, setLevel] = useState("高度复刻");

  /* 生成设置 */
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [settings, setSettings] = useState({ category: "电商商品图", language: "英文", ratio: "1:1" });
  const updateSetting = (key: keyof typeof settings, value: string) => { setSettings((c) => ({ ...c, [key]: value })); setOpenSetting(null); };

  /* 复刻要求 */
  const [replicateNote, setReplicateNote] = useState("");

  /* 生成状态 */
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ title: string; image: string; badge: string }[]>([]);

  const selectedProduct = MOCK_PRODUCTS.find((p) => p.id === selectedProductId);
  const productAssets = MOCK_ASSETS.filter((a) => a.productId === selectedProductId);

  const handleGenerate = () => {
    if (!selectedProductId) return;
    setGenerating(true);
    setResults([]);
    setTimeout(() => {
      setResults([
        { title: `${selectedProduct?.name} - 高度复刻`, image: image27, badge: "高度复刻" },
        { title: `${selectedProduct?.name} - 参考风格`, image: image26, badge: "参考风格" },
        { title: `${selectedProduct?.name} - 变体 A`, image: image10, badge: "高度复刻" },
        { title: `${selectedProduct?.name} - 变体 B`, image: image11, badge: "参考风格" },
      ]);
      setGenerating(false);
    }, 2000);
  };

  return (
    <div className="relative flex h-full bg-[#f4f7fb]">
      {/* ─── 左侧配置面板 ─── */}
      <div className="w-[360px] shrink-0 overflow-y-auto bg-white px-4 sm:px-6 pb-28 pt-7 custom-scrollbar">
        {/* 返回 */}
        <button onClick={() => navigate("/")} className="mb-5 flex items-center gap-1.5 text-[13px] font-bold text-[#86909C] transition-colors hover:text-[#0A1B39]">
          <ArrowLeft className="h-4 w-4" />
          返回资产库
        </button>

        {/* ① 选择商品 */}
        <Title>① 选择商品</Title>
        <div className="mb-6">
          {selectedProduct ? (
            <div className="rounded-xl border border-[#e1e6ee] bg-[#f9fafb] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[14px] font-bold text-[#0A1B39]">{selectedProduct.name}</h3>
                  <p className="mt-1 font-mono text-[12px] text-[#86909C]">{selectedProduct.sku}</p>
                  <p className="mt-1 text-[12px] text-[#86909C]">{selectedProduct.platform} · {selectedProduct.imageCount} 张图片</p>
                </div>
                <button onClick={() => { setSelectedProductId(""); }} className="text-[12px] font-bold text-[#3388ff] hover:text-[#1a6fe8]">更换</button>
              </div>
              {productAssets.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {productAssets.slice(0, 4).map((a) => (
                    <div key={a.id} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#f2f4f7]">
                      <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setShowProductPicker(true)} className="flex h-[80px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#8cc4ff] bg-white transition-colors hover:bg-[#f9fafb]">
              <Folder className="mb-2 h-6 w-6 text-[#3388ff]" />
              <span className="text-[13px] font-bold text-[#3388ff]">点击选择商品</span>
            </button>
          )}
        </div>

        {/* ② 参考内容 */}
        <Title help>② 参考内容</Title>
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#f2f4f7] p-0.5 text-[14px] font-normal">
          <button onClick={() => setMethod("上传参考图")} className={`h-10 rounded-[10px] ${method === "上传参考图" ? "bg-white shadow-sm" : "text-[#86909C]"}`}>上传参考图</button>
          <button onClick={() => setMethod("导入链接")} className={`h-10 rounded-[10px] ${method === "导入链接" ? "bg-white shadow-sm" : "text-[#86909C]"}`}>导入链接</button>
        </div>
        {method === "上传参考图" ? (
          <div className="mb-6">
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e4e9f1] bg-white p-6">
              <Upload className="mb-3 h-7 w-7 text-[#3388ff]" />
              <button className="mb-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[14px] font-semibold hover:bg-[#eceff4]">上传参考图</button>
              <p className="text-[12px] font-normal text-[#86909C]">最多 20 张</p>
            </div>
            {referenceImages.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {referenceImages.map((img, i) => (
                  <div key={i} className="relative h-16 overflow-hidden rounded-lg bg-[#f2f4f7]">
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6">
            <input type="text" placeholder="粘贴商品链接或图片链接..." className="h-11 w-full rounded-xl border border-[#e1e6ee] bg-[#f9fafb] px-4 text-[14px] outline-none transition-colors focus:border-[#3388ff] focus:bg-white" />
            <p className="mt-2 text-[12px] text-[#86909C]">支持亚马逊、TikTok、速卖通等平台链接</p>
          </div>
        )}

        {/* ③ 复刻程度 */}
        <Title>③ 复刻程度</Title>
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button onClick={() => setLevel("参考风格")} className={`rounded-xl p-4 text-left transition-all ${level === "参考风格" ? "border border-[#8bbcff] bg-white shadow-sm" : "bg-[#f5f6f8]"}`}>
            <h3 className="text-[14px] font-normal">参考风格</h3>
            <p className="mt-2 text-[12px] font-normal leading-5 text-[#86909C]">参考整体风格和结构，自动调整色彩和重构场景。</p>
          </button>
          <button onClick={() => setLevel("高度复刻")} className={`rounded-xl p-4 text-left transition-all ${level === "高度复刻" ? "border border-[#8bbcff] bg-white shadow-sm" : "bg-[#f5f6f8]"}`}>
            <h3 className="text-[14px] font-normal">高度复刻</h3>
            <p className="mt-2 text-[12px] font-normal leading-5 text-[#86909C]">参照参考图视觉结构替换产品和文案，场景细节略有差异。</p>
          </button>
        </div>

        {/* ④ 统一复刻要求 */}
        <Title muted>④ 统一复刻要求（选填）</Title>
        <textarea value={replicateNote} onChange={(e) => setReplicateNote(e.target.value)} className="mb-6 h-[74px] w-full resize-none rounded-xl border border-[#e1e6ee] p-3 text-[14px] font-normal text-[#86909C] outline-none transition-colors focus:border-[#3388ff]" placeholder="例如：文案统一用英文、模特保持完全不变、参考图不变只替换商品。" />

        {/* ⑤ 生成设置 */}
        <Title>⑤ 生成设置</Title>
        <div className="space-y-3">
          <SelectBox value={settings.category} options={CLONE_OPTIONS.category} open={openSetting === "category"} onToggle={() => setOpenSetting(openSetting === "category" ? null : "category")} onSelect={(v) => updateSetting("category", v)} />
          <div className="grid grid-cols-2 gap-3">
            <SelectBox value={settings.language} options={CLONE_OPTIONS.language} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(v) => updateSetting("language", v)} />
            <SelectBox value={settings.ratio} options={CLONE_OPTIONS.ratio} open={openSetting === "ratio"} onToggle={() => setOpenSetting(openSetting === "ratio" ? null : "ratio")} onSelect={(v) => updateSetting("ratio", v)} />
          </div>
        </div>
      </div>

      {/* ─── 底部操作按钮 ─── */}
      <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#eef1f5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}>
        <button
          onClick={handleGenerate}
          disabled={!selectedProductId || generating}
          className={`flex h-12 sm:h-14 w-full items-center justify-center gap-2 rounded-lg text-[14px] font-semibold transition-all ${selectedProductId && !generating ? "bg-gradient-to-r from-[#3388ff] to-[#66a3ff] text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] hover:shadow-[0_12px_32px_rgba(47,130,255,.35)]" : "bg-[#C9CDD4] text-white cursor-not-allowed"}`}
        >
          {generating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              复刻中...
            </>
          ) : (
            <>
              <Wand2 className="h-5 w-5" />
              一键复刻爆款图
            </>
          )}
        </button>
      </div>

      {/* ─── 右侧主内容区 ─── */}
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="w-full text-center">
          <h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-extrabold tracking-[-0.03em] text-[#0A1B39]">一键复刻</h1>
          <p className="mt-3 text-[14px] sm:text-[15px] lg:text-[16px] font-normal text-[#86909C]">选择商品 + 参考爆款 = 你的专属爆款图</p>
        </div>

        {/* 流程示意 */}
        {!generating && results.length === 0 && (
          <div className="mt-8 rounded-[20px] sm:rounded-[24px] lg:rounded-[28px] bg-white p-6 sm:p-8 shadow-[0_18px_50px_rgba(29,38,52,.06)]">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <div className={`mb-4 grid h-16 w-16 place-items-center rounded-2xl ${selectedProduct ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#f2f4f7] text-[#86909C]"}`}>
                  {selectedProduct ? <Check className="h-7 w-7" /> : <Folder className="h-7 w-7" />}
                </div>
                <h3 className="text-[15px] font-bold text-[#0A1B39]">选择商品</h3>
                <p className="mt-1.5 text-[13px] text-[#86909C]">{selectedProduct ? `已选：${selectedProduct.name}` : "从资产库中选择要复刻的商品"}</p>
              </div>
              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#f2f4f7] text-[#86909C]">
                  <Upload className="h-7 w-7" />
                </div>
                <h3 className="text-[15px] font-bold text-[#0A1B39]">上传参考图</h3>
                <p className="mt-1.5 text-[13px] text-[#86909C]">上传或导入你想复刻的爆款图片</p>
              </div>
              {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#f2f4f7] text-[#86909C]">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h3 className="text-[15px] font-bold text-[#0A1B39]">一键生成</h3>
                <p className="mt-1.5 text-[13px] text-[#86909C]">AI 自动复刻，生成高度还原的爆款图</p>
              </div>
            </div>

            {/* 连接箭头 */}
            <div className="mt-6 flex items-center justify-center gap-4 text-[#c8d3e2]">
              <div className="h-px flex-1 bg-[#e9edf3]" />
              <ChevronRight className="h-5 w-5" />
              <div className="h-px flex-1 bg-[#e9edf3]" />
              <ChevronRight className="h-5 w-5" />
              <div className="h-px flex-1 bg-[#e9edf3]" />
            </div>
          </div>
        )}

        {/* 生成中 */}
        {generating && (
          <div className="mt-8 flex flex-col items-center justify-center rounded-[24px] bg-white py-20 shadow-[0_18px_50px_rgba(29,38,52,.06)]">
            <div className="relative mb-6">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#e9edf3] border-t-[#3388ff]" />
              <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-[#3388ff]" />
            </div>
            <h3 className="text-[18px] font-bold text-[#0A1B39]">正在复刻中...</h3>
            <p className="mt-2 text-[14px] text-[#86909C]">AI 正在分析参考图并生成专属爆款图，请稍候</p>
          </div>
        )}

        {/* 生成结果 */}
        {results.length > 0 && !generating && (
          <div className="mt-8">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-[18px] font-extrabold text-[#0A1B39]">复刻结果</h2>
                <span className="rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-[12px] font-bold text-[#2e7d32]">{results.length} 张</span>
              </div>
              <button onClick={() => { setResults([]); }} className="text-[13px] font-bold text-[#3388ff] hover:text-[#1a6fe8]">重新生成</button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {results.map((r, i) => (
                <ReplicateResultCard key={i} title={r.title} image={r.image} badge={r.badge} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ─── 商品选择弹窗 ─── */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setShowProductPicker(false)}>
          <div className="w-[min(600px,90vw)] max-h-[70vh] overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(29,38,52,.2)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#eef1f5] px-6 py-4">
              <h2 className="text-[18px] font-extrabold text-[#0A1B39]">选择商品</h2>
              <button onClick={() => setShowProductPicker(false)} className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto p-4 custom-scrollbar" style={{ maxHeight: "calc(70vh - 64px)" }}>
              {MOCK_PRODUCTS.map((product) => {
                const assets = MOCK_ASSETS.filter((a) => a.productId === product.id);
                const isSelected = selectedProductId === product.id;
                return (
                  <button
                    key={product.id}
                    onClick={() => { setSelectedProductId(product.id); setShowProductPicker(false); }}
                    className={`mb-3 flex w-full items-center gap-4 rounded-xl p-4 text-left transition-all ${isSelected ? "border border-[#3388ff] bg-[#eef5ff]" : "border border-[#eef1f5] hover:bg-[#f9fafb]"}`}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f2f4f7]">
                      {assets.length > 0 ? (
                        <img src={assets[0].url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-[#c8d3e2]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[14px] font-bold text-[#0A1B39]">{product.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-[12px] text-[#86909C]">
                        <span className="rounded bg-[#f2f4f7] px-1.5 py-0.5 font-mono">{product.sku}</span>
                        <span>{product.platform}</span>
                        <span>{product.imageCount} 张图片</span>
                      </div>
                    </div>
                    {isSelected && <Check className="h-5 w-5 shrink-0 text-[#3388ff]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
