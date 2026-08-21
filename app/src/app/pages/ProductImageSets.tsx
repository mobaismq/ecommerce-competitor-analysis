import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AlertCircle, Check, ChevronDown, Download, Lightbulb, Loader2, Minus, PenLine, Plus, Sparkles, Trash2, Upload, X, ZoomIn } from "lucide-react";
import mainHeadphone from "@/imports/image-9.png";
import sceneDisplay from "@/imports/image-10.png";
import modelScene from "@/imports/image-11.png";
import detailExplain from "@/imports/image-12.png";
import sellingPoint from "@/imports/image-13.png";
import suiteArrow from "@/imports/箭头.svg";
import { useSidebar } from "@/app/components/SidebarContext";
import { AIReportSelector, SectionTitle, type SuiteProduct } from "@/app/components/AIReportSelector";

function SelectBox({ value, options, open, onToggle, onSelect }: { value: string; options: string[]; open: boolean; onToggle: () => void; onSelect: (value: string) => void }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`h-[30px] w-full rounded-[8px] bg-[#f2f3f5] px-3 flex items-center justify-between text-[13px] font-normal text-[#171A1D] transition-colors ${open ? "ring-1 ring-[#3388ff] bg-white" : "hover:bg-[#eceff4]"}`}
      >
        <span>{value}</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[34px] z-30 max-h-60 overflow-y-auto rounded-[8px] border border-[#e5eaf2] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,41,.12)] custom-scrollbar">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={`flex h-9 w-full items-center rounded-[8px] px-3 text-left text-[14px] font-normal transition-colors ${option === value ? "bg-[#eef5ff] text-[#3388ff]" : "text-[#485066] hover:bg-[#f5f6f8]"}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const GENERATION_OPTIONS = {
  platform: ["淘宝天猫1688", "淘宝", "天猫", "抖音", "京东", "拼多多", "亚马逊", "TikTok", "速卖通", "Temu", "Shein", "Shopee", "Lazada", "eBay", "Walmart", "Shopify", "独立站"],
  country: ["中国", "美国", "英国", "德国", "法国", "意大利", "西班牙", "日本", "韩国", "加拿大", "澳大利亚", "新加坡", "马来西亚", "泰国", "越南", "巴西", "墨西哥"],
  language: ["英文", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "荷兰文", "波兰文", "泰文", "越南文", "印尼文"],
  ratio: ["1:1", "3:4", "4:3", "9:16", "16:9"],
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

type ListingMainSellingPoint = {
  priority?: number;
  title?: string;
  customerBenefit?: string;
  visualExpression?: string;
  dataBasis?: string;
  source?: string[];
};

type DescriptionPayload = {
  ok: boolean;
  report?: {
    id?: number;
    keyword?: string;
    title?: string;
    priceRange?: string;
    competitorCount?: number;
    source?: string;
  } | null;
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
  listingSellingPoints?: {
    source?: string;
    summary?: string;
    mainImageSellingPoints?: ListingMainSellingPoint[];
  };
  mainImagePromptSeed?: string;
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
  fileUrl?: string;
  status?: "generating" | "done" | "failed";
  error?: string;
};

type UploadedProductImage = {
  id: string;
  name: string;
  url: string;
};

type GenerationSlot = ExpandedPrompt & {
  typeKey?: CustomSuiteTypeKey;
};

type AiHelpStatus = "idle" | "thinking" | "writing" | "ready" | "error";

type AiHelpStreamEvent =
  | { type: "thinking"; text?: string }
  | { type: "content"; text?: string }
  | { type: "done"; text?: string }
  | { type: "error"; error?: string };

type EditableTextField = {
  id: string;
  original: string;
  value: string;
  removed: boolean;
};

type GenerationActionPanel =
  | { kind: "text"; slotId: string; title: string; top: number; left: number; fields: EditableTextField[]; loading: boolean; error?: string; originalCount: number }
  | { kind: "image"; slotId: string; title: string; top: number; left: number; direction: string };

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

const AI_HELP_INFORMATION_FIELDS = [
  { key: "name", label: "产品名称", aliases: ["产品名称", "商品名称"] },
  { key: "sellingPoints", label: "核心卖点", aliases: ["核心卖点", "商品卖点", "卖点"] },
  { key: "audience", label: "适用人群", aliases: ["适用人群", "目标人群"] },
  { key: "scenario", label: "期望场景", aliases: ["期望场景", "使用场景", "适用场景"] },
  { key: "specs", label: "具体参数", aliases: ["具体参数", "规格参数", "商品参数"] },
] as const;
const AI_HELP_INFORMATION_FALLBACKS: Partial<Record<(typeof AI_HELP_INFORMATION_FIELDS)[number]["key"], string>> = {
  name: "根据商品图片识别的产品",
  sellingPoints: "外观精致，细节清晰，适合商品主图展示",
  audience: "日常消费人群、礼赠需求人群、风格穿搭人群",
  scenario: "日常使用、通勤出行、礼赠搭配",
  specs: "以商品图片可见信息和用户补充内容为准",
};
const AI_HELP_INFORMATION_ALIAS_TO_KEY = new Map(
  AI_HELP_INFORMATION_FIELDS.flatMap((field) => field.aliases.map((alias) => [alias, field.key] as const)),
);
const AI_HELP_INFORMATION_ALIAS_RE = AI_HELP_INFORMATION_FIELDS
  .flatMap((field) => field.aliases)
  .sort((a, b) => b.length - a.length)
  .join("|");
const AI_HELP_INFORMATION_FIELD_RE = new RegExp(
  `(?:^|\\n)\\s*(?:\\d+\\s*[、.．]\\s*)?(${AI_HELP_INFORMATION_ALIAS_RE})\\s*(?:[:：]|(?=\\s|\\n|$))`,
  "g",
);
const AI_HELP_LEAKED_REASONING_START_RE = /^(?:用户现在需要|用户需要|我现在需要|我现在|我(?:已|已经|会|来|需要|要|正在)|现在(?:我)?(?:先|需要)|下面|以下|接下来|对吧|好的|可以|没问题|根据(?:用户|图片)|让我们|先来|我将|这里|确认|明确|整理|梳理|分析)/;
const AI_HELP_LEAKED_REASONING_INLINE_RE = /(?:。|；|;)?\s*(?:用户现在需要|用户需要|我(?:已|已经|会|来|需要|要|正在|核对|确认|明确)|本次整理|下面|以下)[\s\S]*$/;

function cleanAiHelpFieldValue(value: string) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim().replace(/^[\-•·*]\s*/, ""))
    .filter((line) => line && !AI_HELP_LEAKED_REASONING_START_RE.test(line))
    .join("\n")
    .replace(AI_HELP_LEAKED_REASONING_INLINE_RE, "")
    .replace(/^(?:是|为)\s*/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getLooseAiHelpValue(raw: string, labels: string[], stopLabels: string[]) {
  const source = String(raw || "").replace(/\s+/g, " ").trim();
  for (const label of labels) {
    const index = source.indexOf(label);
    if (index < 0) continue;
    let value = source
      .slice(index + label.length)
      .replace(/^\s*(?:[:：]|为|是|包括|如下|分别为|有|：|:)\s*/, "");
    const stopIndex = stopLabels
      .map((stopLabel) => value.indexOf(stopLabel))
      .filter((item) => item >= 0)
      .sort((a, b) => a - b)[0];
    if (stopIndex >= 0) value = value.slice(0, stopIndex);
    value = cleanAiHelpFieldValue(value.replace(/[。；;]\s*$/, ""));
    if (value) return value;
  }
  return "";
}

function extractLooseAiHelpFields(raw: string) {
  const text = String(raw || "").replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const fields: Partial<Record<(typeof AI_HELP_INFORMATION_FIELDS)[number]["key"], string>> = {};
  const nameMatch = text.match(/(?:目标商品|产品名称|商品名称)\s*(?:为|是|[:：])\s*([^，。；;,.]{2,80})/);
  const name = cleanAiHelpFieldValue(nameMatch?.[1] || "");
  if (name) fields.name = name;
  const sellingPoints = getLooseAiHelpValue(
    text,
    ["核心卖点", "商品卖点", "卖点"],
    ["适用人群", "目标人群", "期望场景", "使用场景", "具体参数", "规格参数", "商品参数"],
  );
  if (sellingPoints) fields.sellingPoints = sellingPoints;
  const audience = getLooseAiHelpValue(
    text,
    ["适用人群", "目标人群"],
    ["期望场景", "使用场景", "具体参数", "规格参数", "商品参数"],
  );
  if (audience) fields.audience = audience;
  const scenario = getLooseAiHelpValue(
    text,
    ["期望场景", "使用场景", "适用场景"],
    ["具体参数", "规格参数", "商品参数"],
  );
  if (scenario) fields.scenario = scenario;
  const specs = getLooseAiHelpValue(text, ["具体参数", "规格参数", "商品参数"], []);
  if (specs) fields.specs = specs;
  return Object.values(fields).some(Boolean) ? fields : null;
}

function parseAiHelpFields(raw: string) {
  const text = String(raw || "").replace(/```[\s\S]*?```/g, "").trimStart();
  if (!text) return null;
  const matches = Array.from(text.matchAll(AI_HELP_INFORMATION_FIELD_RE));
  if (!matches.length) return null;
  const fields: Partial<Record<(typeof AI_HELP_INFORMATION_FIELDS)[number]["key"], string>> = {};
  matches.forEach((match, index) => {
    const key = AI_HELP_INFORMATION_ALIAS_TO_KEY.get(match[1]);
    if (!key) return;
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;
    const value = cleanAiHelpFieldValue(text.slice(start, end));
    if (!value) return;
    fields[key] = fields[key] ? `${fields[key]}\n${value}` : value;
  });
  return fields;
}

function normalizeAiHelpOutput(raw: string, final = false) {
  const fields = parseAiHelpFields(raw) || (final ? extractLooseAiHelpFields(raw) : null);
  if (!fields) return "";
  const requiredKeys = AI_HELP_INFORMATION_FIELDS.map((field) => field.key);
  const filledCount = requiredKeys.filter((key) => fields[key]).length;
  if (final && filledCount < 2) return "";
  if (final) {
    requiredKeys.forEach((key) => {
      if (!fields[key]) fields[key] = AI_HELP_INFORMATION_FALLBACKS[key] || "";
    });
  }
  const availableFields = AI_HELP_INFORMATION_FIELDS.filter((field) => fields[field.key]);
  if (!availableFields.length || (!fields.name && !final)) return "";
  return availableFields
    .map((field, index) => {
      const value = cleanAiHelpFieldValue(fields[field.key] || "");
      return field.key === "sellingPoints"
        ? `${index + 1}.${field.label}：\n${value}`
        : `${index + 1}.${field.label}：${value.replace(/\n+/g, "、")}`;
    })
    .join("\n")
    .trim();
}

async function downloadImageToLocal(src: string, filename: string) {
  const safeName = filename.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 60) || "image";
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const ext = blob.type.includes("png") ? ".png" : blob.type.includes("webp") ? ".webp" : ".jpg";
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${safeName}${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  } catch {
    window.open(src, "_blank");
  }
}
 
const DEFAULT_PROMPT_PREVIEWS: ExpandedPrompt[] = [
  { id: "image-1", name: "图1｜主图（白底/合规）", type: "主图（白底/合规）", prompt: "" },
  { id: "image-2", name: "图2｜场景展示", type: "场景展示", prompt: "" },
  { id: "image-3", name: "图3｜模特场景图", type: "模特场景图", prompt: "" },
  { id: "image-4", name: "图4｜细节说明", type: "细节说明", prompt: "" },
  { id: "image-5", name: "图5｜卖点详解", type: "卖点详解", prompt: "" },
];

const DEFAULT_SLOT_IDS = DEFAULT_PROMPT_PREVIEWS.map((item) => item.id);

const DEFAULT_PREVIEW_IMAGES: Record<string, string> = {
  "image-1": mainHeadphone,
  "image-2": sceneDisplay,
  "image-3": sellingPoint,
  "image-4": detailExplain,
  "image-5": modelScene,
};

const CUSTOM_SUITE_TYPES = [
  { key: "white", label: "白底图", desc: "白底主图，多角度呈现商品细节" },
  { key: "scene", label: "场景图", desc: "展示商品的生活使用场景和人物搭配" },
  { key: "selling", label: "卖点图", desc: "展示商品的核心卖点及细节特写" },
  { key: "function", label: "功能说明图", desc: "展示功能结构、使用方式和参数信息" },
  { key: "detail", label: "细节特写图", desc: "放大商品材质、工艺和关键细节" },
] as const;

type CustomSuiteTypeKey = typeof CUSTOM_SUITE_TYPES[number]["key"];

const DEFAULT_CUSTOM_SUITE_COUNTS: Record<CustomSuiteTypeKey, number> = {
  white: 1,
  scene: 1,
  selling: 1,
  function: 1,
  detail: 1,
};

function ratioClass(ratio: string) {
  if (ratio === "3:4") return "aspect-[3/4]";
  if (ratio === "4:3") return "aspect-[4/3]";
  if (ratio === "9:16") return "aspect-[9/16]";
  if (ratio === "16:9") return "aspect-[16/9]";
  return "aspect-square";
}

export function ProductImageSets() {
  const { expanded } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const aiHelpButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mode, setMode] = useState("智能匹配");
  const [customSuiteCounts, setCustomSuiteCounts] = useState<Record<CustomSuiteTypeKey, number>>(DEFAULT_CUSTOM_SUITE_COUNTS);
  const [copy, setCopy] = useState(false);
  const [listingCopy, setListingCopy] = useState(true);
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [settings, setSettings] = useState({ platform: "淘宝天猫1688", country: "中国", language: "中文", ratio: "1:1" });
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedReportOption, setSelectedReportOption] = useState<SuiteProduct | null>(null);
  const [descriptionPayload, setDescriptionPayload] = useState<DescriptionPayload | null>(null);
  const [loadingDescriptions, setLoadingDescriptions] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [error, setError] = useState("");
  const [generationText, setGenerationText] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedProductImage[]>([]);
  const [expandingPrompts, setExpandingPrompts] = useState(false);
  const [promptExpansion, setPromptExpansion] = useState<PromptExpansionPayload | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>(DEFAULT_SLOT_IDS);
  const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImageResult>>({});
  const [generationSlots, setGenerationSlots] = useState<GenerationSlot[]>([]);
  const [resultViewActive, setResultViewActive] = useState(false);
  const [aiMainPrompt, setAiMainPrompt] = useState("");
  const [aiHelpOpen, setAiHelpOpen] = useState(false);
  const [aiHelpStatus, setAiHelpStatus] = useState<AiHelpStatus>("idle");
  const [aiHelpText, setAiHelpText] = useState("");
  const [aiHelpVisibleText, setAiHelpVisibleText] = useState("");
  const [aiHelpThinkingText, setAiHelpThinkingText] = useState("");
  const [aiHelpError, setAiHelpError] = useState("");
  const [aiHelpPosition, setAiHelpPosition] = useState<{ top: number; left: number } | null>(null);
  const [generationActionPanel, setGenerationActionPanel] = useState<GenerationActionPanel | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const descriptions = descriptionPayload?.descriptions || [];
  const bandSummary = descriptionPayload?.band;
  const overallMainDescription = bandSummary?.image_prompts?.main_image_prompt || "";
  const expandedPrompts = promptExpansion?.prompts || [];
  const previewPrompts = expandedPrompts.length ? expandedPrompts : DEFAULT_PROMPT_PREVIEWS;
  const selectedPromptCount = expandedPrompts.length ? selectedPromptIds.length : DEFAULT_PROMPT_PREVIEWS.length;
  const selectedReport = selectedReportOption;
  const reportMainPoints = descriptionPayload?.listingSellingPoints?.mainImageSellingPoints || [];
  const customImageTotal = CUSTOM_SUITE_TYPES.reduce((sum, item) => sum + customSuiteCounts[item.key], 0);
  const suiteImageCount = mode === "自定义配置" ? customImageTotal : selectedPromptCount;
  const reportMainPrompt = useMemo(() => {
    if (aiMainPrompt) return aiMainPrompt;
    const serverPrompt = String(descriptionPayload?.mainImagePromptSeed || "").trim();
    if (serverPrompt) return serverPrompt;
    const summaryPrompt = String(descriptionPayload?.listingSellingPoints?.summary || "").trim();
    if (summaryPrompt) return summaryPrompt;
    return overallMainDescription;
  }, [aiMainPrompt, descriptionPayload?.mainImagePromptSeed, descriptionPayload?.listingSellingPoints?.summary, overallMainDescription]);
  const uploadedImage = uploadedImages[0]?.url || "";
  const hasSelectedExpandedPrompt = expandedPrompts.length ? expandedPrompts.some((item) => selectedPromptIds.includes(item.id) && item.prompt.trim()) : false;
  const canGenerateImage = Boolean(uploadedImage && (expandedPrompts.length ? hasSelectedExpandedPrompt : generationText.trim()));

  useEffect(() => {
    if (!aiHelpOpen || aiHelpStatus === "thinking" || aiHelpStatus === "error") return;
    if (!aiHelpText || aiHelpVisibleText === aiHelpText) return;
    const timer = window.setTimeout(() => {
      setAiHelpVisibleText((current) => {
        if (current === aiHelpText) return current;
        const remaining = aiHelpText.length - current.length;
        const step = remaining > 120 ? 6 : remaining > 40 ? 4 : 2;
        return aiHelpText.slice(0, current.length + Math.max(1, step));
      });
    }, 18);
    return () => window.clearTimeout(timer);
  }, [aiHelpOpen, aiHelpStatus, aiHelpText, aiHelpVisibleText]);

  function buildGenerationQueue(): GenerationSlot[] {
    if (mode === "自定义配置") {
      let order = 1;
      return CUSTOM_SUITE_TYPES.flatMap((item) => {
        const count = customSuiteCounts[item.key];
        return Array.from({ length: count }, (_, index) => {
          const n = order++;
          const promptParts = [
            generationText.trim(),
            `图片类型：${item.label}`,
            `生成要求：${item.desc}`,
            `输出比例：${settings.ratio}`,
          ].filter(Boolean);
          return {
            id: `custom-${item.key}-${index + 1}-${Date.now()}-${n}`,
            name: `${String(n).padStart(2, "0")} ${item.label}`,
            type: item.label,
            typeKey: item.key,
            prompt: promptParts.join("\n"),
          };
        });
      });
    }
    if (expandedPrompts.length) {
      return expandedPrompts.filter((item) => selectedPromptIds.includes(item.id));
    }
    return DEFAULT_PROMPT_PREVIEWS.map((item) => ({ ...item, prompt: generationText }));
  }

  async function loadDescriptions(reportValue = selectedProduct) {
    if (!reportValue) return;
    setLoadingDescriptions(true);
    setError("");
    setAiMainPrompt("");
    try {
      const response = await fetch(`/api/product-sets/main-image-descriptions?runId=${encodeURIComponent(reportValue)}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取主图描述失败");
      setDescriptionPayload(data);
      setPromptExpansion(null);
      setSelectedPromptId("");
      setSelectedPromptIds(DEFAULT_SLOT_IDS);
      setGeneratedImages({});
      setGenerationSlots([]);
      setResultViewActive(false);
      // 异步拉取 AI 全主图分析报告（首次可能较慢），成功后优先用它的全文做生图提示词（与报告页一致）
      fetch(`/api/report/main-image-ai-report?id=${encodeURIComponent(reportValue)}`)
        .then((res) => res.json())
        .then((aiData) => {
          const aiPrompt = String(aiData?.promptText || aiData?.summary || "").trim();
          if (aiData?.ok && aiData?.source === "ai" && aiPrompt) setAiMainPrompt(aiPrompt);
        })
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDescriptions(false);
    }
  }

  function readImageFile(file: File) {
    return new Promise<UploadedProductImage>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          url: String(reader.result || ""),
        });
      };
      reader.onerror = () => reject(new Error("图片读取失败，请重新上传"));
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(files?: FileList | null) {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;
    const availableSlots = 3 - uploadedImages.length;
    if (availableSlots <= 0) {
      setError("同一产品最多上传 3 张图片");
      return;
    }
    const filesToRead = selectedFiles.slice(0, availableSlots);
    const invalidFile = filesToRead.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setError("请上传图片文件");
      return;
    }
    const oversizedFile = filesToRead.find((file) => file.size > 12 * 1024 * 1024);
    if (oversizedFile) {
      setError("图片太大，请上传 12MB 以内的图片");
      return;
    }
    try {
      const nextImages = await Promise.all(filesToRead.map(readImageFile));
      setUploadedImages((current) => [...current, ...nextImages].slice(0, 3));
      setGeneratedImages({});
      setGenerationSlots([]);
      setResultViewActive(false);
      setGenerationActionPanel(null);
      setError(selectedFiles.length > availableSlots ? "同一产品最多上传 3 张图片，已保留前 3 张。" : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function removeUploadedImage(id: string) {
    setUploadedImages((current) => current.filter((item) => item.id !== id));
    setGeneratedImages({});
    setGenerationSlots([]);
    setResultViewActive(false);
    setGenerationActionPanel(null);
    setError("");
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
    const queue = buildGenerationQueue();
    if (!queue.length) {
      setError("请至少选择一张要生成的图片");
      return;
    }
    if (queue.some((item) => !String(item.prompt || generationText).trim())) {
      setError("请选择或填写相关生成主图的提示词");
      return;
    }
    setGenerationSlots(queue);
    setResultViewActive(true);
    setGenerationActionPanel(null);
    setGeneratedImages(queue.reduce<Record<string, GeneratedImageResult>>((map, item) => {
      map[item.id] = { status: "generating" };
      return map;
    }, {}));
    setGeneratingImage(true);
    setError("");
    let failedCount = 0;
    const batchSaved: Array<{ name: string; url: string; type: string }> = [];
    const batchStamp = new Date();
    const stampText = `${batchStamp.getFullYear()}${String(batchStamp.getMonth() + 1).padStart(2, "0")}${String(batchStamp.getDate()).padStart(2, "0")}-${String(batchStamp.getHours()).padStart(2, "0")}${String(batchStamp.getMinutes()).padStart(2, "0")}${String(batchStamp.getSeconds()).padStart(2, "0")}`;
    const productLabel = selectedReport?.keyword || selectedReport?.label || "商品";
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
              ratio: settings.ratio,
              watermark: false,
            }),
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.error || "生成图片失败");
          const imageUrl = data.images?.[0]?.dataUrl || data.images?.[0]?.url;
          if (!imageUrl) throw new Error("生成成功但没有返回图片 URL");
          setGeneratedImages((current) => ({
            ...current,
            [item.id]: { status: "done", url: imageUrl, fileUrl: data.images?.[0]?.url },
          }));
          batchSaved.push({
            name: `${productLabel}-${item.type || "主图"}-${stampText}`,
            url: data.images?.[0]?.url || imageUrl,
            type: item.type || "主图",
          });
        } catch (err) {
          failedCount += 1;
          setGeneratedImages((current) => ({
            ...current,
            [item.id]: { status: "failed", error: err instanceof Error ? err.message : String(err) },
          }));
        }
      }
      if (failedCount) setError(`${failedCount} 张图片生成失败，其余图片已保留在右侧。`);
      if (batchSaved.length) {
        // 生成成功的主图自动入库沉淀（generated_main_image 表）
        fetch("/api/product-sets/generated-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: batchSaved,
            productName: productLabel,
            sizeRatio: settings.ratio,
            platform: settings.platform,
            runId: selectedReport?.reportId ?? selectedReport?.latestRunId ?? "",
          }),
        }).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingImage(false);
    }
  }

  async function expandPrompts() {
    if (expandingPrompts) return;
    if (!uploadedImage) {
      setError("请先上传商品原图，再使用 AI 帮写");
      return;
    }
    const buttonRect = aiHelpButtonRef.current?.getBoundingClientRect();
    if (buttonRect) {
      setAiHelpPosition({
        top: buttonRect.top,
        left: buttonRect.right + 8,
      });
    }
    setAiHelpOpen(true);
    setAiHelpStatus("thinking");
    setAiHelpText("");
    setAiHelpVisibleText("");
    setAiHelpThinkingText("");
    setAiHelpError("");
    setExpandingPrompts(true);
    setError("");
    setPromptExpansion(null);
    setGeneratedImages({});
    setGenerationSlots([]);
    setResultViewActive(false);
    setGenerationActionPanel(null);
    try {
      const response = await fetch("/api/product-sets/expand-prompts-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          baseText: generationText,
          image: uploadedImage,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "AI 帮写失败");
      }
      if (!response.body) throw new Error("AI 帮写接口没有返回流式内容，请稍后重试。");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let completed = false;

      const appendThinking = (text: string) => {
        const clean = text.trim();
        if (!clean) return;
        setAiHelpThinkingText((current) => {
          const lines = current.split("\n").map((line) => line.trim()).filter(Boolean);
          if (lines.includes(clean)) return current;
          return [...lines, clean].join("\n");
        });
      };

      const handleEvent = (event: AiHelpStreamEvent) => {
        if (event.type === "thinking") {
          appendThinking(String(event.text || ""));
          return;
        }
        if (event.type === "content") {
          const chunk = String(event.text || "");
          if (!chunk) return;
          fullText += chunk;
          const visibleText = normalizeAiHelpOutput(fullText);
          if (!visibleText) return;
          setAiHelpStatus("writing");
          setAiHelpText(visibleText);
          return;
        }
        if (event.type === "done") {
          const text = normalizeAiHelpOutput(String(event.text || fullText), true);
          if (!text) throw new Error("AI 帮写返回内容格式异常，请重新帮写。");
          fullText = text;
          setAiHelpText(text);
          setAiHelpStatus("ready");
          completed = true;
          return;
        }
        if (event.type === "error") {
          throw new Error(event.error || "AI 帮写失败");
        }
      };

      const flushLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let event: AiHelpStreamEvent;
        try {
          event = JSON.parse(trimmed) as AiHelpStreamEvent;
        } catch {
          return;
        }
        handleEvent(event);
      };

      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        lines.forEach(flushLine);
        if (done) break;
      }
      flushLine(buffer);
      if (!completed && fullText.trim()) {
        const normalizedText = normalizeAiHelpOutput(fullText, true);
        if (!normalizedText) throw new Error("AI 帮写返回内容格式异常，请重新帮写。");
        fullText = normalizedText;
        setAiHelpText(normalizedText);
        setAiHelpStatus("ready");
      }
      if (!fullText.trim()) throw new Error("AI 帮写没有返回可用商品信息，请稍后重试。");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAiHelpText("");
      setAiHelpStatus("error");
      setAiHelpError(message);
    } finally {
      setExpandingPrompts(false);
    }
  }

  function confirmAiHelp() {
    const text = normalizeAiHelpOutput(aiHelpText, true).trim();
    if (!text) {
      setAiHelpStatus("error");
      setAiHelpError("AI 帮写返回内容格式异常，请重新帮写。");
      return;
    }
    setGenerationText(text);
    setAiHelpOpen(false);
    setAiHelpStatus("idle");
    setAiHelpError("");
    setAiHelpThinkingText("");
  }

  const aiHelpFinishedWriting = Boolean(aiHelpText.trim()) && aiHelpStatus === "ready" && aiHelpVisibleText === aiHelpText;
  const aiHelpFailed = aiHelpStatus === "error";

  function getFloatingPanelPosition(rect: DOMRect, width = 300) {
    const gap = 12;
    const viewportWidth = window.innerWidth || 1440;
    const viewportHeight = window.innerHeight || 900;
    const preferredLeft = rect.right + gap;
    const fallbackLeft = rect.left - width - gap;
    return {
      left: preferredLeft + width + 16 <= viewportWidth ? preferredLeft : Math.max(16, fallbackLeft),
      top: Math.max(16, Math.min(rect.top, viewportHeight - 260)),
    };
  }

  function openTextPanel(event: MouseEvent<HTMLButtonElement>, item: GenerationSlot, title: string) {
    event.stopPropagation();
    const position = getFloatingPanelPosition(event.currentTarget.getBoundingClientRect(), 300);
    const sourceImage = getEditableImage(item.id);
    if (!sourceImage) {
      setGenerationActionPanel({
        kind: "text",
        slotId: item.id,
        title,
        fields: [],
        loading: false,
        error: "当前图片不可识别，请先完成生成后再编辑文字。",
        originalCount: 0,
        ...position,
      });
      return;
    }
    setGenerationActionPanel({
      kind: "text",
      slotId: item.id,
      title,
      fields: [],
      loading: true,
      error: "",
      originalCount: 0,
      ...position,
    });
    fetch("/api/product-sets/extract-image-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: sourceImage }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "图片文字识别失败");
        const texts = Array.isArray(data.texts) ? data.texts.map((text: unknown) => String(text || "").trim()).filter(Boolean) : [];
        const fields = texts.map((text: string, index: number) => ({
          id: `${item.id}-text-${Date.now()}-${index}`,
          original: text,
          value: text,
          removed: false,
        }));
        setGenerationActionPanel((current) => {
          if (!current || current.kind !== "text" || current.slotId !== item.id) return current;
          return { ...current, fields, loading: false, error: "", originalCount: fields.length };
        });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setGenerationActionPanel((current) => {
          if (!current || current.kind !== "text" || current.slotId !== item.id) return current;
          return { ...current, fields: [], loading: false, error: message || "图片文字识别失败", originalCount: 0 };
        });
      });
  }

  function openImagePanel(event: MouseEvent<HTMLButtonElement>, item: GenerationSlot, title: string) {
    event.stopPropagation();
    const position = getFloatingPanelPosition(event.currentTarget.getBoundingClientRect(), 300);
    setGenerationActionPanel({
      kind: "image",
      slotId: item.id,
      title,
      direction: "",
      ...position,
      });
  }

  function updateTextPanelField(id: string, value: string) {
    setGenerationActionPanel((current) => {
      if (!current || current.kind !== "text") return current;
      return {
        ...current,
        fields: current.fields.map((field) => (field.id === id ? { ...field, value } : field)),
      };
    });
  }

  function removeTextPanelField(id: string) {
    setGenerationActionPanel((current) => {
      if (!current || current.kind !== "text") return current;
      return {
        ...current,
        fields: current.fields.map((field) => (field.id === id ? { ...field, value: "", removed: true } : field)),
      };
    });
  }

  function updateImagePanelDirection(value: string) {
    setGenerationActionPanel((current) => {
      if (!current || current.kind !== "image") return current;
      return { ...current, direction: value };
    });
  }

  function findGenerationSlot(slotId: string) {
    return generationSlots.find((item) => item.id === slotId);
  }

  function getEditableImage(slotId: string) {
    const result = generatedImages[slotId];
    return result?.url || result?.fileUrl || "";
  }

  function buildTextEditPrompt(slot: GenerationSlot | undefined, fields: EditableTextField[]) {
    const replaceLines = fields
      .filter((field) => !field.removed && field.value.trim() && field.value.trim() !== field.original.trim())
      .map((field) => `原文：“${field.original.trim()}” -> 新文：“${field.value.trim()}”`);
    const keepLines = fields
      .filter((field) => !field.removed && field.value.trim() && field.value.trim() === field.original.trim())
      .map((field) => `保持：“${field.original.trim()}”`);
    const deleteLines = fields
      .filter((field) => field.removed || !field.value.trim())
      .map((field) => field.original.trim())
      .filter(Boolean)
      .map((text) => `删除：“${text}”`);
    return [
      "你是电商图片文字编辑智能体。以输入图片为唯一原图，只执行画面中的文字编辑。",
      `图片类型：${slot?.type || "商品图"}`,
      "任务：先定位图片中已有文字，再严格按以下清单处理。",
      "【需要替换】",
      replaceLines.length ? replaceLines.join("\n") : "无",
      "【需要删除】",
      deleteLines.length ? deleteLines.join("\n") : "无",
      "【保持不变】",
      keepLines.length ? keepLines.join("\n") : "无",
      "重要约束：保持商品主体、人物、背景、光影、构图、比例、颜色、材质和画面风格完全不变。",
      "只允许修改文字内容、删除文字以及对文字区域做自然底图修复；不要新增清单外文字。",
      "替换文字时尽量沿用原来的字体风格、字号、颜色、描边、阴影、位置和排版，必要时只做轻微字号调整，确保不溢出。",
      "删除文字后要自然补齐原位置背景，不留下明显涂抹痕迹。",
      "不得改变商品外观、佩戴关系、人物五官、背景、比例或主体位置。",
      `输出比例：${settings.ratio}`,
    ].join("\n");
  }

  function buildImageRetouchPrompt(slot: GenerationSlot | undefined, direction: string) {
    const cleanDirection = direction.trim() || "在保持当前画面风格的基础上轻微优化画面质感和电商展示效果";
    return [
      "基于当前图片进行电商图片局部微调。",
      `图片类型：${slot?.type || "商品图"}`,
      `用户微调方向：${cleanDirection}`,
      "重要约束：严格保持商品主体、品类、颜色、材质、佩戴关系、画面比例和整体构图一致，不替换商品，不改变核心版式。",
      "只按用户微调方向调整必要元素；不要新增无关文字、品牌、水印、促销标识或多余装饰。",
      `输出比例：${settings.ratio}`,
    ].join("\n");
  }

  async function regenerateSlotImage(slotId: string, prompt: string, sourceImage: string) {
    const previous = generatedImages[slotId];
    if (!sourceImage) {
      setError("当前图片不可编辑，请先完成生成后再操作");
      return;
    }
    setGenerationActionPanel(null);
    setError("");
    setGeneratedImages((current) => ({
      ...current,
      [slotId]: { ...current[slotId], status: "generating" },
    }));
    try {
      const response = await fetch("/api/product-sets/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          image: sourceImage,
          size: "2K",
          ratio: settings.ratio,
          watermark: false,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "图片处理失败");
      const imageUrl = data.images?.[0]?.dataUrl || data.images?.[0]?.url;
      if (!imageUrl) throw new Error("处理成功但没有返回图片 URL");
      setGeneratedImages((current) => ({
        ...current,
        [slotId]: { status: "done", url: imageUrl, fileUrl: data.images?.[0]?.url },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setGeneratedImages((current) => ({
        ...current,
        [slotId]: previous || { status: "failed", error: message },
      }));
      setError(message);
    }
  }

  async function runTextEdit() {
    if (!generationActionPanel || generationActionPanel.kind !== "text") return;
    const sourceImage = getEditableImage(generationActionPanel.slotId);
    const slot = findGenerationSlot(generationActionPanel.slotId);
    await regenerateSlotImage(
      generationActionPanel.slotId,
      buildTextEditPrompt(slot, generationActionPanel.fields),
      sourceImage,
    );
  }

  async function runImageRetouch() {
    if (!generationActionPanel || generationActionPanel.kind !== "image") return;
    const sourceImage = getEditableImage(generationActionPanel.slotId);
    const slot = findGenerationSlot(generationActionPanel.slotId);
    await regenerateSlotImage(
      generationActionPanel.slotId,
      buildImageRetouchPrompt(slot, generationActionPanel.direction),
      sourceImage,
    );
  }

  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setOpenSetting(null);
  };

  function togglePromptSelection(id: string) {
    setSelectedPromptIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function updatePromptText(id: string, prompt: string) {
    setPromptExpansion((current) => {
      if (!current?.prompts?.length) return current;
      return {
        ...current,
        prompts: current.prompts.map((item) => item.id === id ? { ...item, prompt } : item),
      };
    });
  }

  function updateCustomSuiteCount(key: CustomSuiteTypeKey, step: number) {
    setCustomSuiteCounts((current) => {
      const currentValue = current[key];
      const currentTotal = CUSTOM_SUITE_TYPES.reduce((sum, item) => sum + current[item.key], 0);
      if (step < 0 && (currentValue <= 0 || currentTotal <= 5)) return current;
      return {
        ...current,
        [key]: Math.max(0, currentValue + step),
      };
    });
  }

  useEffect(() => {
    if (!selectedProduct) return;
    loadDescriptions(selectedProduct).catch(() => undefined);
  }, [selectedProduct]);

  useEffect(() => {
    if (reportMainPrompt) setGenerationText(reportMainPrompt);
  }, [reportMainPrompt]);

  function renderPreviewTile(item: ExpandedPrompt, index: number, compact = false) {
    const result = generatedImages[item.id];
    const src = result?.url || DEFAULT_PREVIEW_IMAGES[item.id] || mainHeadphone;
    const canInspect = result?.status === "done" && Boolean(result.url);
    const n = String(index + 1).padStart(2, "0");
    const title = item.type || item.name;
    const tileSize = compact ? "h-[162px] w-[162px]" : "h-[336px] w-[336px]";
    return (
      <div
        key={item.id}
        onClick={canInspect ? () => setLightbox({ src, title: `${n} ${title}` }) : undefined}
        className={`group/zoom relative shrink-0 overflow-hidden rounded-[12px] bg-transparent text-left ${tileSize} ${canInspect ? "cursor-zoom-in" : "cursor-default"}`}
      >
        <span className="absolute left-3 top-3 z-10 rounded-full bg-[#F2F3F5] px-3 py-1.5 text-[12px] font-semibold text-[#22324D]">
          {n} {title}
        </span>
        <img
          src={src}
          alt={item.name}
          className={`block h-full w-full rounded-[12px] ${compact ? "object-cover" : "object-contain"}`}
          onError={result?.status === "done" ? () => {
            setGeneratedImages((current) => ({
              ...current,
              [item.id]: { ...current[item.id], status: "failed", error: "图片文件已生成，但浏览器加载失败，请重新生成" },
            }));
          } : undefined}
        />
        {canInspect && (
          <span className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#667085] opacity-0 shadow-sm transition-opacity group-hover/zoom:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" /> 放大查看
          </span>
        )}
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
      </div>
    );
  }

  function renderSuitePreview() {
    const slots = previewPrompts.slice(0, 5);
    return (
      <div className="mx-auto flex h-[384px] w-[792px] items-center gap-4 rounded-[20px] bg-white p-6 shadow-[0_18px_40px_rgba(31,37,45,.06)]">
        <div className="h-[336px] w-[336px] shrink-0">
          {renderPreviewTile(slots[0] || DEFAULT_PROMPT_PREVIEWS[0], 0)}
        </div>
        <div className="flex h-[336px] w-10 shrink-0 items-center justify-center">
          <img src={suiteArrow} alt="" className="block w-[40px] shrink-0" />
        </div>
        <div className="grid h-[336px] w-[336px] shrink-0 grid-cols-2 gap-3">
          {slots.slice(1, 5).map((item, index) => renderPreviewTile(item, index + 1, true))}
        </div>
      </div>
    );
  }

  function renderGenerationCard(item: GenerationSlot, index: number) {
    const result = generatedImages[item.id];
    const title = `${String(index + 1).padStart(2, "0")} ${item.type || "主图"}`;
    const src = result?.url || "";
    const isDone = result?.status === "done" && Boolean(src);
    const isActionPanelOpen = generationActionPanel?.slotId === item.id;
    return (
      <div className={`group relative overflow-hidden rounded-[8px] bg-white ${ratioClass(settings.ratio)} shadow-[0_1px_0_rgba(15,23,41,.04)]`}>
        {isDone ? (
          <>
            <img
              src={src}
              alt={title}
              className="h-full w-full object-cover"
              onClick={() => setLightbox({ src, title })}
              onError={() => {
                setGeneratedImages((current) => ({
                  ...current,
                  [item.id]: { ...current[item.id], status: "failed", error: "图片文件已生成，但浏览器加载失败，请重新生成" },
                }));
              }}
            />
            <button
              type="button"
              onClick={() => downloadImageToLocal(result?.fileUrl || src, title)}
              className={`absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-[8px] bg-white/90 text-[#171A1D] shadow-sm transition-opacity hover:bg-white ${isActionPanelOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              aria-label={`下载 ${title}`}
            >
              <Download className="h-4 w-4" />
            </button>
            <div className={`absolute inset-x-0 bottom-0 z-20 flex gap-2 bg-gradient-to-t from-black/45 via-black/25 to-transparent p-3 pt-10 transition-opacity ${isActionPanelOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              <button
                type="button"
                onClick={(event) => openImagePanel(event, item, title)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[#171A1D]/72 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-[#171A1D]/84"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI改图
              </button>
              <button
                type="button"
                onClick={(event) => openTextPanel(event, item, title)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[#171A1D]/72 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-[#171A1D]/84"
              >
                <PenLine className="h-3.5 w-3.5" />
                编辑文字
              </button>
            </div>
          </>
        ) : result?.status === "failed" ? (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-[13px] font-semibold leading-6 text-[#c03535]">
            {result.error || "生成失败"}
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-[#A0A7B2]">
            <div className="mb-3 flex gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#A0A7B2]" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#A0A7B2] [animation-delay:120ms]" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#A0A7B2] [animation-delay:240ms]" />
            </div>
            <div className="text-[13px] font-medium">AI生成中...</div>
          </div>
        )}
        <span className="absolute left-3 top-3 z-10 rounded-[8px] bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-[#22324D] shadow-sm">
          {title}
        </span>
      </div>
    );
  }

  function renderGenerationResults() {
    const slots = generationSlots.length ? generationSlots : buildGenerationQueue();
    return (
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-left text-[18px] font-bold text-[#171A1D]">生成结果：</h2>
          <label className="flex items-center gap-2 text-[13px] font-medium text-[#5F6B7A]">
            <span className="h-4 w-4 rounded-[4px] border border-[#D7DCE3] bg-white" />
            全选
          </label>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className={`relative overflow-hidden rounded-[8px] bg-white ${ratioClass(settings.ratio)}`}>
            <img src={uploadedImage} alt="原图" className="h-full w-full object-contain" />
            <span className="absolute left-3 top-3 rounded-[8px] bg-[#8E9299] px-2.5 py-1 text-[12px] font-semibold text-white">原图</span>
          </div>
          {slots.map((item, index) => renderGenerationCard(item, index))}
        </div>
      </div>
    );
  }

  return (
      <div className="relative flex h-full bg-[#f2f4f7]">
      <div className="w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pb-28 pt-5 custom-scrollbar">
        <SectionTitle help>商品原图</SectionTitle>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            handleUpload(event.target.files).catch(() => undefined);
            event.currentTarget.value = "";
          }}
        />
        {uploadedImages.length ? (
          <div className="mb-4 grid grid-cols-3 gap-3">
            {uploadedImages.map((image) => (
              <div key={image.id} className="relative h-[82px] overflow-hidden rounded-[8px] bg-[#F2F3F5] shadow-sm">
                <img src={image.url} alt={image.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeUploadedImage(image.id)}
                  className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70"
                  aria-label={`删除 ${image.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {uploadedImages.length < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid h-[82px] place-items-center rounded-[8px] bg-[#F2F3F5] text-[#171A1D] transition-colors hover:bg-[#ECEFF4]"
                aria-label="继续上传商品图"
              >
                <Plus className="h-6 w-6" />
              </button>
            )}
          </div>
        ) : (
          <div className="mb-4 flex h-[94px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#E3E7EF] bg-white">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mb-3 flex h-8 items-center gap-1.5 rounded-[8px] bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]"
            >
              <Upload className="h-4 w-4" />
              上传图片
            </button>
            <p className="max-w-[260px] truncate text-[12px] font-normal text-[#8B949E]">同一产品，最多3张。</p>
          </div>
        )}

        {error && (
          <div className="mb-5 flex gap-2 rounded-[8px] border border-[#ffd7d7] bg-[#fff5f5] p-3 text-[13px] font-semibold text-[#c03535]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AIReportSelector value={selectedProduct} onChange={(runId, report) => {
          setSelectedProduct(runId);
          setSelectedReportOption(report);
          setError("");
        }} />

        <SectionTitle>生成设置</SectionTitle>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <SelectBox value={settings.platform} options={GENERATION_OPTIONS.platform} open={openSetting === "platform"} onToggle={() => setOpenSetting(openSetting === "platform" ? null : "platform")} onSelect={(value) => updateSetting("platform", value)} />
          <SelectBox value={settings.country} options={GENERATION_OPTIONS.country} open={openSetting === "country"} onToggle={() => setOpenSetting(openSetting === "country" ? null : "country")} onSelect={(value) => updateSetting("country", value)} />
          <SelectBox value={settings.language} options={GENERATION_OPTIONS.language} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(value) => updateSetting("language", value)} />
          <SelectBox value={settings.ratio} options={GENERATION_OPTIONS.ratio} open={openSetting === "ratio"} onToggle={() => setOpenSetting(openSetting === "ratio" ? null : "ratio")} onSelect={(value) => updateSetting("ratio", value)} />
        </div>

        <div className="flex items-center justify-between">
          <SectionTitle help>商品卖点&要求</SectionTitle>
          <button
            ref={aiHelpButtonRef}
            onClick={expandPrompts}
            disabled={expandingPrompts}
            className="mb-4 flex h-7 items-center gap-1 rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm"
          >
            {expandingPrompts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
            AI 帮写
          </button>
        </div>
        <textarea
          className="mb-4 h-[114px] w-full resize-none rounded-[8px] border border-[#DDE3EC] bg-white p-3 text-[12px] font-normal leading-[20px] text-[#5F6B7A] outline-none focus:border-[#4690ff]"
          value={generationText}
          onChange={(event) => setGenerationText(event.target.value)}
          placeholder={`建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.具体参数`}
        />
        {reportMainPoints.length ? (
          <div className="mb-4 rounded-[8px] border border-[#e4ebf5] bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[12px] font-bold text-[#344054]">已回传主图卖点</div>
              <span className="rounded-full bg-[#eef6ff] px-2 py-0.5 text-[11px] font-bold text-[#3388ff]">{reportMainPoints.length} 条</span>
            </div>
            <div className="space-y-2">
              {reportMainPoints.slice(0, 4).map((item, index) => (
                <div key={`${item.title || "point"}-${index}`} className="rounded-[8px] bg-[#f8fafc] p-2.5 text-[12px] leading-5 text-[#667085]">
                  <div className="font-bold text-[#0A1B39]">{index + 1}. {item.title || "主图卖点"}</div>
                  <div className="mt-0.5">画面表达：{item.visualExpression || "商品主体清晰，少量文字表达核心卖点"}</div>
                  <div className="mt-0.5 truncate text-[#98A2B3]">依据：{item.dataBasis || "竞品报告数据库聚合"}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {loadingDescriptions && selectedReport ? (
          <div className="mb-6 flex items-center gap-2 rounded-[8px] bg-[#f8fafc] px-3 py-2 text-[12px] font-semibold text-[#667085]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在导入主图生图文本
          </div>
        ) : null}

        <SectionTitle>套图结构配置</SectionTitle>
        <div className="mb-4 rounded-[8px] bg-[#F2F3F5] p-3">
          <button onClick={() => setMode("智能匹配")} className="w-full rounded-[8px] bg-[#F2F3F5] p-3 text-left transition-colors hover:bg-[#ECEFF4]">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#171A1D]">
              <span className={`grid h-4 w-4 place-items-center rounded-[4px] ${mode === "智能匹配" ? "bg-[#1683FF] text-white" : "border border-[#D7DCE3] bg-white text-transparent"}`}>
                <Check className="h-3 w-3" />
              </span>
              智能匹配
            </div>
            <p className="mt-1 text-[12px] font-normal text-[#8B949E]">AI智能分析商品图，匹配最佳Listing套图。</p>
          </button>
          <button onClick={() => setMode("自定义配置")} className="mt-2 w-full rounded-[8px] bg-[#F2F3F5] p-3 text-left transition-colors hover:bg-[#ECEFF4]">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#171A1D]">
              <span className={`grid h-4 w-4 place-items-center rounded-[4px] ${mode === "自定义配置" ? "bg-[#1683FF] text-white" : "border border-[#D7DCE3] bg-white text-transparent"}`}>
                <Check className="h-3 w-3" />
              </span>
              自定义配置
            </div>
            <p className="mt-1 text-[12px] font-normal text-[#8B949E]">可自由调整各类型图片数量，至少选择5张。</p>
          </button>
          {mode === "自定义配置" && (
            <div className="mt-3 space-y-2">
              {CUSTOM_SUITE_TYPES.map((item) => {
                const count = customSuiteCounts[item.key];
                const cannotDecrease = count <= 0 || customImageTotal <= 5;
                return (
                  <div key={item.key} className="flex min-h-[70px] items-center justify-between rounded-[8px] bg-white px-3 py-3">
                    <div className="min-w-0 pr-3">
                      <div className="text-[13px] font-semibold text-[#171A1D]">{item.label}</div>
                      <p className="mt-1 text-[12px] font-normal leading-5 text-[#8B949E]">{item.desc}</p>
                    </div>
                    <div className="flex h-7 shrink-0 items-center overflow-hidden rounded-[8px] bg-[#F5F6F8]">
                      <button
                        type="button"
                        onClick={() => updateCustomSuiteCount(item.key, -1)}
                        disabled={cannotDecrease}
                        className="grid h-7 w-7 place-items-center text-[#171A1D] transition-colors hover:bg-[#ECEFF4] disabled:cursor-not-allowed disabled:text-[#C4C6CA]"
                        aria-label={`${item.label}减少一张`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="grid h-7 w-7 place-items-center text-[13px] font-semibold text-[#171A1D]">{count}</span>
                      <button
                        type="button"
                        onClick={() => updateCustomSuiteCount(item.key, 1)}
                        className="grid h-7 w-7 place-items-center text-[#171A1D] transition-colors hover:bg-[#ECEFF4]"
                        aria-label={`${item.label}增加一张`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <SectionTitle>附加功能</SectionTitle>
        <div className="space-y-3">
          <div className="flex h-12 items-center justify-between rounded-[8px] bg-[#F2F3F5] px-3 text-[13px] font-normal text-[#171A1D]"><span>爆款风格分析</span><span onClick={() => setCopy(!copy)} className={`h-5 w-9 rounded-full p-0.5 ${copy ? "bg-[#1683FF]" : "bg-[#B8BDC5]"}`}><i className={`block h-4 w-4 rounded-full bg-white transition-transform ${copy ? "translate-x-4" : ""}`} /></span></div>
          <div className="flex h-12 items-center justify-between rounded-[8px] bg-[#F2F3F5] px-3 text-[13px] font-normal text-[#171A1D]"><span className="flex items-center gap-1.5">商品上架文案生成 <span className="rounded-full bg-[#FFE8D8] px-1.5 py-0.5 text-[10px] font-semibold text-[#C35A22]">限免</span></span><span onClick={() => setListingCopy(!listingCopy)} className={`h-5 w-9 rounded-full p-0.5 ${listingCopy ? "bg-[#5F666F]" : "bg-[#B8BDC5]"}`}><i className={`block h-4 w-4 rounded-full bg-white transition-transform ${listingCopy ? "translate-x-4" : ""}`} /></span></div>
        </div>
      </div>

      <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#eef1f5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}>
        <button
          onClick={generateMainImage}
          disabled={generatingImage || !canGenerateImage}
          className={`h-10 w-full rounded-[8px] text-[13px] font-semibold text-white ${generatingImage || !canGenerateImage ? "bg-[#C4C6CA]" : "bg-[#171A1D] hover:bg-[#2A2F36]"}`}
        >
          {generatingImage ? "正在生成..." : `一键生成套图与商品上架文案（${suiteImageCount}张）`}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className={`flex min-h-full ${resultViewActive ? "items-start justify-start" : "items-center justify-center"}`}>
          <div className={`w-full pb-10 text-center ${resultViewActive ? "max-w-none" : "max-w-[980px]"}`}>
            {!resultViewActive && (
              <>
                <h1 className="text-[32px] font-bold leading-tight text-[#171A1D]">商品主图</h1>
                <p className="mt-3 text-[14px] font-normal leading-6 text-[#5F6B7A]">
                  上传商品图，AI 即刻生成 <span className="font-semibold text-[#1683FF]">符合多电商平台规范</span> 的高转化率商品主图。
                </p>
              </>
            )}
            <div className={resultViewActive ? "mt-0" : "mt-12"}>
              {resultViewActive ? renderGenerationResults() : renderSuitePreview()}
            </div>
          </div>
        </div>
      </div>
      <button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md">?</button>

      {aiHelpOpen && (
        <div
          className="fixed z-40 w-[300px]"
          style={aiHelpPosition ? { top: aiHelpPosition.top, left: aiHelpPosition.left } : { top: 420, left: expanded ? 560 : 392 }}
        >
          <div className="rounded-[8px] bg-white p-4 shadow-[0_16px_48px_rgba(15,23,42,0.16)] ring-1 ring-[#E6EAF0]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#171A1D]">AI 帮写</h3>
              <button
                type="button"
                onClick={() => setAiHelpOpen(false)}
                className="grid h-6 w-6 place-items-center rounded-full text-[#8B949E] transition-colors hover:bg-[#F2F3F5] hover:text-[#171A1D]"
                aria-label="关闭 AI 帮写"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-[168px] rounded-[8px] border border-[#DDE3EC] bg-white p-3 text-left text-[13px] font-normal leading-6 text-[#171A1D]">
              {!aiHelpVisibleText && !aiHelpError ? (
                <div className="flex h-[142px] flex-col items-center justify-center text-[#8E9299]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#AEB4BC]" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#AEB4BC] [animation-delay:120ms]" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#AEB4BC] [animation-delay:240ms]" />
                  </div>
                  <div className="text-[13px] font-medium">AI 深度思考中...</div>
                </div>
              ) : (
                <>
                  <div className="max-h-[214px] overflow-y-auto whitespace-pre-wrap pr-1 custom-scrollbar">
                    {aiHelpVisibleText}
                    {(aiHelpStatus === "writing" || (aiHelpStatus === "ready" && aiHelpVisibleText !== aiHelpText)) && (
                      <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-[#171A1D]" />
                    )}
                  </div>
                  {aiHelpError && (
                    <div className="rounded-[8px] bg-[#FFF5F5] px-2 py-1.5 text-[12px] font-medium leading-5 text-[#C03535]">
                      {aiHelpError}
                    </div>
                  )}
                </>
              )}
            </div>
            {aiHelpFinishedWriting ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={expandPrompts}
                  disabled={expandingPrompts}
                  className="h-9 rounded-[8px] bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#ECEFF4] disabled:cursor-not-allowed disabled:text-[#8B949E]"
                >
                  重新帮写
                </button>
                <button
                  type="button"
                  onClick={confirmAiHelp}
                  className="h-9 rounded-[8px] bg-[#171A1D] text-[13px] font-semibold text-white transition-colors hover:bg-[#2A2F36]"
                >
                  确认
                </button>
              </div>
            ) : aiHelpFailed ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAiHelpOpen(false)}
                  className="h-9 rounded-[8px] bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#ECEFF4]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={expandPrompts}
                  disabled={expandingPrompts}
                  className="h-9 rounded-[8px] bg-[#171A1D] text-[13px] font-semibold text-white transition-colors hover:bg-[#2A2F36] disabled:cursor-not-allowed disabled:bg-[#C4C6CA]"
                >
                  重新帮写
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled
                className="mt-3 h-9 w-full rounded-[8px] bg-[#C4C6CA] text-[13px] font-semibold text-white"
              >
                正在帮写请稍后...
              </button>
            )}
          </div>
        </div>
      )}

      {generationActionPanel && (
        <div
          className="fixed z-40 w-[300px] rounded-[8px] bg-white p-4 shadow-[0_16px_48px_rgba(15,23,42,0.18)] ring-1 ring-[#E6EAF0]"
          style={{ top: generationActionPanel.top, left: generationActionPanel.left }}
        >
          {generationActionPanel.kind === "text" ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#171A1D]">编辑文字</h3>
                <button
                  type="button"
                  onClick={() => setGenerationActionPanel(null)}
                  className="grid h-6 w-6 place-items-center rounded-full text-[#8B949E] transition-colors hover:bg-[#F2F3F5] hover:text-[#171A1D]"
                  aria-label="关闭编辑文字"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {generationActionPanel.loading ? (
                <div className="flex h-[132px] flex-col items-center justify-center rounded-[8px] border border-[#E6EAF0] bg-white text-[#8B949E]">
                  <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                  <div className="text-[13px] font-medium">正在识别图片文案...</div>
                </div>
              ) : generationActionPanel.error ? (
                <div className="flex min-h-[96px] items-center justify-center rounded-[8px] border border-[#F6C8C8] bg-[#FFF4F4] p-3 text-center text-[12px] font-medium leading-5 text-[#C03535]">
                  {generationActionPanel.error}
                </div>
              ) : generationActionPanel.fields.some((field) => !field.removed) ? (
                <div className="space-y-2">
                  {generationActionPanel.fields.filter((field) => !field.removed).map((field) => (
                    <div key={field.id} className="flex h-10 items-center gap-2 rounded-[8px] border border-[#E6EAF0] bg-[#F8F9FB] px-3 focus-within:border-[#4690ff] focus-within:bg-white">
                      <input
                        value={field.value}
                        onChange={(event) => updateTextPanelField(field.id, event.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#171A1D] outline-none"
                        placeholder="输入图片文案"
                      />
                      <button
                        type="button"
                        onClick={() => removeTextPanelField(field.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[#8B949E] transition-colors hover:bg-[#ECEFF4] hover:text-[#171A1D]"
                        aria-label="删除这条文案"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : generationActionPanel.originalCount > 0 ? (
                <div className="flex min-h-[96px] items-center justify-center rounded-[8px] border border-[#E6EAF0] bg-[#F8F9FB] p-3 text-center text-[12px] font-medium text-[#8B949E]">
                  已删除全部图片文字
                </div>
              ) : (
                <div className="flex min-h-[96px] items-center justify-center rounded-[8px] border border-[#E6EAF0] bg-[#F8F9FB] p-3 text-center text-[12px] font-medium text-[#8B949E]">
                  未识别到图片文字
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGenerationActionPanel(null)}
                  className="h-9 rounded-[8px] bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#ECEFF4]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={runTextEdit}
                  disabled={generatedImages[generationActionPanel.slotId]?.status === "generating" || generationActionPanel.loading || Boolean(generationActionPanel.error) || generationActionPanel.originalCount === 0}
                  className="h-9 rounded-[8px] bg-[#8FBCFF] text-[13px] font-semibold text-white transition-colors hover:bg-[#6FA8FF] disabled:cursor-not-allowed disabled:bg-[#C4C6CA]"
                >
                  {generatedImages[generationActionPanel.slotId]?.status === "generating" ? "处理中..." : generationActionPanel.fields.some((field) => !field.removed && field.value.trim()) ? "确认改字 · 15" : "删除文字 · 15"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#171A1D]">输入微调方向（选填）</h3>
                <button
                  type="button"
                  onClick={() => setGenerationActionPanel(null)}
                  className="grid h-6 w-6 place-items-center rounded-full text-[#8B949E] transition-colors hover:bg-[#F2F3F5] hover:text-[#171A1D]"
                  aria-label="关闭 AI 改图"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={generationActionPanel.direction}
                onChange={(event) => updateImagePanelDirection(event.target.value)}
                className="h-[132px] w-full resize-none rounded-[8px] border border-[#E6EAF0] bg-white p-3 text-[12px] font-normal leading-5 text-[#171A1D] outline-none focus:border-[#4690ff]"
                placeholder="输入调整要求（选填，空着将默认重绘）。如：商品向左移动一点，换成浅灰色背景..."
              />
              <p className="mt-2 text-[12px] font-normal text-[#8B949E]">重新生成将消耗 15 点。</p>
              <button
                type="button"
                onClick={runImageRetouch}
                disabled={generatedImages[generationActionPanel.slotId]?.status === "generating"}
                className="mt-3 h-9 w-full rounded-[8px] bg-[#171A1D] text-[13px] font-semibold text-white transition-colors hover:bg-[#2A2F36] disabled:cursor-not-allowed disabled:bg-[#C4C6CA]"
              >
                {generatedImages[generationActionPanel.slotId]?.status === "generating" ? "生成中..." : "重新生成 · 15"}
              </button>
            </>
          )}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6" onClick={() => setLightbox(null)}>
          <div className="relative flex max-h-full max-w-full flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex w-full items-center justify-between gap-4">
              <span className="text-[14px] font-bold text-white">{lightbox.title}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadImageToLocal(lightbox.src, lightbox.title)}
                  className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f0f3f8]"
                >
                  <Download className="h-4 w-4" /> 保存到本地
                </button>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <img src={lightbox.src} alt={lightbox.title} className="max-h-[80vh] max-w-[90vw] rounded-xl bg-white object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
