import { useState, type ReactNode } from "react";
import { Check, ChevronDown, CircleHelp, Link2, Lock, Sparkles, Upload, Video } from "lucide-react";
import { useSidebar } from "@/app/components/SidebarContext";
import image1 from "@/imports/image-1.png";
import image9 from "@/imports/image-9.png";
import image10 from "@/imports/image-10.png";
import image11 from "@/imports/image-11.png";
import image12 from "@/imports/image-12.png";
import image13 from "@/imports/image-13.png";
import image26 from "@/imports/image-26.png";
import image27 from "@/imports/image-27.png";

const VIDEO_TYPE_CARDS = [
  { label: "UGC 种草", desc: "用户视角真实分享体验", image: image11 },
  { label: "带货短剧", desc: "短剧带货情节植入", image: image26 },
  { label: "产品口播", desc: "面对镜头讲解产品卖点", image: image27 },
  { label: "产品演示", desc: "多角度展示 + 使用演示", image: image13 },
  { label: "开箱测评", desc: "真实开箱 + 功能体验", image: image9 },
  { label: "场景种草", desc: "生活场景自然融入产品", image: image10 },
  { label: "对比评测", desc: "竞品对比突出优势", image: image12 },
  { label: "教程视频", desc: "使用教程 + 技巧分享", image: image1 },
];

const MARKETS = ["北美", "欧洲", "东南亚", "日韩", "中东", "拉美", "澳洲", "全球"];
const LANGUAGES = ["英语", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "阿拉伯文", "泰文", "越南文", "印尼文"];
const RATIOS = ["TikTok/Reels · 9:16", "抖音 · 9:16", "小红书 · 9:16", "淘宝主图 · 1:1", "YouTube · 16:9", "亚马逊 · 16:9"];
const VIDEO_TYPE_OPTIONS = ["UGC 种草", "带货短剧", "产品演示", "产品口播", "TVC广告", "痛点解决", "开箱种草", "反应展示"];

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

function VideoPreviewCard({ label, desc, image, selected, onClick }: { label: string; desc: string; image: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-[290px] w-[180px] overflow-hidden rounded-[8px] bg-white text-left shadow-[0_8px_24px_rgba(29,38,52,.06)] ${selected ? "ring-2 ring-[#3388FF]" : ""}`}
    >
      <div className="relative h-[220px] w-full overflow-hidden rounded-t-[8px] bg-[#F2F4F7]">
        <img src={image} alt={label} className="block h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span className="absolute bottom-4 left-4 grid h-8 w-8 place-items-center rounded-full bg-white/25 backdrop-blur-sm">
          <Video className="h-4 w-4 text-white" />
        </span>
        {selected && (
          <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-[#3388FF] text-white">
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="h-[70px] px-4 py-3">
        <h3 className="text-[14px] font-bold text-[#171A1D]">{label}</h3>
        <p className="mt-1 text-[12px] font-normal text-[#8B949E]">{desc}</p>
      </div>
    </button>
  );
}

export function ViralVideoReplication() {
  const { expanded } = useSidebar();
  const [tab, setTab] = useState<"generate" | "replicate">("generate");
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [market, setMarket] = useState("北美");
  const [language, setLanguage] = useState("英语");
  const [ratio, setRatio] = useState("TikTok/Reels · 9:16");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["UGC 种草"]);
  const [mode, setMode] = useState<"type" | "script">("type");
  const [sellingPoints, setSellingPoints] = useState("");
  const [replicateLink, setReplicateLink] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [fissionCount, setFissionCount] = useState(1);

  const toggleType = (label: string) => {
    setSelectedTypes((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label]);
  };

  const updateSetting = (key: string, value: string) => {
    if (key === "market") setMarket(value);
    if (key === "language") setLanguage(value);
    if (key === "ratio") setRatio(value);
    setOpenSetting(null);
  };

  return (
    <div className="relative flex h-full bg-[#F2F4F7]">
      <div className="w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pb-28 pt-5 custom-scrollbar">
        <div className="mb-4 grid grid-cols-2 rounded-[8px] bg-[#F2F3F5] p-0.5 text-[13px] font-normal">
          <button onClick={() => setTab("generate")} className={`h-9 rounded-[8px] transition-all ${tab === "generate" ? "bg-white font-semibold shadow-sm" : "text-[#8B949E]"}`}>生成爆款</button>
          <button onClick={() => setTab("replicate")} className={`h-9 rounded-[8px] transition-all ${tab === "replicate" ? "bg-white font-semibold shadow-sm" : "text-[#8B949E]"}`}>爆款复刻</button>
        </div>

        {tab === "generate" ? (
          <>
            <SectionTitle help>上传产品图</SectionTitle>
            <div className="mb-4 flex h-[94px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#8CC4FF] bg-white">
              <button className="mb-3 flex h-8 items-center gap-1.5 rounded-[8px] bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]">
                <Upload className="h-4 w-4" />
                上传产品图
              </button>
              <p className="text-[12px] font-normal text-[#8B949E]">点击或拖拽上传</p>
              <p className="text-[12px] font-normal text-[#8B949E]">建议上传多张不同角度的白底图</p>
            </div>

            <SectionTitle>目标市场与语言</SectionTitle>
            <div className="mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectBox value={market} options={MARKETS} open={openSetting === "market"} onToggle={() => setOpenSetting(openSetting === "market" ? null : "market")} onSelect={(value) => updateSetting("market", value)} />
                <SelectBox value={language} options={LANGUAGES} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(value) => updateSetting("language", value)} />
              </div>
              <SelectBox value={ratio} options={RATIOS} open={openSetting === "ratio"} onToggle={() => setOpenSetting(openSetting === "ratio" ? null : "ratio")} onSelect={(value) => updateSetting("ratio", value)} />
            </div>

            <SectionTitle help>商品卖点</SectionTitle>
            <button className="mb-2 flex h-7 items-center gap-1 rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              AI 帮写
            </button>
            <textarea
              value={sellingPoints}
              onChange={(event) => setSellingPoints(event.target.value)}
              className="mb-4 h-[80px] w-full resize-none rounded-[8px] border border-[#DDE3EC] p-3 text-[12px] font-normal leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]"
              placeholder="输入商品核心卖点、适用人群、使用场景等信息..."
            />

            <SectionTitle>视频类型</SectionTitle>
            <div className="mb-3 grid grid-cols-2 rounded-[8px] bg-[#F2F3F5] p-0.5 text-[13px] font-normal">
              <button onClick={() => setMode("type")} className={`h-9 rounded-[8px] transition-all ${mode === "type" ? "bg-white font-semibold shadow-sm" : "text-[#8B949E]"}`}>视频类型</button>
              <button onClick={() => setMode("script")} className={`h-9 rounded-[8px] transition-all ${mode === "script" ? "bg-white font-semibold shadow-sm" : "text-[#8B949E]"}`}>自定义脚本</button>
            </div>
            {mode === "type" ? (
              <div className="mb-4 grid grid-cols-2 gap-2">
                {VIDEO_TYPE_OPTIONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleType(item)}
                    className={`h-9 rounded-[8px] px-3 text-left text-[13px] font-semibold transition-all ${selectedTypes.includes(item) ? "bg-[#EEF5FF] text-[#3388FF] ring-1 ring-[#3388FF]" : "bg-[#F2F3F5] text-[#485066]"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : (
              <textarea className="mb-4 h-[100px] w-full resize-none rounded-[8px] border border-[#DDE3EC] p-3 text-[12px] font-normal leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]" placeholder="输入你的视频脚本内容..." />
            )}
          </>
        ) : (
          <>
            <SectionTitle help>上传素材</SectionTitle>
            <div className="mb-4 flex h-[94px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#8CC4FF] bg-white">
              <button className="mb-2 flex h-8 items-center gap-1.5 rounded-[8px] bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]">
                <Upload className="h-4 w-4" />
                上传产品图
              </button>
              <p className="text-[12px] font-normal text-[#8B949E]">建议上传多张不同角度的白底图</p>
            </div>

            <SectionTitle>上传参考视频</SectionTitle>
            <div className="mb-4 flex h-[94px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#E3E7EF] bg-white">
              <button className="mb-2 flex h-8 items-center gap-1.5 rounded-[8px] bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]">
                <Upload className="h-4 w-4" />
                上传参考视频
              </button>
              <p className="px-4 text-center text-[11px] font-normal text-[#8B949E]">AI会深度复刻原片结构、情绪与风格。</p>
            </div>

            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B949E]" />
                <input
                  type="text"
                  value={replicateLink}
                  onChange={(event) => setReplicateLink(event.target.value)}
                  placeholder="支持导入TikTok、抖音、小红书链接。"
                  className="h-10 w-full rounded-[8px] border border-[#DDE3EC] bg-[#F9FAFB] pl-9 pr-3 text-[12px] outline-none focus:border-[#4690FF] focus:bg-white"
                />
              </div>
              <button className="h-10 shrink-0 rounded-[8px] bg-[#F2F3F5] px-4 text-[13px] font-semibold text-[#171A1D]">导入</button>
            </div>
            <label className="mb-4 flex items-start gap-2 text-[12px] text-[#8B949E]">
              <input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-[#D0D5DD] accent-[#3388FF]" />
              <span>我已获得使用该链接内容的必要授权，且依法有权对其进行使用。</span>
            </label>

            <SectionTitle>目标市场与语言</SectionTitle>
            <div className="mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectBox value={market} options={MARKETS} open={openSetting === "market"} onToggle={() => setOpenSetting(openSetting === "market" ? null : "market")} onSelect={(value) => updateSetting("market", value)} />
                <SelectBox value={language} options={LANGUAGES} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(value) => updateSetting("language", value)} />
              </div>
              <SelectBox value={ratio} options={RATIOS} open={openSetting === "ratio"} onToggle={() => setOpenSetting(openSetting === "ratio" ? null : "ratio")} onSelect={(value) => updateSetting("ratio", value)} />
            </div>

            <SectionTitle help>商品卖点（可选）</SectionTitle>
            <textarea className="mb-4 h-[80px] w-full resize-none rounded-[8px] border border-[#DDE3EC] p-3 text-[12px] font-normal leading-5 text-[#5F6B7A] outline-none focus:border-[#4690FF]" placeholder="输入商品核心卖点，或重点复刻的内容。" />

            <SectionTitle>爆款裂变</SectionTitle>
            <div className="mb-4 rounded-[8px] bg-[#F2F3F5] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-[#171A1D]">爆款裂变</h3>
                  <p className="mt-1 text-[12px] text-[#8B949E]">基于参考视频生成多版本差异化内容</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setFissionCount(Math.max(1, fissionCount - 1))} className="grid h-8 w-8 place-items-center rounded-[8px] bg-white text-[#8B949E] shadow-sm">-</button>
                  <span className="w-6 text-center text-[14px] font-bold text-[#171A1D]">{fissionCount}</span>
                  <button onClick={() => setFissionCount(fissionCount + 1)} className="grid h-8 w-8 place-items-center rounded-[8px] bg-white text-[#8B949E] shadow-sm">+</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#EEF1F5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}>
        <button className="flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#C4C6CA] text-[13px] font-semibold text-white">
          <Lock className="h-4 w-4" />
          {tab === "generate" ? "生成 15s 爆款视频" : `复制 15s 爆款视频（共 ${fissionCount} 条）`}
          <span className="rounded bg-white/20 px-2 py-0.5 text-[11px]">{tab === "generate" ? "解锁权益" : "首条折扣"}</span>
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="flex min-h-full items-center justify-center">
          <div className="w-full max-w-[1040px] pb-10 text-center">
            <h1 className="text-[32px] font-bold leading-tight text-[#171A1D]">爆款视频复刻</h1>
            <p className="mt-3 text-[14px] font-normal leading-6 text-[#5F6B7A]">上传商品图，AI 一键批量生成多类型高转化视频。</p>

            <div className="mt-12 mx-auto w-[864px] rounded-[20px] bg-white p-8 shadow-[0_18px_40px_rgba(31,37,45,.06)]">
              <div className="grid grid-cols-4 gap-4">
                {VIDEO_TYPE_CARDS.map((item) => (
                  <VideoPreviewCard
                    key={item.label}
                    label={item.label}
                    desc={item.desc}
                    image={item.image}
                    selected={selectedTypes.includes(item.label)}
                    onClick={() => toggleType(item.label)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md">?</button>
    </div>
  );
}
