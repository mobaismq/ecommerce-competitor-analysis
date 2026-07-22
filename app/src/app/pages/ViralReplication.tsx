import { useState, type ReactNode } from "react";
import { ChevronDown, CircleHelp, Upload } from "lucide-react";
import referenceAd from "@/imports/image-26.png";
import highCopyAd from "@/imports/image-27.png";
import styleCopyAd from "@/imports/image.png";
import productCloth from "@/imports/image-1.png";
import { useSidebar } from "@/app/components/SidebarContext";

function Title({ children, help = false, muted = false }: { children: ReactNode; help?: boolean; muted?: boolean }) { return <h2 className={`mb-4 flex items-center gap-1 text-[14px] font-semibold ${muted ? "text-[#86909C]" : "text-[#0A1B39]"}`}>{children}{help && <CircleHelp className="h-4 w-4 text-[#86909C]" />}</h2>; }
function SelectBox({ value, options, open, onToggle, onSelect }: { value: string; options: string[]; open: boolean; onToggle: () => void; onSelect: (value: string) => void }) {
  return <div className="relative"><button type="button" onClick={onToggle} className={`h-[42px] w-full rounded-[9px] bg-[#f2f4f7] px-3.5 flex items-center justify-between text-[14px] font-normal text-[#0A1B39] transition-colors ${open ? "ring-1 ring-[#3388ff] bg-white" : "hover:bg-[#eceff4]"}`}><span>{value}</span><ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} /></button>{open && <div className="absolute left-0 right-0 top-[46px] z-30 max-h-60 overflow-y-auto rounded-xl border border-[#e5eaf2] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,41,.12)] custom-scrollbar">{options.map((option) => <button key={option} type="button" onClick={() => onSelect(option)} className={`flex h-9 w-full items-center rounded-lg px-3 text-left text-[14px] font-normal transition-colors ${option === value ? "bg-[#eef5ff] text-[#3388ff]" : "text-[#485066] hover:bg-[#f5f6f8]"}`}>{option}</button>)}</div>}</div>;
}
const CLONE_OPTIONS = {
  category: ["电商商品图", "社媒广告图", "详情页模块", "主图", "场景图", "卖点图", "海报图"],
  language: ["英文", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "荷兰文", "波兰文", "泰文", "越南文", "印尼文"],
  ratio: ["1:1", "3:4", "4:3", "9:16", "16:9"],
};

function GirlAd({ variant = "ref", className = "" }: { variant?: "ref" | "copy" | "style"; className?: string }) {
  const isBlue = variant === "style";
  return <div className={`relative overflow-hidden rounded-[18px] ${isBlue ? "bg-[#dff0fb]" : "bg-[#f5e9d7]"} ${className}`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.9),transparent_40%)]" />
    <h3 className={`absolute left-5 top-5 text-left font-black leading-[.95] ${isBlue ? "text-[#214f80] text-[14px]" : variant === "ref" ? "text-[#e7a61f] text-[13px]" : "text-[#9a6c50] text-[14px]"}`}>{variant === "ref" ? "Liebevoll gestaltet für\nkleine Prinzessinnen" : variant === "copy" ? "Sweet For\nLittle Princesses" : "Designed for\nLittle Princesses"}</h3>
    <p className="absolute left-5 top-[88px] text-left text-[13px] font-semibold text-[#725c4d]">Soft Skin-friendly Fabric,<br/>Comfortable For Daily Wear</p>
    <div className="absolute bottom-0 right-10 h-[72%] w-[25%] rounded-t-full bg-[#f7cfae]" />
    <div className="absolute bottom-[16%] right-[15%] h-[38%] w-[12%] rounded-full bg-[#f5d3b6]" />
    <div className="absolute bottom-0 right-[13%] h-[45%] w-[20%] rounded-t-[45%] bg-gradient-to-b from-[#cde5ff] to-[#9ec6ef] border-t-8 border-white" />
    <div className="absolute right-5 top-4 rounded-full bg-white/90 px-4 py-2 text-[12px] font-normal text-[#86909C]">{variant === "copy" ? "高度复刻" : variant === "style" ? "参考风格" : "参考图"}</div>
    {variant === "ref" && <div className="absolute -bottom-8 left-[42%] h-28 w-28 rounded-full bg-white shadow-xl grid place-items-center"><div className="h-16 w-20 rounded-t-xl bg-[#cde5ff] border-t-8 border-white" /><span className="absolute bottom-3 text-[12px] font-normal text-[#86909C]">产品图</span></div>}
  </div>;
}

export function ViralReplication() {
  const { expanded } = useSidebar();
  const [method, setMethod] = useState("上传参考图");
  const [level, setLevel] = useState("高度复刻");
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [settings, setSettings] = useState({ category: "电商商品图", language: "英文", ratio: "1:1" });
  const updateSetting = (key: keyof typeof settings, value: string) => { setSettings((current) => ({ ...current, [key]: value })); setOpenSetting(null); };
  return <div className="relative flex h-full bg-[#f4f7fb]">
    <div className="w-[360px] shrink-0 overflow-y-auto bg-white px-4 sm:px-6 pb-28 pt-7 custom-scrollbar">
      <Title help>产品原图(可选)</Title>
      <div className="mb-6 flex h-[132px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#8cc4ff] bg-white"><button className="mb-4 flex items-center gap-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[14px] font-semibold"><Upload className="h-5 w-5" />上传产品图</button><p className="text-[12px] font-normal text-[#86909C]">有商品需替换时上传，无商品可跳过</p></div>
      <Title>参考内容</Title>
      <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#f2f4f7] p-0.5 text-[14px] font-normal"><button onClick={() => setMethod("上传参考图")} className={`h-10 rounded-[10px] ${method === "上传参考图" ? "bg-white shadow-sm" : "text-[#86909C]"}`}>上传参考图</button><button onClick={() => setMethod("导入链接")} className={`h-10 rounded-[10px] ${method === "导入链接" ? "bg-white shadow-sm" : "text-[#86909C]"}`}>导入链接</button></div>
      <div className="mb-6 flex h-[132px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e4e9f1] bg-white"><button className="mb-4 flex items-center gap-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[14px] font-semibold"><Upload className="h-5 w-5" />上传参考图</button><p className="text-[12px] font-normal text-[#86909C]">最多20张</p></div>
      <Title>复刻程度</Title>
      <div className="mb-6 grid grid-cols-2 gap-3"><button onClick={() => setLevel("参考风格")} className={`rounded-xl p-5 text-left ${level === "参考风格" ? "border border-[#8bbcff] bg-white" : "bg-[#f5f6f8]"}`}><h3 className="text-[14px] font-normal">参考风格</h3><p className="mt-2 text-[12px] font-normal leading-6 text-[#86909C]">参考整体风格和结构，自动调整色彩和重构场景。</p></button><button onClick={() => setLevel("高度复刻")} className={`rounded-xl p-5 text-left ${level === "高度复刻" ? "border border-[#8bbcff] bg-white" : "bg-[#f5f6f8]"}`}><h3 className="text-[14px] font-normal">高度复刻</h3><p className="mt-2 text-[12px] font-normal leading-6 text-[#86909C]">参照参考图视觉结构替换产品和文案，场景细节略有差异。</p></button></div>
      <Title>统一复刻要求（选填）</Title>
      <textarea className="mb-6 h-[74px] w-full resize-none rounded-xl border border-[#e1e6ee] p-3 text-[14px] font-normal text-[#86909C] outline-none" defaultValue="例如：文案统一用英文、模特保持完全不变、参考图不变只替换商品。" />
      <Title>生成设置</Title>
      <div className="space-y-3">
        <SelectBox value={settings.category} options={CLONE_OPTIONS.category} open={openSetting === "category"} onToggle={() => setOpenSetting(openSetting === "category" ? null : "category")} onSelect={(value) => updateSetting("category", value)} />
        <div className="grid grid-cols-2 gap-3">
          <SelectBox value={settings.language} options={CLONE_OPTIONS.language} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(value) => updateSetting("language", value)} />
          <SelectBox value={settings.ratio} options={CLONE_OPTIONS.ratio} open={openSetting === "ratio"} onToggle={() => setOpenSetting(openSetting === "ratio" ? null : "ratio")} onSelect={(value) => updateSetting("ratio", value)} />
        </div>
      </div>
    </div>
    <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#eef1f5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}><button className="h-12 sm:h-14 w-full rounded-lg bg-[#C9CDD4] text-[14px] font-semibold text-white">一键复刻爆款图</button></div>
    <main className="flex-1 overflow-hidden p-6"><div className="w-full text-center"><h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-medium tracking-[-0.03em] text-[#0A1B39]">爆款图复刻</h1><p className="mt-3 text-[14px] sm:text-[15px] lg:text-[16px] font-normal text-[#86909C]">想参考的爆款 + 你的产品图 = 你的爆款图</p>
      <div className="mt-6 sm:mt-8 rounded-[20px] sm:rounded-[24px] lg:rounded-[28px] bg-white p-4 sm:p-6 lg:p-8 shadow-[0_18px_50px_rgba(29,38,52,.06)]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_80px_1.06fr] items-center gap-4 sm:gap-6">
          <div className="relative">
            <div className="h-[200px] sm:h-[230px] lg:h-[250px] overflow-hidden rounded-[18px] bg-[#f5e9d7] shadow-sm">
              <img src={referenceAd} alt="参考爆款童装广告图" className="h-full w-full object-cover" />
            </div>
            <div className="absolute right-3 top-3 rounded-full bg-white/90 px-4 py-2 text-[12px] font-normal text-[#485066]">参考图</div>
            <div className="absolute -bottom-9 left-1/2 grid h-28 w-28 -translate-x-1/2 place-items-center rounded-full bg-white shadow-xl">
              <img src={productCloth} alt="蓝色童装产品图" className="h-20 w-20 object-contain" />
              <span className="absolute bottom-3 text-[12px] font-normal">产品图</span>
            </div>
          </div>
          <div className="flex flex-col gap-7 text-[40px] text-[#c8d3e2]"><span className="rotate-[-15deg]">↗</span><span className="rotate-[15deg]">↘</span></div>
          <div className="grid grid-rows-2 gap-2">
            <div className="relative h-[255px] overflow-hidden rounded-[18px] bg-[#f5e9d7]">
              <img src={highCopyAd} alt="高度复刻后的童装广告图" className="h-full w-full object-cover" />
              <div className="absolute right-3 top-3 rounded-full bg-white/90 px-4 py-2 text-[12px] font-normal text-[#485066]">高度复刻</div>
            </div>
            <div className="relative h-[255px] overflow-hidden rounded-[18px] bg-[#dff0fb]">
              <img src={styleCopyAd} alt="参考风格后的童装广告图" className="h-full w-full object-cover" />
              <div className="absolute right-3 top-3 rounded-full bg-white/90 px-4 py-2 text-[12px] font-normal text-[#485066]">参考风格</div>
            </div>
          </div>
        </div>
      </div>
    </div></main><button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md">?</button>
  </div>;
}
