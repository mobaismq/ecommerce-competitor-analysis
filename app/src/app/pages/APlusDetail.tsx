import { useState, type ReactNode } from "react";
import { Check, ChevronDown, CircleHelp, Lightbulb, Upload } from "lucide-react";
import earbudFront from "@/imports/image-15.png";
import earbudCase from "@/imports/image-16.png";
import earbudSingle from "@/imports/image-17.png";
import { useSidebar } from "@/app/components/SidebarContext";
import detailLong from "@/imports/image-18.png";
import heroBanner from "@/imports/image-19.png";
import specsBanner from "@/imports/image-20.png";
import lifestyleBanner from "@/imports/image-21.png";
import featureIcons from "@/imports/image-23.png";
import emotionScene from "@/imports/image-24.png";
import useCases from "@/imports/image-25.png";

function Title({ children, help = false }: { children: ReactNode; help?: boolean }) {
  return <h2 className="mb-4 flex items-center gap-1 text-[14px] font-semibold text-[#0A1B39]">{children}{help && <CircleHelp className="h-4 w-4 text-[#86909C]" />}</h2>;
}
function SelectBox({ value, options, open, onToggle, onSelect, wide = false }: { value: string; options: string[]; open: boolean; onToggle: () => void; onSelect: (value: string) => void; wide?: boolean }) {
  return (
    <div className={`relative ${wide ? "col-span-3" : ""}`}>
      <button type="button" onClick={onToggle} className={`h-[42px] w-full rounded-[9px] bg-[#f2f4f7] px-3.5 flex items-center justify-between text-[14px] font-normal text-[#0A1B39] transition-colors ${open ? "ring-1 ring-[#3388ff] bg-white" : "hover:bg-[#eceff4]"}`}>
        <span>{value}</span><ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="absolute left-0 right-0 top-[46px] z-30 max-h-60 overflow-y-auto rounded-xl border border-[#e5eaf2] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,41,.12)] custom-scrollbar">
        {options.map((option) => <button key={option} type="button" onClick={() => onSelect(option)} className={`flex h-9 w-full items-center rounded-lg px-3 text-left text-[14px] font-normal transition-colors ${option === value ? "bg-[#eef5ff] text-[#3388ff]" : "text-[#485066] hover:bg-[#f5f6f8]"}`}>{option}</button>)}
      </div>}
    </div>
  );
}
function BlueBud({ small = false }: { small?: boolean }) {
  return <div className={`relative mx-auto ${small ? "h-24 w-24" : "h-32 w-32"}`}><div className="absolute bottom-4 left-4 h-16 w-16 rounded-xl bg-gradient-to-br from-[#27a9e8] to-[#064678] shadow-xl" /><div className="absolute left-3 top-4 h-11 w-6 -rotate-45 rounded-full bg-gradient-to-b from-[#48c2ff] to-[#07588f]" /><div className="absolute right-8 top-1 h-14 w-7 rotate-12 rounded-full bg-gradient-to-b from-[#4cc7ff] to-[#07598f]" /><div className="absolute bottom-10 left-12 h-8 w-8 rounded-full bg-[#051a2e]" /></div>;
}
function DetailTile({ className = "", children }: { className?: string; children?: ReactNode }) { return <div className={`relative overflow-hidden bg-[#0a2945] ${className}`}>{children}</div>; }

const APLUS_OPTIONS = {
  platform: ["亚马逊", "TikTok", "速卖通", "Temu", "Shein", "Shopee", "Lazada", "eBay", "Walmart", "Shopify", "独立站"],
  country: ["美国", "英国", "德国", "法国", "意大利", "西班牙", "日本", "韩国", "加拿大", "澳大利亚", "新加坡", "马来西亚", "泰国", "越南", "巴西", "墨西哥"],
  language: ["英文", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "荷兰文", "波兰文", "泰文", "越南文", "印尼文"],
  type: ["普通A+", "品牌故事", "高级A+", "对比表详情", "图文详情", "旗舰店详情"],
};

export function APlusDetail() {
  const { expanded } = useSidebar();
  const [checked, setChecked] = useState(["首屏主视觉", "核心卖点图", "使用场景图", "多角度图", "场景氛围图", "商品细节图"]);
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [settings, setSettings] = useState({ platform: "亚马逊", country: "美国", language: "英文", type: "普通A+" });
  const updateSetting = (key: keyof typeof settings, value: string) => { setSettings((current) => ({ ...current, [key]: value })); setOpenSetting(null); };
  const modules = [
    ["首屏主视觉", "传递核心价值"],
    ["核心卖点图", "突出差点优势"],
    ["使用场景图", "呈现真实使用场景"],
    ["多角度图", "多角度呈现外观"],
    ["场景氛围图", "展示使用场景"],
    ["商品细节图", "放大材质与工艺"],
    ["品牌故事图", "传达品牌理念"],
    ["尺寸/容量/尺码图", "展示规格信息"],
    ["效果对比图", "使用前后效果对比"],
    ["详细规格/参数表", "展示详细商品数据"],
    ["工艺制作图", "展示工艺制作过程"],
    ["配件/赠品图", "明确收货的所有物品"],
    ["系列展示图", "多色或多SKU展示"],
    ["商品成分图", "展示配方/材质/成分"],
    ["售后保障图", "说明质保退换政策"],
    ["使用建议图", "商品使用的注意事项"],
  ];  return <div className="relative flex h-full bg-[#f4f7fb]">
    <div className="w-[360px] shrink-0 overflow-y-auto bg-white px-4 sm:px-6 pb-28 pt-7 custom-scrollbar">
      <Title help>商品原图</Title>
      <div className="mb-6 flex h-[132px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e4e9f1] bg-white"><button className="mb-4 flex items-center gap-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[14px] font-semibold"><Upload className="h-5 w-5" />上传图片</button><p className="text-[12px] font-normal text-[#86909C]">同一产品，最多3张。</p></div>
      <Title>生成设置</Title>
      <div className="mb-6 grid grid-cols-3 gap-3.5">
        <SelectBox value={settings.platform} options={APLUS_OPTIONS.platform} open={openSetting === "platform"} onToggle={() => setOpenSetting(openSetting === "platform" ? null : "platform")} onSelect={(value) => updateSetting("platform", value)} />
        <SelectBox value={settings.country} options={APLUS_OPTIONS.country} open={openSetting === "country"} onToggle={() => setOpenSetting(openSetting === "country" ? null : "country")} onSelect={(value) => updateSetting("country", value)} />
        <SelectBox value={settings.language} options={APLUS_OPTIONS.language} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(value) => updateSetting("language", value)} />
        <SelectBox value={settings.type} options={APLUS_OPTIONS.type} open={openSetting === "type"} onToggle={() => setOpenSetting(openSetting === "type" ? null : "type")} onSelect={(value) => updateSetting("type", value)} wide />
      </div>
      <div className="mb-4 flex items-center justify-between"><Title help>商品卖点&要求</Title><button className="mb-4 flex items-center gap-1.5 rounded-full border border-[#e8edf4] bg-white px-3 py-1.5 text-[14px] font-semibold text-[#3587ff] shadow-sm"><Lightbulb className="h-4 w-4" />AI 帮写</button></div>
      <textarea className="mb-6 h-[164px] w-full resize-none rounded-xl border border-[#e1e6ee] bg-white p-3 text-[14px] font-normal leading-7 text-[#86909C] outline-none" defaultValue={`建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.具体参数`} />
      <Title help>包含模块（多选）</Title>
      <div className="grid grid-cols-2 gap-4">
        {modules.map(([m, d]) => <button key={m} onClick={() => setChecked(v => v.includes(m) ? v.filter(x => x !== m) : [...v, m])} className="rounded-xl bg-[#f5f6f8] p-5 text-left"><div className="flex items-center gap-2 text-[14px] font-normal"><span className={`grid h-5 w-5 place-items-center rounded ${checked.includes(m) ? "bg-[#3388ff] text-white" : "bg-white border border-[#d8dde5]"}`}>{checked.includes(m) && <Check className="h-4 w-4" />}</span>{m}</div><p className="mt-2 text-[12px] font-normal text-[#86909C]">{d}</p></button>)}
      </div>
    </div>
    <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#eef1f5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}><button className="h-12 sm:h-14 w-full rounded-lg bg-[#505154] text-[14px] font-semibold text-white">请上传产品图</button></div>
    <main className="flex-1 overflow-hidden p-6"><div className="w-full text-center"><h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-medium tracking-[-0.03em] text-[#0A1B39]">A+/详情页</h1><p className="mt-3 text-[14px] sm:text-[15px] lg:text-[16px] font-normal text-[#86909C]">上传商品图，AI 即刻生成 <span className="text-[#3388ff]">符合多电商平台规范</span> 的专业详情页。</p>
      <div className="mt-6 sm:mt-8 rounded-[20px] sm:rounded-[24px] lg:rounded-[28px] bg-white p-4 sm:p-6 lg:p-8 shadow-[0_18px_50px_rgba(29,38,52,.06)]"><div className="grid grid-cols-1 lg:grid-cols-[140px_38px_120px_1fr] gap-4 lg:gap-6 items-center lg:items-stretch h-auto lg:h-[430px]">
        <div className="grid grid-cols-3 lg:grid-rows-3 gap-1.5 rounded-[22px] overflow-hidden h-[120px] lg:h-auto">
          <div className="bg-[#f5f6fa] grid place-items-center"><img src={earbudFront} alt="蓝色无线耳机开盖产品图" className="h-full w-full object-contain p-3" /></div>
          <div className="bg-[#f5f6fa] grid place-items-center"><img src={earbudCase} alt="蓝色无线耳机充电盒背面" className="h-full w-full object-contain p-3" /></div>
          <div className="relative bg-[#f5f6fa] grid place-items-center"><img src={earbudSingle} alt="蓝色单只无线耳机" className="h-full w-full object-contain p-3" /><span className="absolute bottom-4 rounded-full bg-black/35 px-5 py-2 text-white text-[12px] font-normal">上传产品图</span></div>
        </div>
        <div className="grid place-items-center text-[36px] text-[#c8d3e2] rotate-[-20deg]">↗</div>
        <div className="overflow-hidden rounded-[20px]"><DetailTile className="h-full bg-[#071f38]"><img src={detailLong} alt="蓝色耳机电商详情长图" className="h-full w-full object-cover" /><span className="absolute bottom-3 left-3 right-3 rounded-full bg-black/45 py-2 text-white text-[12px] font-normal">生成电商长图</span></DetailTile></div>
        <div className="grid grid-cols-2 grid-rows-3 gap-1.5 overflow-hidden rounded-[20px]">
          <DetailTile><img src={heroBanner} alt="蓝色耳机首屏主视觉" className="h-full w-full object-cover" /></DetailTile>
          <DetailTile><img src={featureIcons} alt="蓝色耳机无线自由续航充电卖点图" className="h-full w-full object-cover" /></DetailTile>
          <DetailTile><img src={specsBanner} alt="蓝色耳机核心卖点规格图" className="h-full w-full object-cover" /></DetailTile>
          <DetailTile><img src={emotionScene} alt="蓝色耳机情绪场景卖点图" className="h-full w-full object-cover" /></DetailTile>
          <DetailTile className="bg-[#dcc5a2]"><img src={lifestyleBanner} alt="蓝色耳机生活方式场景图" className="h-full w-full object-cover" /></DetailTile>
          <DetailTile className="bg-[#97b6d6]"><img src={useCases} alt="蓝色耳机通勤运动工作场景图" className="h-full w-full object-cover" /><span className="absolute bottom-3 left-3 right-3 rounded-full bg-black/50 py-2 text-white text-[12px] font-normal">符合多电商平台规范</span></DetailTile>
        </div>
      </div></div></div></main><button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md">?</button>
  </div>;
}
