import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, ChevronDown, CircleHelp, FileText, Lightbulb, Loader2, Search, Upload } from "lucide-react";
import mainHeadphone from "@/imports/image-9.png";
import sceneDisplay from "@/imports/image-10.png";
import modelScene from "@/imports/image-11.png";
import detailExplain from "@/imports/image-12.png";
import sellingPoint from "@/imports/image-13.png";
import { useSidebar } from "@/app/components/SidebarContext";

function SelectBox({ value, options, open, onToggle, onSelect }: { value: string; options: string[]; open: boolean; onToggle: () => void; onSelect: (value: string) => void }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`h-[42px] w-full rounded-[9px] bg-[#f2f4f7] px-3.5 flex items-center justify-between text-[14px] font-normal text-[#0A1B39] transition-colors ${open ? "ring-1 ring-[#3388ff] bg-white" : "hover:bg-[#eceff4]"}`}
      >
        <span>{value}</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[46px] z-30 max-h-60 overflow-y-auto rounded-xl border border-[#e5eaf2] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,41,.12)] custom-scrollbar">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`flex h-9 w-full items-center rounded-lg px-3 text-left text-[14px] font-normal transition-colors ${option === value ? "bg-[#eef5ff] text-[#3388ff]" : "text-[#485066] hover:bg-[#f5f6f8]"}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, help = false }: { children: ReactNode; help?: boolean }) {
  return <h2 className="mb-4 flex items-center gap-1 text-[14px] font-semibold tracking-[-0.01em] text-[#0A1B39]">{children}{help && <CircleHelp className="h-4 w-4 text-[#86909C]" />}</h2>;
}

function PreviewCard({ n, title, className = "", children }: { n: string; title: string; className?: string; children?: ReactNode }) {
  return <div className={`relative overflow-hidden rounded-2xl border border-[#eef1f5] bg-white shadow-[0_10px_24px_rgba(31,37,45,.08)] ${className}`}>
    <div className="absolute left-3 top-3 z-10 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-semibold text-[#667085] shadow-sm">{n} {title}</div>
    {children}
  </div>;
}

function FitImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-[#f8fafc] p-4 ${className}`}>
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

const GENERATION_OPTIONS = {
  platform: ["淘宝", "天猫", "抖音", "京东", "拼多多", "亚马逊", "TikTok", "速卖通", "Temu", "Shein", "Shopee", "Lazada", "eBay", "Walmart", "Shopify", "独立站"],
  country: ["中国", "美国", "英国", "德国", "法国", "意大利", "西班牙", "日本", "韩国", "加拿大", "澳大利亚", "新加坡", "马来西亚", "泰国", "越南", "巴西", "墨西哥"],
  language: ["英文", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "荷兰文", "波兰文", "泰文", "越南文", "印尼文"],
  ratio: ["1:1", "3:4", "4:3", "9:16", "16:9"],
};

type SuiteProduct = {
  value: string;
  label: string;
  keyword?: string;
  count: number;
  priceRange?: string;
  status?: string;
  reportId?: number;
  latestRunId?: number;
  latestAt?: string;
};

type PriceBand = {
  id: number;
  price_band: string;
  competitor_count: number;
  price_min?: number | null;
  price_max?: number | null;
  price_avg?: number | null;
  sold_count_total?: number | null;
  sales_amount_total?: number | null;
};

type MainImageDescription = {
  product_id?: string;
  title?: string;
  price?: number | null;
  sold_count?: number | null;
  sales_amount?: number | null;
  product_link?: string;
  image_url?: string;
  title_direction?: string;
  main_image_prompt?: string;
  detail_image_prompt?: string;
  buyer_show_prompt?: string;
  selling_points?: Array<{ term?: string; keyword?: string; count?: number }>;
  demands?: Array<{ term?: string; keyword?: string; count?: number }>;
};

type DescriptionPayload = {
  ok: boolean;
  band?: PriceBand & {
    image_prompts?: {
      main_image_prompt?: string;
      detail_image_prompt?: string;
      buyer_show_prompt?: string;
      title_direction?: string;
    };
    selling_points?: Array<{ term?: string; keyword?: string; count?: number }>;
    demands?: Array<{ term?: string; keyword?: string; count?: number }>;
  };
  descriptions?: MainImageDescription[];
  error?: string;
};

type ExpandedPrompt = {
  id: string;
  name: string;
  type: string;
  prompt: string;
};

type PromptExpansionPayload = {
  ok: boolean;
  information?: string;
  plan?: string;
  prompts?: ExpandedPrompt[];
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  } | null;
  error?: string;
};

type GeneratedImageResult = {
  url?: string;
  status?: "generating" | "done" | "failed";
  error?: string;
};

function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "无数据";
  return `¥${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function formatCount(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "0";
  return Number(value).toLocaleString("zh-CN");
}

function imageUrl(raw?: string) {
  const text = String(raw || "").trim();
  if (text.startsWith("//")) return `https:${text}`;
  return text;
}
 
const DEFAULT_PROMPT_PREVIEWS: ExpandedPrompt[] = [
  { id: "image-1", name: "图1｜白底图", type: "白底图", prompt: "" },
  { id: "image-2", name: "图2｜场景图", type: "场景图", prompt: "" },
  { id: "image-3", name: "图3｜卖点图", type: "卖点图", prompt: "" },
  { id: "image-4", name: "图4｜功能说明图", type: "功能说明图", prompt: "" },
  { id: "image-5", name: "图5｜细节特写图", type: "细节特写图", prompt: "" },
];

const DEFAULT_PREVIEW_IMAGES: Record<string, string> = {
  "image-1": mainHeadphone,
  "image-2": sceneDisplay,
  "image-3": sellingPoint,
  "image-4": detailExplain,
  "image-5": modelScene,
};

export function ProductImageSets() {
  const { expanded } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState("智能匹配");
  const [copy, setCopy] = useState(false);
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [settings, setSettings] = useState({ platform: "淘宝", country: "中国", language: "中文", ratio: "1:1" });
  const [productSearch, setProductSearch] = useState("");
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [suiteProducts, setSuiteProducts] = useState<SuiteProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedReportOption, setSelectedReportOption] = useState<SuiteProduct | null>(null);
  const [descriptionPayload, setDescriptionPayload] = useState<DescriptionPayload | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingDescriptions, setLoadingDescriptions] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [error, setError] = useState("");
  const [generationText, setGenerationText] = useState("");
  const [uploadedImage, setUploadedImage] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [expandingPrompts, setExpandingPrompts] = useState(false);
  const [promptExpansion, setPromptExpansion] = useState<PromptExpansionPayload | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImageResult>>({});

  const descriptions = descriptionPayload?.descriptions || [];
  const bandSummary = descriptionPayload?.band;
  const overallMainDescription = bandSummary?.image_prompts?.main_image_prompt || "";
  const expandedPrompts = promptExpansion?.prompts || [];
  const previewPrompts = expandedPrompts.length ? expandedPrompts : DEFAULT_PROMPT_PREVIEWS;
  const selectedPromptCount = expandedPrompts.length ? selectedPromptIds.length : 1;
  const selectedReport = selectedReportOption || suiteProducts.find((item) => item.value === selectedProduct) || null;
  const priceBandGenerationText = useMemo(() => {
    return overallMainDescription || "系统会只把主图生图文本传递到这里。";
  }, [overallMainDescription]);

  async function loadProducts(search = productSearch) {
    setLoadingProducts(true);
    setError("");
    try {
      const response = await fetch(`/api/product-sets/products?q=${encodeURIComponent(search)}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取商品失败");
      const products = data.products || [];
      setSuiteProducts(products);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadDescriptions(reportValue = selectedProduct) {
    if (!reportValue) return;
    setLoadingDescriptions(true);
    setError("");
    try {
      const response = await fetch(`/api/product-sets/main-image-descriptions?runId=${encodeURIComponent(reportValue)}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取主图描述失败");
      setDescriptionPayload(data);
      setPromptExpansion(null);
      setSelectedPromptId("");
      setSelectedPromptIds([]);
      setGeneratedImages({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDescriptions(false);
    }
  }

  function handleUpload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("图片太大，请上传 12MB 以内的图片");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(String(reader.result || ""));
      setUploadedFileName(file.name);
      setGeneratedImages({});
      setError("");
    };
    reader.onerror = () => setError("图片读取失败，请重新上传");
    reader.readAsDataURL(file);
  }

  async function generateMainImage() {
    if (!uploadedImage) {
      setError("请先上传商品原图");
      return;
    }
    if (!generationText.trim() && !expandedPrompts.length) {
      setError("请先填写主图提示词");
      return;
    }
    const queue = expandedPrompts.length
      ? expandedPrompts.filter((item) => selectedPromptIds.includes(item.id))
      : [{ id: "image-1", name: "图1｜白底图", type: "白底图", prompt: generationText }];
    if (!queue.length) {
      setError("请至少选择一张要生成的图片");
      return;
    }
    setGeneratingImage(true);
    setError("");
    let failedCount = 0;
    try {
      for (const item of queue) {
        setGeneratedImages((current) => ({
          ...current,
          [item.id]: { status: "generating" },
        }));
        try {
          const response = await fetch("/api/product-sets/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: item.prompt || generationText,
              image: uploadedImage,
              size: "2K",
              watermark: false,
            }),
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.error || "生成图片失败");
          const imageUrl = data.images?.[0]?.url;
          if (!imageUrl) throw new Error("生成成功但没有返回图片 URL");
          setGeneratedImages((current) => ({
            ...current,
            [item.id]: { status: "done", url: imageUrl },
          }));
        } catch (err) {
          failedCount += 1;
          setGeneratedImages((current) => ({
            ...current,
            [item.id]: { status: "failed", error: err instanceof Error ? err.message : String(err) },
          }));
        }
      }
      if (failedCount) setError(`${failedCount} 张图片生成失败，其余图片已保留在右侧。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingImage(false);
    }
  }

  async function expandPrompts() {
    if (!generationText.trim()) {
      setError("请先填写主图生图文本");
      return;
    }
    setExpandingPrompts(true);
    setError("");
    try {
      const response = await fetch("/api/product-sets/expand-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: "",
          priceBand: "",
          settings,
          baseText: generationText,
          image: uploadedImage,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "扩写提示词失败");
      const prompts: ExpandedPrompt[] = data.prompts || [];
      setPromptExpansion(data);
      setGeneratedImages({});
      const firstPrompt = prompts[0];
      if (firstPrompt?.prompt) {
        setSelectedPromptId(firstPrompt.id);
        setSelectedPromptIds([firstPrompt.id]);
        setGenerationText(firstPrompt.prompt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExpandingPrompts(false);
    }
  }

  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setOpenSetting(null);
  };

  function togglePromptSelection(id: string) {
    setSelectedPromptIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  useEffect(() => {
    loadProducts("").catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProducts(productSearch).catch(() => undefined);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  useEffect(() => {
    if (!selectedProduct) return;
    loadDescriptions(selectedProduct).catch(() => undefined);
  }, [selectedProduct]);

  useEffect(() => {
    setGenerationText(priceBandGenerationText);
  }, [priceBandGenerationText]);

  return (
    <div className="relative flex h-full bg-[#f4f7fb]">
      <div className="w-[360px] shrink-0 overflow-y-auto bg-white px-4 sm:px-6 pb-28 pt-7 custom-scrollbar">
        <SectionTitle help>商品原图</SectionTitle>
        <div className="mb-5 flex h-[132px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e4e9f1] bg-white">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleUpload(event.target.files?.[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mb-4 flex items-center gap-2 rounded-xl bg-[#f2f4f7] px-4 py-2 text-[14px] font-semibold"
          >
            <Upload className="h-5 w-5" />
            上传图片
          </button>
          <p className="max-w-[260px] truncate text-[12px] font-normal text-[#86909C]">{uploadedFileName || "同一产品，最多三张"}</p>
        </div>

        <SectionTitle help>选择AI报告</SectionTitle>
        <div className="relative mb-5">
          <button
            type="button"
            onClick={() => setProductDropdownOpen((open) => !open)}
            className={`flex h-[42px] w-full items-center justify-between rounded-[9px] bg-[#f2f4f7] px-3.5 text-[14px] font-semibold text-[#0A1B39] transition-colors ${productDropdownOpen ? "bg-white ring-1 ring-[#3388ff]" : "hover:bg-[#eceff4]"}`}
          >
            <span className={selectedReport ? "truncate" : "truncate text-[#86909C]"}>{selectedReport?.label || "选择已完成的商品报告"}</span>
            <ChevronDown className={`h-5 w-5 transition-transform ${productDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {productDropdownOpen && (
            <div className="absolute left-0 right-0 top-[48px] z-40 rounded-xl border border-[#e5eaf2] bg-white p-2 shadow-[0_12px_28px_rgba(15,23,41,.12)]">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white pl-9 pr-3 text-[13px] font-semibold text-[#0A1B39] outline-none focus:border-[#3388ff]"
                  placeholder="搜索已完成整体报告"
                  autoFocus
                />
              </div>
              <div className="max-h-[220px] space-y-1 overflow-y-auto custom-scrollbar">
                {loadingProducts && <div className="flex items-center gap-2 rounded-lg p-3 text-[13px] font-semibold text-[#667085]"><Loader2 className="h-4 w-4 animate-spin" />读取报告...</div>}
                {!loadingProducts && suiteProducts.length === 0 && <div className="rounded-lg p-3 text-[13px] font-semibold text-[#98A2B3]">暂无已完成整体报告，请先在竞品报告页完成“AI生成整体报告”。</div>}
                {!loadingProducts && suiteProducts.map((product) => (
                  <button
                    key={product.value}
                    onClick={() => {
                      setSelectedProduct(product.value);
                      setSelectedReportOption(product);
                      setProductDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${selectedProduct === product.value ? "bg-[#eef5ff] text-[#3388ff]" : "text-[#485066] hover:bg-[#f5f6f8]"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{product.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-70">
                        {product.keyword} · {product.priceRange || "-"} · {formatCount(product.count)} 个竞品
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[11px] font-bold text-[#2e7d32]">已完成</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedReport && (
            <div className="mt-2 rounded-xl bg-[#f8fafc] p-3 text-[12px] font-semibold leading-5 text-[#667085]">
              <div className="truncate text-[#0A1B39]">{selectedReport.keyword}</div>
              <div>采集范围 {selectedReport.priceRange || "-"} · 竞品 {formatCount(selectedReport.count)}</div>
              <div>报告时间 {selectedReport.latestAt || "-"}</div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-5 flex gap-2 rounded-xl border border-[#ffd7d7] bg-[#fff5f5] p-3 text-[13px] font-semibold text-[#c03535]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <SectionTitle>生成设置</SectionTitle>
        <div className="mb-6 grid grid-cols-2 gap-3.5">
          <SelectBox value={settings.platform} options={GENERATION_OPTIONS.platform} open={openSetting === "platform"} onToggle={() => setOpenSetting(openSetting === "platform" ? null : "platform")} onSelect={(value) => updateSetting("platform", value)} />
          <SelectBox value={settings.country} options={GENERATION_OPTIONS.country} open={openSetting === "country"} onToggle={() => setOpenSetting(openSetting === "country" ? null : "country")} onSelect={(value) => updateSetting("country", value)} />
          <SelectBox value={settings.language} options={GENERATION_OPTIONS.language} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(value) => updateSetting("language", value)} />
          <SelectBox value={settings.ratio} options={GENERATION_OPTIONS.ratio} open={openSetting === "ratio"} onToggle={() => setOpenSetting(openSetting === "ratio" ? null : "ratio")} onSelect={(value) => updateSetting("ratio", value)} />
        </div>

        <div className="mb-5 flex items-center justify-between">
          <SectionTitle help>商品卖点&要求</SectionTitle>
          <button
            onClick={expandPrompts}
            disabled={expandingPrompts || !generationText.trim()}
            className="mb-4 flex items-center gap-1.5 rounded-full border border-[#e8edf4] bg-white px-3 py-1.5 text-[14px] font-semibold text-[#3587ff] shadow-sm disabled:cursor-not-allowed disabled:text-[#98A2B3]"
          >
            {expandingPrompts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
            {expandingPrompts ? "扩写中" : "AI 帮写"}
          </button>
        </div>
        <textarea
          className="mb-3 h-[164px] w-full resize-none rounded-xl border border-[#e1e6ee] bg-white p-3 text-[14px] font-normal leading-7 text-[#667085] outline-none focus:border-[#4690ff]"
          value={generationText}
          onChange={(event) => setGenerationText(event.target.value)}
        />
        {promptExpansion?.prompts?.length ? (
          <div className="mb-4 rounded-xl border border-[#e4ebf5] bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#344054]">
                <FileText className="h-4 w-4 text-[#3388ff]" />
                已按主图 skill 扩写
              </div>
              <div className="flex items-center gap-2">
                {promptExpansion.usage?.total_tokens ? (
                  <span className="text-[11px] font-semibold text-[#98A2B3]">tokens {formatCount(promptExpansion.usage.total_tokens)}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedPromptIds(promptExpansion.prompts?.map((item) => item.id) || [])}
                  className="text-[11px] font-bold text-[#3388ff]"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPromptIds([])}
                  className="text-[11px] font-bold text-[#98A2B3]"
                >
                  清空
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {promptExpansion.prompts.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    togglePromptSelection(item.id);
                    setSelectedPromptId(item.id);
                    setGenerationText(item.prompt);
                  }}
                  className={`rounded-lg border px-2.5 py-2 text-left text-[12px] font-bold transition-colors ${
                    selectedPromptIds.includes(item.id) ? "border-[#3388ff] bg-[#eef6ff] text-[#3388ff]" : "border-[#eef1f5] bg-[#f8fafc] text-[#667085] hover:border-[#b8d7ff]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${selectedPromptIds.includes(item.id) ? "border-[#3388ff] bg-[#3388ff] text-white" : "border-[#d7deea] bg-white text-transparent"}`}>
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{item.name}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold opacity-70">{item.type}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] font-semibold text-[#98A2B3]">已选择 {formatCount(selectedPromptIds.length)} 张，点击卡片可选择/取消，并同步查看该图提示词。</div>
          </div>
        ) : null}
        {loadingDescriptions ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-[#f8fafc] px-3 py-2 text-[12px] font-semibold text-[#667085]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在导入主图生图文本
          </div>
        ) : (
          <div className="mb-6 rounded-xl bg-[#f8fafc] px-3 py-2 text-[12px] font-semibold text-[#86909C]">
            AI 帮写和生图只使用上方主图提示词，不会带入价格段、详情图或买家秀文本。
          </div>
        )}

        <SectionTitle>套图结构配置</SectionTitle>
        <div className="space-y-3">
          <button onClick={() => setMode("智能匹配")} className="w-full rounded-2xl bg-[#f5f6f8] p-5 text-left">
            <div className="flex items-center gap-3 text-[14px] font-normal"><span className="grid h-5 w-5 place-items-center rounded bg-[#3388ff] text-white"><Check className="h-4 w-4" /></span>智能匹配</div>
            <p className="mt-2 text-[12px] font-normal text-[#86909C]">AI智能分析商品图，匹配最佳Listing套图</p>
          </button>
          <button onClick={() => setMode("自定义配置")} className="w-full rounded-2xl bg-[#f5f6f8] p-5 text-left">
            <div className="flex items-center gap-3 text-[14px] font-normal"><span className={`h-5 w-5 rounded border ${mode === "自定义配置" ? "bg-[#3388ff] border-[#3388ff]" : "border-[#d8dde5] bg-white"}`} />自定义配置</div>
            <p className="mt-2 text-[12px] font-normal text-[#86909C]">可自由调整各类型图片数量，至少选择7张</p>
          </button>
        </div>
        <SectionTitle>附加功能</SectionTitle>
        <div className="rounded-xl bg-[#f5f6f8] p-4 flex items-center justify-between text-[14px] font-normal"><span>爆款风格分析</span><span onClick={() => setCopy(!copy)} className={`h-6 w-11 rounded-full p-0.5 ${copy ? "bg-[#3388ff]" : "bg-[#C9CDD4]"}`}><i className={`block h-5 w-5 rounded-full bg-white transition-transform ${copy ? "translate-x-5" : ""}`} /></span></div>
      </div>

      <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#eef1f5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}>
        <button
          onClick={generateMainImage}
          disabled={generatingImage || !uploadedImage || (!generationText.trim() && !expandedPrompts.length) || (Boolean(expandedPrompts.length) && selectedPromptIds.length === 0)}
          className={`h-12 sm:h-14 w-full rounded-lg text-[14px] font-semibold text-white ${generatingImage || !uploadedImage || (!generationText.trim() && !expandedPrompts.length) || (Boolean(expandedPrompts.length) && selectedPromptIds.length === 0) ? "bg-[#C9CDD4]" : "bg-[#3388ff] hover:bg-[#1f78f2]"}`}
        >
          {generatingImage ? "正在生成..." : expandedPrompts.length ? `生成已选 ${selectedPromptCount} 张` : "生成主图"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="mx-auto w-full max-w-[1480px] text-center">
          <h1 className="text-[28px] sm:text-[32px] lg:text-[36px] font-medium tracking-[-0.03em] text-[#0A1B39]">AI商品套图</h1>
          <p className="mt-3 text-[14px] sm:text-[15px] lg:text-[16px] font-normal text-[#86909C]">选择已完成整体报告后，可多选图位批量生成，右侧会展示每张生成结果。</p>

          <div className="mt-6 sm:mt-8 rounded-[20px] sm:rounded-[24px] lg:rounded-[28px] bg-white p-4 sm:p-5 lg:p-6 shadow-[0_18px_50px_rgba(29,38,52,.06)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-left">
              <div>
                <div className="text-[16px] font-bold text-[#0A1B39]">套图预览</div>
                <div className="mt-1 text-[12px] font-semibold text-[#98A2B3]">等尺寸展示每个图位，生成后会替换对应图片。</div>
              </div>
              <div className="rounded-full bg-[#f5f8ff] px-3 py-1.5 text-[12px] font-bold text-[#3388ff]">
                {previewPrompts.length} 张图位
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {previewPrompts.slice(0, 5).map((item, index) => {
                const result = generatedImages[item.id];
                const isSelected = selectedPromptIds.includes(item.id);
                const src = result?.url || (index === 0 && uploadedImage ? uploadedImage : DEFAULT_PREVIEW_IMAGES[item.id]) || mainHeadphone;
                const n = String(index + 1).padStart(2, "0");

                return (
                  <PreviewCard key={item.id} n={n} title={item.type || item.name} className="aspect-square min-h-[260px]">
                    <FitImage src={src} alt={item.name} className="pt-12" />
                    <div className={`absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm ${result?.status === "done" ? "bg-[#ECFDF3] text-[#079455]" : isSelected ? "bg-[#EFF6FF] text-[#3388ff]" : "bg-white/95 text-[#98A2B3]"}`}>
                      {result?.status === "done" ? "已生成" : isSelected ? "已选择" : "未选择"}
                    </div>
                    {result?.status === "generating" && (
                      <div className="absolute inset-0 grid place-items-center bg-white/70 text-[13px] font-bold text-[#3388ff]">
                        <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">生成中</span>
                      </div>
                    )}
                    {result?.status === "failed" && (
                      <div className="absolute inset-0 grid place-items-center bg-white/85 p-3 text-center text-[12px] font-bold text-[#c03535]">
                        {result.error || "生成失败"}
                      </div>
                    )}
                  </PreviewCard>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md">?</button>
    </div>
  );
}
