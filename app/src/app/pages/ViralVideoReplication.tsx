import { useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, CircleHelp, Link2, Lock, Play, Sparkles, Upload, Video } from "lucide-react";
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
const VIDEO_TYPES = [
  { label: "UGC 种草", desc: "用户视角真实分享体验", image: image11 },
  { label: "带货短剧", desc: "短剧带货情节植入", image: image26 },
  { label: "产品口播", desc: "面对镜头讲解产品卖点", image: image27 },
  { label: "产品演示", desc: "多角度展示 + 使用演示", image: image13 },
  { label: "开箱测评", desc: "真实开箱 + 功能体验", image: image9 },
  { label: "场景种草", desc: "生活场景自然融入产品", image: image10 },
  { label: "对比评测", desc: "竞品对比突出优势", image: image12 },
  { label: "教程视频", desc: "使用教程 + 技巧分享", image: image1 },
];

const VIDEO_TYPE_OPTIONS = ["UGC 种草", "带货短剧", "产品演示", "产品口播", "TVC广告", "痛点解决", "开箱种草", "反应展示"];

const MARKETS = ["北美", "欧洲", "东南亚", "日韩", "中东", "拉美", "澳洲", "全球"];
const LANGUAGES = ["英语", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "阿拉伯文", "泰文", "越南文", "印尼文"];
const RATIOS = ["TikTok/Reels · 9:16", "抖音 · 9:16", "小红书 · 9:16", "淘宝主图 · 1:1", "YouTube · 16:9", "亚马逊 · 16:9"];
const GENDERS = ["女", "男", "不限"];
const AGES = ["青少年", "青年", "中年", "老年"];
const ETHNICITIES = ["欧美白人", "亚洲人", "非裔", "拉丁裔", "中东人", "混血"];
const BODY_TYPES = ["纤细", "标准", "健美", "丰满"];

/* ─ 复刻示例数据 ── */
const REPLICATE_EXAMPLES = [
  { refVideo: "/videos/参考视频1.mp4", refLabel: "参考视频", productImage: image13, productLabel: "商品图", resultVideo: "/videos/复刻视频1.mp4", resultLabel: "复刻视频" },
  { refVideo: "/videos/参考视频2.mp4", refLabel: "参考视频", productImage: image12, productLabel: "商品图", resultVideo: "/videos/复刻视频2.mp4", resultLabel: "复刻视频" },
];

/* ── 视频类型卡片数据（含视频） ── */
const VIDEO_TYPE_CARDS = [
  { label: "UGC 种草", desc: "用户视角真实分享体验", video: "/videos/UGC种草.mp4", image: image11 },
  { label: "带货短剧", desc: "短剧带货情节植入", video: "/videos/带货短剧.mov", image: image26 },
  { label: "产品口播", desc: "面对镜头讲解产品卖点", video: "/videos/产品口播.mp4", image: image27 },
  { label: "产品演示", desc: "多角度展示 + 使用演示", video: "/videos/产品种草.mp4", image: image13 },
  { label: "开箱测评", desc: "真实开箱 + 功能体验", image: image9 },
  { label: "场景种草", desc: "生活场景自然融入产品", image: image10 },
  { label: "对比评测", desc: "竞品对比突出优势", image: image12 },
  { label: "教程视频", desc: "使用教程 + 技巧分享", image: image1 },
];

/* ── 小组件 ─ */
function Title({ children, help = false }: { children: ReactNode; help?: boolean }) {
  return <h2 className="mb-3 flex items-center gap-1 text-[14px] font-semibold text-[#0A1B39]">{children}{help && <CircleHelp className="h-4 w-4 text-[#86909C]" />}</h2>;
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

function VideoTypeCard({ label, desc, image, video, selected, onClick }: { label: string; desc: string; image: string; video?: string; selected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative overflow-hidden rounded-2xl bg-white text-left transition-all hover:shadow-[0_8px_24px_rgba(29,38,52,.1)] ${selected ? "ring-2 ring-[#3388ff] shadow-[0_4px_16px_rgba(47,130,255,.15)]" : "shadow-[0_2px_8px_rgba(29,38,52,.04)]"}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-2xl bg-[#f2f4f7]">
        {video && hovered ? (
          <video src={video} autoPlay loop muted playsInline className="h-full w-full object-cover" />
        ) : (
          <img src={image} alt={label} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <div className="absolute bottom-0 left-0 grid h-8 w-8 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
            <Video className="h-4 w-4 text-white" />
          </div>
        </div>
        {selected && (
          <div className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[#3388ff] text-white">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-[13px] font-bold text-[#0A1B39]">{label}</h3>
        <p className="mt-0.5 text-[11px] text-[#86909C]">{desc}</p>
      </div>
    </button>
  );
}

function ReplicatePairCard({ refVideo, refLabel, productImage, productLabel, resultVideo, resultLabel }: { refVideo: string; refLabel: string; productImage: string; productLabel: string; resultVideo: string; resultLabel: string }) {
  return (
    <div className="flex items-center gap-3">
      {/* 参考视频 */}
      <div className="relative flex-1 overflow-hidden rounded-2xl bg-[#f2f4f7]">
        <div className="relative aspect-[3/4] overflow-hidden">
          <video src={refVideo} autoPlay loop muted playsInline className="h-full w-full object-cover" />
          <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">{productLabel}</div>
          <div className="absolute inset-x-2 bottom-8 flex justify-center">
            <img src={productImage} alt={productLabel} className="h-12 w-12 rounded-lg border-2 border-white object-cover shadow-md" />
          </div>
        </div>
        <div className="p-2.5 text-center text-[12px] font-semibold text-[#0A1B39]">{refLabel}</div>
      </div>
      {/* 箭头 */}
      <ArrowRight className="h-6 w-6 shrink-0 text-[#c8d3e2]" />
      {/* 复刻视频 */}
      <div className="relative flex-1 overflow-hidden rounded-2xl bg-[#f2f4f7]">
        <div className="relative aspect-[3/4] overflow-hidden">
          <video src={resultVideo} autoPlay loop muted playsInline className="h-full w-full object-cover" />
        </div>
        <div className="p-2.5 text-center text-[12px] font-semibold text-[#0A1B39]">{resultLabel}</div>
      </div>
    </div>
  );
}

/* ── 主页面 ── */
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

  /* 定制专属模特 */
  const [customModelEnabled, setCustomModelEnabled] = useState(false);
  const [modelTab, setModelTab] = useState<"preset" | "my">("preset");
  const [modelGender, setModelGender] = useState("女");
  const [modelAge, setModelAge] = useState("青少年");
  const [modelEthnicity, setModelEthnicity] = useState("欧美白人");
  const [modelBodyType, setModelBodyType] = useState("纤细");
  const [modelDetails, setModelDetails] = useState("");

  /* 爆款复刻专用 */
  const [replicateLink, setReplicateLink] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [fissionCount, setFissionCount] = useState(1);

  const toggleType = (label: string) => {
    setSelectedTypes((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  };

  const updateSetting = (key: string, value: string) => {
    if (key === "market") setMarket(value);
    if (key === "language") setLanguage(value);
    if (key === "ratio") setRatio(value);
    setOpenSetting(null);
  };

  return (
    <div className="relative flex h-full bg-[#f4f7fb]">
      {/* ─── 左侧配置面板 ─── */}
      <div className="w-[360px] shrink-0 overflow-y-auto bg-white px-4 sm:px-6 pb-28 pt-7 custom-scrollbar">
        {/* Tab 切换 */}
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#f2f4f7] p-0.5 text-[14px] font-normal">
          <button onClick={() => setTab("generate")} className={`h-10 rounded-[10px] transition-all ${tab === "generate" ? "bg-white shadow-sm font-semibold" : "text-[#86909C]"}`}>生成爆款</button>
          <button onClick={() => setTab("replicate")} className={`h-10 rounded-[10px] transition-all ${tab === "replicate" ? "bg-white shadow-sm font-semibold" : "text-[#86909C]"}`}>爆款复刻</button>
        </div>

        {/* ===== 生成爆款 Tab ===== */}
        {tab === "generate" && (
          <>
            {/* 上传产品图 */}
            <Title help>上传产品图</Title>
            <div className="mb-6 flex h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#8cc4ff] bg-white">
              <button className="mb-3 flex items-center gap-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[14px] font-semibold hover:bg-[#eceff4]">
                <Upload className="h-4 w-4" />
                上传产品图
              </button>
              <p className="text-[12px] font-normal text-[#86909C]">点击或拖拽上传</p>
              <p className="text-[12px] font-normal text-[#86909C]">建议上传多张不同角度的白底图</p>
            </div>

            {/* 目标市场与语言 */}
            <Title>目标市场与语言</Title>
            <div className="mb-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectBox value={market} options={MARKETS} open={openSetting === "market"} onToggle={() => setOpenSetting(openSetting === "market" ? null : "market")} onSelect={(v) => updateSetting("market", v)} />
                <SelectBox value={language} options={LANGUAGES} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(v) => updateSetting("language", v)} />
              </div>
              <SelectBox value={ratio} options={RATIOS} open={openSetting === "ratio"} onToggle={() => setOpenSetting(openSetting === "ratio" ? null : "ratio")} onSelect={(v) => updateSetting("ratio", v)} />
            </div>

            {/* 商品卖点 */}
            <Title help>商品卖点</Title>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <button className="flex items-center gap-1.5 rounded-lg bg-[#f2f4f7] px-3 py-1.5 text-[12px] font-semibold text-[#3388ff] hover:bg-[#eceff4]">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI 帮写
                </button>
              </div>
              <textarea
                value={sellingPoints}
                onChange={(e) => setSellingPoints(e.target.value)}
                className="h-[80px] w-full resize-none rounded-xl border border-[#e1e6ee] p-3 text-[14px] font-normal text-[#86909C] outline-none transition-colors focus:border-[#3388ff]"
                placeholder="输入商品核心卖点、适用人群、使用场景等信息..."
              />
            </div>

            {/* 视频类型 */}
            <Title>视频类型</Title>
            <div className="mb-6">
              <div className="mb-3 grid grid-cols-2 rounded-xl bg-[#f2f4f7] p-0.5 text-[13px] font-normal">
                <button onClick={() => setMode("type")} className={`h-9 rounded-[8px] transition-all ${mode === "type" ? "bg-white shadow-sm font-semibold" : "text-[#86909C]"}`}>视频类型</button>
                <button onClick={() => setMode("script")} className={`h-9 rounded-[8px] transition-all ${mode === "script" ? "bg-white shadow-sm font-semibold" : "text-[#86909C]"}`}>自定义脚本</button>
              </div>
              {mode === "type" && (
                <div className="grid grid-cols-2 gap-2">
                  {VIDEO_TYPE_OPTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className={`h-10 rounded-lg px-3 text-[13px] font-semibold transition-all text-left ${selectedTypes.includes(t) ? "bg-[#eef5ff] text-[#3388ff] ring-1 ring-[#3388ff]" : "bg-[#f2f4f7] text-[#485066] hover:bg-[#eceff4]"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {mode === "script" && (
                <textarea className="h-[100px] w-full resize-none rounded-xl border border-[#e1e6ee] p-3 text-[14px] font-normal text-[#86909C] outline-none transition-colors focus:border-[#3388ff]" placeholder="输入你的视频脚本内容..." />
              )}
            </div>

            {/* 定制专属模特 */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-[#0A1B39]">定制专属模特</h2>
                <button
                  onClick={() => setCustomModelEnabled(!customModelEnabled)}
                  className={`relative h-[22px] w-[42px] rounded-full transition-colors ${customModelEnabled ? "bg-[#3388ff]" : "bg-[#d0d5dd]"}`}
                >
                  <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${customModelEnabled ? "left-[22px]" : "left-[2px]"}`} />
                </button>
              </div>
              {customModelEnabled && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 rounded-xl bg-[#f2f4f7] p-0.5 text-[13px] font-normal">
                    <button onClick={() => setModelTab("preset")} className={`h-9 rounded-[8px] transition-all ${modelTab === "preset" ? "bg-white shadow-sm font-semibold" : "text-[#86909C]"}`}>定制达人</button>
                    <button onClick={() => setModelTab("my")} className={`h-9 rounded-[8px] transition-all ${modelTab === "my" ? "bg-white shadow-sm font-semibold" : "text-[#86909C]"}`}>我的达人</button>
                  </div>
                  {modelTab === "preset" ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <SelectBox value={modelGender} options={GENDERS} open={openSetting === "modelGender"} onToggle={() => setOpenSetting(openSetting === "modelGender" ? null : "modelGender")} onSelect={(v) => { setModelGender(v); setOpenSetting(null); }} />
                        <SelectBox value={modelAge} options={AGES} open={openSetting === "modelAge"} onToggle={() => setOpenSetting(openSetting === "modelAge" ? null : "modelAge")} onSelect={(v) => { setModelAge(v); setOpenSetting(null); }} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <SelectBox value={modelEthnicity} options={ETHNICITIES} open={openSetting === "modelEthnicity"} onToggle={() => setOpenSetting(openSetting === "modelEthnicity" ? null : "modelEthnicity")} onSelect={(v) => { setModelEthnicity(v); setOpenSetting(null); }} />
                        <SelectBox value={modelBodyType} options={BODY_TYPES} open={openSetting === "modelBodyType"} onToggle={() => setOpenSetting(openSetting === "modelBodyType" ? null : "modelBodyType")} onSelect={(v) => { setModelBodyType(v); setOpenSetting(null); }} />
                      </div>
                      <textarea
                        value={modelDetails}
                        onChange={(e) => setModelDetails(e.target.value)}
                        className="h-[60px] w-full resize-none rounded-xl border border-[#e1e6ee] p-3 text-[13px] font-normal text-[#86909C] outline-none transition-colors focus:border-[#3388ff]"
                        placeholder="例如：小麦色皮肤、齐刘海、眼角有泪痣..."
                      />
                    </>
                  ) : (
                    <div className="flex h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e4e9f1] bg-[#f9fafb]">
                      <button className="mb-2 flex items-center gap-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[13px] font-semibold hover:bg-[#eceff4]">
                        <Upload className="h-4 w-4" />
                        上传达人
                      </button>
                      <p className="text-[12px] font-normal text-[#86909C]">上传达人照片或视频</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== 爆款复刻 Tab ===== */}
        {tab === "replicate" && (
          <>
            {/* 上传素材 */}
            <Title help>上传素材</Title>
            {/* 上传产品图 */}
            <div className="mb-5 flex h-[120px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#8cc4ff] bg-white">
              <button className="mb-2 flex items-center gap-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[13px] font-semibold hover:bg-[#eceff4]">
                <Upload className="h-4 w-4" />
                上传产品图
              </button>
              <p className="text-[12px] font-normal text-[#86909C]">点击或拖拽上传</p>
              <p className="text-[12px] font-normal text-[#86909C]">建议上传多张不同角度的白底图</p>
            </div>

            {/* 上传参考视频 */}
            <Title>上传参考视频</Title>
            <div className="mb-4 flex h-[120px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e4e9f1] bg-white">
              <button className="mb-2 flex items-center gap-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[13px] font-semibold hover:bg-[#eceff4]">
                <Upload className="h-4 w-4" />
                上传参考视频
              </button>
              <p className="text-[11px] font-normal text-[#86909C] text-center px-4">AI会深度复刻原片结构、情绪与风格，</p>
              <p className="text-[11px] font-normal text-[#86909C] text-center px-4">视频过长时会转写为适合15秒的剧情。</p>
            </div>

            {/* 链接导入 */}
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909C]" />
                <input
                  type="text"
                  value={replicateLink}
                  onChange={(e) => setReplicateLink(e.target.value)}
                  placeholder="支持导入TikTok、抖音、小红书链接。"
                  className="h-10 w-full rounded-lg border border-[#e1e6ee] bg-[#f9fafb] pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[#3388ff] focus:bg-white"
                />
              </div>
              <button className="h-10 shrink-0 rounded-lg bg-[#f2f4f7] px-4 text-[13px] font-semibold text-[#0A1B39] hover:bg-[#eceff4]">导入</button>
            </div>
            <label className="mb-6 flex items-start gap-2 text-[12px] text-[#86909C]">
              <input
                type="checkbox"
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-[#d0d5dd] accent-[#3388ff]"
              />
              <span>我已获得使用该链接内容的必要授权，且依法有权对其进行使用。</span>
            </label>

            {/* 目标市场与语言 */}
            <Title>目标市场与语言</Title>
            <div className="mb-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectBox value={market} options={MARKETS} open={openSetting === "market"} onToggle={() => setOpenSetting(openSetting === "market" ? null : "market")} onSelect={(v) => updateSetting("market", v)} />
                <SelectBox value={language} options={LANGUAGES} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(v) => updateSetting("language", v)} />
              </div>
              <SelectBox value={ratio} options={RATIOS} open={openSetting === "ratio"} onToggle={() => setOpenSetting(openSetting === "ratio" ? null : "ratio")} onSelect={(v) => updateSetting("ratio", v)} />
            </div>

            {/* 商品卖点（可选） */}
            <Title help>商品卖点（可选）</Title>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <button className="flex items-center gap-1.5 rounded-lg bg-[#f2f4f7] px-3 py-1.5 text-[12px] font-semibold text-[#3388ff] hover:bg-[#eceff4]">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI 帮写
                </button>
              </div>
              <textarea
                className="h-[80px] w-full resize-none rounded-xl border border-[#e1e6ee] p-3 text-[14px] font-normal text-[#86909C] outline-none transition-colors focus:border-[#3388ff]"
                placeholder="输入商品核心卖点，或重点复刻的内容。"
              />
            </div>

            {/* 爆款裂变 */}
            <Title>爆款裂变</Title>
            <div className="mb-6 rounded-xl border border-[#eef1f5] bg-[#f9fafb] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-bold text-[#0A1B39]">爆款裂变</h3>
                  <p className="mt-1 text-[12px] text-[#86909C]">基于参考视频生成多版本差异化内容</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFissionCount(Math.max(1, fissionCount - 1))}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#86909C] shadow-sm hover:bg-[#f2f4f7]"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-[14px] font-bold text-[#0A1B39]">{fissionCount}</span>
                  <button
                    onClick={() => setFissionCount(fissionCount + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#86909C] shadow-sm hover:bg-[#f2f4f7]"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* 定制专属模特 */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-[#0A1B39]">定制专属模特</h2>
                <button
                  onClick={() => setCustomModelEnabled(!customModelEnabled)}
                  className={`relative h-[22px] w-[42px] rounded-full transition-colors ${customModelEnabled ? "bg-[#3388ff]" : "bg-[#d0d5dd]"}`}
                >
                  <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${customModelEnabled ? "left-[22px]" : "left-[2px]"}`} />
                </button>
              </div>
              {customModelEnabled && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 rounded-xl bg-[#f2f4f7] p-0.5 text-[13px] font-normal">
                    <button onClick={() => setModelTab("preset")} className={`h-9 rounded-[8px] transition-all ${modelTab === "preset" ? "bg-white shadow-sm font-semibold" : "text-[#86909C]"}`}>定制达人</button>
                    <button onClick={() => setModelTab("my")} className={`h-9 rounded-[8px] transition-all ${modelTab === "my" ? "bg-white shadow-sm font-semibold" : "text-[#86909C]"}`}>我的达人</button>
                  </div>
                  {modelTab === "preset" ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <SelectBox value={modelGender} options={GENDERS} open={openSetting === "modelGender"} onToggle={() => setOpenSetting(openSetting === "modelGender" ? null : "modelGender")} onSelect={(v) => { setModelGender(v); setOpenSetting(null); }} />
                        <SelectBox value={modelAge} options={AGES} open={openSetting === "modelAge"} onToggle={() => setOpenSetting(openSetting === "modelAge" ? null : "modelAge")} onSelect={(v) => { setModelAge(v); setOpenSetting(null); }} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <SelectBox value={modelEthnicity} options={ETHNICITIES} open={openSetting === "modelEthnicity"} onToggle={() => setOpenSetting(openSetting === "modelEthnicity" ? null : "modelEthnicity")} onSelect={(v) => { setModelEthnicity(v); setOpenSetting(null); }} />
                        <SelectBox value={modelBodyType} options={BODY_TYPES} open={openSetting === "modelBodyType"} onToggle={() => setOpenSetting(openSetting === "modelBodyType" ? null : "modelBodyType")} onSelect={(v) => { setModelBodyType(v); setOpenSetting(null); }} />
                      </div>
                      <textarea
                        value={modelDetails}
                        onChange={(e) => setModelDetails(e.target.value)}
                        className="h-[60px] w-full resize-none rounded-xl border border-[#e1e6ee] p-3 text-[13px] font-normal text-[#86909C] outline-none transition-colors focus:border-[#3388ff]"
                        placeholder="例如：小麦色皮肤、齐刘海、眼角有泪痣..."
                      />
                    </>
                  ) : (
                    <div className="flex h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e4e9f1] bg-[#f9fafb]">
                      <button className="mb-2 flex items-center gap-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[13px] font-semibold hover:bg-[#eceff4]">
                        <Upload className="h-4 w-4" />
                        上传达人
                      </button>
                      <p className="text-[12px] font-normal text-[#86909C]">上传达人照片或视频</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── 底部操作按钮 ─── */}
      <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#eef1f5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}>
        {tab === "generate" ? (
          <button className="flex h-12 sm:h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#C9CDD4] text-[14px] font-semibold text-white">
            <Lock className="h-4 w-4" />
            生成 15s 爆款视频
            <span className="rounded bg-white/20 px-2 py-0.5 text-[11px]">解锁权益</span>
          </button>
        ) : (
          <button className="flex h-12 sm:h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#C9CDD4] text-[14px] font-semibold text-white">
            <Lock className="h-4 w-4" />
            复制 15s 爆款视频（共 {fissionCount} 条）
            <span className="rounded bg-white/20 px-2 py-0.5 text-[11px]">首条折扣</span>
          </button>
        )}
      </div>

      {/* ── 右侧主内容区 ─── */}
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {tab === "generate" ? (
          <>
            <div className="w-full text-center">
              <h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-extrabold tracking-[-0.03em] text-[#0A1B39]">爆款电商视频</h1>
              <p className="mt-3 text-[14px] sm:text-[15px] lg:text-[16px] font-normal text-[#86909C]">上传商品图，AI 一键批量生成多类型高转化视频。</p>
            </div>
            <div className="mt-8 rounded-[20px] sm:rounded-[24px] bg-white p-4 sm:p-6 shadow-[0_18px_50px_rgba(29,38,52,.06)]">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {VIDEO_TYPE_CARDS.map((vt) => (
                  <VideoTypeCard
                    key={vt.label}
                    label={vt.label}
                    desc={vt.desc}
                    image={vt.image}
                    video={vt.video}
                    selected={selectedTypes.includes(vt.label)}
                    onClick={() => toggleType(vt.label)}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-full text-center">
              <h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-extrabold tracking-[-0.03em] text-[#0A1B39]">爆款视频复刻</h1>
              <p className="mt-3 text-[14px] sm:text-[15px] lg:text-[16px] font-normal text-[#86909C]">上传商品图和参考视频，AI 一键批量复刻高转化视频。</p>
            </div>
            <div className="mt-8 rounded-[20px] sm:rounded-[24px] bg-white p-4 sm:p-6 shadow-[0_18px_50px_rgba(29,38,52,.06)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {REPLICATE_EXAMPLES.map((ex, i) => (
                  <ReplicatePairCard
                    key={i}
                    refVideo={ex.refVideo}
                    refLabel={ex.refLabel}
                    productImage={ex.productImage}
                    productLabel={ex.productLabel}
                    resultVideo={ex.resultVideo}
                    resultLabel={ex.resultLabel}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* ─── 右下角帮助按钮 ─── */}
      <button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md flex items-center justify-center text-[#86909C]">?</button>
    </div>
  );
}
