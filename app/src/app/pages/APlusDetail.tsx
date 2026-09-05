import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { AlertCircle, Check, ChevronDown, Download, GripVertical, Lightbulb, Loader2, Minus, MoreHorizontal, PenLine, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import earbudFront from "@/imports/image-15.png";
import earbudCase from "@/imports/image-16.png";
import earbudSingle from "@/imports/image-17.png";
import detailLong from "@/imports/image-18.png";
import heroBanner from "@/imports/image-19.png";
import specsBanner from "@/imports/image-20.png";
import lifestyleBanner from "@/imports/image-21.png";
import featureIcons from "@/imports/image-23.png";
import emotionScene from "@/imports/image-24.png";
import useCases from "@/imports/image-25.png";
import suiteArrow from "@/imports/箭头.svg";
import { useSidebar } from "@/app/components/SidebarContext";
import { AiHelpPopover } from "@/app/components/AiHelpPopover";
import { ProductImageHelpTooltip } from "@/app/components/ProductImageHelpTooltip";
import { AIReportSelector, SectionTitle, type SuiteProduct } from "@/app/components/AIReportSelector";

function SelectBox({ value, options, open, onToggle, onSelect, wide = false }: { value: string; options: string[]; open: boolean; onToggle: () => void; onSelect: (value: string) => void; wide?: boolean }) {
  return (
    <div className={`relative ${wide ? "col-span-3" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-[30px] w-full items-center justify-between rounded-[8px] bg-[#F2F3F5] px-3 text-[13px] font-normal text-[#171A1D] transition-colors ${open ? "bg-white ring-1 ring-[#3388ff]" : "hover:bg-[#ECEFF4]"}`}
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

const GENERATION_OPTIONS = {
  platform: ["淘宝天猫1688", "淘宝", "天猫", "抖音", "京东", "拼多多", "亚马逊", "TikTok", "速卖通", "Temu", "Shein", "Shopee", "Lazada", "eBay", "Walmart", "Shopify", "独立站"],
  country: ["中国", "美国", "英国", "德国", "法国", "意大利", "西班牙", "日本", "韩国", "加拿大", "澳大利亚", "新加坡", "马来西亚", "泰国", "越南", "巴西", "墨西哥"],
  language: ["英文", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "荷兰文", "波兰文", "泰文", "越南文", "印尼文"],
  ratio: ["1:1", "3:4", "4:3", "9:16", "16:9"],
};

const MODULES = [
  ["首屏主视觉", "传递核心价值"],
  ["核心卖点图", "突出差异优势"],
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
];

const PRODUCT_IMAGES = [
  { src: earbudFront, alt: "蓝色无线耳机开盖产品图" },
  { src: earbudCase, alt: "蓝色无线耳机充电盒背面" },
  { src: earbudSingle, alt: "蓝色单只无线耳机" },
];

const DETAIL_BANNERS = [
  { src: heroBanner, alt: "蓝色耳机首屏主视觉" },
  { src: featureIcons, alt: "蓝色耳机无线自由续航充电卖点图" },
  { src: specsBanner, alt: "蓝色耳机核心卖点规格图" },
  { src: emotionScene, alt: "蓝色耳机情绪场景卖点图" },
  { src: lifestyleBanner, alt: "蓝色耳机生活方式场景图" },
  { src: useCases, alt: "蓝色耳机通勤运动工作场景图" },
];

type UploadedProductImage = {
  id: string;
  name: string;
  url: string;
};

type AiHelpStreamEvent =
  | { type: "thinking"; text?: string }
  | { type: "content"; text?: string }
  | { type: "done"; text?: string; model?: string }
  | { type: "error"; error?: string };

type GeneratedDetailImage = {
  status: "generating" | "done" | "failed";
  url?: string;
  fileUrl?: string;
  ratio?: string;
  error?: string;
};

type DetailGenerationSlot = {
  id: string;
  name: string;
  type: string;
  prompt: string;
};

type DetailWorkflowStep = "form" | "strategy";
type DetailStrategyStatus = "idle" | "generating" | "ready" | "error";

type DetailStrategyModule = {
  id: string;
  type: string;
  title: string;
  lines: string[];
  prompt?: string;
};

type DetailStrategyPlan = {
  strategyText: string;
  modules: DetailStrategyModule[];
};

type DetailWorkflowPrompt = {
  id: string;
  name: string;
  type: string;
  prompt: string;
};

type AiHelpStatus = "idle" | "thinking" | "writing" | "ready" | "error";

type ResizeTargetOption = {
  id: string;
  label: string;
  sizeLabel?: string;
};

type ResizePanelState = {
  mode: "single" | "batch";
  slotId?: string;
  top: number;
  left: number;
  selectedId: string;
};

type EditableTextField = {
  id: string;
  original: string;
  value: string;
  removed: boolean;
};

type DetailActionPanel =
  | {
      kind: "text";
      slotId: string;
      title: string;
      top: number;
      left: number;
      fields: EditableTextField[];
      loading: boolean;
      error?: string;
      originalCount: number;
    }
  | {
      kind: "image";
      slotId: string;
      title: string;
      top: number;
      left: number;
      direction: string;
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
  band?: {
    image_prompts?: {
      main_image_prompt?: string;
      detail_image_prompt?: string;
      buyer_show_prompt?: string;
      title_direction?: string;
    };
  };
  descriptions?: Array<{
    product_id?: string;
    title?: string;
    detail_image_prompt?: string;
  }>;
  listingSellingPoints?: {
    summary?: string;
    mainImageSellingPoints?: ListingMainSellingPoint[];
  };
  mainImagePromptSeed?: string;
  error?: string;
};

function normalizeAiHelpText(raw: string) {
  return String(raw || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function buildAPlusImagePrompt({
  settings,
  productText,
  modules,
  reportText,
  moduleStrategy,
}: {
  settings: { platform: string; country: string; language: string; ratio: string };
  productText: string;
  modules: string[];
  reportText: string;
  moduleStrategy?: string;
}) {
  return [
    "你是专业电商详情图设计师。请基于用户上传的商品原图，生成一张专业详情图/长图模块预览。",
    "",
    "【页面设置】",
    `目标平台：${settings.platform}`,
    `销售地区：${settings.country}`,
    `画面语种：${settings.language}`,
    `输出比例：${settings.ratio}`,
    "",
    "【商品卖点与要求】",
    productText || "用户未填写，请以商品原图可见信息为准，不得编造不可见参数。",
    "",
    "【引用的AI报告信息】",
    reportText || "未引用AI报告。",
    "",
    "【模块策略与设计规划】",
    moduleStrategy || "未生成模块策略，请按商品信息和所选模块自行规划。",
    "",
    "【需要包含的详情模块】",
    modules.length ? modules.join("、") : "按商品特点智能选择详情模块",
    "",
    "【生成要求】",
    "1. 商品真实结构、颜色、材质、比例和关键细节必须以用户上传图片为准。",
    "2. 生成专业电商详情图视觉，不要混入其他商品、其他品牌、无关造型或未提供的参数。",
    "3. 版式清晰，标题、卖点短文案、局部细节、场景/参数模块之间层级明确。",
    "4. 文案必须使用页面设置中的语言；中文设置时使用简体中文。",
    "5. 不要添加水印、二维码、价格、促销角标或无法验证的认证标识。",
    "",
    "输出：只返回一张完成设计的电商详情图。",
  ].join("\n");
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

function extractProductName(text: string) {
  const match = text.match(/(?:产品名称|商品名称)\s*[:：]\s*([^\n\r]+)/);
  return String(match?.[1] || "").replace(/^[\d.\s、-]+/, "").trim();
}

const MODULE_NAME_SET = new Set(MODULES.map(([name]) => name));

function normalizeSelectedModules(modules: string[]) {
  return modules.filter((module) => MODULE_NAME_SET.has(module));
}

function buildDetailPromptSlots(modules: string[]) {
  return normalizeSelectedModules(modules).map((module, index) => ({
    id: `detail-${index + 1}-${module}`,
    name: `${String(index + 1).padStart(2, "0")} ${module}`,
    type: module,
    sequence: index + 1,
  }));
}

function parseDetailDesignLine(line: string, type: string) {
  const match = line.match(new RegExp(`^【${type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}】(.+)$`));
  if (!match?.[1]) return [];
  return match[1]
    .split("｜")
    .map((part) => part.trim().replace(/：$/, ""))
    .filter(Boolean)
    .slice(0, 8);
}

function buildDetailStrategyPlanFromWorkflow({
  information,
  designPlan,
  prompts,
}: {
  information: string;
  designPlan: string;
  prompts: DetailWorkflowPrompt[];
}): DetailStrategyPlan {
  const designLines = String(designPlan || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    strategyText: designPlan || information || "暂无详情页规划。",
    modules: prompts.map((prompt, index) => {
      const line = designLines.find((item) => item.startsWith(`【${prompt.type}】`)) || "";
      const parsedLines = parseDetailDesignLine(line, prompt.type);
      return {
        id: `strategy-${index}-${prompt.type}`,
        type: prompt.type,
        title: prompt.name.replace(/^\d+\s*/, "") || prompt.type,
        prompt: prompt.prompt,
        lines: parsedLines.length
          ? parsedLines
          : [
              "已按详情页设计规划生成该模块。",
              "已按对应 Markdown 规范生成最终生图提示词。",
            ],
      };
    }),
  };
}

function pickField(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`${escaped}\\s*[:：]\\s*([^\\n\\r]+)`));
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function compactText(value: string, fallback: string, max = 64) {
  const text = String(value || "").replace(/\s+/g, " ").replace(/^[\d.\s、-]+/, "").trim();
  const result = text || fallback;
  return result.length > max ? `${result.slice(0, max)}...` : result;
}

function firstUsefulLine(...sources: string[]) {
  for (const source of sources) {
    const parts = String(source || "")
      .split(/[\n\r。；;]+/)
      .map((line) => line.replace(/^[\d.\s、-]+/, "").trim())
      .filter((line) => line.length > 3);
    if (parts[0]) return parts[0];
  }
  return "";
}

function buildDetailStrategyPlan({
  settings,
  productText,
  reportText,
  modules,
  fallbackProductName,
}: {
  settings: { platform: string; country: string; language: string; ratio: string };
  productText: string;
  reportText: string;
  modules: string[];
  fallbackProductName?: string;
}): DetailStrategyPlan {
  const combinedText = `${productText}\n${reportText}`;
  const productName = extractProductName(productText) || compactText(fallbackProductName || "", "当前商品", 36);
  const sellingPoint = pickField(combinedText, ["核心卖点", "卖点", "产品卖点"]) || firstUsefulLine(productText, reportText) || "突出商品核心卖点与使用价值";
  const audience = pickField(combinedText, ["适用人群", "目标人群"]) || "目标消费人群";
  const scenes = pickField(combinedText, ["期望场景", "使用场景", "场景"]) || "日常使用、通勤、社交、送礼等场景";
  const spec = pickField(combinedText, ["具体参数", "参数", "规格"]) || "以商品原图可见结构和用户输入信息为准";
  const language = settings.language || "中文";
  const shortSelling = compactText(sellingPoint, "核心卖点", 18);
  const isChinese = language.includes("中文");

  const moduleTitleMap: Record<string, string> = {
    "首屏主视觉": `传递${shortSelling}`,
    "核心卖点图": "突出核心差异优势",
    "使用场景图": "展示多场景适配性",
    "多角度图": "多角度呈现商品外观",
    "场景氛围图": "建立使用情绪与风格",
    "商品细节图": "放大材质与工艺",
    "品牌故事图": "传达品牌理念与调性",
    "尺寸/容量/尺码图": "清晰呈现规格信息",
    "效果对比图": "直观对比使用前后",
    "详细规格/参数表": "整理关键参数",
    "工艺制作图": "展示制作工艺过程",
    "配件/赠品图": "明确收货内容",
    "系列展示图": "展示系列与SKU",
    "商品成分图": "解释材质/成分",
    "售后保障图": "降低购买顾虑",
    "使用建议图": "说明使用与保养建议",
  };

  const moduleLineMap: Record<string, string[]> = {
    "首屏主视觉": [
      `主标题：${productName}，突出${shortSelling}`,
      "画面：商品主体完整清晰，第一屏建立详情页整体调性",
      "布局：主视觉+核心短句+必要卖点标签",
      `目标语言：${language}`,
    ],
    "核心卖点图": [
      `主卖点：${compactText(sellingPoint, "核心卖点", 42)}`,
      "表达：用局部特写、图标或短文案解释利益点",
      "避免：重复场景图内容，不堆砌无关参数",
      `目标语言：${language}`,
    ],
    "使用场景图": [
      `场景：${compactText(scenes, "真实使用场景", 64)}`,
      `人物/环境：匹配${compactText(audience, "目标人群", 30)}`,
      "重点：突出使用效果和生活代入感",
      `目标语言：${language}`,
    ],
    "多角度图": [
      "内容：正面、侧面、背面、局部角度组合",
      "依据：以原图商品结构为准，不能改款",
      "布局：多图并列或网格展示，标注角度",
      `目标语言：${language}`,
    ],
    "场景氛围图": [
      `氛围：围绕${compactText(scenes, "使用场景", 42)}建立情绪`,
      "色调：遵循统一视觉定调，不抢商品",
      "重点：商品和场景关联清楚",
      `目标语言：${language}`,
    ],
    "商品细节图": [
      "细节：材质、工艺、结构、纹理、连接处",
      `参数：${compactText(spec, "以可见信息为准", 64)}`,
      "布局：局部放大+指示线+短说明",
      `目标语言：${language}`,
    ],
    "品牌故事图": [
      "内容：品牌理念、产品灵感、使用价值",
      "表达：保持克制，不编造品牌历史和认证",
      "布局：品牌态度文案+商品氛围图",
      `目标语言：${language}`,
    ],
    "尺寸/容量/尺码图": [
      `规格：${compactText(spec, "按用户输入和可见信息展示", 64)}`,
      "表达：尺寸线、表格或尺码对照，信息清楚",
      "约束：没有明确数据时不生成具体数值",
      `目标语言：${language}`,
    ],
    "效果对比图": [
      "内容：使用前后、普通款对比或场景效果对比",
      "表达：只对比可合理表达的视觉效果",
      "约束：不夸大功效，不制造虚假承诺",
      `目标语言：${language}`,
    ],
    "详细规格/参数表": [
      `参数来源：${compactText(spec, "商品可见结构与用户输入", 64)}`,
      "表达：表格化整理材质、颜色、尺寸、适用信息",
      "约束：缺失参数标注为以实物/详情为准，不编造",
      `目标语言：${language}`,
    ],
    "工艺制作图": [
      "内容：可见工艺、材质处理、结构细节",
      "表达：流程感或分点说明，突出品质感",
      "约束：不编造不可验证的生产工序",
      `目标语言：${language}`,
    ],
    "配件/赠品图": [
      "内容：商品主体、包装、配件、赠品或收货清单",
      "表达：平铺展示+名称标注",
      "约束：未提供配件时只展示商品主体和包装示意",
      `目标语言：${language}`,
    ],
    "系列展示图": [
      "内容：颜色、款式、SKU或组合展示",
      "表达：统一背景下的系列网格",
      "约束：未提供多SKU时不凭空扩展款式",
      `目标语言：${language}`,
    ],
    "商品成分图": [
      "内容：材质、成分、结构组成",
      "表达：拆解图、图标或材质说明",
      "约束：按可见材质和用户输入表达，不写医疗/认证功效",
      `目标语言：${language}`,
    ],
    "售后保障图": [
      "内容：包装、发货、退换、客服等保障信息",
      "表达：信任感图标+短句说明",
      "约束：不写平台未确认的具体承诺和时效",
      `目标语言：${language}`,
    ],
    "使用建议图": [
      "内容：使用步骤、保养方式、注意事项",
      "表达：步骤化说明或图标说明",
      "约束：只写通用建议，避免不确定风险承诺",
      `目标语言：${language}`,
    ],
  };

  const normalizedModules = normalizeSelectedModules(modules);
  return {
    strategyText: [
      "产品与卖点",
      `产品：${productName}`,
      `卖点：${compactText(sellingPoint, "突出商品核心卖点与使用价值", 96)}`,
      `适用人群：${compactText(audience, "目标消费人群", 64)}`,
      `期望场景：${compactText(scenes, "真实使用场景", 64)}`,
      "顾虑：信息不清晰、材质/尺寸/适用场景判断成本高",
      "视觉重心：以商品主体和关键卖点为核心，避免无关造型、无关配色和无法验证的参数",
      "",
      "视觉定调",
      `风格：${isChinese ? "清晰专业" : "clean professional"} / ${settings.platform}电商详情视觉`,
      "色彩：以商品原色为主，背景与装饰色只做辅助，不引入无关配色",
      `字体：${isChinese ? "中粗标题字 + 易读正文字" : "bold headline + readable body text"}`,
      "色温：自然中性，按商品调性微调",
      "光质：柔和干净，突出商品材质与结构细节",
    ].join("\n"),
    modules: normalizedModules.map((module, index) => ({
      id: `strategy-${index}-${module}`,
      type: module,
      title: moduleTitleMap[module] || MODULES.find(([name]) => name === module)?.[1] || "详情图模块",
      lines: moduleLineMap[module] || [
        `目标：围绕${productName}补充详情页信息`,
        `内容：${compactText(sellingPoint, "商品核心卖点", 42)}`,
        `目标语言：${language}`,
      ],
    })),
  };
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

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败，无法生成长图"));
    img.src = src;
  });
}

const RESIZE_TARGET_OPTIONS: ResizeTargetOption[] = [
  { id: "a-plus-normal", label: "普通A+", sizeLabel: "970:600" },
  { id: "a-plus-web", label: "高级A+（Web端）", sizeLabel: "1464:600" },
  { id: "a-plus-mobile", label: "高级A+（移动端）", sizeLabel: "600:450" },
  { id: "1:1", label: "1:1" },
  { id: "3:4", label: "3:4" },
  { id: "9:16", label: "9:16" },
  { id: "16:9", label: "16:9" },
];

export function APlusDetail() {
  const { expanded } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const aiHelpButtonRef = useRef<HTMLButtonElement | null>(null);
  const resizePanelRef = useRef<HTMLDivElement | null>(null);
  const [checked, setChecked] = useState(["首屏主视觉", "核心卖点图", "使用场景图", "多角度图", "场景氛围图", "商品细节图"]);
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [settings, setSettings] = useState({ platform: "淘宝天猫1688", country: "中国", language: "中文", ratio: "1:1" });
  const [uploadedImages, setUploadedImages] = useState<UploadedProductImage[]>([]);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedReportOption, setSelectedReportOption] = useState<SuiteProduct | null>(null);
  const [descriptionPayload, setDescriptionPayload] = useState<DescriptionPayload | null>(null);
  const [loadingDescriptions, setLoadingDescriptions] = useState(false);
  const [detailGenerationText, setDetailGenerationText] = useState("");
  const [aiWriting, setAiWriting] = useState(false);
  const [generatingDetail, setGeneratingDetail] = useState(false);
  const [generatedDetailImages, setGeneratedDetailImages] = useState<Record<string, GeneratedDetailImage>>({});
  const [detailGenerationSlots, setDetailGenerationSlots] = useState<DetailGenerationSlot[]>([]);
  const [resultViewActive, setResultViewActive] = useState(false);
  const [detailWorkflowStep, setDetailWorkflowStep] = useState<DetailWorkflowStep>("form");
  const [detailStrategyStatus, setDetailStrategyStatus] = useState<DetailStrategyStatus>("idle");
  const [detailStrategyPlan, setDetailStrategyPlan] = useState<DetailStrategyPlan | null>(null);
  const [detailWorkflowPrompts, setDetailWorkflowPrompts] = useState<DetailWorkflowPrompt[]>([]);
  const [strategyExpanded, setStrategyExpanded] = useState(false);
  const [expandedPromptTypes, setExpandedPromptTypes] = useState<string[]>([]);
  const [orderedModules, setOrderedModules] = useState<string[]>([]);
  const [draggingModule, setDraggingModule] = useState<string | null>(null);
  const [selectedDetailImageIds, setSelectedDetailImageIds] = useState<string[]>([]);
  const [resizePanel, setResizePanel] = useState<ResizePanelState | null>(null);
  const [detailActionPanel, setDetailActionPanel] = useState<DetailActionPanel | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);
  const [longPreview, setLongPreview] = useState<{ open: boolean; loading: boolean; url?: string; error?: string; title: string }>({
    open: false,
    loading: false,
    title: "",
  });
  const [aiHelpOpen, setAiHelpOpen] = useState(false);
  const [aiHelpStatus, setAiHelpStatus] = useState<AiHelpStatus>("idle");
  const [aiHelpText, setAiHelpText] = useState("");
  const [aiHelpVisibleText, setAiHelpVisibleText] = useState("");
  const [aiHelpError, setAiHelpError] = useState("");
  const [aiHelpPosition, setAiHelpPosition] = useState<{ top: number; left: number } | null>(null);

  const selectedReport = selectedReportOption;
  const reportSellingPoints = descriptionPayload?.listingSellingPoints?.mainImageSellingPoints || [];
  const detailPromptSeed = (() => {
    if (!descriptionPayload) return "";
    const bandDetail = String(descriptionPayload.band?.image_prompts?.detail_image_prompt || "").trim();
    if (bandDetail) return bandDetail;
    const firstProductDetail = String(descriptionPayload.descriptions?.[0]?.detail_image_prompt || "").trim();
    if (firstProductDetail) return firstProductDetail;
    const summary = String(descriptionPayload.listingSellingPoints?.summary || "").trim();
    if (summary) return summary;
    const seed = String(descriptionPayload.mainImagePromptSeed || "").trim();
    return seed;
  })();

  useEffect(() => {
    if (!resizePanel) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setResizePanel(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resizePanel]);

  useEffect(() => {
    if (!resizePanel) return;
    const handleMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (resizePanelRef.current?.contains(target)) return;
      if (target.closest("[data-resize-trigger='true']")) return;
      setResizePanel(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [resizePanel]);

  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setOpenSetting(null);
    invalidateDetailStrategy();
  };

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
    const availableSlots = 6 - uploadedImages.length;
    if (availableSlots <= 0) {
      setError("同一产品最多上传 6 张图片");
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
      setUploadedImages((current) => [...current, ...nextImages].slice(0, 6));
      resetDetailStrategy();
      setGeneratedDetailImages({});
      setDetailGenerationSlots([]);
      setResultViewActive(false);
      setSelectedDetailImageIds([]);
      setError(selectedFiles.length > availableSlots ? "同一产品最多上传 6 张图片，已保留前 6 张。" : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function removeUploadedImage(id: string) {
    setUploadedImages((current) => current.filter((item) => item.id !== id));
    setGeneratedDetailImages({});
    setDetailGenerationSlots([]);
    setResultViewActive(false);
    setSelectedDetailImageIds([]);
    setResizePanel(null);
    setDetailActionPanel(null);
    setLightbox(null);
    resetDetailStrategy();
    setError("");
  }

  function getFloatingPanelPosition(rect: DOMRect, width = 300) {
    const gap = 12;
    const viewportWidth = window.innerWidth || 1440;
    const preferredLeft = rect.right + gap;
    const fallbackLeft = rect.left - width - gap;
    return {
      left: preferredLeft + width + 16 <= viewportWidth ? preferredLeft : Math.max(16, fallbackLeft),
      top: Math.max(16, rect.top),
    };
  }

  function resetDetailStrategy() {
    setDetailWorkflowStep("form");
    setDetailStrategyStatus("idle");
    setDetailStrategyPlan(null);
    setDetailWorkflowPrompts([]);
    setStrategyExpanded(false);
    setExpandedPromptTypes([]);
    setOrderedModules([]);
    setDraggingModule(null);
  }

  function invalidateDetailStrategy() {
    setDetailStrategyStatus("idle");
    setDetailStrategyPlan(null);
    setDetailWorkflowPrompts([]);
    setStrategyExpanded(false);
    setExpandedPromptTypes([]);
    setOrderedModules([]);
    setDraggingModule(null);
    setDetailWorkflowStep((current) => (current === "strategy" ? "form" : current));
  }

  function toggleModule(module: string) {
    setChecked((current) => (
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module]
    ));
    invalidateDetailStrategy();
  }

  function getActiveStrategyModules() {
    const modules = detailStrategyPlan?.modules || [];
    const byType = new Map(modules.map((module) => [module.type, module]));
    const order = orderedModules.length ? orderedModules : modules.map((module) => module.type);
    return order.map((type) => byType.get(type)).filter((module): module is DetailStrategyModule => Boolean(module));
  }

  function buildReferencedDetailReportText() {
    if (!selectedReport && !descriptionPayload) return "";
    const reportLines = reportSellingPoints.map((item, index) => {
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
      detailPromptSeed,
      reportLines.length ? `报告分析结论：\n${reportLines.join("\n")}` : "",
    ].map((item) => item.trim()).filter(Boolean).join("\n\n");
  }

  function handleModuleDrop(event: DragEvent<HTMLDivElement>, targetType: string) {
    event.preventDefault();
    if (!draggingModule || draggingModule === targetType) return;
    setOrderedModules((current) => {
      const sourceOrder = current.length ? current : detailStrategyPlan?.modules.map((module) => module.type) || [];
      const next = sourceOrder.filter((type) => type !== draggingModule);
      const targetIndex = next.indexOf(targetType);
      if (targetIndex < 0) return sourceOrder;
      next.splice(targetIndex, 0, draggingModule);
      return next;
    });
    setDraggingModule(null);
  }

  function updateDetailWorkflowPrompt(type: string, value: string) {
    setDetailWorkflowPrompts((current) => (
      current.map((prompt) => (prompt.type === type ? { ...prompt, prompt: value } : prompt))
    ));
    setDetailStrategyPlan((current) => {
      if (!current) return current;
      return {
        ...current,
        modules: current.modules.map((module) => (module.type === type ? { ...module, prompt: value } : module)),
      };
    });
  }

  function togglePromptExpanded(type: string) {
    setExpandedPromptTypes((current) => (
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    ));
  }

  function deleteDetailWorkflowPrompt(type: string) {
    setDetailWorkflowPrompts((current) => current.filter((prompt) => prompt.type !== type));
    setDetailStrategyPlan((current) => {
      if (!current) return current;
      return {
        ...current,
        modules: current.modules.filter((module) => module.type !== type),
      };
    });
    setOrderedModules((current) => current.filter((item) => item !== type));
    setExpandedPromptTypes((current) => current.filter((item) => item !== type));
    setSelectedDetailImageIds([]);
    setGeneratedDetailImages({});
    setDetailGenerationSlots([]);
    setResultViewActive(false);
  }

  async function generateDetailStrategyPlan() {
    if (!uploadedImages.length) {
      setError("请先上传商品原图");
      return;
    }
    const modules = normalizeSelectedModules(checked);
    if (!modules.length) {
      setError("请至少选择一个详情图模块");
      return;
    }
    setError("");
    setResultViewActive(false);
    setSelectedDetailImageIds([]);
    setResizePanel(null);
    setDetailActionPanel(null);
    setLightbox(null);
    setDetailWorkflowStep("strategy");
    setDetailStrategyStatus("generating");
    setDetailStrategyPlan(null);
    setDetailWorkflowPrompts([]);
    setOrderedModules([]);
    setDraggingModule(null);
    try {
      const response = await fetch("/api/product-sets/generate-detail-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          baseText: detailGenerationText,
          reportText: buildReferencedDetailReportText(),
          image: uploadedImages[0]?.url || "",
          images: uploadedImages.map((item) => item.url),
          promptSlots: buildDetailPromptSlots(modules),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "详情图工作流生成失败");
      const prompts: DetailWorkflowPrompt[] = Array.isArray(data.prompts)
        ? data.prompts
            .map((item: DetailWorkflowPrompt) => ({
              id: String(item.id || ""),
              name: String(item.name || item.type || "详情图"),
              type: String(item.type || ""),
              prompt: String(item.prompt || "").trim(),
            }))
            .filter((item: DetailWorkflowPrompt) => item.id && MODULE_NAME_SET.has(item.type) && item.prompt)
        : [];
      if (prompts.length < modules.length) throw new Error("详情图提示词返回不完整，请重试。");
      const plan = buildDetailStrategyPlanFromWorkflow({
        information: String(data.information || ""),
        designPlan: String(data.designPlan || ""),
        prompts,
      });
      setDetailStrategyPlan(plan);
      setDetailWorkflowPrompts(prompts);
      setOrderedModules(plan.modules.map((module) => module.type));
      setStrategyExpanded(true);
      setDetailStrategyStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDetailStrategyStatus("error");
      setError(message);
    }
  }

  function buildDetailGenerationSlots(): DetailGenerationSlot[] {
    if (detailWorkflowPrompts.length) {
      const byType = new Map(detailWorkflowPrompts.map((prompt) => [prompt.type, prompt]));
      const order = orderedModules.length ? orderedModules : detailWorkflowPrompts.map((prompt) => prompt.type);
      return order
        .map((type, index) => {
          const prompt = byType.get(type);
          if (!prompt) return null;
          return {
            id: prompt.id || `detail-${index + 1}-${type}`,
            name: `${String(index + 1).padStart(2, "0")} ${prompt.type}`,
            type: prompt.type,
            prompt: prompt.prompt,
          };
        })
        .filter((slot): slot is DetailGenerationSlot => Boolean(slot));
    }
    const strategyModules = getActiveStrategyModules();
    const fallbackModules: DetailStrategyModule[] = normalizeSelectedModules(checked).map((module, index) => ({
      id: `fallback-${index}-${module}`,
      type: module,
      title: MODULES.find(([name]) => name === module)?.[1] || module,
      lines: [],
    }));
    const modules = strategyModules.length ? strategyModules : fallbackModules;
    return modules.map((module, index) => {
      const moduleStrategy = [
        detailStrategyPlan?.strategyText || "",
        `${module.type}：${module.title}`,
        ...module.lines,
      ].filter(Boolean).join("\n");
      return {
        id: `detail-${index + 1}-${Date.now()}`,
        name: `${String(index + 1).padStart(2, "0")} ${module.type}`,
        type: module.type,
        prompt: buildAPlusImagePrompt({
          settings,
          productText: detailGenerationText,
          modules: [module.type],
          reportText: detailPromptSeed,
          moduleStrategy,
        }),
      };
    });
  }

  async function handleAiHelp() {
    if (aiWriting) return;
    if (!uploadedImages.length) {
      setError("请先上传商品原图，再使用 AI 帮写");
      return;
    }
    const rect = aiHelpButtonRef.current?.getBoundingClientRect();
    if (rect) setAiHelpPosition(getFloatingPanelPosition(rect));
    setAiHelpOpen(true);
    setAiHelpStatus("thinking");
    setAiHelpText("");
    setAiHelpVisibleText("");
    setAiHelpError("");
    setAiWriting(true);
    setError("");
    try {
      const response = await fetch("/api/product-sets/expand-prompts-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          baseText: detailGenerationText,
          image: uploadedImages[0]?.url || "",
          images: uploadedImages.map((item) => item.url),
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "AI 帮写失败");
      }
      if (!response.body) throw new Error("AI 帮写接口没有返回内容，请稍后重试。");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let finalText = "";

      const flushLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let event: AiHelpStreamEvent;
        try {
          event = JSON.parse(trimmed) as AiHelpStreamEvent;
        } catch {
          return;
        }
        if (event.type === "content") {
          fullText += String(event.text || "");
          const nextText = normalizeAiHelpText(fullText);
          if (nextText) {
            setAiHelpStatus("writing");
            setAiHelpText(nextText);
          }
        }
        if (event.type === "done") {
          finalText = normalizeAiHelpText(String(event.text || fullText));
          if (finalText) {
            setAiHelpText(finalText);
            setAiHelpStatus("ready");
          }
        }
        if (event.type === "error") throw new Error(event.error || "AI 帮写失败");
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
      const resultText = normalizeAiHelpText(finalText || fullText);
      if (!resultText) throw new Error("AI 帮写没有返回可用商品信息，请稍后重试。");
      setAiHelpText(resultText);
      setAiHelpStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAiHelpStatus("error");
      setAiHelpError(message);
    } finally {
      setAiWriting(false);
    }
  }

  function confirmAiHelp() {
    const text = normalizeAiHelpText(aiHelpText);
    if (!text) {
      setAiHelpStatus("error");
      setAiHelpError("AI 帮写返回内容格式异常，请重新帮写。");
      return;
    }
    setDetailGenerationText(text);
    invalidateDetailStrategy();
    setAiHelpOpen(false);
    setAiHelpStatus("idle");
    setAiHelpError("");
  }

  async function generateDetailImage() {
    if (generatingDetail) return;
    if (!uploadedImages.length) {
      setError("请先上传商品原图");
      return;
    }
    if (detailWorkflowStep === "strategy" && !getActiveStrategyModules().length) {
      setError("请先生成模块策略与设计规划");
      return;
    }
    if (detailWorkflowStep === "strategy" && !detailWorkflowPrompts.length) {
      setError("请先生成详情页提示词");
      return;
    }
    if (detailWorkflowStep === "strategy" && detailWorkflowPrompts.some((item) => !item.prompt.trim())) {
      setError("存在空的模块提示词，请补充后再生成详情图");
      return;
    }
    setGeneratingDetail(true);
    setError("");
    setSelectedDetailImageIds([]);
    setResizePanel(null);
    setDetailActionPanel(null);
    setLightbox(null);
    const slots = buildDetailGenerationSlots();
    setDetailGenerationSlots(slots);
    setResultViewActive(true);
    setGeneratedDetailImages(slots.reduce<Record<string, GeneratedDetailImage>>((map, item) => {
      map[item.id] = { status: "generating" };
      return map;
    }, {}));
    try {
      let failedCount = 0;
      for (const slot of slots) {
        try {
          setGeneratedDetailImages((current) => ({ ...current, [slot.id]: { status: "generating" } }));
          const response = await fetch("/api/product-sets/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: slot.prompt,
              image: uploadedImages[0]?.url || "",
              images: uploadedImages.map((item) => item.url),
              size: "2K",
              ratio: settings.ratio,
              watermark: false,
            }),
          });
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(data.error || "生成详情图失败");
          const imageUrl = data.images?.[0]?.dataUrl || data.images?.[0]?.url;
          if (!imageUrl) throw new Error("生成成功但没有返回图片 URL");
          setGeneratedDetailImages((current) => ({
            ...current,
            [slot.id]: { status: "done", url: imageUrl, fileUrl: data.images?.[0]?.url, ratio: settings.ratio },
          }));
        } catch (err) {
          failedCount += 1;
          setGeneratedDetailImages((current) => ({
            ...current,
            [slot.id]: { status: "failed", error: err instanceof Error ? err.message : String(err) },
          }));
        }
      }
      if (failedCount) setError(`${failedCount} 张详情图生成失败，其余图片已保留在右侧。`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setGeneratedDetailImages((current) => {
        const next = { ...current };
        Object.keys(next).forEach((id) => {
          if (next[id]?.status === "generating") next[id] = { status: "failed", error: message };
        });
        return next;
      });
      setError(message);
    } finally {
      setGeneratingDetail(false);
    }
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

  function openDetailTextPanel(event: MouseEvent<HTMLButtonElement>, slot: DetailGenerationSlot, title: string) {
    event.stopPropagation();
    const position = getFloatingPanelPosition(event.currentTarget.getBoundingClientRect(), 300);
    const sourceImage = getEditableDetailImage(slot.id);
    if (!sourceImage) {
      setDetailActionPanel({
        kind: "text",
        slotId: slot.id,
        title,
        fields: [],
        loading: false,
        error: "当前图片不可识别，请先完成生成后再编辑文字。",
        originalCount: 0,
        ...position,
      });
      return;
    }
    setDetailActionPanel({
      kind: "text",
      slotId: slot.id,
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
          id: `${slot.id}-text-${Date.now()}-${index}`,
          original: text,
          value: text,
          removed: false,
        }));
        setDetailActionPanel((current) => {
          if (!current || current.kind !== "text" || current.slotId !== slot.id) return current;
          return { ...current, fields, loading: false, error: "", originalCount: fields.length };
        });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setDetailActionPanel((current) => {
          if (!current || current.kind !== "text" || current.slotId !== slot.id) return current;
          return { ...current, fields: [], loading: false, error: message || "图片文字识别失败", originalCount: 0 };
        });
      });
  }

  function openDetailImagePanel(event: MouseEvent<HTMLButtonElement>, slot: DetailGenerationSlot, title: string) {
    event.stopPropagation();
    const position = getFloatingPanelPosition(event.currentTarget.getBoundingClientRect(), 300);
    setDetailActionPanel({
      kind: "image",
      slotId: slot.id,
      title,
      direction: "",
      ...position,
    });
  }

  function updateDetailTextPanelField(id: string, value: string) {
    setDetailActionPanel((current) => {
      if (!current || current.kind !== "text") return current;
      return {
        ...current,
        fields: current.fields.map((field) => (field.id === id ? { ...field, value } : field)),
      };
    });
  }

  function removeDetailTextPanelField(id: string) {
    setDetailActionPanel((current) => {
      if (!current || current.kind !== "text") return current;
      return {
        ...current,
        fields: current.fields.map((field) => (field.id === id ? { ...field, value: "", removed: true } : field)),
      };
    });
  }

  function updateDetailImagePanelDirection(value: string) {
    setDetailActionPanel((current) => {
      if (!current || current.kind !== "image") return current;
      return { ...current, direction: value };
    });
  }

  function findDetailSlot(slotId: string) {
    return detailGenerationSlots.find((item) => item.id === slotId);
  }

  function getEditableDetailImage(slotId: string) {
    const result = generatedDetailImages[slotId];
    return result?.url || result?.fileUrl || "";
  }

  function getDetailDownloadFolderName() {
    const productName = extractProductName(detailGenerationText)
      || selectedReport?.keyword
      || selectedReport?.label
      || uploadedImages[0]?.name?.replace(/\.[^.]+$/, "")
      || "商品";
    return `${safeFileName(productName, "商品")}_详情图`;
  }

  async function downloadDetailImagesAsFolder(items: Array<{ src: string; title: string }>) {
    if (!items.length) return;
    const folderName = getDetailDownloadFolderName();
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

  function getSelectableDetailImageIds(slots: DetailGenerationSlot[]) {
    return slots
      .filter((slot) => {
        const result = generatedDetailImages[slot.id];
        return result?.status === "done" && Boolean(result.url || result.fileUrl);
      })
      .map((slot) => slot.id);
  }

  function toggleDetailImageSelection(slotId: string) {
    const result = generatedDetailImages[slotId];
    if (result?.status !== "done" || !(result.url || result.fileUrl)) return;
    setSelectedDetailImageIds((current) => (
      current.includes(slotId)
        ? current.filter((id) => id !== slotId)
        : [...current, slotId]
    ));
  }

  function toggleAllDetailImages(slots: DetailGenerationSlot[]) {
    const selectableIds = getSelectableDetailImageIds(slots);
    if (!selectableIds.length) return;
    setSelectedDetailImageIds((current) => {
      const allSelected = selectableIds.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !selectableIds.includes(id));
      return Array.from(new Set([...current, ...selectableIds]));
    });
  }

  async function downloadSelectedDetailImages(slots: DetailGenerationSlot[]) {
    const selectedSet = new Set(selectedDetailImageIds);
    const items: Array<{ src: string; title: string }> = [];
    slots.forEach((slot, index) => {
      if (!selectedSet.has(slot.id)) return;
      const result = generatedDetailImages[slot.id];
      const src = result?.fileUrl || result?.url || "";
      if (!src) return;
      items.push({
        src,
        title: `${String(index + 1).padStart(2, "0")} ${slot.type || "详情图"}`,
      });
    });
    await downloadDetailImagesAsFolder(items);
  }

  function getDoneDetailImageItems(slots: DetailGenerationSlot[]) {
    return slots
      .map((slot, index) => {
        const result = generatedDetailImages[slot.id];
        const src = result?.fileUrl || result?.url || "";
        if (result?.status !== "done" || !src) return null;
        return {
          id: slot.id,
          src,
          title: `${String(index + 1).padStart(2, "0")} ${slot.type || "详情图"}`,
        };
      })
      .filter((item): item is { id: string; src: string; title: string } => Boolean(item));
  }

  async function downloadAllDetailImages(slots: DetailGenerationSlot[]) {
    const items = getDoneDetailImageItems(slots);
    await downloadDetailImagesAsFolder(items);
  }

  async function buildLongDetailImageUrl(slots: DetailGenerationSlot[]) {
    const items = getDoneDetailImageItems(slots);
    if (!items.length) throw new Error("暂无可预览的详情图");
    const images = await Promise.all(items.map((item) => loadCanvasImage(item.src)));
    const width = Math.max(...images.map((img) => img.naturalWidth || img.width));
    const heights = images.map((img) => {
      const naturalWidth = img.naturalWidth || img.width || width;
      const naturalHeight = img.naturalHeight || img.height || width;
      return Math.round((naturalHeight * width) / naturalWidth);
    });
    const height = heights.reduce((sum, itemHeight) => sum + itemHeight, 0);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持长图合成");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    let y = 0;
    images.forEach((img, index) => {
      ctx.drawImage(img, 0, y, width, heights[index]);
      y += heights[index];
    });
    return canvas.toDataURL("image/png");
  }

  async function openLongPreview(slots: DetailGenerationSlot[]) {
    const title = `生成结果 ${new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")}`;
    setLongPreview({ open: true, loading: true, title });
    try {
      const url = await buildLongDetailImageUrl(slots);
      setLongPreview({ open: true, loading: false, url, title });
    } catch (err) {
      setLongPreview({
        open: true,
        loading: false,
        title,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function deleteDetailImage(slotId: string) {
    setGeneratedDetailImages((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
    setDetailGenerationSlots((current) => current.filter((slot) => slot.id !== slotId));
    setSelectedDetailImageIds((current) => current.filter((id) => id !== slotId));
    setResizePanel((current) => current?.slotId === slotId ? null : current);
    setDetailActionPanel((current) => current?.slotId === slotId ? null : current);
  }

  function deleteSelectedDetailImages(slots: DetailGenerationSlot[]) {
    const selectedSet = new Set(getSelectableDetailImageIds(slots).filter((id) => selectedDetailImageIds.includes(id)));
    if (!selectedSet.size) return;
    setGeneratedDetailImages((current) => {
      const next = { ...current };
      selectedSet.forEach((id) => delete next[id]);
      return next;
    });
    setDetailGenerationSlots((current) => current.filter((slot) => !selectedSet.has(slot.id)));
    setSelectedDetailImageIds((current) => current.filter((id) => !selectedSet.has(id)));
    setResizePanel((current) => current?.slotId && selectedSet.has(current.slotId) ? null : current);
    setDetailActionPanel((current) => current && selectedSet.has(current.slotId) ? null : current);
  }

  function buildDetailTextEditPrompt(slot: DetailGenerationSlot | undefined, fields: EditableTextField[]) {
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
    const result = slot ? generatedDetailImages[slot.id] : undefined;
    return [
      "你是电商详情图文字编辑智能体。以输入图片为唯一原图，只执行画面中的文字编辑。",
      `图片类型：${slot?.type || "详情图"}`,
      "任务：先定位图片中已有文字，再严格按以下清单处理。",
      "【需要替换】",
      replaceLines.length ? replaceLines.join("\n") : "无",
      "【需要删除】",
      deleteLines.length ? deleteLines.join("\n") : "无",
      "【保持不变】",
      keepLines.length ? keepLines.join("\n") : "无",
      "重要约束：保持商品主体、人物、背景、光影、构图、比例、颜色、材质和详情页版式完全不变。",
      "只允许修改文字内容、删除文字以及对文字区域做自然底图修复；不要新增清单外文字。",
      "替换文字时尽量沿用原来的字体风格、字号、颜色、描边、阴影、位置和排版，必要时只做轻微字号调整，确保不溢出。",
      "删除文字后要自然补齐原位置背景，不留下明显涂抹痕迹。",
      "不得改变商品外观、佩戴关系、人物五官、背景、比例、主体位置或详情页模块结构。",
      `输出比例：${result?.ratio || settings.ratio}`,
    ].join("\n");
  }

  async function regenerateDetailSlotImage(slotId: string, prompt: string, sourceImage: string) {
    const previous = generatedDetailImages[slotId];
    if (!sourceImage) {
      setError("当前图片不可编辑，请先完成生成后再操作");
      return;
    }
    setDetailActionPanel(null);
    setError("");
    setSelectedDetailImageIds((current) => current.filter((id) => id !== slotId));
    setGeneratedDetailImages((current) => ({
      ...current,
      [slotId]: { ...current[slotId], status: "generating" },
    }));
    try {
      const ratio = previous?.ratio || settings.ratio;
      const response = await fetch("/api/product-sets/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          image: sourceImage,
          images: [sourceImage],
          size: "2K",
          ratio,
          watermark: false,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "图片处理失败");
      const imageUrl = data.images?.[0]?.dataUrl || data.images?.[0]?.url;
      if (!imageUrl) throw new Error("处理成功但没有返回图片 URL");
      setGeneratedDetailImages((current) => ({
        ...current,
        [slotId]: { status: "done", url: imageUrl, fileUrl: data.images?.[0]?.url || imageUrl, ratio },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setGeneratedDetailImages((current) => ({
        ...current,
        [slotId]: previous || { status: "failed", error: message },
      }));
      setError(message);
    }
  }

  async function runDetailTextEdit() {
    if (!detailActionPanel || detailActionPanel.kind !== "text") return;
    const sourceImage = getEditableDetailImage(detailActionPanel.slotId);
    const slot = findDetailSlot(detailActionPanel.slotId);
    await regenerateDetailSlotImage(
      detailActionPanel.slotId,
      buildDetailTextEditPrompt(slot, detailActionPanel.fields),
      sourceImage,
    );
  }

  async function runDetailImageRetouch() {
    if (!detailActionPanel || detailActionPanel.kind !== "image") return;
    const sourceImage = getEditableDetailImage(detailActionPanel.slotId);
    const slot = findDetailSlot(detailActionPanel.slotId);
    const slotId = detailActionPanel.slotId;
    const previous = generatedDetailImages[slotId];
    if (!sourceImage) {
      setError("当前图片不可编辑，请先完成生成后再操作");
      return;
    }
    setDetailActionPanel(null);
    setError("");
    setSelectedDetailImageIds((current) => current.filter((id) => id !== slotId));
    setGeneratedDetailImages((current) => ({
      ...current,
      [slotId]: { ...current[slotId], status: "generating" },
    }));
    try {
      const promptResponse = await fetch("/api/product-sets/generate-retouch-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { ...settings, ratio: previous?.ratio || settings.ratio },
          slot: slot ? { id: slot.id, name: slot.name, type: slot.type } : null,
          originalPrompt: slot?.prompt || "",
          userDirection: detailActionPanel.direction,
          originalImage: uploadedImages[0]?.url || "",
          currentImage: sourceImage,
        }),
      });
      const promptData = await promptResponse.json();
      if (!promptResponse.ok || !promptData.ok) throw new Error(promptData.error || "AI改图提示词生成失败");
      const retouchPrompt = String(promptData.prompt || "").trim();
      if (!retouchPrompt) throw new Error("AI改图提示词为空，请重试");
      const referenceImages = promptData.referenceMode === "product_and_current" && uploadedImages[0]?.url
        ? [uploadedImages[0].url, sourceImage]
        : [sourceImage];
      const ratio = previous?.ratio || settings.ratio;
      const imageResponse = await fetch("/api/product-sets/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: retouchPrompt,
          image: sourceImage,
          images: referenceImages,
          size: "2K",
          ratio,
          watermark: false,
        }),
      });
      const imageData = await imageResponse.json();
      if (!imageResponse.ok || !imageData.ok) throw new Error(imageData.error || "图片处理失败");
      const imageUrl = imageData.images?.[0]?.dataUrl || imageData.images?.[0]?.url;
      if (!imageUrl) throw new Error("处理成功但没有返回图片 URL");
      setGeneratedDetailImages((current) => ({
        ...current,
        [slotId]: { status: "done", url: imageUrl, fileUrl: imageData.images?.[0]?.url || imageUrl, ratio },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setGeneratedDetailImages((current) => ({
        ...current,
        [slotId]: previous || { status: "failed", error: message },
      }));
      setError(message);
    }
  }

  function buildDetailSmartResizePrompt(slot: DetailGenerationSlot | undefined, targetId: string) {
    const option = getResizeTargetOption(targetId);
    const targetLabel = option ? `${option.label}${option.sizeLabel ? `（${option.sizeLabel}）` : ""}` : targetId;
    return [
      "你是电商详情图智能改尺寸助手。请基于参考图重新生成一张目标尺寸图片。",
      "",
      "【参考图优先级】",
      "参考图1：用户上传商品原图，只用于校验商品真实结构、颜色、材质、比例、佩戴关系和关键细节，不要把参考图1的原始拍摄构图直接套回结果。",
      "参考图2：当前已生成详情图，是这次改尺寸的核心依据。用户认可这张图的布局、风格、样式、背景方向、商品表现、文案内容和详情页版式。",
      "",
      "【当前图位】",
      `图位名称：${slot?.name || "未命名详情图"}`,
      `图位类型：${slot?.type || "详情图"}`,
      `原始生图提示词：${String(slot?.prompt || "").trim() || "未提供"}`,
      "",
      "【改尺寸目标】",
      `目标尺寸/比例：${targetLabel}`,
      `输出画面语种：${settings.language || "中文"}`,
      "",
      "【必须遵守】",
      "1. 这是尺寸适配，不是重新设计；必须尽量保留参考图2的构图骨架、主体相对位置、视觉风格、色调、光影、材质质感、文字内容、文字层级和装饰元素。",
      "2. 可以为适配新比例做必要的画布扩展、背景自然延展、留白调整、元素轻微缩放或位置微调，但不能把已有详情图推翻重做。",
      "3. 不要使用简单白色填充边框，不要出现大面积空白边，不要把原图生硬居中贴在新画布里。",
      "4. 商品真实结构必须以参考图1校验，不得改变商品款式、颜色、材质、结构连接、佩戴关系或关键细节。",
      "5. 已有文案必须保留原意和主要内容；只允许为适配新画布做轻微排版移动和字号微调，不能新增无关卖点、品牌、参数、促销角标或水印。",
      "6. 输出图片必须在目标比例内完整呈现，主体和文字不得被裁切、遮挡或变形。",
      "",
      "输出：只返回一张完成尺寸适配后的电商详情图。",
    ].join("\n");
  }

  async function runDetailSmartResizeRequest(slotId: string, targetId: string, previous: GeneratedDetailImage | undefined) {
    const src = previous?.url || previous?.fileUrl || "";
    if (!src) return;
    const slot = findDetailSlot(slotId);
    const ratio = getResizeGenerationRatio(targetId);
    const prompt = buildDetailSmartResizePrompt(slot, targetId);
    const referenceImages = uploadedImages[0]?.url ? [uploadedImages[0].url, src] : [src];
    try {
      const response = await fetch("/api/product-sets/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          image: src,
          images: referenceImages,
          size: "2K",
          ratio,
          watermark: false,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "智能改尺寸失败");
      const resizedUrl = data.images?.[0]?.dataUrl || data.images?.[0]?.url;
      if (!resizedUrl) throw new Error("智能改尺寸成功但没有返回图片 URL");
      setGeneratedDetailImages((current) => ({
        ...current,
        [slotId]: { status: "done", url: resizedUrl, fileUrl: data.images?.[0]?.url || resizedUrl, ratio },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setGeneratedDetailImages((current) => ({
        ...current,
        [slotId]: previous || { status: "failed", error: message },
      }));
      setError(message);
    }
  }

  async function resizeDetailImage(slotId: string, targetId = settings.ratio) {
    const previous = generatedDetailImages[slotId];
    const src = previous?.url || previous?.fileUrl || "";
    if (!src) return;
    setGeneratedDetailImages((current) => ({
      ...current,
      [slotId]: { ...current[slotId], status: "generating" },
    }));
    await runDetailSmartResizeRequest(slotId, targetId, previous);
  }

  async function resizeSelectedDetailImages(slots: DetailGenerationSlot[], targetId = settings.ratio) {
    const selectedIds = getSelectableDetailImageIds(slots).filter((id) => selectedDetailImageIds.includes(id));
    const previousById = new Map(selectedIds.map((id) => [id, generatedDetailImages[id]] as const));
    setGeneratedDetailImages((current) => {
      const next = { ...current };
      selectedIds.forEach((id) => {
        if (current[id]) next[id] = { ...current[id], status: "generating" };
      });
      return next;
    });
    for (const id of selectedIds) {
      await runDetailSmartResizeRequest(id, targetId, previousById.get(id));
    }
  }

  async function confirmResizePanel() {
    if (!resizePanel) return;
    const panel = resizePanel;
    const targetId = panel.selectedId;
    setResizePanel(null);
    if (panel.mode === "single" && panel.slotId) {
      await resizeDetailImage(panel.slotId, targetId);
    } else {
      const slots = detailGenerationSlots.length ? detailGenerationSlots : buildDetailGenerationSlots();
      await resizeSelectedDetailImages(slots, targetId);
    }
  }

  async function loadDescriptions(reportValue: string) {
    if (!reportValue) return;
    setLoadingDescriptions(true);
    setError("");
    try {
      const response = await fetch(`/api/product-sets/main-image-descriptions?runId=${encodeURIComponent(reportValue)}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "读取详情图描述失败");
      setDescriptionPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDescriptions(false);
    }
  }

  useEffect(() => {
    if (!selectedProduct) return;
    loadDescriptions(selectedProduct).catch(() => undefined);
  }, [selectedProduct]);

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

  function renderDetailStrategyPanel() {
    const strategyModules = getActiveStrategyModules();
    if (detailStrategyStatus === "generating") {
      return (
        <div className="flex min-h-[520px] flex-col">
          <SectionTitle>详情图工作流</SectionTitle>
          <div className="grid h-[360px] place-items-center rounded-[10px] bg-[#F2F3F5] text-[#A0A7B2]">
            <div className="flex flex-col items-center">
              <div className="mb-3 flex gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#A0A7B2]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#A0A7B2] [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#A0A7B2] [animation-delay:240ms]" />
              </div>
              <div className="text-[13px] font-medium">正在整理信息、规划详情页并生成提示词...</div>
            </div>
          </div>
        </div>
      );
    }

    if (detailStrategyStatus === "error") {
      return (
        <div className="pb-2">
          <SectionTitle>详情图工作流</SectionTitle>
          <div className="rounded-[10px] border border-[#FFD7D7] bg-[#FFF5F5] p-4 text-[13px] font-semibold leading-6 text-[#C03535]">
            <div className="mb-2 flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error || "详情图工作流生成失败，请返回上一步重新生成。"}</span>
            </div>
            <div className="mt-3 text-[12px] font-normal text-[#8A4B4B]">
              请检查商品图、商品信息、AI报告引用和后端模型配置后重试。
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDetailWorkflowStep("form")}
            className="mt-4 h-10 w-full rounded-[8px] bg-[#171A1D] text-[13px] font-semibold text-white transition-colors hover:bg-[#2A2F36]"
          >
            返回上一步
          </button>
        </div>
      );
    }

    return (
      <div className="pb-2">
        <SectionTitle>详情页规划</SectionTitle>
        <div className="mb-5 rounded-[10px] border border-[#E4E7EC] bg-white p-4">
          <div className={`${strategyExpanded ? "" : "max-h-[112px] overflow-hidden"} whitespace-pre-line text-[13px] font-normal leading-7 text-[#171A1D]`}>
            {detailStrategyPlan?.strategyText || "暂无详情页规划，请返回上一步重新生成。"}
          </div>
          <button
            type="button"
            onClick={() => setStrategyExpanded((current) => !current)}
            className="mt-3 flex h-7 w-full items-center justify-center gap-1 text-[12px] font-medium text-[#171A1D]"
          >
            {strategyExpanded ? "收起" : "展开全部"}
            <ChevronDown className={`h-4 w-4 transition-transform ${strategyExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        <SectionTitle>模块提示词</SectionTitle>
        <div className="space-y-3">
          {strategyModules.map((module) => {
            const promptExpanded = expandedPromptTypes.includes(module.type);
            return (
            <div
              key={module.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleModuleDrop(event, module.type)}
              className={`relative rounded-[10px] bg-[#F5F6F8] p-4 ${draggingModule === module.type ? "opacity-60" : ""}`}
            >
              <div className="mb-3 flex items-center gap-2 pr-16">
                <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-5 text-[#171A1D]">{module.type}</h3>
                <button
                  type="button"
                  onClick={() => deleteDetailWorkflowPrompt(module.type)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[#8B949E] transition-colors hover:bg-[#FFF1F0] hover:text-[#F04438]"
                  aria-label={`删除 ${module.type}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={module.prompt || ""}
                onChange={(event) => updateDetailWorkflowPrompt(module.type, event.target.value)}
                rows={promptExpanded ? 14 : 4}
                className={`w-full rounded-[8px] border border-[#E2E7EF] bg-white p-3 pr-4 text-[12px] font-normal leading-6 text-[#344054] outline-none focus:border-[#4690FF] ${promptExpanded ? "resize-y" : "resize-none overflow-hidden"}`}
                placeholder="暂无提示词，请返回上一步重新生成。"
              />
              <button
                type="button"
                onClick={() => togglePromptExpanded(module.type)}
                className="mt-2 flex h-7 w-full items-center justify-center gap-1 text-[12px] font-medium text-[#171A1D]"
              >
                {promptExpanded ? "收起" : "展开查看更多"}
                <ChevronDown className={`h-4 w-4 transition-transform ${promptExpanded ? "rotate-180" : ""}`} />
              </button>
              <span
                draggable
                onDragStart={() => setDraggingModule(module.type)}
                onDragEnd={() => setDraggingModule(null)}
                className="absolute right-3 top-4 grid h-7 w-7 cursor-grab place-items-center rounded-[8px] text-[#A0A7B2] hover:bg-[#ECEFF4]"
                aria-label={`拖拽调整 ${module.type} 顺序`}
              >
                <GripVertical className="h-5 w-5" />
              </span>
            </div>
            );
          })}
          {!strategyModules.length && (
            <div className="rounded-[10px] bg-[#F5F6F8] p-4 text-[13px] font-medium text-[#8B949E]">
              暂无模块提示词，请返回上一步重新生成。
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderDetailGenerationCard(slot: DetailGenerationSlot, index: number) {
    const result = generatedDetailImages[slot.id];
    const title = `${String(index + 1).padStart(2, "0")} ${slot.type}`;
    const src = result?.url || "";
    const isDone = result?.status === "done" && Boolean(src);
    const isSelected = selectedDetailImageIds.includes(slot.id);
    const isActionPanelOpen = detailActionPanel?.slotId === slot.id;
    return (
      <div className={`group relative aspect-square overflow-hidden rounded-[8px] bg-white shadow-[0_1px_0_rgba(15,23,41,.04)] ${isSelected ? "ring-2 ring-[#171A1D]" : ""}`}>
        {isDone ? (
          <>
            <img
              src={src}
              alt={title}
              className="h-full w-full cursor-zoom-in bg-white object-contain"
              onClick={() => setLightbox({ src, title })}
              onError={() => {
                setGeneratedDetailImages((current) => ({
                  ...current,
                  [slot.id]: { ...current[slot.id], status: "failed", error: "图片文件已生成，但浏览器加载失败，请重新生成" },
                }));
              }}
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleDetailImageSelection(slot.id);
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
                onClick={(event) => {
                  event.stopPropagation();
                  downloadImageToLocal(result?.fileUrl || src, title).catch(() => undefined);
                }}
                className="grid h-8 w-8 place-items-center rounded-[8px] bg-white/90 text-[#171A1D] shadow-sm transition-colors hover:bg-white"
                aria-label={`下载 ${title}`}
              >
                <Download className="h-4 w-4" />
              </button>
              <div className="group/more relative">
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#171A1D] text-white shadow-sm transition-colors hover:bg-black"
                  aria-label={`${title} 更多操作`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                <div className="pointer-events-none absolute right-0 top-8 w-[140px] rounded-[10px] bg-white p-1.5 text-[13px] font-semibold text-[#171A1D] opacity-0 shadow-[0_12px_28px_rgba(15,23,41,.18)] transition-opacity group-hover/more:pointer-events-auto group-hover/more:opacity-100 group-focus-within/more:pointer-events-auto group-focus-within/more:opacity-100">
                  <button
                    type="button"
                    onClick={(event) => openResizePanel(event, "single", slot.id, "left")}
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
                      deleteDetailImage(slot.id);
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
                onClick={(event) => openDetailImagePanel(event, slot, title)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[#171A1D]/72 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-[#171A1D]/84"
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI改图
              </button>
              <button
                type="button"
                onClick={(event) => openDetailTextPanel(event, slot, title)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[#171A1D]/72 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-[#171A1D]/84"
              >
                <PenLine className="h-3.5 w-3.5" />
                编辑文字
              </button>
            </div>
          </>
        ) : result?.status === "failed" ? (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-[13px] font-semibold leading-6 text-[#C03535]">
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
        <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-[6px] bg-black/35 px-2 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-[2px]">
          {slot.type}
        </span>
      </div>
    );
  }

  function renderDetailGenerationResults() {
    const slots = detailGenerationSlots.length ? detailGenerationSlots : buildDetailGenerationSlots();
    const selectableIds = getSelectableDetailImageIds(slots);
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedDetailImageIds.includes(id));
    const someSelected = selectableIds.some((id) => selectedDetailImageIds.includes(id));
    const selectedCount = selectedDetailImageIds.filter((id) => selectableIds.includes(id)).length;
    const doneItems = getDoneDetailImageItems(slots);
    return (
      <div className="w-full">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-left text-[18px] font-bold text-[#171A1D]">生成结果：</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleAllDetailImages(slots)}
              disabled={!selectableIds.length}
              className={`flex items-center gap-2 text-[13px] font-medium transition-colors ${selectableIds.length ? "text-[#5F6B7A] hover:text-[#171A1D]" : "cursor-not-allowed text-[#A0A7B2]"}`}
              aria-pressed={allSelected}
            >
              <span className={`grid h-4 w-4 place-items-center rounded-[4px] border ${someSelected ? "border-[#171A1D] bg-[#171A1D] text-white" : "border-[#171A1D] bg-white text-transparent"}`}>
                {allSelected ? <Check className="h-3 w-3" /> : someSelected ? <Minus className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              </span>
              全选
            </button>
            <button
              type="button"
              onClick={() => openLongPreview(slots).catch(() => undefined)}
              disabled={!doneItems.length}
              className={`flex h-9 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold shadow-[0_1px_0_rgba(15,23,41,.06)] transition-colors ${doneItems.length ? "text-[#171A1D] hover:bg-[#F5F6F8]" : "cursor-not-allowed text-[#A0A7B2]"}`}
            >
              预览长图
            </button>
            {selectedCount > 0 && (
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
                  onClick={() => downloadSelectedDetailImages(slots).catch(() => undefined)}
                  className="flex h-9 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-[#171A1D] shadow-[0_1px_0_rgba(15,23,41,.06)] transition-colors hover:bg-[#F5F6F8]"
                >
                  <Download className="h-4 w-4" />
                  批量下载
                </button>
                <button
                  type="button"
                  onClick={() => deleteSelectedDetailImages(slots)}
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
            <img src={uploadedImages[0]?.url || ""} alt="原图" className="h-full w-full object-contain" />
            <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-[6px] bg-black/35 px-2 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-[2px]">
              原图
            </span>
          </div>
          {slots.map((slot, index) => renderDetailGenerationCard(slot, index))}
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

  const strategyModuleCount = getActiveStrategyModules().length || normalizeSelectedModules(checked).length;

  return (
    <div className="relative flex h-full bg-[#F2F4F7]">
      <div className="w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pb-28 pt-5 custom-scrollbar">
        {detailWorkflowStep === "strategy" ? renderDetailStrategyPanel() : (
        <>
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
            {uploadedImages.length < 6 && (
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
            <p className="text-[12px] font-normal text-[#8B949E]">同一产品，最多6张。</p>
          </div>
        )}

        {error && (
          <div className="mb-5 flex gap-2 rounded-[8px] border border-[#FFD7D7] bg-[#FFF5F5] p-3 text-[13px] font-semibold text-[#C03535]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AIReportSelector value={selectedProduct} onChange={(runId, report) => {
          setSelectedProduct(runId);
          setSelectedReportOption(report);
          if (!runId) setDescriptionPayload(null);
          setError("");
          invalidateDetailStrategy();
        }} />
        {selectedProduct && (
          <button
            type="button"
            onClick={() => {
              setSelectedProduct("");
              setSelectedReportOption(null);
              setDescriptionPayload(null);
              setError("");
              invalidateDetailStrategy();
            }}
            className="-mt-2 mb-4 h-8 w-full rounded-[8px] bg-[#F2F3F5] text-[12px] font-semibold text-[#5F6B7A] transition-colors hover:bg-[#E8EAED]"
          >
            不引用AI报告
          </button>
        )}

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
            type="button"
            onClick={() => handleAiHelp().catch(() => undefined)}
            disabled={aiWriting || !uploadedImages.length}
            className="mb-4 flex h-7 items-center gap-1 rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiWriting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
            {aiWriting ? "帮写中" : "AI 帮写"}
          </button>
        </div>
        <textarea
          className="mb-4 h-[114px] w-full resize-none rounded-[8px] border border-[#DDE3EC] bg-white p-3 text-[12px] font-normal leading-[20px] text-[#5F6B7A] outline-none focus:border-[#4690FF]"
          value={detailGenerationText}
          onChange={(event) => {
            setDetailGenerationText(event.target.value);
            invalidateDetailStrategy();
          }}
          placeholder={`建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.具体参数`}
        />
        {reportSellingPoints.length ? (
          <div className="mb-4 rounded-[8px] border border-[#e4ebf5] bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[12px] font-bold text-[#344054]">已回传报告卖点</div>
              <span className="rounded-full bg-[#eef6ff] px-2 py-0.5 text-[11px] font-bold text-[#3388ff]">{reportSellingPoints.length} 条</span>
            </div>
            <div className="space-y-2">
              {reportSellingPoints.slice(0, 4).map((item, index) => (
                <div key={`${item.title || "point"}-${index}`} className="rounded-[8px] bg-[#f8fafc] p-2.5 text-[12px] leading-5 text-[#667085]">
                  <div className="font-bold text-[#0A1B39]">{index + 1}. {item.title || "报告卖点"}</div>
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
            正在读取AI报告引用信息
          </div>
        ) : null}

        <SectionTitle help>包含模块（多选）</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {MODULES.map(([module, desc]) => (
            <button
              key={module}
              onClick={() => toggleModule(module)}
              className="rounded-[8px] bg-[#F2F3F5] p-3 text-left"
            >
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#171A1D]">
                <span className={`grid h-4 w-4 place-items-center rounded-[4px] ${checked.includes(module) ? "bg-[#1683FF] text-white" : "border border-[#D7DCE3] bg-white text-transparent"}`}>
                  <Check className="h-3 w-3" />
                </span>
                {module}
              </div>
              <p className="mt-1 text-[12px] font-normal text-[#8B949E]">{desc}</p>
            </button>
          ))}
        </div>
        </>
        )}
      </div>

      <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#EEF1F5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}>
        {detailWorkflowStep === "strategy" ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDetailWorkflowStep("form")}
              disabled={generatingDetail || detailStrategyStatus === "generating"}
              className="h-10 w-[96px] rounded-[8px] bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#E8EAED] disabled:cursor-not-allowed disabled:opacity-60"
            >
              上一步
            </button>
            <button
              type="button"
              onClick={() => generateDetailImage().catch(() => undefined)}
              disabled={detailStrategyStatus !== "ready" || !uploadedImages.length || generatingDetail}
              className={`h-10 flex-1 rounded-[8px] text-[13px] font-semibold text-white ${detailStrategyStatus === "ready" && uploadedImages.length && !generatingDetail ? "bg-[#171A1D] hover:bg-[#2A2F36]" : "bg-[#C4C6CA]"}`}
            >
              {generatingDetail ? "正在生成..." : `生成详情图（${strategyModuleCount}张）`}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => generateDetailStrategyPlan().catch(() => undefined)}
            disabled={!uploadedImages.length || detailStrategyStatus === "generating" || generatingDetail}
            className={`h-10 w-full rounded-[8px] text-[13px] font-semibold text-white ${uploadedImages.length && detailStrategyStatus !== "generating" && !generatingDetail ? "bg-[#171A1D] hover:bg-[#2A2F36]" : "bg-[#505154]"}`}
          >
            {detailStrategyStatus === "generating" ? "生成中..." : uploadedImages.length ? "生成详情页规划和提示词" : "请上传产品图"}
          </button>
        )}
      </div>

      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className={`flex min-h-full ${resultViewActive ? "items-start justify-start" : "items-center justify-center"}`}>
          <div className={`w-full pb-10 text-center ${resultViewActive ? "max-w-none" : "max-w-[980px]"}`}>
            {!resultViewActive && (
              <>
                <h1 className="text-[32px] font-bold leading-tight text-[#171A1D]">详情图</h1>
                <p className="mt-3 text-[14px] font-normal leading-6 text-[#5F6B7A]">
                  上传商品图，AI 即刻生成 <span className="font-semibold text-[#1683FF]">符合多电商平台规范</span> 的专业详情图。
                </p>
              </>
            )}

            <div className={resultViewActive ? "mt-0" : "mt-12"}>
            {resultViewActive ? renderDetailGenerationResults() : (
              <div className="mx-auto flex h-[444px] w-[792px] items-center gap-4 rounded-[20px] bg-white p-6 shadow-[0_18px_40px_rgba(31,37,45,.06)]">
              <>
              <div className="grid h-[396px] w-[123px] shrink-0 grid-rows-3 gap-1.5 overflow-hidden rounded-[18px]">
                {PRODUCT_IMAGES.map((item, index) => (
                  <div key={item.alt} className="relative grid h-[128px] w-[123px] place-items-center bg-[#F6F7FA]">
                    <img src={item.src} alt={item.alt} className="block h-full w-full object-contain p-3" />
                    {index === PRODUCT_IMAGES.length - 1 && (
                      <span className="absolute bottom-2 left-2 right-2 rounded-full bg-black/35 py-1.5 text-[12px] font-semibold text-white">上传产品图</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex h-[396px] w-10 shrink-0 items-center justify-center">
                <img src={suiteArrow} alt="" className="block w-[40px] shrink-0" />
              </div>

              <div className="relative h-[396px] w-[111px] shrink-0 overflow-hidden rounded-[18px]">
                <img src={detailLong} alt="蓝色耳机电商详情长图" className="block h-full w-full object-contain" />
                <span className="absolute bottom-2 left-2 right-2 rounded-full bg-black/45 py-1.5 text-[12px] font-semibold text-white">生成电商长图</span>
              </div>

              <div className="grid h-[396px] w-[420px] shrink-0 grid-cols-2 grid-rows-3 gap-1.5 overflow-hidden rounded-[18px]">
                {DETAIL_BANNERS.map((item, index) => (
                  <div key={item.alt} className="relative h-[128px] w-[207px] overflow-hidden bg-[#0A2945]">
                    <img src={item.src} alt={item.alt} className="block h-full w-full object-contain" />
                    {index === DETAIL_BANNERS.length - 1 && (
                      <span className="absolute bottom-2 left-2 right-2 rounded-full bg-black/50 py-1.5 text-[12px] font-semibold text-white">符合多电商平台规范</span>
                    )}
                  </div>
                ))}
              </div>
              </>
              </div>
            )}
            </div>
          </div>
        </div>
      </main>

      <button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md">?</button>

      <AiHelpPopover
        open={aiHelpOpen}
        position={aiHelpPosition}
        fallbackPosition={{ top: 420, left: expanded ? 560 : 392 }}
        status={aiHelpStatus}
        text={aiHelpText}
        visibleText={aiHelpVisibleText}
        error={aiHelpError}
        retrying={aiWriting}
        onClose={() => setAiHelpOpen(false)}
        onRetry={() => handleAiHelp().catch(() => undefined)}
        onConfirm={confirmAiHelp}
      />

      {renderResizePanel()}

      {detailActionPanel && (
        <div
          className="fixed z-40 w-[300px] rounded-[8px] bg-white p-4 shadow-[0_16px_48px_rgba(15,23,42,0.18)] ring-1 ring-[#E6EAF0]"
          style={{ top: detailActionPanel.top, left: detailActionPanel.left }}
        >
          {detailActionPanel.kind === "text" ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#171A1D]">编辑文字</h3>
                <button
                  type="button"
                  onClick={() => setDetailActionPanel(null)}
                  className="grid h-6 w-6 place-items-center rounded-full text-[#8B949E] transition-colors hover:bg-[#F2F3F5] hover:text-[#171A1D]"
                  aria-label="关闭编辑文字"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {detailActionPanel.loading ? (
                <div className="flex h-[132px] flex-col items-center justify-center rounded-[8px] border border-[#E6EAF0] bg-white text-[#8B949E]">
                  <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                  <div className="text-[13px] font-medium">正在识别图片文案...</div>
                </div>
              ) : detailActionPanel.error ? (
                <div className="flex min-h-[96px] items-center justify-center rounded-[8px] border border-[#F6C8C8] bg-[#FFF4F4] p-3 text-center text-[12px] font-medium leading-5 text-[#C03535]">
                  {detailActionPanel.error}
                </div>
              ) : detailActionPanel.fields.some((field) => !field.removed) ? (
                <div className="space-y-2">
                  {detailActionPanel.fields.filter((field) => !field.removed).map((field) => (
                    <div key={field.id} className="flex h-10 items-center gap-2 rounded-[8px] border border-[#E6EAF0] bg-[#F8F9FB] px-3 focus-within:border-[#4690ff] focus-within:bg-white">
                      <input
                        value={field.value}
                        onChange={(event) => updateDetailTextPanelField(field.id, event.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#171A1D] outline-none"
                        placeholder="输入图片文案"
                      />
                      <button
                        type="button"
                        onClick={() => removeDetailTextPanelField(field.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[#8B949E] transition-colors hover:bg-[#ECEFF4] hover:text-[#171A1D]"
                        aria-label="删除这条文案"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : detailActionPanel.originalCount > 0 ? (
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
                  onClick={() => setDetailActionPanel(null)}
                  className="h-9 rounded-[8px] bg-[#F2F3F5] text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#ECEFF4]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => runDetailTextEdit().catch(() => undefined)}
                  disabled={generatedDetailImages[detailActionPanel.slotId]?.status === "generating" || detailActionPanel.loading || Boolean(detailActionPanel.error) || detailActionPanel.originalCount === 0}
                  className="h-9 rounded-[8px] bg-[#8FBCFF] text-[13px] font-semibold text-white transition-colors hover:bg-[#6FA8FF] disabled:cursor-not-allowed disabled:bg-[#C4C6CA]"
                >
                  {generatedDetailImages[detailActionPanel.slotId]?.status === "generating" ? "处理中..." : detailActionPanel.fields.some((field) => !field.removed && field.value.trim()) ? "确认改字 · 15" : "删除文字 · 15"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#171A1D]">输入微调方向（选填）</h3>
                <button
                  type="button"
                  onClick={() => setDetailActionPanel(null)}
                  className="grid h-6 w-6 place-items-center rounded-full text-[#8B949E] transition-colors hover:bg-[#F2F3F5] hover:text-[#171A1D]"
                  aria-label="关闭 AI 改图"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea
                value={detailActionPanel.direction}
                onChange={(event) => updateDetailImagePanelDirection(event.target.value)}
                className="h-[132px] w-full resize-none rounded-[8px] border border-[#E6EAF0] bg-white p-3 text-[12px] font-normal leading-5 text-[#171A1D] outline-none focus:border-[#4690ff]"
                placeholder="输入调整要求（选填，空着将默认重绘）。如：商品向左移动一点，换成浅灰色背景..."
              />
              <p className="mt-2 text-[12px] font-normal text-[#8B949E]">重新生成将消耗 15 点。</p>
              <button
                type="button"
                onClick={() => runDetailImageRetouch().catch(() => undefined)}
                disabled={generatedDetailImages[detailActionPanel.slotId]?.status === "generating"}
                className="mt-3 h-9 w-full rounded-[8px] bg-[#171A1D] text-[13px] font-semibold text-white transition-colors hover:bg-[#2A2F36] disabled:cursor-not-allowed disabled:bg-[#C4C6CA]"
              >
                {generatedDetailImages[detailActionPanel.slotId]?.status === "generating" ? "生成中..." : "重新生成 · 15"}
              </button>
            </>
          )}
        </div>
      )}

      {longPreview.open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-8"
          onClick={() => setLongPreview({ open: false, loading: false, title: "" })}
        >
          <div
            className="flex max-h-[86vh] w-[78vw] max-w-[1280px] flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_24px_70px_rgba(0,0,0,.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[#EEF0F3] px-5">
              <h3 className="text-[16px] font-semibold text-[#2A2F36]">{longPreview.title || "生成结果"}</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => longPreview.url && downloadImageToLocal(longPreview.url, "详情长图").catch(() => undefined)}
                  disabled={!longPreview.url || longPreview.loading}
                  className="flex h-9 items-center gap-2 rounded-[8px] bg-[#F5F6F8] px-4 text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#ECEFF4] disabled:cursor-not-allowed disabled:text-[#A0A7B2]"
                >
                  <Download className="h-4 w-4" />
                  下载长图
                </button>
                <button
                  type="button"
                  onClick={() => downloadAllDetailImages(detailGenerationSlots).catch(() => undefined)}
                  disabled={!getDoneDetailImageItems(detailGenerationSlots).length}
                  className="flex h-9 items-center gap-2 rounded-[8px] bg-[#F5F6F8] px-4 text-[13px] font-semibold text-[#171A1D] transition-colors hover:bg-[#ECEFF4] disabled:cursor-not-allowed disabled:text-[#A0A7B2]"
                >
                  <Download className="h-4 w-4" />
                  下载全部图片
                </button>
                <button
                  type="button"
                  onClick={() => setLongPreview({ open: false, loading: false, title: "" })}
                  className="grid h-9 w-9 place-items-center rounded-full text-[#8B949E] transition-colors hover:bg-[#F2F3F5] hover:text-[#171A1D]"
                  aria-label="关闭长图预览"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-6">
              {longPreview.loading ? (
                <div className="flex h-[420px] flex-col items-center justify-center rounded-[8px] bg-[#F5F6F8] text-[#8B949E]">
                  <Loader2 className="mb-3 h-6 w-6 animate-spin" />
                  <div className="text-[13px] font-medium">正在合成长图...</div>
                </div>
              ) : longPreview.error ? (
                <div className="flex h-[320px] items-center justify-center rounded-[8px] bg-[#FFF4F4] p-6 text-center text-[13px] font-semibold leading-6 text-[#C03535]">
                  {longPreview.error}
                </div>
              ) : longPreview.url ? (
                <img src={longPreview.url} alt="详情长图预览" className="mx-auto block w-full max-w-[980px] bg-white" />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-8">
          <div className="absolute left-8 top-7 text-[14px] font-semibold text-white">{lightbox.title}</div>
          <button
            type="button"
            onClick={() => downloadImageToLocal(lightbox.src, lightbox.title).catch(() => undefined)}
            className="absolute right-20 top-5 flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-[#0A1B39] shadow-sm"
          >
            <Download className="h-4 w-4" />
            保存到本地
          </button>
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-8 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label="关闭预览"
          >
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox.src} alt={lightbox.title} className="max-h-[86vh] max-w-[86vw] rounded-[8px] bg-white object-contain" />
        </div>
      )}
    </div>
  );
}
