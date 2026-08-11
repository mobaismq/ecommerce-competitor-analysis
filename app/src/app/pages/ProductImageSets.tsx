import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, ChevronDown, CircleHelp, Download, Lightbulb, Loader2, Minus, Plus, Upload, X, ZoomIn } from "lucide-react";
import mainHeadphone from "@/imports/image-9.png";
import sceneDisplay from "@/imports/image-10.png";
import modelScene from "@/imports/image-11.png";
import detailExplain from "@/imports/image-12.png";
import sellingPoint from "@/imports/image-13.png";
import suiteArrow from "@/imports/箭头.svg";
import { useSidebar } from "@/app/components/SidebarContext";

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

function SectionTitle({ children, help = false }: { children: ReactNode; help?: boolean }) {
  return <h2 className="mb-4 flex items-center gap-1 text-[14px] font-semibold text-[#171A1D]">{children}{help && <CircleHelp className="h-3.5 w-3.5 text-[#8B949E]" />}</h2>;
}

const GENERATION_OPTIONS = {
  platform: ["淘宝天猫1688", "淘宝", "天猫", "抖音", "京东", "拼多多", "亚马逊", "TikTok", "速卖通", "Temu", "Shein", "Shopee", "Lazada", "eBay", "Walmart", "Shopify", "独立站"],
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

export function ProductImageSets() {
  const { expanded } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState("智能匹配");
  const [customSuiteCounts, setCustomSuiteCounts] = useState<Record<CustomSuiteTypeKey, number>>(DEFAULT_CUSTOM_SUITE_COUNTS);
  const [copy, setCopy] = useState(false);
  const [listingCopy, setListingCopy] = useState(true);
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [settings, setSettings] = useState({ platform: "淘宝天猫1688", country: "中国", language: "中文", ratio: "1:1" });
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
  const [uploadedImages, setUploadedImages] = useState<UploadedProductImage[]>([]);
  const [expandingPrompts, setExpandingPrompts] = useState(false);
  const [promptExpansion, setPromptExpansion] = useState<PromptExpansionPayload | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>(DEFAULT_SLOT_IDS);
  const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImageResult>>({});
  const [aiMainPrompt, setAiMainPrompt] = useState("");
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
  const selectedReport = selectedReportOption || suiteProducts.find((item) => item.value === selectedProduct) || null;
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
      setError(selectedFiles.length > availableSlots ? "同一产品最多上传 3 张图片，已保留前 3 张。" : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function removeUploadedImage(id: string) {
    setUploadedImages((current) => current.filter((item) => item.id !== id));
    setGeneratedImages({});
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
    const queue = expandedPrompts.length
      ? expandedPrompts.filter((item) => selectedPromptIds.includes(item.id))
      : DEFAULT_PROMPT_PREVIEWS.map((item) => ({ ...item, prompt: generationText }));
    if (!queue.length) {
      setError("请至少选择一张要生成的图片");
      return;
    }
    if (queue.some((item) => !String(item.prompt || generationText).trim())) {
      setError("请选择或填写相关生成主图的提示词");
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
    if (!uploadedImage) {
      setError("请先上传商品原图，再使用 AI 帮写");
      return;
    }
    if (!selectedPromptIds.length) {
      setError("请先勾选需要生成提示词的图位");
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
          selectedSlots: DEFAULT_PROMPT_PREVIEWS
            .filter((item) => selectedPromptIds.includes(item.id))
            .map((item) => ({ id: item.id, name: item.name, type: item.type })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "扩写提示词失败");
      const prompts: ExpandedPrompt[] = data.prompts || [];
      const information = String(data.information || data.text || "").trim();
      setPromptExpansion(prompts.length ? data : null);
      setGeneratedImages({});
      if (prompts.length) {
        setSelectedPromptId(prompts[0].id);
      }
      if (information) {
        setGenerationText(information);
      }
      const firstPrompt = prompts[0];
      if (!information && firstPrompt?.prompt) {
        setSelectedPromptId(firstPrompt.id);
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
            onClick={expandPrompts}
            disabled={expandingPrompts}
            className="mb-4 flex h-7 items-center gap-1 rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm"
          >
            {expandingPrompts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
            {expandingPrompts ? "扩写中" : "AI 帮写"}
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
        <div className="flex min-h-full items-center justify-center">
          <div className="w-full max-w-[980px] pb-10 text-center">
            <h1 className="text-[32px] font-bold leading-tight text-[#171A1D]">商品主图</h1>
            <p className="mt-3 text-[14px] font-normal leading-6 text-[#5F6B7A]">
              上传商品图，AI 即刻生成 <span className="font-semibold text-[#1683FF]">符合多电商平台规范</span> 的高转化率商品主图。
            </p>
            <div className="mt-12">
              {renderSuitePreview()}
            </div>
          </div>
        </div>
      </div>
      <button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md">?</button>

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
