import { useState, type ReactNode } from "react";
import { ChevronDown, CircleHelp, Upload } from "lucide-react";
import referenceAd from "@/imports/image-26.png";
import highCopyAd from "@/imports/image-27.png";
import styleCopyAd from "@/imports/image.png";
import productCloth from "@/imports/image-1.png";
import suiteArrow from "@/imports/箭头.svg";
import { useSidebar } from "@/app/components/SidebarContext";

function SectionTitle({ children, help = false }: { children: ReactNode; help?: boolean }) {
  return <h2 className="mb-3 flex items-center gap-1 text-[14px] font-semibold text-[#171A1D]">{children}{help && <CircleHelp className="h-3.5 w-3.5 text-[#8B949E]" />}</h2>;
}

function SelectBox({ value, options, open, onToggle, onSelect }: { value: string; options: string[]; open: boolean; onToggle: () => void; onSelect: (value: string) => void }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-[30px] w-full items-center justify-between rounded-[8px] bg-[#F2F3F5] px-3 text-[13px] font-normal text-[#171A1D] transition-colors ${open ? "bg-white ring-1 ring-[#3388FF]" : "hover:bg-[#ECEFF4]"}`}
      >
        <span>{value}</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[34px] z-30 max-h-60 overflow-y-auto rounded-[8px] border border-[#E5EAF2] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,41,.12)] custom-scrollbar">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`flex h-9 w-full items-center rounded-[8px] px-3 text-left text-[14px] font-normal transition-colors ${option === value ? "bg-[#EEF5FF] text-[#3388FF]" : "text-[#485066] hover:bg-[#F5F6F8]"}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CLONE_OPTIONS = {
  category: ["电商商品图", "社媒广告图", "详情页模块", "主图", "场景图", "卖点图", "海报图"],
  language: ["英文", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "荷兰文", "波兰文", "泰文", "越南文", "印尼文"],
  ratio: ["1:1", "3:4", "4:3", "9:16", "16:9"],
};

export function ViralReplication() {
  const { expanded } = useSidebar();
  const [method, setMethod] = useState("上传参考图");
  const [level, setLevel] = useState("高度复刻");
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [settings, setSettings] = useState({ category: "电商商品图", language: "英文", ratio: "1:1" });

  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setOpenSetting(null);
  };

  return (
    <div className="relative flex h-full bg-[#F2F4F7]">
      <div className="w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pb-28 pt-5 custom-scrollbar">
        <SectionTitle help>产品原图(可选)</SectionTitle>
        <div className="mb-4 flex h-[94px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#8CC4FF] bg-white">
          <button className="mb-3 flex h-8 items-center gap-1.5 rounded-[8px] bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]">
            <Upload className="h-4 w-4" />
            上传产品图
          </button>
          <p className="text-[12px] font-normal text-[#8B949E]">有商品需替换时上传，无商品可跳过</p>
        </div>

        <SectionTitle>参考内容</SectionTitle>
        <div className="mb-4 grid grid-cols-2 rounded-[8px] bg-[#F2F3F5] p-0.5 text-[13px] font-normal">
          <button onClick={() => setMethod("上传参考图")} className={`h-9 rounded-[8px] transition-all ${method === "上传参考图" ? "bg-white font-semibold shadow-sm" : "text-[#8B949E]"}`}>上传参考图</button>
          <button onClick={() => setMethod("导入链接")} className={`h-9 rounded-[8px] transition-all ${method === "导入链接" ? "bg-white font-semibold shadow-sm" : "text-[#8B949E]"}`}>导入链接</button>
        </div>
        <div className="mb-4 flex h-[94px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#E3E7EF] bg-white">
          <button className="mb-3 flex h-8 items-center gap-1.5 rounded-[8px] bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]">
            <Upload className="h-4 w-4" />
            上传参考图
          </button>
          <p className="text-[12px] font-normal text-[#8B949E]">最多20张</p>
        </div>

        <SectionTitle>复刻程度</SectionTitle>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <button onClick={() => setLevel("参考风格")} className={`rounded-[8px] p-3 text-left ${level === "参考风格" ? "border border-[#8BBcff] bg-white" : "bg-[#F2F3F5]"}`}>
            <h3 className="text-[13px] font-semibold text-[#171A1D]">参考风格</h3>
            <p className="mt-2 text-[12px] font-normal leading-5 text-[#8B949E]">参考整体风格和结构，自动调整色彩和重构场景。</p>
          </button>
          <button onClick={() => setLevel("高度复刻")} className={`rounded-[8px] p-3 text-left ${level === "高度复刻" ? "border border-[#8BBcff] bg-white" : "bg-[#F2F3F5]"}`}>
            <h3 className="text-[13px] font-semibold text-[#171A1D]">高度复刻</h3>
            <p className="mt-2 text-[12px] font-normal leading-5 text-[#8B949E]">参照参考图视觉结构替换产品和文案，场景细节略有差异。</p>
          </button>
        </div>

        <SectionTitle>统一复刻要求（选填）</SectionTitle>
        <textarea className="mb-4 h-[74px] w-full resize-none rounded-[8px] border border-[#DDE3EC] p-3 text-[12px] font-normal leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]" defaultValue="例如：文案统一用英文、模特保持完全不变、参考图不变只替换商品。" />

        <SectionTitle>生成设置</SectionTitle>
        <div className="space-y-3">
          <SelectBox value={settings.category} options={CLONE_OPTIONS.category} open={openSetting === "category"} onToggle={() => setOpenSetting(openSetting === "category" ? null : "category")} onSelect={(value) => updateSetting("category", value)} />
          <div className="grid grid-cols-2 gap-3">
            <SelectBox value={settings.language} options={CLONE_OPTIONS.language} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(value) => updateSetting("language", value)} />
            <SelectBox value={settings.ratio} options={CLONE_OPTIONS.ratio} open={openSetting === "ratio"} onToggle={() => setOpenSetting(openSetting === "ratio" ? null : "ratio")} onSelect={(value) => updateSetting("ratio", value)} />
          </div>
        </div>
      </div>

      <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#EEF1F5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}>
        <button className="h-10 w-full rounded-[8px] bg-[#C4C6CA] text-[13px] font-semibold text-white">一键复刻爆款图</button>
      </div>

      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="flex min-h-full items-center justify-center">
          <div className="w-full max-w-[980px] pb-10 text-center">
            <h1 className="text-[32px] font-bold leading-tight text-[#171A1D]">爆款图复刻</h1>
            <p className="mt-3 text-[14px] font-normal leading-6 text-[#5F6B7A]">想参考的爆款 + 你的产品图 = 你的爆款图</p>

            <div className="mt-12 mx-auto flex h-[384px] w-[792px] items-center gap-4 rounded-[20px] bg-white p-6 shadow-[0_18px_40px_rgba(31,37,45,.06)]">
              <div className="flex h-[336px] w-[336px] shrink-0 items-center">
                <div className="relative h-[209px] w-[336px] overflow-hidden rounded-[18px]">
                  <img src={referenceAd} alt="参考爆款童装广告图" className="block h-full w-full object-contain" />
                  <span className="absolute right-3 top-3 rounded-full bg-[#F2F3F5] px-3 py-1.5 text-[12px] font-semibold text-[#22324D]">参考图</span>
                  <div className="absolute -bottom-9 left-1/2 grid h-28 w-28 -translate-x-1/2 place-items-center rounded-full bg-white shadow-[0_14px_30px_rgba(31,37,45,.16)]">
                    <img src={productCloth} alt="蓝色童装产品图" className="h-20 w-20 object-contain" />
                    <span className="absolute bottom-3 text-[12px] font-semibold text-[#22324D]">产品图</span>
                  </div>
                </div>
              </div>

              <div className="flex h-[336px] w-10 shrink-0 flex-col items-center justify-center gap-8">
                <img src={suiteArrow} alt="" className="block w-[40px] shrink-0" />
                <img src={suiteArrow} alt="" className="block w-[40px] shrink-0 rotate-90" />
              </div>

              <div className="grid h-[336px] w-[336px] shrink-0 grid-rows-2 justify-items-center gap-3">
                <div className="relative h-[162px] w-[262px] overflow-hidden rounded-[18px]">
                  <img src={highCopyAd} alt="高度复刻后的童装广告图" className="block h-full w-full object-contain" />
                  <span className="absolute right-3 top-3 rounded-full bg-[#F2F3F5] px-3 py-1.5 text-[12px] font-semibold text-[#22324D]">高度复刻</span>
                </div>
                <div className="relative h-[162px] w-[261px] overflow-hidden rounded-[18px]">
                  <img src={styleCopyAd} alt="参考风格后的童装广告图" className="block h-full w-full object-contain" />
                  <span className="absolute right-3 top-3 rounded-full bg-[#F2F3F5] px-3 py-1.5 text-[12px] font-semibold text-[#22324D]">参考风格</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md">?</button>
    </div>
  );
}
