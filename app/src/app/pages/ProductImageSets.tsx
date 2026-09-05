import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AlertCircle, Check, ChevronDown, Download, Lightbulb, Loader2, Minus, MoreHorizontal, PenLine, Plus, Sparkles, Trash2, Upload, X, ZoomIn } from "lucide-react";
import mainHeadphone from "@/imports/image-9.png";
import sceneDisplay from "@/imports/image-10.png";
import modelScene from "@/imports/image-11.png";
import detailExplain from "@/imports/image-12.png";
import sellingPoint from "@/imports/image-13.png";
import suiteArrow from "@/imports/箭头.svg";
import { useSidebar } from "@/app/components/SidebarContext";
import { AiHelpPopover } from "@/app/components/AiHelpPopover";
import { ProductImageHelpTooltip } from "@/app/components/ProductImageHelpTooltip";
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

const MAX_PRODUCT_UPLOADS = 6;

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

type PromptRequestSlot = {
  id: string;
  name: string;
  type: string;
  typeKey?: CustomSuiteTypeKey;
  sequence: number;
};

type AiHelpStatus = "idle" | "thinking" | "writing" | "ready" | "error";

type AiHelpStreamEvent =
  | { type: "thinking"; text?: string }
  | { type: "content"; text?: string }
  | { type: "done"; text?: string; plan?: string; prompts?: ExpandedPrompt[]; model?: string; usage?: PromptExpansionPayload["usage"] }
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

type ResizeTargetOption = {
  id: string;
  label: string;
  width: number;
  height: number;
  sizeLabel?: string;
};

type ResizePanelState = {
  mode: "single" | "batch";
  slotId?: string;
  top: number;
  left: number;
  selectedId: string;
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

function safeFileName(value: string, fallback = "image") {
  return value.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || fallback;
}

function inferImageExt(blob: Blob, src: string) {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("gif")) return "gif";
  if (blob.type.includes("jpeg") || blob.type.includes("jpg")) return "jpg";
  const pathMatch = src.split("?")[0]?.match(/\.([a-zA-Z0-9]{2,5})$/);
  return pathMatch?.[1]?.toLowerCase() || "png";
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZipBlob(files: Array<{ path: string; data: Uint8Array }>) {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const writeHeader = (size: number, writer: (view: DataView) => void) => {
    const bytes = new Uint8Array(size);
    writer(new DataView(bytes.buffer));
    return bytes;
  };

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path);
    const checksum = crc32(file.data);
    const localHeader = writeHeader(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, checksum, true);
      view.setUint32(18, file.data.byteLength, true);
      view.setUint32(22, file.data.byteLength, true);
      view.setUint16(26, nameBytes.byteLength, true);
      view.setUint16(28, 0, true);
    });
    parts.push(localHeader, nameBytes, file.data);

    const centralHeader = writeHeader(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint16(14, 0, true);
      view.setUint32(16, checksum, true);
      view.setUint32(20, file.data.byteLength, true);
      view.setUint32(24, file.data.byteLength, true);
      view.setUint16(28, nameBytes.byteLength, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, offset, true);
    });
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.byteLength + nameBytes.byteLength + file.data.byteLength;
  });

  const centralSize = centralParts.reduce((sum, item) => sum + item.byteLength, 0);
  const endHeader = writeHeader(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, offset, true);
    view.setUint16(20, 0, true);
  });

  return new Blob([...parts, ...centralParts, endHeader], { type: "application/zip" });
}

function downloadBlobToLocal(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

async function downloadImageToLocal(src: string, filename: string) {
  const safeName = safeFileName(filename);
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    downloadBlobToLocal(blob, `${safeName}.${inferImageExt(blob, src)}`);
  } catch {
    window.open(src, "_blank");
  }
}

const RESIZE_TARGET_OPTIONS: ResizeTargetOption[] = [
  { id: "a-plus-normal", label: "普通A+", width: 970, height: 600, sizeLabel: "970:600" },
  { id: "a-plus-web", label: "高级A+（Web端）", width: 1464, height: 600, sizeLabel: "1464:600" },
  { id: "a-plus-mobile", label: "高级A+（移动端）", width: 600, height: 450, sizeLabel: "600:450" },
  { id: "1:1", label: "1:1", width: 1440, height: 1440 },
  { id: "3:4", label: "3:4", width: 1440, height: 1920 },
  { id: "9:16", label: "9:16", width: 1080, height: 1920 },
  { id: "16:9", label: "16:9", width: 1920, height: 1080 },
];

function getResizeTargetSize(ratio: string) {
  const option = RESIZE_TARGET_OPTIONS.find((item) => item.id === ratio);
  if (option) return { width: option.width, height: option.height };
  if (ratio === "3:4") return { width: 1440, height: 1920 };
  if (ratio === "4:3") return { width: 1920, height: 1440 };
  if (ratio === "9:16") return { width: 1080, height: 1920 };
  if (ratio === "16:9") return { width: 1920, height: 1080 };
  return { width: 1440, height: 1440 };
}

async function resizeImageToCurrentRatio(src: string, ratio: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败，无法改尺寸"));
    img.src = src;
  });
  const { width, height } = getResizeTargetSize(ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持图片尺寸处理");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const padding = Math.round(Math.min(width, height) * 0.02);
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;
  const scale = Math.min(drawWidth / image.naturalWidth, drawHeight / image.naturalHeight);
  const targetWidth = image.naturalWidth * scale;
  const targetHeight = image.naturalHeight * scale;
  const x = (width - targetWidth) / 2;
  const y = (height - targetHeight) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, x, y, targetWidth, targetHeight);
  return canvas.toDataURL("image/png");
}
 
const DEFAULT_PROMPT_PREVIEWS: ExpandedPrompt[] = [
  { id: "image-1", name: "图1｜白底图", type: "白底图", prompt: "" },
  { id: "image-2", name: "图2｜场景图", type: "场景图", prompt: "" },
  { id: "image-3", name: "图3｜卖点图", type: "卖点图", prompt: "" },
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
  { key: "white", label: "白底图", desc: "纯白背景，单主体合规商品主图" },
  { key: "scene", label: "场景图", desc: "单一真实使用场景，突出商品佩戴/使用效果" },
  { key: "selling", label: "卖点图", desc: "聚焦单个核心卖点，配合短文案说明" },
  { key: "function", label: "细节说明", desc: "展示商品可见细节、结构、使用方式和参数信息" },
  { key: "detail", label: "卖点详解", desc: "拆解商品核心卖点、适用场景和购买理由" },
] as const;

type CustomSuiteTypeKey = typeof CUSTOM_SUITE_TYPES[number]["key"];
type AiHelpFieldKey = typeof AI_HELP_INFORMATION_FIELDS[number]["key"];
type CustomSuiteVariant = { theme: string; composition: string; copy: string; avoid: string };

const CUSTOM_TYPE_VARIANTS: Record<CustomSuiteTypeKey, CustomSuiteVariant[]> = {
  white: [
    {
      theme: "标准白底主图",
      composition: "单一商品主体居中展示，完整露出商品轮廓和主要结构",
      copy: "不添加任何画面文案",
      avoid: "不要多角度拼图、不要尺寸标注、不要局部放大窗、不要人物或生活场景",
    },
    {
      theme: "白底侧摆主图",
      composition: "单一商品主体略微侧摆，保持纯白背景和完整商品形态",
      copy: "不添加任何画面文案",
      avoid: "不要重复标准正面构图、不要拼贴、不要道具、不要参数说明",
    },
    {
      theme: "白底细节清晰主图",
      composition: "单一商品主体在纯白背景中清晰呈现可见细节，主体占比稳定",
      copy: "不添加任何画面文案",
      avoid: "不要做成详情页、不要多图组合、不要引线标注、不要促销元素",
    },
  ],
  scene: [
    {
      theme: "场景一",
      composition: "围绕商品信息中的第一个适用场景设计画面，使用完整单一场景构图，商品必须是第一视觉中心",
      copy: "标题和标签从当前商品信息中提炼，不使用其他商品的卖点词",
      avoid: "不要四宫格拼贴，不要复用其他场景图的背景、人物姿势、标题或标签",
    },
    {
      theme: "场景二",
      composition: "围绕商品信息中的第二个适用场景设计画面，与第一张保持不同背景、距离和人物角度",
      copy: "标题和标签只来自当前商品名称、核心卖点或期望场景",
      avoid: "不要复用上一张场景图的标题、标签、构图和背景",
    },
    {
      theme: "场景三",
      composition: "围绕商品信息中的第三个适用场景设计画面，改变光线氛围、画面距离和主体朝向",
      copy: "标题和标签必须区别于前两张场景图",
      avoid: "不要只拍局部，不要使用前两张场景图的背景和文案",
    },
    {
      theme: "场景四",
      composition: "围绕商品信息中的另一个可用场景或人群需求设计画面，突出商品用途",
      copy: "标题和标签从当前商品适用人群或使用场景中提炼",
      avoid: "不要重复前三张场景图的视觉主题",
    },
    {
      theme: "场景五",
      composition: "围绕当前商品的补充使用场景设计画面，整体风格与前面场景明显区分",
      copy: "标题和标签不复用前面场景图",
      avoid: "不要引入当前商品信息之外的具体商品属性",
    },
  ],
  selling: [
    {
      theme: "核心卖点一",
      composition: "围绕当前商品信息中的第一条核心卖点做视觉表达，可用商品局部、使用效果或放大窗证明",
      copy: "主标题从第一条核心卖点提炼，标签只使用当前商品信息中的词",
      avoid: "不要讲第二、第三卖点，不要使用其他商品的造型、纹理或配色词",
    },
    {
      theme: "核心卖点二",
      composition: "围绕当前商品信息中的第二条核心卖点做视觉表达，与第一张卖点图使用不同版式和证据",
      copy: "主标题从第二条核心卖点提炼，不能复用第一张卖点图标题",
      avoid: "不要重复第一卖点，不要使用当前商品信息之外的材质、颜色、形状或功能",
    },
    {
      theme: "核心卖点三",
      composition: "围绕当前商品信息中的第三条核心卖点做视觉表达，突出不同卖点证据和信息层级",
      copy: "主标题从第三条核心卖点提炼，标签与前两张不同",
      avoid: "不要重复前两张卖点，不要引入未在图片或输入框出现的商品属性",
    },
    {
      theme: "补充卖点四",
      composition: "从当前商品的适用人群、场景或参数中提炼一个补充购买理由，做成卖点图",
      copy: "主标题必须来自当前商品信息，不复用前三张卖点图",
      avoid: "不要编造参数，不要使用固定示例商品词",
    },
    {
      theme: "补充卖点五",
      composition: "从当前商品信息中提炼另一个补充购买理由，使用与前面不同的构图和版式",
      copy: "主标题和标签只使用当前商品可确认信息",
      avoid: "不要复用前面卖点图的主题、标题和版式",
    },
  ],
  function: [
    {
      theme: "结构说明",
      composition: "用引线和局部放大说明图片中可见的商品主体结构、连接关系或关键部件位置",
      copy: "文案只写可见结构名称和简短说明",
      avoid: "不要编造材质等级、尺寸、重量、工艺认证",
    },
    {
      theme: "佩戴方式",
      composition: "展示耳侧佩戴方式和上耳效果，可用一处局部放大说明佩戴位置",
      copy: "文案强调佩戴展示，不写无法确认的功能参数",
      avoid: "不要重复结构说明；不要做成卖点海报",
    },
    {
      theme: "细节特写",
      composition: "放大展示珠饰、边缘、纹理或可见装饰细节，背景简洁",
      copy: "文案围绕真实可见细节",
      avoid: "不要加入图片中不存在的接口、材质、认证或数值",
    },
  ],
  detail: [
    {
      theme: "核心卖点汇总",
      composition: "主商品大图搭配3个信息点，分别说明当前商品信息里的不同卖点",
      copy: "标题建议：三大亮点；信息点文案必须互不重复",
      avoid: "不要只讲单一卖点；不要大段文字",
    },
    {
      theme: "人群场景详解",
      composition: "主商品搭配人群和场景小窗，说明适合通勤、约会、出游等不同需求",
      copy: "标题建议：多场景百搭；标签按场景拆分",
      avoid: "不要重复核心卖点汇总版式；不要虚构适用场景之外的功能",
    },
    {
      theme: "购买理由拆解",
      composition: "左右分栏或卡片式布局，商品清晰突出，拆解设计感、质感、搭配价值",
      copy: "标题建议：为什么值得入手；短句说明购买理由",
      avoid: "不要复用前两张布局；不要出现无依据参数",
    },
  ],
};

const DEFAULT_CUSTOM_SUITE_COUNTS: Record<CustomSuiteTypeKey, number> = {
  white: 1,
  scene: 1,
  selling: 1,
  function: 1,
  detail: 1,
};

const CUSTOM_SCENE_FALLBACKS = ["主要使用场景", "第二使用场景", "第三使用场景", "补充使用场景", "人群适配场景"];
const CUSTOM_SELLING_FALLBACKS = ["核心卖点一", "核心卖点二", "核心卖点三", "补充卖点四", "补充卖点五"];
const CUSTOM_DETAIL_FALLBACKS = ["核心卖点汇总", "人群场景详解", "购买理由拆解"];

function cleanCustomTopic(value: string) {
  return String(value || "")
    .replace(/^\s*(?:\d+\s*[、.．]\s*)?/, "")
    .replace(/^(?:核心卖点|期望场景|适用场景|具体参数|规格参数|商品参数)\s*[:：]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCustomTopics(value?: string, { splitComma = false } = {}) {
  const source = String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[；;]/g, "\n")
    .replace(splitComma ? /[、，,]/g : /[、]/g, "\n");
  const seen = new Set<string>();
  return source
    .split(/\n+/)
    .map(cleanCustomTopic)
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, 8);
}

function shortCustomTitle(value: string, fallback: string) {
  const title = cleanCustomTopic(value)
    .split(/[，,、。；;：:]/)[0]
    .trim();
  return (title || fallback).slice(0, 14);
}

function buildDynamicCustomVariant(
  key: CustomSuiteTypeKey,
  index: number,
  fields: Partial<Record<AiHelpFieldKey, string>>,
): CustomSuiteVariant {
  const sellingTopics = splitCustomTopics(fields.sellingPoints);
  const sceneTopics = splitCustomTopics(fields.scenario, { splitComma: true });
  const specTopics = splitCustomTopics(fields.specs, { splitComma: true });
  const audienceTopics = splitCustomTopics(fields.audience, { splitComma: true });
  const fallback = CUSTOM_TYPE_VARIANTS[key][index % CUSTOM_TYPE_VARIANTS[key].length];

  if (key === "scene") {
    const scene = sceneTopics[index] || sceneTopics[index % sceneTopics.length] || CUSTOM_SCENE_FALLBACKS[index % CUSTOM_SCENE_FALLBACKS.length];
    const audience = audienceTopics[index % Math.max(audienceTopics.length, 1)] || "目标人群";
    return {
      theme: scene,
      composition: `围绕“${scene}”设计一个完整单一场景，结合“${audience}”的使用/佩戴需求，改变背景、人物姿势、镜头距离和光线氛围，商品必须清晰突出`,
      copy: `标题建议：${shortCustomTitle(scene, fallback.theme)}；标签从当前商品卖点中提炼，避免复用其他场景图`,
      avoid: `不要使用与“${scene}”无关的商品属性；不要复用同批其他场景图的背景、人物姿势、标题或标签`,
    };
  }

  if (key === "selling") {
    const point = sellingTopics[index] || sellingTopics[index % sellingTopics.length] || CUSTOM_SELLING_FALLBACKS[index % CUSTOM_SELLING_FALLBACKS.length];
    return {
      theme: shortCustomTitle(point, fallback.theme),
      composition: `只围绕当前商品卖点“${point}”做视觉表达，用商品局部、佩戴/使用效果、放大窗或对比区证明这个卖点`,
      copy: `主标题从“${point}”提炼，短标签只使用当前商品信息中的词`,
      avoid: "不要讲其他卖点，不要使用当前商品信息之外的造型、纹理、配色、材质、功能或参数",
    };
  }

  if (key === "function") {
    const spec = specTopics[index] || specTopics[index % specTopics.length] || fallback.theme;
    return {
      theme: shortCustomTitle(spec, fallback.theme),
      composition: `围绕“${spec}”这个当前商品可见/已填写信息做细节说明，可用引线、局部放大或信息小窗`,
      copy: `文案只说明“${spec}”相关的可确认信息`,
      avoid: "不要编造图片中不可见、用户未填写的材质等级、尺寸、重量、认证或功能参数",
    };
  }

  if (key === "detail") {
    const first = sellingTopics[index] || sellingTopics[0] || CUSTOM_DETAIL_FALLBACKS[index % CUSTOM_DETAIL_FALLBACKS.length];
    const second = sellingTopics[(index + 1) % Math.max(sellingTopics.length, 1)] || sceneTopics[0] || "";
    const detailTheme = [first, second].filter(Boolean).map((item) => shortCustomTitle(item, "")).join(" + ") || fallback.theme;
    return {
      theme: detailTheme,
      composition: `围绕当前商品的“${detailTheme}”做综合拆解，主商品清晰突出，信息区拆分为2到3个不同购买理由`,
      copy: "标题和信息点必须来自当前商品卖点、适用场景或具体参数",
      avoid: "不要使用其他商品的固定示例词，不要虚构当前商品未提供的属性",
    };
  }

  return fallback;
}

export function ProductImageSets() {
  const { expanded } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const aiHelpButtonRef = useRef<HTMLButtonElement | null>(null);
  const resizePanelRef = useRef<HTMLDivElement | null>(null);
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
  const [selectedGeneratedImageIds, setSelectedGeneratedImageIds] = useState<string[]>([]);
  const [generationSlots, setGenerationSlots] = useState<GenerationSlot[]>([]);
  const [resultViewActive, setResultViewActive] = useState(false);
  const [aiMainPrompt, setAiMainPrompt] = useState("");
  const [aiHelpOpen, setAiHelpOpen] = useState(false);
  const [aiHelpStatus, setAiHelpStatus] = useState<AiHelpStatus>("idle");
  const [aiHelpText, setAiHelpText] = useState("");
  const [aiHelpVisibleText, setAiHelpVisibleText] = useState("");
  const [aiHelpThinkingText, setAiHelpThinkingText] = useState("");
  const [aiHelpError, setAiHelpError] = useState("");
  const [aiHelpPromptExpansion, setAiHelpPromptExpansion] = useState<PromptExpansionPayload | null>(null);
  const [aiHelpPosition, setAiHelpPosition] = useState<{ top: number; left: number } | null>(null);
  const [generationActionPanel, setGenerationActionPanel] = useState<GenerationActionPanel | null>(null);
  const [resizePanel, setResizePanel] = useState<ResizePanelState | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);

  useEffect(() => {
    if (!resizePanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setResizePanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resizePanel]);

  useEffect(() => {
    if (!resizePanel) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (resizePanelRef.current?.contains(target)) return;
      if (target.closest("[data-resize-trigger='true']")) return;
      setResizePanel(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [resizePanel]);

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
  const uploadedImageUrls = uploadedImages.map((image) => image.url).filter(Boolean);
  const hasSelectedExpandedPrompt = expandedPrompts.length ? expandedPrompts.some((item) => selectedPromptIds.includes(item.id) && item.prompt.trim()) : false;
  const canGenerateImage = Boolean(uploadedImage && (expandedPrompts.length ? hasSelectedExpandedPrompt : true));

  function buildCustomSuitePrompt(item: typeof CUSTOM_SUITE_TYPES[number], index: number, total: number) {
    const baseInfo = generationText.trim() || promptExpansion?.information?.trim() || "以用户上传商品原图中可见信息为准";
    const infoFields = parseAiHelpFields(baseInfo) || extractLooseAiHelpFields(baseInfo) || {};
    const variant = buildDynamicCustomVariant(item.key, index, infoFields);
    const commonRules = [
      `商品信息：${baseInfo}`,
      "必须以用户上传的商品原图为唯一商品主体，保持商品外观、颜色、结构、可见细节和佩戴/使用方式一致，不替换商品，不生成其他品类。",
      `本张类型：${item.label}`,
      `本张独立主题：${variant.theme}`,
      `本张构图要求：${variant.composition}`,
      `本张文案方向：${variant.copy}`,
      `本张禁止事项：${variant.avoid}`,
      total > 1 ? `同类型去重要求：这是${item.label}的第 ${index + 1} 张，共 ${total} 张；必须与其他${item.label}在主题、场景、主体角度、版式、标题和标签文案上明显不同。` : "",
      `输出比例：${settings.ratio}`,
      `页面语言：${settings.language}`,
    ];
    if (item.key === "white") {
      return [
        ...commonRules,
        "画面要求：纯白或接近纯白背景，单一完整商品主体居中展示，主体清晰、边缘干净、光线柔和均匀，符合电商白底主图审美。",
        "白底图禁止：不要四宫格、不要多图拼贴、不要尺寸标注、不要引线、不要卖点文案、不要标题、不要图标、不要促销角标、不要人物和场景道具。",
      ].join("\n");
    }
    if (item.key === "scene") {
      return [
        ...commonRules,
        "画面要求：生成一个完整真实的使用场景，商品必须是第一视觉中心，可有人物佩戴/使用或自然陈列，背景服务于商品用途和风格，光影自然，构图像一张完整场景广告图。",
        "场景图禁止：不要四宫格、不要多场景拼贴、不要参数表、不要尺寸标注、不要把商品变成配角，画面文案最多保留一个短标题和少量短标签。同批多张场景图不得使用同一个人物姿势、同一个背景、同一个标题或同一组标签。",
      ].join("\n");
    }
    if (item.key === "selling") {
      return [
        ...commonRules,
        "画面要求：只聚焦一个核心卖点，用商品局部、佩戴效果、放大窗、对比区或视觉证据说明优势；版式要像电商卖点海报，标题短、标签少、层级清晰。",
        "卖点图禁止：不要做成纯场景图，不要堆叠多个卖点，不要四宫格场景拼贴，不要虚构材质等级、尺寸、认证、功效或其他图片中不可确认的信息。同批多张卖点图必须分别讲不同卖点，不得复用同一个主标题、同一个卖点词或同一套版式。",
      ].join("\n");
    }
    if (item.key === "function") {
      return [
        ...commonRules,
        "画面要求：围绕一个真实可见细节、结构、部件、规格或使用方式进行说明，可使用局部放大、引线、信息小窗和少量短文案，信息必须来自图片可见内容或用户明确填写内容。",
        "细节说明禁止：不要编造看不见的参数，不要重复卖点图的主题，不要把画面做成生活场景拼贴。",
      ].join("\n");
    }
    return [
      ...commonRules,
      "画面要求：围绕2到3个核心卖点做综合拆解，可使用图标、短文案、参数区、适用场景小窗或产品局部组合，但主商品仍要清晰突出，信息层级明确。",
      "卖点详解禁止：不要复用白底图构图，不要做成无重点的大段文字，不要虚构品牌、型号、功效、材质等级或具体数值。",
    ].join("\n");
  }

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
          return {
            id: `custom-${item.key}-${index + 1}-${Date.now()}-${n}`,
            name: `${String(n).padStart(2, "0")} ${item.label}`,
            type: item.label,
            typeKey: item.key,
            prompt: buildCustomSuitePrompt(item, index, count),
          };
        });
      });
    }
    if (expandedPrompts.length) {
      return expandedPrompts.filter((item) => selectedPromptIds.includes(item.id));
    }
    return DEFAULT_PROMPT_PREVIEWS.map((item) => ({ ...item, prompt: generationText }));
  }

  function buildPromptRequestSlots(queue: GenerationSlot[]): PromptRequestSlot[] {
    return queue.map((item, index) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      typeKey: item.typeKey,
      sequence: index + 1,
    }));
  }

  function buildReferencedReportText() {
    const reportLines = reportMainPoints.map((item, index) => {
      const parts = [
        item.title,
        item.customerBenefit,
        item.visualExpression,
        item.dataBasis,
      ].map((value) => String(value || "").trim()).filter(Boolean);
      return parts.length ? `${index + 1}. ${parts.join("；")}` : "";
    }).filter(Boolean);
    return [
      selectedReport ? `已选择AI报告：${selectedReport.label || selectedReport.keyword || ""}` : "",
      reportMainPrompt,
      reportLines.length ? `报告主图卖点：\n${reportLines.join("\n")}` : "",
    ].map((item) => item.trim()).filter(Boolean).join("\n\n");
  }

  async function prepareGenerationQueue(queue: GenerationSlot[]): Promise<GenerationSlot[]> {
    const information = generationText.trim() || promptExpansion?.information?.trim() || "以用户上传商品原图中可见信息为准";

    const response = await fetch("/api/product-sets/generate-prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings,
        baseText: generationText,
        reportText: buildReferencedReportText(),
        information,
        image: uploadedImage,
        images: uploadedImageUrls,
        promptSlots: buildPromptRequestSlots(queue),
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || "生成主图提示词失败");

    const prompts = Array.isArray(data.prompts)
      ? data.prompts.filter((item: ExpandedPrompt) => item?.id && item?.prompt?.trim())
      : [];
    const promptMap = new Map(prompts.map((item: ExpandedPrompt) => [item.id, item]));
    const nextQueue = queue.map((item) => {
      const generatedPrompt = promptMap.get(item.id);
      return generatedPrompt ? { ...item, ...generatedPrompt, typeKey: item.typeKey } : item;
    });
    if (nextQueue.some((item) => !String(item.prompt).trim())) {
      throw new Error("生成主图提示词不完整，请重试。");
    }
    setPromptExpansion({
      ok: true,
      information: String(data.information || information),
      plan: String(data.designPlan || ""),
      prompts,
      model: data.model,
      usage: data.usage || null,
    });
    setSelectedPromptIds(prompts.map((item: ExpandedPrompt) => item.id));
    return nextQueue;
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
      setSelectedGeneratedImageIds([]);
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
    const availableSlots = MAX_PRODUCT_UPLOADS - uploadedImages.length;
    if (availableSlots <= 0) {
      setError(`同一产品最多上传 ${MAX_PRODUCT_UPLOADS} 张图片`);
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
      setUploadedImages((current) => [...current, ...nextImages].slice(0, MAX_PRODUCT_UPLOADS));
      setGeneratedImages({});
      setGenerationSlots([]);
      setPromptExpansion(null);
      setAiHelpPromptExpansion(null);
      setSelectedPromptIds(DEFAULT_SLOT_IDS);
      setResultViewActive(false);
      setGenerationActionPanel(null);
      setError(selectedFiles.length > availableSlots ? `同一产品最多上传 ${MAX_PRODUCT_UPLOADS} 张图片，已保留前 ${MAX_PRODUCT_UPLOADS} 张。` : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function removeUploadedImage(id: string) {
    setUploadedImages((current) => current.filter((item) => item.id !== id));
    setGeneratedImages({});
    setSelectedGeneratedImageIds([]);
    setGenerationSlots([]);
    setPromptExpansion(null);
    setAiHelpPromptExpansion(null);
    setSelectedPromptIds(DEFAULT_SLOT_IDS);
    setResultViewActive(false);
    setGenerationActionPanel(null);
    setError("");
  }

  async function generateMainImage() {
    if (!uploadedImage) {
      setError("请先上传商品原图");
      return;
    }
    const initialQueue = buildGenerationQueue();
    if (!initialQueue.length) {
      setError("请至少选择一张要生成的图片");
      return;
    }
    setGeneratingImage(true);
    setError("");
    let failedCount = 0;
    const batchSaved: Array<{ name: string; url: string; type: string }> = [];
    const batchStamp = new Date();
    const stampText = `${batchStamp.getFullYear()}${String(batchStamp.getMonth() + 1).padStart(2, "0")}${String(batchStamp.getDate()).padStart(2, "0")}-${String(batchStamp.getHours()).padStart(2, "0")}${String(batchStamp.getMinutes()).padStart(2, "0")}${String(batchStamp.getSeconds()).padStart(2, "0")}`;
    const productLabel = selectedReport?.keyword || selectedReport?.label || "商品";
    try {
      setGenerationSlots(initialQueue);
      setResultViewActive(true);
      setGenerationActionPanel(null);
      setResizePanel(null);
      setSelectedGeneratedImageIds([]);
      setGeneratedImages(initialQueue.reduce<Record<string, GeneratedImageResult>>((map, item) => {
        map[item.id] = { status: "generating" };
        return map;
      }, {}));
      const queue = await prepareGenerationQueue(initialQueue);
      if (!queue.length) throw new Error("请至少选择一张要生成的图片");
      if (queue.some((item) => !String(item.prompt).trim())) throw new Error("主图提示词生成不完整，请重试。");
      setGenerationSlots(queue);
      setGeneratedImages(queue.reduce<Record<string, GeneratedImageResult>>((map, item) => {
        map[item.id] = { status: "generating" };
        return map;
      }, {}));
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
              images: uploadedImageUrls,
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
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setGeneratedImages((current) => {
        const next = { ...current };
        Object.keys(next).forEach((id) => {
          if (next[id]?.status === "generating") next[id] = { status: "failed", error: message };
        });
        return next;
      });
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
    setAiHelpPromptExpansion(null);
    setExpandingPrompts(true);
    setError("");
    setPromptExpansion(null);
    setGeneratedImages({});
    setSelectedGeneratedImageIds([]);
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
          images: uploadedImageUrls,
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
          const prompts = Array.isArray(event.prompts)
            ? event.prompts.filter((item) => item?.id && item?.name && item?.type && item?.prompt?.trim())
            : [];
          setAiHelpPromptExpansion(prompts.length ? {
            ok: true,
            information: text,
            plan: event.plan || "",
            prompts,
            model: event.model,
            usage: event.usage || null,
          } : null);
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
    if (aiHelpPromptExpansion?.prompts?.length) {
      setPromptExpansion({
        ...aiHelpPromptExpansion,
        ok: true,
        information: text,
        prompts: aiHelpPromptExpansion.prompts,
      });
      setSelectedPromptIds(aiHelpPromptExpansion.prompts.map((item) => item.id));
    }
    setAiHelpOpen(false);
    setAiHelpStatus("idle");
    setAiHelpError("");
    setAiHelpThinkingText("");
  }

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

  function getDefaultResizeTargetId() {
    return RESIZE_TARGET_OPTIONS.some((item) => item.id === settings.ratio) ? settings.ratio : "1:1";
  }

  function getResizeTargetOption(targetId: string) {
    return RESIZE_TARGET_OPTIONS.find((item) => item.id === targetId) || RESIZE_TARGET_OPTIONS.find((item) => item.id === "1:1") || RESIZE_TARGET_OPTIONS[0];
  }

  function getResizeGenerationRatio(targetId: string) {
    const option = getResizeTargetOption(targetId);
    if (!option) return settings.ratio;
    return option.sizeLabel || option.id;
  }

  function buildSmartResizePrompt(slot: GenerationSlot | undefined, targetId: string) {
    const option = getResizeTargetOption(targetId);
    const targetLabel = option ? `${option.label}${option.sizeLabel ? `（${option.sizeLabel}）` : ""}` : targetId;
    return [
      "你是电商图片智能改尺寸助手。请基于参考图重新生成一张目标尺寸图片。",
      "",
      "【参考图优先级】",
      "参考图1：用户上传商品原图，只用于校验商品真实结构、颜色、材质、比例、佩戴关系和关键细节，不要把参考图1的原始拍摄构图直接套回结果。",
      "参考图2：当前已生成图片，是这次改尺寸的核心依据。用户认可这张图的布局、风格、样式、背景方向、商品表现、文案内容和商业版式。",
      "",
      "【当前图位】",
      `图位名称：${slot?.name || "未命名图位"}`,
      `图位类型：${slot?.type || "商品图"}`,
      `原始生图提示词：${String(slot?.prompt || "").trim() || "未提供"}`,
      "",
      "【改尺寸目标】",
      `目标尺寸/比例：${targetLabel}`,
      `输出画面语种：${settings.language || "中文"}`,
      "",
      "【必须遵守】",
      "1. 这是尺寸适配，不是重新设计；必须尽量保留参考图2的构图骨架、主体相对位置、视觉风格、色调、光影、材质质感、文字内容、文字层级和装饰元素。",
      "2. 可以为适配新比例做必要的画布扩展、背景自然延展、留白调整、元素轻微缩放或位置微调，但不能把已有设计推翻重做。",
      "3. 不要使用简单白色填充边框，不要出现大面积空白边，不要把原图生硬居中贴在新画布里。",
      "4. 商品真实结构必须以参考图1校验，不得改变商品款式、颜色、材质、结构连接、佩戴关系或关键细节。",
      "5. 已有文案必须保留原意和主要内容；只允许为适配新画布做轻微排版移动和字号微调，不能新增无关卖点、品牌、参数、促销角标或水印。",
      "6. 如果目标比例更窄或更高，要自然延展同风格场景或背景，并保证主体和文字不被裁切、不被遮挡、不变形。",
      "",
      "输出：只返回一张完成尺寸适配后的电商图片。",
    ].join("\n");
  }

  function getResizePanelPosition(rect: DOMRect, width = 400, placement: "left" | "bottom" = "left") {
    const gap = 12;
    const viewportWidth = window.innerWidth || 1440;
    const viewportHeight = window.innerHeight || 900;
    if (placement === "bottom") {
      return {
        left: Math.max(16, Math.min(rect.right - width, viewportWidth - width - 16)),
        top: Math.max(16, Math.min(rect.bottom + gap, viewportHeight - 360)),
      };
    }
    return {
      left: Math.max(16, Math.min(rect.left - width - gap, viewportWidth - width - 16)),
      top: Math.max(16, Math.min(rect.top - 72, viewportHeight - 360)),
    };
  }

  function openResizePanel(event: MouseEvent<HTMLButtonElement>, mode: "single" | "batch", slotId?: string, placement: "left" | "bottom" = "left") {
    event.stopPropagation();
    if (resizePanel?.mode === mode && resizePanel.slotId === slotId) {
      setResizePanel(null);
      return;
    }
    const position = getResizePanelPosition(event.currentTarget.getBoundingClientRect(), 400, placement);
    setResizePanel({
      mode,
      slotId,
      selectedId: resizePanel?.selectedId || getDefaultResizeTargetId(),
      ...position,
    });
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

  function getSelectableGeneratedImageIds(slots: GenerationSlot[]) {
    return slots
      .filter((slot) => {
        const result = generatedImages[slot.id];
        return result?.status === "done" && Boolean(result.url || result.fileUrl);
      })
      .map((slot) => slot.id);
  }

  function toggleGeneratedImageSelection(slotId: string) {
    const result = generatedImages[slotId];
    if (result?.status !== "done" || !(result.url || result.fileUrl)) return;
    setSelectedGeneratedImageIds((current) => (
      current.includes(slotId)
        ? current.filter((id) => id !== slotId)
        : [...current, slotId]
    ));
  }

  function toggleAllGeneratedImages(slots: GenerationSlot[]) {
    const selectableIds = getSelectableGeneratedImageIds(slots);
    if (!selectableIds.length) return;
    setSelectedGeneratedImageIds((current) => {
      const allSelected = selectableIds.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !selectableIds.includes(id));
      return Array.from(new Set([...current, ...selectableIds]));
    });
  }

  function getMainImageDownloadFolderName() {
    const fields = (parseAiHelpFields(generationText) || extractLooseAiHelpFields(generationText) || {}) as Partial<Record<AiHelpFieldKey, string>>;
    const uploadedName = uploadedImages[0]?.name?.replace(/\.[^.]+$/, "");
    const productName = fields.name || selectedReport?.keyword || selectedReport?.label || uploadedName || "商品";
    return `${safeFileName(productName, "商品")}主图`;
  }

  async function downloadSelectedGeneratedImages(slots: GenerationSlot[]) {
    const selectedSet = new Set(selectedGeneratedImageIds);
    const items: Array<{ src: string; title: string }> = [];
    slots.forEach((slot, index) => {
      if (!selectedSet.has(slot.id)) return;
      const result = generatedImages[slot.id];
      const src = result?.fileUrl || result?.url || "";
      if (!src) return;
      items.push({
        src,
        title: `${String(index + 1).padStart(2, "0")} ${slot.type || "主图"}`,
      });
    });
    if (!items.length) return;
    const folderName = getMainImageDownloadFolderName();
    const files = await Promise.all(items.map(async (item, index) => {
      const response = await fetch(item.src);
      if (!response.ok) throw new Error("图片下载失败，请稍后重试");
      const blob = await response.blob();
      return {
        path: `${folderName}/${String(index + 1).padStart(2, "0")}_${safeFileName(item.title)}.${inferImageExt(blob, item.src)}`,
        data: new Uint8Array(await blob.arrayBuffer()),
      };
    }));
    downloadBlobToLocal(makeZipBlob(files), `${folderName}.zip`);
  }

  function deleteGeneratedImage(slotId: string) {
    setGeneratedImages((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
    setGenerationSlots((current) => current.filter((slot) => slot.id !== slotId));
    setSelectedGeneratedImageIds((current) => current.filter((id) => id !== slotId));
    setGenerationActionPanel((current) => current?.slotId === slotId ? null : current);
    setResizePanel((current) => current?.slotId === slotId ? null : current);
  }

  function deleteSelectedGeneratedImages(slots: GenerationSlot[]) {
    const selectedSet = new Set(getSelectableGeneratedImageIds(slots).filter((id) => selectedGeneratedImageIds.includes(id)));
    if (!selectedSet.size) return;
    setGeneratedImages((current) => {
      const next = { ...current };
      selectedSet.forEach((id) => delete next[id]);
      return next;
    });
    setGenerationSlots((current) => current.filter((slot) => !selectedSet.has(slot.id)));
    setSelectedGeneratedImageIds((current) => current.filter((id) => !selectedSet.has(id)));
    setGenerationActionPanel((current) => current && selectedSet.has(current.slotId) ? null : current);
    setResizePanel((current) => current?.slotId && selectedSet.has(current.slotId) ? null : current);
  }

  async function runSmartResizeRequest(slotId: string, targetId: string, previous: GeneratedImage | undefined) {
    const src = previous?.url || previous?.fileUrl || "";
    if (!src) return;
    const slot = findGenerationSlot(slotId);
    const prompt = buildSmartResizePrompt(slot, targetId);
    const referenceImages = uploadedImage ? [uploadedImage, src] : [src];
    try {
      const response = await fetch("/api/product-sets/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          image: src,
          images: referenceImages,
          size: "2K",
          ratio: getResizeGenerationRatio(targetId),
          watermark: false,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "智能改尺寸失败");
      const resizedUrl = data.images?.[0]?.dataUrl || data.images?.[0]?.url;
      if (!resizedUrl) throw new Error("智能改尺寸成功但没有返回图片 URL");
      setGeneratedImages((current) => ({
        ...current,
        [slotId]: { status: "done", url: resizedUrl, fileUrl: data.images?.[0]?.url || resizedUrl },
      }));
    } catch (err) {
      setGeneratedImages((current) => ({
        ...current,
        [slotId]: previous || { status: "failed", error: err instanceof Error ? err.message : String(err) },
      }));
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function resizeGeneratedImage(slotId: string, targetId = settings.ratio) {
    const previous = generatedImages[slotId];
    const src = previous?.url || previous?.fileUrl || "";
    if (!src) return;
    setGeneratedImages((current) => ({
      ...current,
      [slotId]: { ...current[slotId], status: "generating" },
    }));
    await runSmartResizeRequest(slotId, targetId, previous);
  }

  async function resizeSelectedGeneratedImages(slots: GenerationSlot[], targetId = settings.ratio) {
    const selectedIds = getSelectableGeneratedImageIds(slots).filter((id) => selectedGeneratedImageIds.includes(id));
    const previousById = new Map(selectedIds.map((id) => [id, generatedImages[id]] as const));
    setGeneratedImages((current) => {
      const next = { ...current };
      selectedIds.forEach((id) => {
        if (current[id]) {
          next[id] = { ...current[id], status: "generating" };
        }
      });
      return next;
    });
    for (const id of selectedIds) {
      await runSmartResizeRequest(id, targetId, previousById.get(id));
    }
  }

  async function confirmResizePanel() {
    if (!resizePanel) return;
    const panel = resizePanel;
    const targetId = panel.selectedId;
    setResizePanel(null);
    if (panel.mode === "single" && panel.slotId) {
      await resizeGeneratedImage(panel.slotId, targetId);
    } else {
      const slots = generationSlots.length ? generationSlots : buildGenerationQueue();
      await resizeSelectedGeneratedImages(slots, targetId);
    }
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

  async function regenerateSlotImage(slotId: string, prompt: string, sourceImage: string) {
    const previous = generatedImages[slotId];
    if (!sourceImage) {
      setError("当前图片不可编辑，请先完成生成后再操作");
      return;
    }
    setGenerationActionPanel(null);
    setError("");
    setSelectedGeneratedImageIds((current) => current.filter((id) => id !== slotId));
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
    const slotId = generationActionPanel.slotId;
    const previous = generatedImages[slotId];
    if (!sourceImage) {
      setError("当前图片不可编辑，请先完成生成后再操作");
      return;
    }
    setGenerationActionPanel(null);
    setError("");
    setSelectedGeneratedImageIds((current) => current.filter((id) => id !== slotId));
    setGeneratedImages((current) => ({
      ...current,
      [slotId]: { ...current[slotId], status: "generating" },
    }));
    try {
      const promptResponse = await fetch("/api/product-sets/generate-retouch-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          slot: slot ? { id: slot.id, name: slot.name, type: slot.type } : null,
          originalPrompt: slot?.prompt || "",
          userDirection: generationActionPanel.direction,
          originalImage: uploadedImage,
          currentImage: sourceImage,
        }),
      });
      const promptData = await promptResponse.json();
      if (!promptResponse.ok || !promptData.ok) throw new Error(promptData.error || "AI改图提示词生成失败");
      const retouchPrompt = String(promptData.prompt || "").trim();
      if (!retouchPrompt) throw new Error("AI改图提示词为空，请重试");
      const referenceImages = promptData.referenceMode === "product_and_current" && uploadedImage
        ? [uploadedImage, sourceImage]
        : [sourceImage];
      const imageResponse = await fetch("/api/product-sets/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: retouchPrompt,
          image: sourceImage,
          images: referenceImages,
          size: "2K",
          ratio: settings.ratio,
          watermark: false,
        }),
      });
      const imageData = await imageResponse.json();
      if (!imageResponse.ok || !imageData.ok) throw new Error(imageData.error || "图片处理失败");
      const imageUrl = imageData.images?.[0]?.dataUrl || imageData.images?.[0]?.url;
      if (!imageUrl) throw new Error("处理成功但没有返回图片 URL");
      setGeneratedImages((current) => ({
        ...current,
        [slotId]: { status: "done", url: imageUrl, fileUrl: imageData.images?.[0]?.url },
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

  function renderResizePanel() {
    if (!resizePanel) return null;
    return (
      <div
        ref={resizePanelRef}
        className="fixed z-[70] w-[400px] overflow-hidden rounded-[10px] bg-white shadow-[0_18px_48px_rgba(15,23,41,.22)]"
        style={{ top: resizePanel.top, left: resizePanel.left }}
        onClick={(event) => event.stopPropagation()}
      >
          <div className="p-3">
            {RESIZE_TARGET_OPTIONS.map((option) => {
              const selected = resizePanel.selectedId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setResizePanel((current) => current ? { ...current, selectedId: option.id } : current)}
                  className={`flex h-10 w-full items-center gap-3 rounded-[8px] px-2 text-left transition-colors ${selected ? "bg-[#F5F6F8]" : "hover:bg-[#F7F8FA]"}`}
                >
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selected ? "border-[#171A1D]" : "border-[#D0D5DD]"}`}>
                    {selected && <span className="h-2 w-2 rounded-full bg-[#171A1D]" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#344054]">{option.label}</span>
                  {option.sizeLabel && <span className="shrink-0 text-[13px] font-medium text-[#8E9299]">{option.sizeLabel}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 border-t border-[#EEF0F3] p-3">
            <button
              type="button"
              onClick={() => setResizePanel(null)}
              className="flex h-9 flex-1 items-center justify-center rounded-[8px] bg-[#F2F3F5] text-[13px] font-semibold text-[#344054] transition-colors hover:bg-[#E8EAED]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => confirmResizePanel().catch(() => undefined)}
              className="flex h-9 flex-1 items-center justify-center rounded-[8px] bg-[#171A1D] text-[13px] font-semibold text-white transition-colors hover:bg-black"
            >
              确定 · 15
            </button>
          </div>
      </div>
    );
  }

  function renderGenerationCard(item: GenerationSlot, index: number) {
    const result = generatedImages[item.id];
    const typeTitle = item.type || "主图";
    const title = `${String(index + 1).padStart(2, "0")} ${typeTitle}`;
    const src = result?.url || "";
    const isDone = result?.status === "done" && Boolean(src);
    const isSelected = selectedGeneratedImageIds.includes(item.id);
    const isActionPanelOpen = generationActionPanel?.slotId === item.id;
    return (
      <div className={`group relative aspect-square overflow-hidden rounded-[8px] bg-white shadow-[0_1px_0_rgba(15,23,41,.04)] ${isSelected ? "ring-2 ring-[#171A1D]" : ""}`}>
        {isDone ? (
          <>
            <img
              src={src}
              alt={title}
              className="h-full w-full bg-white object-contain"
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
              onClick={(event) => {
                event.stopPropagation();
                toggleGeneratedImageSelection(item.id);
              }}
              className={`absolute left-3 top-3 z-30 grid h-5 w-5 place-items-center rounded-[5px] border shadow-sm transition-opacity ${isSelected ? "border-[#171A1D] bg-[#171A1D] text-white opacity-100" : "border-[#171A1D] bg-white/95 text-transparent opacity-0 group-hover:opacity-100 hover:bg-white"}`}
              aria-label={`${isSelected ? "取消选择" : "选择"} ${title}`}
              aria-pressed={isSelected}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <div className={`absolute right-2 top-2 z-30 flex gap-2 transition-opacity ${isActionPanelOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              <button
                type="button"
                onClick={() => downloadImageToLocal(result?.fileUrl || src, title)}
                className="grid h-8 w-8 place-items-center rounded-[8px] bg-white/90 text-[#171A1D] shadow-sm transition-colors hover:bg-white"
                aria-label={`下载 ${title}`}
              >
                <Download className="h-4 w-4" />
              </button>
              <div className="group/more relative">
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#171A1D] text-white shadow-sm transition-colors hover:bg-black"
                  aria-label={`${title} 更多操作`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                <div className="pointer-events-none absolute right-0 top-8 w-[140px] rounded-[10px] bg-white p-1.5 text-[13px] font-semibold text-[#171A1D] opacity-0 shadow-[0_12px_28px_rgba(15,23,41,.18)] transition-opacity group-hover/more:pointer-events-auto group-hover/more:opacity-100 group-focus-within/more:pointer-events-auto group-focus-within/more:opacity-100">
                  <button
                    type="button"
                    onClick={(event) => openResizePanel(event, "single", item.id, "left")}
                    data-resize-trigger="true"
                    className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left transition-colors hover:bg-[#F5F6F8]"
                  >
                    <Sparkles className="h-4 w-4" />
                    智能改尺寸
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteGeneratedImage(item.id);
                    }}
                    className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[#F04438] transition-colors hover:bg-[#FFF1F0]"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </button>
                </div>
              </div>
            </div>
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
        <span className={`pointer-events-none absolute left-3 z-10 rounded-[6px] bg-black/35 px-2 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-[2px] transition-all ${isActionPanelOpen ? "bottom-[64px]" : "bottom-3 group-hover:bottom-[64px]"}`}>
          {typeTitle}
        </span>
      </div>
    );
  }

  function renderGenerationResults() {
    const slots = generationSlots.length ? generationSlots : buildGenerationQueue();
    const selectableGeneratedImageIds = getSelectableGeneratedImageIds(slots);
    const allGeneratedImagesSelected = selectableGeneratedImageIds.length > 0 && selectableGeneratedImageIds.every((id) => selectedGeneratedImageIds.includes(id));
    const someGeneratedImagesSelected = selectableGeneratedImageIds.some((id) => selectedGeneratedImageIds.includes(id));
    const selectedDownloadCount = selectedGeneratedImageIds.filter((id) => selectableGeneratedImageIds.includes(id)).length;
    return (
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-left text-[18px] font-bold text-[#171A1D]">生成结果：</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleAllGeneratedImages(slots)}
              disabled={!selectableGeneratedImageIds.length}
              className={`flex items-center gap-2 text-[13px] font-medium transition-colors ${selectableGeneratedImageIds.length ? "text-[#5F6B7A] hover:text-[#171A1D]" : "cursor-not-allowed text-[#A0A7B2]"}`}
              aria-pressed={allGeneratedImagesSelected}
            >
              <span className={`grid h-4 w-4 place-items-center rounded-[4px] border ${someGeneratedImagesSelected ? "border-[#171A1D] bg-[#171A1D] text-white" : "border-[#171A1D] bg-white text-transparent"}`}>
                {allGeneratedImagesSelected ? <Check className="h-3 w-3" /> : someGeneratedImagesSelected ? <Minus className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              </span>
              全选
            </button>
            {selectedDownloadCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={(event) => openResizePanel(event, "batch", undefined, "bottom")}
                  data-resize-trigger="true"
                  className="flex h-9 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-[#171A1D] shadow-[0_1px_0_rgba(15,23,41,.06)] transition-colors hover:bg-[#F5F6F8]"
                >
                  <Sparkles className="h-4 w-4" />
                  批量改尺寸
                </button>
                <button
                  type="button"
                  onClick={() => downloadSelectedGeneratedImages(slots).catch(() => undefined)}
                  className="flex h-9 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-[#171A1D] shadow-[0_1px_0_rgba(15,23,41,.06)] transition-colors hover:bg-[#F5F6F8]"
                >
                  <Download className="h-4 w-4" />
                  批量下载
                </button>
                <button
                  type="button"
                  onClick={() => deleteSelectedGeneratedImages(slots)}
                  className="flex h-9 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-[#171A1D] shadow-[0_1px_0_rgba(15,23,41,.06)] transition-colors hover:bg-[#F5F6F8]"
                >
                  <Trash2 className="h-4 w-4" />
                  批量删除
                </button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="relative aspect-square overflow-hidden rounded-[8px] bg-white">
            <img src={uploadedImage} alt="原图" className="h-full w-full object-contain" />
            <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-[6px] bg-black/35 px-2 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-[2px]">
              原图
            </span>
          </div>
          {slots.map((item, index) => renderGenerationCard(item, index))}
        </div>
      </div>
    );
  }

  return (
      <div className="relative flex h-full bg-[#f2f4f7]">
      <div className="w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pb-28 pt-5 custom-scrollbar">
        <h2 className="mb-4 flex items-center gap-1 text-[14px] font-semibold text-[#171A1D]">
          商品原图
          <ProductImageHelpTooltip />
        </h2>
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
            {uploadedImages.length < MAX_PRODUCT_UPLOADS && (
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
            <p className="max-w-[260px] truncate text-[12px] font-normal text-[#8B949E]">同一产品，最多{MAX_PRODUCT_UPLOADS}张。</p>
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

      <AiHelpPopover
        open={aiHelpOpen}
        position={aiHelpPosition}
        fallbackPosition={{ top: 420, left: expanded ? 560 : 392 }}
        status={aiHelpStatus}
        text={aiHelpText}
        visibleText={aiHelpVisibleText}
        error={aiHelpError}
        retrying={expandingPrompts}
        onClose={() => setAiHelpOpen(false)}
        onRetry={expandPrompts}
        onConfirm={confirmAiHelp}
      />

      {renderResizePanel()}

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
